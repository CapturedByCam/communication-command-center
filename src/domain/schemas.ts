import { z } from "zod";

const nullableOptional = <T extends z.ZodType>(schema: T) =>
  schema.nullable().optional();

const dateTime = z.string().datetime({ offset: true });

export const SourceSchema = z.enum([
  "gmail",
  "apple_share_sheet",
  "manual",
  "chatgpt",
  "google_chat",
]);

export const CategorySchema = z.enum([
  "client_lead",
  "active_project",
  "aviation",
  "business_admin",
  "personal",
  "other",
]);

export const StatusSchema = z.enum(["open", "snoozed", "resolved", "archived"]);

export const WaitingOnSchema = z.enum(["me", "them", "none", "unknown"]);
export const UrgencySchema = z.enum([
  "critical",
  "today",
  "this_week",
  "later",
]);

export const NextActionTypeSchema = z.enum([
  "reply",
  "send_file",
  "schedule",
  "call",
  "follow_up",
  "review",
  "none",
]);

export const DraftStatusSchema = z.enum([
  "not_needed",
  "needed",
  "generated",
  "reviewed",
  "sent",
  "stale",
  "failed",
]);

export const DraftRiskSchema = z.enum(["routine", "review_only", "no_draft"]);

export const ContactSchema = z
  .object({
    name: nullableOptional(z.string().max(200)),
    email: nullableOptional(z.string().email()),
    phone: nullableOptional(z.string().max(64)),
    handle: nullableOptional(z.string().max(200)),
  })
  .strict();

export const CommunicationItemSchema = z
  .object({
    schema_version: z.literal("1.0"),
    item_id: z.string().regex(/^cc_[A-Za-z0-9_-]{12,}$/),
    source: SourceSchema,
    source_record_id: z.string().min(1).max(512),
    source_thread_id: z.string().min(1).max(512),
    source_link: nullableOptional(z.string().url()),
    captured_at: dateTime,
    updated_at: dateTime,
    contact: ContactSchema.optional(),
    category: CategorySchema,
    project_id: nullableOptional(z.string().max(128)),
    status: StatusSchema,
    waiting_on: WaitingOnSchema,
    urgency: UrgencySchema,
    priority_score: z.number().int().min(0).max(100),
    next_action_type: NextActionTypeSchema,
    next_action: z.string().max(500),
    summary: z.string().max(500),
    preview: nullableOptional(z.string().max(240)),
    deadline_at: nullableOptional(dateTime),
    deadline_text: nullableOptional(z.string().max(200)),
    needs_date_review: z.boolean().optional(),
    follow_up_at: nullableOptional(dateTime),
    promised_follow_up: nullableOptional(z.string().max(500)),
    draft_status: DraftStatusSchema,
    gmail_draft_id: nullableOptional(z.string().max(512)),
    confidence: z.number().min(0).max(1),
    classifier_version: z.string().min(1).max(64),
    content_hash: z.string().regex(/^[a-f0-9]{64}$/),
    manual_override: z.boolean().optional(),
    snooze_until: nullableOptional(dateTime),
    resolved_at: nullableOptional(dateTime),
    raw_content_stored: z.literal(false),
    last_error_code: nullableOptional(z.string().max(128)),
  })
  .strict();

export const ShortcutModelFieldsSchema = z
  .object({
    classification_status: z.enum(["parsed", "needs_server_review"]),
    category: CategorySchema,
    urgency: UrgencySchema,
    waiting_on: WaitingOnSchema,
    deadline_at: nullableOptional(dateTime),
    deadline_text: nullableOptional(z.string().max(200)),
    next_action: z.string().max(500),
    summary: z.string().max(500),
  })
  .strict();

export const ShortcutIntakeSchema = z
  .object({
    schema_version: z.literal("1.0"),
    auth_token: z.string().min(40).max(256),
    idempotency_key: z.string().uuid(),
    captured_at: dateTime,
    source: z.literal("apple_share_sheet"),
    shared_text: z.string().min(1).max(12_000),
    contact_hint: nullableOptional(z.string().max(200)),
    app_hint: nullableOptional(z.string().max(100)),
    model_fields: ShortcutModelFieldsSchema,
  })
  .strict();

export const StudioStagingSchema = z
  .object({
    schema_version: z.literal("1.0"),
    ingest_id: z.string().min(12).max(128),
    flow_run_id: z.string().min(1).max(256),
    gmail_message_id: z.string().min(1).max(512),
    received_at: dateTime,
    sender_email: z.string().email(),
    subject: z.string().max(500),
    requires_response: z.boolean(),
    draft_risk: DraftRiskSchema,
    category_hint: nullableOptional(z.string().max(64)),
    project_hint: nullableOptional(z.string().max(128)),
    deadline_text: nullableOptional(z.string().max(200)),
    next_action_hint: nullableOptional(z.string().max(500)),
    summary_hint: nullableOptional(z.string().max(500)),
    confidence_hint: nullableOptional(z.number().min(0).max(1)),
    processing_status: z.enum(["new", "processing", "processed", "failed"]),
    processed_at: nullableOptional(dateTime),
    error_code: nullableOptional(z.string().max(128)),
  })
  .strict();
