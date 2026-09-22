import { z } from "zod";

const ItemIdSchema = z.string().regex(/^cc_[A-Za-z0-9_-]{12,}$/);
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const BoundedIdSchema = z.string().min(1).max(512);

export const DraftOperationSchema = z
  .object({
    schema_version: z.literal("1.0"),
    item_id: ItemIdSchema,
    mailbox: z.string().email(),
    thread_id: BoundedIdSchema,
    source_message_id: BoundedIdSchema,
    source_content_hash: HashSchema,
    operation_id: z.string().uuid(),
    operation: z.enum(["create", "replace", "delete"]),
    status: z.enum([
      "pending",
      "generated",
      "stale",
      "uncertain",
      "deleted",
      "cancelled",
    ]),
    draft_id: BoundedIdSchema.nullable(),
    draft_revision: BoundedIdSchema.nullable(),
    body_hash: HashSchema,
    expected_body_hash: HashSchema.nullable(),
    synthetic: z.boolean(),
    stale_requested: z.boolean(),
    updated_at: z.string().datetime({ offset: true }),
    error_code: z.enum(["WRITE_UNCERTAIN", "FINALIZE_FAILED"]).nullable(),
  })
  .strict()
  .superRefine((operation, context) => {
    if (
      ["generated", "stale", "deleted"].includes(operation.status) &&
      operation.draft_id === null
    ) {
      context.addIssue({ code: "custom", message: "draft id is required" });
    }
    if (
      (operation.draft_id === null && operation.draft_revision !== null) ||
      (operation.draft_id !== null && operation.draft_revision === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "draft revision must match draft id presence",
      });
    }
    if (
      ["replace", "delete"].includes(operation.operation) &&
      operation.draft_id === null
    ) {
      context.addIssue({ code: "custom", message: "draft id is required" });
    }
    if (
      ["replace", "delete"].includes(operation.operation) &&
      operation.expected_body_hash === null
    ) {
      context.addIssue({
        code: "custom",
        message: "expected body hash is required",
      });
    }
  });

export type DraftOperation = z.infer<typeof DraftOperationSchema>;
