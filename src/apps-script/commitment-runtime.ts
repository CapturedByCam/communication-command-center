import { z } from "zod";
import { AuditRepository } from "../adapters/sheets/audit-repository.js";
import {
  CommitmentRepository,
  type CommitmentStorageUpsertResult,
} from "../adapters/sheets/commitment-repository.js";
import {
  GmailClient,
  APPROVED_GMAIL_MAILBOX,
} from "../adapters/gmail/gmail-client.js";
import { normalizeDeadlineSuggestion } from "../services/commitment-service.js";
import {
  GmailMetadataReader,
  type GmailMetadataGateway,
} from "./gmail-reader.js";
import { RuntimeSheetAdapter, type TableGateway } from "./sheet-adapter.js";

const DAY_MILLIS = 86_400_000;
const MAX_SOURCE_AGE_MILLIS = 30 * DAY_MILLIS;
const proposalSchema = z
  .object({
    promise_text: z.string().trim().min(1).max(500),
    deadline_text: z.string().trim().max(200).nullable(),
  })
  .strict();
const requestSchema = z
  .object({
    workbookId: z.string().min(1).max(512),
    requestedMessageId: z.string().min(1).max(512),
    now: z.string().datetime({ offset: true }),
  })
  .strict();

export interface OutboundCommitmentObservationRequest {
  readonly gateway: TableGateway;
  readonly gmail: GmailMetadataGateway;
  readonly workbookId: string;
  readonly requestedMessageId: string;
  /** Untrusted interpretation output. It is validated before any provider or workbook read. */
  readonly proposal: unknown;
  readonly now: string;
  readonly sha256: (value: string) => string;
  /** Bound by a future entrypoint to owner, workbook, and the dedicated feature flag. */
  readonly authorize: () => boolean;
}

export type OutboundCommitmentObservationResult =
  | { readonly status: "disabled" }
  | {
      readonly status: CommitmentStorageUpsertResult["outcome"];
    };

class DisabledDuringTransaction extends Error {}

function checkedHash(sha256: (value: string) => string, value: string): string {
  let result: string;
  try {
    result = sha256(value);
  } catch {
    throw new Error("COMMITMENT_HASH_INVALID");
  }
  if (!/^[a-f0-9]{64}$/u.test(result))
    throw new Error("COMMITMENT_HASH_INVALID");
  return result;
}

function sourceInvalid(): never {
  throw new Error("COMMITMENT_SOURCE_INVALID");
}

function normalizedAddress(value: string): string {
  return value.trim().toLowerCase();
}

function isExcludedLabel(label: string): boolean {
  return /^(DRAFT|SPAM|TRASH|CATEGORY_PROMOTIONS|CATEGORY_FORUMS)$/iu.test(
    label,
  );
}

function assertOutboundSource(
  snapshot: Awaited<ReturnType<GmailClient["getThreadSnapshot"]>>,
  requestedMessageId: string,
  now: Date,
) {
  if (snapshot.messages.length !== 1 || snapshot.threadId.length < 1)
    return sourceInvalid();
  const message = snapshot.messages[0]!;
  if (message.id !== requestedMessageId) return sourceInvalid();
  if (
    normalizedAddress(message.sender) !== APPROVED_GMAIL_MAILBOX ||
    message.recipients.length < 1 ||
    message.recipients.some(
      (recipient) => normalizedAddress(recipient) === APPROVED_GMAIL_MAILBOX,
    ) ||
    !message.labels.some((label) => label.toUpperCase() === "SENT") ||
    message.labels.some(isExcludedLabel) ||
    message.automated ||
    message.bulk ||
    message.receipt
  ) {
    return sourceInvalid();
  }
  const observedAt = new Date(message.internalDate);
  const sourceTime = observedAt.valueOf();
  const nowTime = now.valueOf();
  if (
    !Number.isFinite(sourceTime) ||
    sourceTime < nowTime - MAX_SOURCE_AGE_MILLIS ||
    sourceTime >= nowTime
  ) {
    return sourceInvalid();
  }
  return { message, observedAt: observedAt.toISOString() };
}

