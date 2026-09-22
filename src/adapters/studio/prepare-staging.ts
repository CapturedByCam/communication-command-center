import { z } from "zod";
import { classifyDraftRisk } from "../../domain/risk.js";
import { CategorySchema, DraftRiskSchema, StudioStagingSchema } from "../../domain/schemas.js";
import type { StudioStagingRecord } from "../../domain/types.js";

const SourceSchema = z.object({
  mailbox: z.string().email(),
  // Local transport limit, not an assertion about Gmail's opaque ID format.
  gmail_message_id: z.string().min(1).max(115),
  flow_run_id: z.string().min(1).max(256),
  received_at: z.string().datetime({ offset: true }),
  sender_email: z.string().email(),
  subject: z.string().max(500),
}).strict();

const ContextSchema = z.object({
  approvedMailbox: z.string().email(),
  knownContact: z.boolean(),
}).strict();

// New internal extraction contract. Existing persisted staging schema stays 1.0.
// Never treat Studio Extract's prose output as this object without validation.
export const StudioInterpretationSchema = z.object({
  requires_response: z.boolean(),
  direct_response_requested: z.boolean(),
  draft_risk: DraftRiskSchema,
  category_hint: CategorySchema,
  project_hint: z.string().max(128).nullable(),
  deadline_text: z.string().max(200).nullable(),
  next_action_hint: z.string().max(500),
  summary_hint: z.string().max(280),
  confidence_hint: z.number().min(0).max(1),
  message_kind: z.enum([
    "receipt", "newsletter", "automated_notice", "spam",
    "closed_acknowledgement", "information_only",
  ]).nullable(),
  consequences: z.array(z.enum([
    "pricing", "negotiation", "complaint", "scope_dispute", "contract",
    "payment", "refund", "legal", "aviation_employment",
    "external_schedule_commitment", "sensitive_personal",
  ])).max(11),
  model_uncertain: z.boolean(),
}).strict();

export type PreparationResult =
  | { ok: true; record: StudioStagingRecord }
  | { ok: false; error_code:
      | "STUDIO_INVALID_SOURCE" | "STUDIO_INVALID_MODEL"
      | "STUDIO_INVALID_CONTEXT" | "STUDIO_MAILBOX_OUT_OF_SCOPE"
      | "STUDIO_UNSAFE_CELL" };

/** Pure local boundary. Does not write Sheets, authorize drafts, or wire a Studio step. */
export function prepareStudioStaging(
  source: unknown,
  model: unknown,
  context: unknown,
): PreparationResult {
  const trusted = ContextSchema.safeParse(context);
  if (!trusted.success) return { ok: false, error_code: "STUDIO_INVALID_CONTEXT" };
  const metadata = SourceSchema.safeParse(source);
  if (!metadata.success) return { ok: false, error_code: "STUDIO_INVALID_SOURCE" };
  if (metadata.data.mailbox.toLowerCase() !== trusted.data.approvedMailbox.toLowerCase()) {
    return { ok: false, error_code: "STUDIO_MAILBOX_OUT_OF_SCOPE" };
  }
  const interpretation = StudioInterpretationSchema.safeParse(model);
  if (!interpretation.success) return { ok: false, error_code: "STUDIO_INVALID_MODEL" };

  const fields = interpretation.data;
  const computedRisk = classifyDraftRisk({
    knownContact: trusted.data.knownContact,
    directResponseRequested: fields.requires_response && fields.direct_response_requested,
    messageKind: fields.message_kind,
    consequences: fields.consequences,
    modelUncertain: fields.model_uncertain,
  });
  // Either side may make drafting more restrictive; neither can promote it.
  const draftRisk = fields.draft_risk === "no_draft" || computedRisk === "no_draft"
    ? "no_draft"
    : fields.draft_risk === "review_only" || computedRisk === "review_only"
      ? "review_only" : "routine";

  const record = StudioStagingSchema.parse({
    schema_version: "1.0",
    ingest_id: `studio:gmail:${metadata.data.gmail_message_id}`,
    flow_run_id: metadata.data.flow_run_id,
    gmail_message_id: metadata.data.gmail_message_id,
    received_at: metadata.data.received_at,
    sender_email: metadata.data.sender_email,
    subject: metadata.data.subject,
    requires_response: fields.requires_response,
    draft_risk: draftRisk,
    category_hint: fields.category_hint,
    project_hint: fields.project_hint,
    deadline_text: fields.deadline_text,
    next_action_hint: fields.next_action_hint,
    summary_hint: fields.summary_hint,
    confidence_hint: fields.confidence_hint,
    processing_status: "new",
    processed_at: null,
    error_code: null,
  });
  // Defense in depth until the live adapter proves literal/RAW writes.
  // Do not rewrite user content or place raw validation errors in logs.
  if (Object.values(record).some((value) => typeof value === "string" && /^\s*[=+@-]/u.test(value))) {
    return { ok: false, error_code: "STUDIO_UNSAFE_CELL" };
  }
  return { ok: true, record };
}
