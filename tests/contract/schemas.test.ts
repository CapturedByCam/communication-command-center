import { describe, expect, it } from "vitest";
import {
  CommunicationItemSchema,
  ShortcutIntakeSchema,
  StudioStagingSchema,
} from "../../src/domain/schemas.js";

const validCommunicationItem = {
  schema_version: "1.0",
  item_id: "cc_123456789012",
  source: "gmail",
  source_record_id: "message-1",
  source_thread_id: "thread-1",
  source_link: "https://mail.google.com/mail/u/0/#inbox/thread-1",
  captured_at: "2026-09-22T12:00:00-04:00",
  updated_at: "2026-09-22T12:05:00-04:00",
  contact: {
    name: "Example Contact",
    email: "contact@example.com",
    phone: null,
    handle: null,
  },
  category: "client_lead",
  project_id: null,
  status: "open",
  waiting_on: "me",
  urgency: "today",
  priority_score: 80,
  next_action_type: "reply",
  next_action: "Reply with available times.",
  summary: "A synthetic lead asked about availability.",
  preview: "Could you share your availability?",
  deadline_at: null,
  deadline_text: null,
  needs_date_review: false,
  follow_up_at: null,
  promised_follow_up: null,
  draft_status: "needed",
  gmail_draft_id: null,
  confidence: 0.95,
  classifier_version: "fixture-v1",
  content_hash: "a".repeat(64),
  manual_override: false,
  snooze_until: null,
  resolved_at: null,
  raw_content_stored: false,
  last_error_code: null,
} as const;

const validShortcutIntake = {
  schema_version: "1.0",
  auth_token: "t".repeat(40),
  idempotency_key: "123e4567-e89b-42d3-a456-426614174000",
  captured_at: "2026-09-22T12:00:00Z",
  source: "apple_share_sheet",
  shared_text: "Synthetic shared text",
  contact_hint: null,
  app_hint: "Messages",
  model_fields: {
    classification_status: "parsed",
    category: "personal",
    urgency: "later",
    waiting_on: "none",
    deadline_at: null,
    deadline_text: null,
    next_action: "Review the shared text.",
    summary: "A synthetic shared-text example.",
  },
} as const;

const validStudioStaging = {
  schema_version: "1.0",
  ingest_id: "ingest_123456",
  flow_run_id: "flow-1",
  gmail_message_id: "message-1",
  received_at: "2026-09-22T12:00:00Z",
  sender_email: "sender@example.com",
  subject: "Synthetic subject",
  requires_response: true,
  draft_risk: "routine",
  category_hint: "client_lead",
  project_hint: null,
  deadline_text: null,
  next_action_hint: "Reply.",
  summary_hint: "Synthetic staging record.",
  confidence_hint: 0.9,
  processing_status: "new",
  processed_at: null,
  error_code: null,
} as const;

describe("versioned domain schemas", () => {
  it("accepts valid examples for every contract", () => {
    expect(CommunicationItemSchema.parse(validCommunicationItem)).toEqual(
      validCommunicationItem,
    );
    expect(ShortcutIntakeSchema.parse(validShortcutIntake)).toEqual(
      validShortcutIntake,
    );
    expect(StudioStagingSchema.parse(validStudioStaging)).toEqual(
      validStudioStaging,
    );
  });

  it("rejects unknown properties at every object boundary", () => {
    expect(() =>
      CommunicationItemSchema.parse({
        ...validCommunicationItem,
        unexpected: true,
      }),
    ).toThrow();
    expect(() =>
      ShortcutIntakeSchema.parse({
        ...validShortcutIntake,
        model_fields: {
          ...validShortcutIntake.model_fields,
          unexpected: true,
        },
      }),
    ).toThrow();
  });

  it("rejects invalid enums and schema versions", () => {
    expect(() =>
      CommunicationItemSchema.parse({
        ...validCommunicationItem,
        waiting_on: "nobody",
      }),
    ).toThrow();
    expect(() =>
      StudioStagingSchema.parse({
        ...validStudioStaging,
        schema_version: "2.0",
      }),
    ).toThrow();
  });

  it("enforces the preview limit and raw-content invariant", () => {
    expect(() =>
      CommunicationItemSchema.parse({
        ...validCommunicationItem,
        preview: "p".repeat(241),
      }),
    ).toThrow();
    expect(() =>
      CommunicationItemSchema.parse({
        ...validCommunicationItem,
        raw_content_stored: true,
      }),
    ).toThrow();
  });

  it("enforces Shortcut UUID and token constraints", () => {
    expect(() =>
      ShortcutIntakeSchema.parse({
        ...validShortcutIntake,
        idempotency_key: "not-a-uuid",
      }),
    ).toThrow();
    expect(() =>
      ShortcutIntakeSchema.parse({
        ...validShortcutIntake,
        auth_token: "short",
      }),
    ).toThrow();
  });
});
