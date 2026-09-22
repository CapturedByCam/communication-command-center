import { z } from "zod";
import { CommunicationItemSchema } from "../domain/schemas.js";
import type { CommunicationItem } from "../domain/types.js";
import { calculatePriority } from "../domain/priority.js";
import {
  ThreadSnapshotSchema,
  type ThreadSnapshot,
} from "../adapters/gmail/gmail-client.js";
import {
  deriveThreadState,
  type ThreadCommitment,
  type ThreadState,
} from "../adapters/gmail/thread-state.js";

export type Sha256 = (value: string) => string;
export function checkedHash(hash: Sha256, value: string): string {
  return z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(hash(value));
}

/** Both Studio and recovery use this authoritative snapshot, never staging hints. */
export function normalizeStagingItem(
  rawSnapshot: ThreadSnapshot,
  commitments: ThreadCommitment[],
  now: string,
  sha256: Sha256,
): CommunicationItem | null {
  const snapshot = ThreadSnapshotSchema.parse(rawSnapshot);
  const state = deriveThreadState(snapshot, commitments, now);
  return normalizeDerivedThreadState(snapshot, state, now, sha256);
}

/** Internal projection of deterministic, validated chronology. */
export function normalizeDerivedThreadState(
  snapshot: ThreadSnapshot,
  state: ThreadState,
  now: string,
  sha256: Sha256,
): CommunicationItem | null {
  if (state.excluded) return null;
  const status =
    state.waitingOn === "none" && !state.hasOpenPromise ? "resolved" : "open";
  const review =
    state.waitingOn === "unknown" ||
    state.hasOpenPromise ||
    state.draftRisk === "review_only";
  const latestAt = state.latestMessageAt!;
  // Include interpreted state so an obligation becoming overdue is not deduped away.
  const contentHash = checkedHash(
    sha256,
    JSON.stringify({
      threadId: snapshot.threadId,
      mailbox: snapshot.mailbox.toLowerCase(),
      state,
    }),
  );
  const itemId = `cc_${checkedHash(sha256, `gmail:${snapshot.mailbox.toLowerCase()}:${snapshot.threadId}`)}`;
  const urgency = state.hasOverdueUnresolvedPromise ? "today" : "later";
  return CommunicationItemSchema.parse({
    schema_version: "1.0",
    item_id: itemId,
    source: "gmail",
    source_record_id: state.latestMessageId ?? snapshot.threadId,
    source_thread_id: snapshot.threadId,
    source_link: `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(snapshot.mailbox.toLowerCase())}#all/${encodeURIComponent(snapshot.threadId)}`,
    captured_at: latestAt,
    updated_at: latestAt,
    category: state.category,
    status,
    waiting_on: state.waitingOn,
    urgency,
    priority_score: calculatePriority({
      urgency,
      status,
      now: new Date(now),
      isNewClientLead: state.category === "client_lead",
      isAviationOpportunity: state.category === "aviation",
      isActiveProject: state.category === "active_project",
    }),
    next_action_type: review
      ? "review"
      : state.waitingOn === "me"
        ? "reply"
        : state.waitingOn === "them"
          ? "follow_up"
          : "none",
    next_action: review
      ? "Review the thread and any open obligation."
      : state.waitingOn === "me"
        ? "Review and reply to the request."
        : state.waitingOn === "them"
          ? "Await the other participant's response."
          : "No response needed.",
    summary: state.summary,
    preview: null,
    draft_status:
      state.waitingOn === "me" && !review && state.draftRisk === "routine"
        ? "needed"
        : "not_needed",
    confidence: state.confidence,
    classifier_version: "gmail-snapshot-v1",
    content_hash: contentHash,
    manual_override: false,
    raw_content_stored: false,
    resolved_at: status === "resolved" ? latestAt : null,
  });
}
