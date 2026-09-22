import { z } from "zod";
import {
  APPROVED_GMAIL_MAILBOX,
  ThreadSnapshotSchema,
  type ThreadSnapshot,
} from "./gmail-client.js";
import {
  deriveThreadState,
  type ThreadCommitment,
  type ThreadState,
} from "./thread-state.js";
import {
  CommitmentStorageSchema,
  type CommitmentStorageRecord,
} from "../../domain/commitment-schema.js";

export interface GmailChronologyWindow {
  readonly from: string;
  readonly to: string;
}

const timestamp = z.string().datetime({ offset: true });
const maximumWindowMilliseconds = 30 * 24 * 60 * 60 * 1_000;

const parseTime = (value: string, name: string): number => {
  timestamp.parse(value);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${name} timestamp.`);
  return parsed;
};

function parseWindow(
  rawWindow: GmailChronologyWindow,
  now: string,
): {
  readonly from: number;
  readonly to: number;
  readonly now: number;
} {
  const from = parseTime(rawWindow.from, "window start");
  const to = parseTime(rawWindow.to, "window end");
  const nowAt = parseTime(now, "current");
  if (from >= to || to > nowAt || to - from > maximumWindowMilliseconds) {
    throw new Error("Invalid bounded Gmail chronology window.");
  }
  return { from, to, now: nowAt };
}

function assertUniqueMessageIds(
  messages: readonly { readonly id: string }[],
): void {
  const ids = new Set<string>();
  for (const message of messages) {
    if (ids.has(message.id)) {
      throw new Error("Duplicate Gmail message ID in bounded chronology.");
    }
    ids.add(message.id);
  }
}

function assertUniqueRecords(
  records: readonly CommitmentStorageRecord[],
): void {
  const commitmentIds = new Set<string>();
  const evidenceIds = new Set<string>();
  for (const record of records) {
    if (commitmentIds.has(record.commitment_id)) {
      throw new Error("Duplicate commitment ID in bounded chronology.");
    }
    if (evidenceIds.has(record.source_evidence_id)) {
      throw new Error(
        "Duplicate commitment evidence ID in bounded chronology.",
      );
    }
    commitmentIds.add(record.commitment_id);
    evidenceIds.add(record.source_evidence_id);
  }
}

const isOutbound = (message: {
  readonly sender: string;
  readonly recipients: readonly string[];
}): boolean =>
  message.sender.toLowerCase() === APPROVED_GMAIL_MAILBOX &&
  !message.recipients.some(
    (recipient) => recipient.toLowerCase() === APPROVED_GMAIL_MAILBOX,
  );

const asThreadCommitment = (
  record: CommitmentStorageRecord,
): ThreadCommitment => ({
  messageId: record.source_message_id,
  status: record.status,
  deadlineAt: record.deadline_at,
});

function latestSnapshotState(
  snapshot: ReturnType<typeof ThreadSnapshotSchema.parse>,
  hasOpenPromise: boolean,
  hasOverdueUnresolvedPromise: boolean,
): ThreadState {
  const latest = [...snapshot.messages].sort(
    (left, right) =>
      right.internalDate - left.internalDate || right.id.localeCompare(left.id),
  )[0];
  return {
    excluded: false,
    waitingOn: hasOverdueUnresolvedPromise ? "me" : "unknown",
    latestMessageId: latest.id,
    latestMessageAt: new Date(latest.internalDate).toISOString(),
    category: "other",
    draftRisk: "no_draft",
    summary:
      "Thread chronology is excluded or predates the bounded scan; review the open obligation.",
    confidence: 0,
    hasOpenPromise,
    hasOverdueUnresolvedPromise,
  };
}

/**
 * Combines a bounded Gmail snapshot with persisted commitment evidence.
 * Older evidence may affect review state but is never fabricated as a message.
 */
export function deriveBoundedThreadState(
  rawSnapshot: ThreadSnapshot,
  rawRecords: readonly CommitmentStorageRecord[],
  window: GmailChronologyWindow,
  now: string,
): ThreadState {
  const snapshot = ThreadSnapshotSchema.parse(rawSnapshot);
  if (snapshot.mailbox.toLowerCase() !== APPROVED_GMAIL_MAILBOX) {
    throw new Error("Snapshot mailbox is outside the approved Gmail scope.");
  }
  const bounds = parseWindow(window, now);
  assertUniqueMessageIds(snapshot.messages);
  for (const message of snapshot.messages) {
    if (
      message.internalDate < bounds.from ||
      message.internalDate >= bounds.to
    ) {
      throw new Error("Snapshot message is outside the bounded Gmail window.");
    }
  }

  const records = z.array(CommitmentStorageSchema).parse(rawRecords);
  assertUniqueRecords(records);
  for (const record of records) {
    if (record.source_thread_id !== snapshot.threadId) {
      throw new Error(
        "Commitment source thread does not match the Gmail snapshot.",
      );
    }
  }

  const messageById = new Map(
    snapshot.messages.map((message) => [message.id, message]),
  );
  const inWindow: CommitmentStorageRecord[] = [];
  const older: CommitmentStorageRecord[] = [];
  for (const record of records) {
    const observedAt = Date.parse(record.observed_at);
    if (observedAt >= bounds.to) {
      throw new Error(
        "Commitment observation is after the bounded Gmail window.",
      );
    }
    if (observedAt < bounds.from) {
      older.push(record);
      continue;
    }
    const message = messageById.get(record.source_message_id);
    if (!message) {
      throw new Error(
        "In-window commitment source message is missing from the snapshot.",
      );
    }
    if (!isOutbound(message)) {
      throw new Error(
        "In-window commitment must reference an outbound Gmail message.",
      );
    }
    if (message.internalDate !== observedAt) {
      throw new Error(
        "In-window commitment observed_at does not match its source message.",
      );
    }
    inWindow.push(record);
  }

  const state = deriveThreadState(
    snapshot,
    inWindow.map(asThreadCommitment),
    now,
  );
  const allOpen = records.filter((record) => record.status === "open");
  const olderOpen = older.filter((record) => record.status === "open");
  const olderOverdue = olderOpen.some(
    (record) =>
      record.deadline_at !== null &&
      Date.parse(record.deadline_at) < bounds.now,
  );

  if (olderOpen.length > 0) {
    return latestSnapshotState(
      snapshot,
      true,
      state.hasOverdueUnresolvedPromise || olderOverdue,
    );
  }
  if (state.excluded && allOpen.length > 0) {
    const overdue = allOpen.some(
      (record) =>
        record.deadline_at !== null &&
        Date.parse(record.deadline_at) < bounds.now,
    );
    return latestSnapshotState(snapshot, true, overdue);
  }
  return state;
}
