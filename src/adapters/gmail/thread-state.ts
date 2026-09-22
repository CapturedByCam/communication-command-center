import { z } from "zod";
import { deriveWaitingOn } from "../../domain/state-machine.js";
import type { Category, DraftRisk, WaitingOn } from "../../domain/types.js";
import {
  APPROVED_GMAIL_MAILBOX,
  ThreadSnapshotSchema,
  type ThreadSnapshot,
} from "./gmail-client.js";

const ThreadCommitmentSchema = z
  .object({
    messageId: z.string().min(1).max(512),
    status: z.enum(["open", "fulfilled"]),
    deadlineAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export type ThreadCommitment = z.infer<typeof ThreadCommitmentSchema>;

export interface ThreadState {
  excluded: boolean;
  waitingOn: WaitingOn;
  latestMessageId: string | null;
  latestMessageAt: string | null;
  category: Category;
  draftRisk: DraftRisk;
  summary: string;
  confidence: number;
  hasOpenPromise: boolean;
  hasOverdueUnresolvedPromise: boolean;
}

type Message = ThreadSnapshot["messages"][number];

const isOwnAddress = (address: string): boolean =>
  address.toLowerCase() === APPROVED_GMAIL_MAILBOX;

const messageDirection = (message: Message): "inbound" | "outbound" | null => {
  const senderIsOwn = isOwnAddress(message.sender);
  const recipientIsOwn = message.recipients.some(isOwnAddress);
  if (senderIsOwn === recipientIsOwn) {
    return null;
  }
  return senderIsOwn ? "outbound" : "inbound";
};

const isExcluded = (message: Message): boolean =>
  message.automated ||
  message.bulk ||
  message.receipt ||
  /^no[-_.]?reply@/i.test(message.sender) ||
  message.labels.some((label) => /^(spam|draft)$/i.test(label));

const equalMessage = (left: Message, right: Message): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

function assertNoConflictingDuplicates(
  messages: readonly Message[],
): Message[] {
  const byId = new Map<string, Message>();
  for (const message of messages) {
    const prior = byId.get(message.id);
    if (prior && !equalMessage(prior, message)) {
      throw new Error("Conflicting duplicate Gmail message IDs.");
    }
    if (!prior) {
      byId.set(message.id, message);
    }
  }
  return [...byId.values()];
}

const ambiguousState = (
  latestMessageAt: string | null,
  hasOpenPromise: boolean,
  hasOverdueUnresolvedPromise: boolean,
): ThreadState => ({
  excluded: false,
  waitingOn: hasOverdueUnresolvedPromise ? "me" : "unknown",
  latestMessageId: null,
  latestMessageAt,
  category: "other",
  draftRisk: "no_draft",
  summary: "Latest message chronology is ambiguous.",
  confidence: 0,
  hasOpenPromise,
  hasOverdueUnresolvedPromise,
});

/** Derives deterministic chronology and waiting state from a validated plain snapshot. */
export function deriveThreadState(
  rawSnapshot: ThreadSnapshot,
  rawCommitments: ThreadCommitment[],
  now: string,
): ThreadState {
  const snapshot = ThreadSnapshotSchema.parse(rawSnapshot);
  if (snapshot.mailbox.toLowerCase() !== APPROVED_GMAIL_MAILBOX) {
    throw new Error("Snapshot mailbox is outside the approved Gmail scope.");
  }
  const commitments = z.array(ThreadCommitmentSchema).parse(rawCommitments);
  const nowAt = z.string().datetime({ offset: true }).parse(now);
  const nowTime = new Date(nowAt).getTime();
  const messages = assertNoConflictingDuplicates(snapshot.messages);
  if (messages.some((message) => message.internalDate > nowTime)) {
    throw new Error("Snapshot contains a future Gmail message timestamp.");
  }

  const messageById = new Map(messages.map((message) => [message.id, message]));
  for (const commitment of commitments) {
    const message = messageById.get(commitment.messageId);
    if (!message || messageDirection(message) !== "outbound") {
      throw new Error(
        "A thread commitment must reference an outbound snapshot message.",
      );
    }
  }

  const meaningful = messages
    .filter((message) => !isExcluded(message))
    .sort(
      (left, right) =>
        left.internalDate - right.internalDate ||
        left.id.localeCompare(right.id),
    );
  if (meaningful.length === 0) {
    return {
      excluded: true,
      waitingOn: "none",
      latestMessageId: null,
      latestMessageAt: null,
      category: "other",
      draftRisk: "no_draft",
      summary: "Thread is excluded by deterministic Gmail filters.",
      confidence: 0,
      hasOpenPromise: false,
      hasOverdueUnresolvedPromise: false,
    };
  }

  const latestTimestamp = meaningful.at(-1)?.internalDate;
  const latest = meaningful.filter(
    (message) => message.internalDate === latestTimestamp,
  );
  const latestAt = new Date(latestTimestamp as number).toISOString();
  const openCommitments = commitments.filter(
    (commitment) => commitment.status === "open",
  );
  const hasOverdueUnresolvedPromise = openCommitments.some(
    (commitment) =>
      commitment.deadlineAt !== null &&
      new Date(commitment.deadlineAt).getTime() < nowTime,
  );
  const latestSignals = new Set(
    latest.map(
      (message) =>
        `${messageDirection(message) ?? "unknown"}:${message.interpretation.kind}`,
    ),
  );
  if (latestSignals.size > 1) {
    return ambiguousState(
      latestAt,
      openCommitments.length > 0,
      hasOverdueUnresolvedPromise,
    );
  }

  const latestMessage = latest.sort((left, right) =>
    left.id.localeCompare(right.id),
  )[0];
  const kind = latestMessage.interpretation.kind;
  const direction = messageDirection(latestMessage);
  const waitingOn = deriveWaitingOn({
    hasOverdueUnresolvedPromise,
    latestMessage: {
      direction: direction ?? "inbound",
      requiresResponse: kind === "question",
      expectsResponse: kind === "question",
      isAcknowledgement: kind === "acknowledgement",
      isInformational: kind === "informational",
      isAmbiguous: kind === "ambiguous" || direction === null,
    },
  });

  return {
    excluded: false,
    waitingOn,
    latestMessageId: latestMessage.id,
    latestMessageAt: latestAt,
    category: latestMessage.interpretation.category,
    draftRisk: latestMessage.interpretation.risk,
    summary: latestMessage.interpretation.summary,
    confidence: latestMessage.interpretation.confidence,
    hasOpenPromise: openCommitments.length > 0,
    hasOverdueUnresolvedPromise,
  };
}
