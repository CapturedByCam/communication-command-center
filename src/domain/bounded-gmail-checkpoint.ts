import { z } from "zod";
import { APPROVED_GMAIL_MAILBOX } from "../adapters/gmail/gmail-client.js";

const timestamp = z.string().datetime({ offset: true });
export const BoundedReferenceSchema = z
  .object({
    id: z.string().min(1).max(512),
    threadId: z.string().min(1).max(512),
  })
  .strict();
export const BoundedReferenceShardSchema = z
  .object({
    schema_version: z.literal("1.0"),
    window_from: timestamp,
    window_to: timestamp,
    references: z.array(BoundedReferenceSchema).max(20),
  })
  .strict()
  .refine((value) => {
    const from = Date.parse(value.window_from),
      to = Date.parse(value.window_to);
    return (
      JSON.stringify(value).length <= 30_000 &&
      from < to &&
      to - from <= 30 * 86_400_000 &&
      from % 1000 === 0 &&
      to % 1000 === 0
    );
  });

export const BoundedGmailCheckpointSchema = z
  .object({
    schema_version: z.literal("2.0"),
    mailbox: z.literal(APPROVED_GMAIL_MAILBOX),
    window: z.object({ from: timestamp, to: timestamp }).strict(),
    phase: z.enum(["enumerating", "processing", "complete", "blocked"]),
    pageToken: z.string().min(1).max(2048).nullable(),
    seenPageTokenHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(100),
    shardCount: z.number().int().min(0).max(100),
    nextThread: z.number().int().min(0).max(2000),
    completedThrough: timestamp.nullable(),
    retry: z
      .object({
        attempts: z.number().int().min(1).max(2),
        nextAttemptAt: timestamp,
      })
      .strict()
      .nullable(),
    error_code: z
      .enum([
        "READ_FAILED",
        "CURSOR_EXPIRED",
        "EVIDENCE_INVALID",
        "LIMIT_EXCEEDED",
      ])
      .nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const from = Date.parse(value.window.from),
      to = Date.parse(value.window.to);
    if (
      from >= to ||
      to - from > 30 * 86_400_000 ||
      from % 1000 ||
      to % 1000 ||
      (value.phase !== "enumerating" && value.pageToken !== null) ||
      (value.phase === "enumerating" && value.nextThread !== 0) ||
      (value.phase === "processing" && value.shardCount === 0) ||
      value.nextThread > value.shardCount * 20 ||
      new Set(value.seenPageTokenHashes).size !==
        value.seenPageTokenHashes.length ||
      (value.retry !== null && value.error_code !== "READ_FAILED") ||
      (value.phase !== "blocked" &&
        value.error_code !== null &&
        value.retry === null) ||
      (value.phase === "complete" &&
        (value.completedThrough !== value.window.to ||
          value.retry !== null ||
          value.error_code !== null)) ||
      (value.phase === "blocked" &&
        (value.error_code === null || value.retry !== null)) ||
      (value.completedThrough !== null &&
        Date.parse(value.completedThrough) > to)
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid bounded checkpoint state.",
      });
  });
export type BoundedGmailCheckpoint = z.infer<
  typeof BoundedGmailCheckpointSchema
>;