function auditResult(
  outcome: CommitmentStorageUpsertResult["outcome"],
): "created" | null {
  return outcome === "created" ? "created" : null;
}

/**
 * Persists one already-interpreted obligation summary per outbound message. It
 * intentionally has no Apps Script global binding or Gmail mutation; a future
 * provider must resolve multi-promise semantics before invoking this boundary.
 */
export async function observeOutboundCommitment(
  request: OutboundCommitmentObservationRequest,
): Promise<OutboundCommitmentObservationResult> {
  const proposal = proposalSchema.safeParse(request.proposal);
  const parsedRequest = requestSchema.safeParse({
    workbookId: request.workbookId,
    requestedMessageId: request.requestedMessageId,
    now: request.now,
  });
  if (!proposal.success || !parsedRequest.success)
    throw new Error("COMMITMENT_REQUEST_INVALID");
  const now = new Date(parsedRequest.data.now);
  if (Number.isNaN(now.valueOf()))
    throw new Error("COMMITMENT_REQUEST_INVALID");

  if (!request.authorize()) return { status: "disabled" };
  const gmail = new GmailClient(
    new GmailMetadataReader(request.gmail, { mode: "requested_message_only" }),
  );
  const snapshot = await gmail.getThreadSnapshot(
    parsedRequest.data.requestedMessageId,
  );
  const source = assertOutboundSource(
    snapshot,
    parsedRequest.data.requestedMessageId,
    now,
  );

  const deadline = normalizeDeadlineSuggestion({
    text: proposal.data.deadline_text,
    anchorAt: source.observedAt,
  });
  const messageHash = checkedHash(
    request.sha256,
    `commitment-message:v1:${APPROVED_GMAIL_MAILBOX}:${source.message.id}`,
  );
  const itemHash = checkedHash(
    request.sha256,
    `gmail:${APPROVED_GMAIL_MAILBOX}:${snapshot.threadId}`,
  );
  const record = {
    commitment_id: `com_${messageHash.slice(0, 32)}`,
    item_id: `cc_${itemHash}`,
    source_thread_id: snapshot.threadId,
    promise_text: proposal.data.promise_text,
    deadline_at: deadline.deadlineAt,
    deadline_text: deadline.deadlineText,
    status: "open" as const,
    fulfilled_at: null,
    fulfillment_evidence_id: null,
    manual_override: false,
    updated_at: parsedRequest.data.now,
    schema_version: "1.1" as const,
    source_message_id: source.message.id,
    source_evidence_id: `evi_${messageHash}`,
    observed_at: source.observedAt,
    resolved_by: null,
    needs_date_review: deadline.needsDateReview,
  };
  const adapter = new RuntimeSheetAdapter(request.gateway);
  const commitments = new CommitmentRepository(
    adapter,
    parsedRequest.data.workbookId,
  );
  const audit = new AuditRepository(adapter, parsedRequest.data.workbookId);

  try {
    return await commitments.runTransaction(async () => {
      if (!request.authorize()) return { status: "disabled" };
      await commitments.verifyHeaders();
      if (!request.authorize()) return { status: "disabled" };
      const result = await commitments.upsertWithinTransaction(record);
      const resultForAudit = auditResult(result.outcome);
      if (!resultForAudit) return { status: result.outcome };
      if (!request.authorize()) throw new DisabledDuringTransaction();
      await audit.append({
        event_id: `evt_${messageHash.slice(0, 32)}`,
        event_at: parsedRequest.data.now,
        item_id: record.item_id,
        source: "gmail",
        action: "upsert_item",
        result: resultForAudit,
        error_code: null,
        payload_hash: checkedHash(
          request.sha256,
          `commitment-audit:v1:${record.commitment_id}:${record.source_evidence_id}`,
        ),
        duration_ms: 0,
        actor: "commitment_observer",
        correlation_id: `commitment_${messageHash.slice(0, 32)}`,
      });
      if (!request.authorize()) throw new DisabledDuringTransaction();
      return { status: result.outcome };
    });
  } catch (error) {
    if (error instanceof DisabledDuringTransaction)
      return { status: "disabled" };
    throw error;
  }
}
