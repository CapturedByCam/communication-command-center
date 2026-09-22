import { z } from "zod";
import type { Commitment } from "../services/commitment-service.js";

const timestamp = z
  .string()
  .datetime({ offset: true })
  .refine((value) => {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))$/u.exec(
        value,
      );
    if (!match) return false;
    const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [
      1, 2, 3, 4, 5, 6, 7, 8,
    ].map((index) => Number(match[index] ?? 0));
    if (
      month < 1 ||
      month > 12 ||
      hour > 23 ||
      minute > 59 ||
      second > 59 ||
      offsetHour > 23 ||
      offsetMinute > 59
    )
      return false;
    const calendar = new Date(Date.UTC(year, month - 1, day));
    return (
      calendar.getUTCFullYear() === year &&
      calendar.getUTCMonth() === month - 1 &&
      calendar.getUTCDate() === day
    );
  }, "Invalid timestamp.");
const identifier = z.string().min(1).max(512);

/**
 * Persisted Commitment row contract. Version 1.1 adds immutable source
 * provenance; older rows must be handled by the explicit migration path.
 */
export const CommitmentStorageSchema = z
  .object({
    commitment_id: z.string().regex(/^com_[A-Za-z0-9_-]{8,124}$/),
    item_id: z.string().regex(/^cc_[A-Za-z0-9_-]{12,}$/),
    source_thread_id: identifier,
    promise_text: z.string().min(1).max(500),
    deadline_at: timestamp.nullable(),
    deadline_text: z.string().max(200).nullable(),
    status: z.enum(["open", "fulfilled"]),
    fulfilled_at: timestamp.nullable(),
    fulfillment_evidence_id: identifier.nullable(),
    manual_override: z.boolean(),
    updated_at: timestamp,
    schema_version: z.literal("1.1"),
    source_message_id: identifier,
    source_evidence_id: identifier,
    observed_at: timestamp,
    resolved_by: z.string().min(1).max(128).nullable(),
    needs_date_review: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.updated_at) < Date.parse(value.observed_at)) {
      context.addIssue({
        code: "custom",
        message: "updated_at cannot precede observed_at.",
      });
    }
    if (value.status === "open") {
      if (
        value.fulfilled_at !== null ||
        value.fulfillment_evidence_id !== null ||
        value.resolved_by !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "Open commitments cannot have fulfillment data.",
        });
      }
      return;
    }
    if (value.fulfilled_at === null) {
      context.addIssue({
        code: "custom",
        message: "Fulfilled commitments require fulfilled_at.",
      });
    }
    if (
      value.fulfilled_at !== null &&
      Date.parse(value.fulfilled_at) < Date.parse(value.observed_at)
    ) {
      context.addIssue({
        code: "custom",
        message: "fulfilled_at cannot precede observed_at.",
      });
    }
    if (
      value.fulfilled_at !== null &&
      Date.parse(value.updated_at) < Date.parse(value.fulfilled_at)
    ) {
      context.addIssue({
        code: "custom",
        message: "updated_at cannot precede fulfilled_at.",
      });
    }
    if (value.fulfillment_evidence_id === null && value.resolved_by === null) {
      context.addIssue({
        code: "custom",
        message:
          "Fulfilled commitments require evidence or a named manual resolver.",
      });
    }
    if (value.resolved_by !== null && !value.manual_override) {
      context.addIssue({
        code: "custom",
        message: "Named manual resolution requires manual_override.",
      });
    }
  });

export type CommitmentStorageRecord = z.infer<typeof CommitmentStorageSchema>;

export const CommitmentResolutionInputSchema = z
  .object({
    fulfillmentEvidenceId: identifier.optional(),
    actor: z.string().min(1).max(128).optional(),
    resolvedAt: timestamp,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.fulfillmentEvidenceId && !value.actor) {
      context.addIssue({
        code: "custom",
        message: "Resolution requires evidence or a named manual resolver.",
      });
    }
  });

export type CommitmentResolutionInput = z.infer<
  typeof CommitmentResolutionInputSchema
>;

/** Deliberately drops 1.1-only storage metadata for existing briefing APIs. */
export function commitmentStorageToCommitment(
  rawRecord: CommitmentStorageRecord,
): Commitment {
  const record = CommitmentStorageSchema.parse(rawRecord);
  return {
    commitmentId: record.commitment_id,
    itemId: record.item_id,
    sourceThreadId: record.source_thread_id,
    promiseText: record.promise_text,
    sourceEvidenceId: record.source_evidence_id,
    observedAt: record.observed_at,
    deadlineAt: record.deadline_at,
    deadlineText: record.deadline_text,
    status: record.status,
    fulfilledAt: record.fulfilled_at,
    fulfillmentEvidenceId: record.fulfillment_evidence_id,
    manualOverride: record.manual_override,
    resolvedBy: record.resolved_by,
    updatedAt: record.updated_at,
  };
}
