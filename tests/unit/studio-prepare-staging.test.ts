import { describe, expect, it } from "vitest";
import { prepareStudioStaging } from "../../src/adapters/studio/prepare-staging.js";
import { StudioStagingSchema } from "../../src/domain/schemas.js";

const envelope = {
  mailbox: "pilot@example.com",
  gmail_message_id: "message-0001",
  flow_run_id: "run-0001",
  received_at: "2026-09-22T12:00:00Z",
  sender_email: "sender@example.com",
  subject: "Synthetic project question",
};
const context = { approvedMailbox: "pilot@example.com", knownContact: true };
const model = {
  requires_response: true,
  direct_response_requested: true,
  draft_risk: "routine",
  category_hint: "active_project",
  project_hint: null,
  deadline_text: null,
  next_action_hint: "Reply to the question.",
  summary_hint: "A synthetic contact asked a project question.",
  confidence_hint: 0.95,
  message_kind: null,
  consequences: [],
  model_uncertain: false,
};

describe("Studio staging preparation (local contract; no Google writes)", () => {
  it("prepares a schema-compatible metadata record with a stable message key", () => {
    const first = prepareStudioStaging(envelope, model, context);
    const retry = prepareStudioStaging(
      { ...envelope, flow_run_id: "run-0002" },
      model,
      context,
    );
    expect(first.ok).toBe(true);
    if (!first.ok || !retry.ok) throw new Error("Expected valid fixture");
    expect(first.record.ingest_id).toBe("studio:gmail:message-0001");
    expect(retry.record.ingest_id).toBe(first.record.ingest_id);
    expect(first.record.processing_status).toBe("new");
    expect(first.record.draft_risk).toBe("routine");
    expect(StudioStagingSchema.safeParse(first.record).success).toBe(true);
    expect(first.record).not.toHaveProperty("consequences");
    expect(first.record).not.toHaveProperty("body");
  });

  it.each([
    "pricing",
    "negotiation",
    "complaint",
    "scope_dispute",
    "contract",
    "payment",
    "refund",
    "legal",
    "aviation_employment",
    "external_schedule_commitment",
    "sensitive_personal",
  ])("overrides an unsafe routine label for %s", (risk) => {
    const result = prepareStudioStaging(
      envelope,
      { ...model, consequences: [risk] },
      context,
    );
    expect(result.ok && result.record.draft_risk).toBe("review_only");
  });

  it.each([
    { ...model, model_uncertain: true },
    { ...model, draft_risk: "review_only" },
  ])("preserves review requirements", (fields) => {
    const result = prepareStudioStaging(envelope, fields, context);
    expect(result.ok && result.record.draft_risk).toBe("review_only");
  });

  it("requires a trusted known-contact match", () => {
    const result = prepareStudioStaging(envelope, model, {
      ...context,
      knownContact: false,
    });
    expect(result.ok && result.record.draft_risk).toBe("review_only");
  });

  it.each([
    { ...model, requires_response: false },
    { ...model, direct_response_requested: false },
    { ...model, draft_risk: "no_draft" },
    ...[
      "newsletter",
      "receipt",
      "closed_acknowledgement",
      "information_only",
      "automated_notice",
      "spam",
    ].map((message_kind) => ({ ...model, message_kind })),
  ])(
    "does not permit informational messages to produce routine drafts",
    (fields) => {
      const result = prepareStudioStaging(envelope, fields, context);
      expect(result.ok && result.record.draft_risk).toBe("no_draft");
    },
  );

  it.each([
    { ...model, category_hint: "invented" },
    { ...model, draft_risk: "ROUTINE" },
    { ...model, requires_response: "true" },
    { ...model, confidence_hint: "0.9" },
    { ...model, confidence_hint: 1.01 },
    { ...model, summary_hint: "x".repeat(281) },
    { ...model, consequences: ["invented"] },
    { ...model, body: "PRIVATE CANARY" },
    { ...model, knownContact: true },
    { ...model, model_uncertain: undefined },
  ])("rejects untrusted model shape without leaking input", (fields) => {
    expect(prepareStudioStaging(envelope, fields, context)).toEqual({
      ok: false,
      error_code: "STUDIO_INVALID_MODEL",
    });
  });

  it.each([
    { ...envelope, gmail_message_id: "" },
    { ...envelope, received_at: "yesterday" },
    { ...envelope, flow_run_id: "" },
    { ...envelope, body: "PRIVATE CANARY" },
    { ...envelope, subject: "x".repeat(501) },
  ])("rejects bad source metadata without leaking input", (source) => {
    expect(prepareStudioStaging(source, model, context)).toEqual({
      ok: false,
      error_code: "STUDIO_INVALID_SOURCE",
    });
  });

  it("rejects a different mailbox and unvalidated context", () => {
    expect(
      prepareStudioStaging(
        { ...envelope, mailbox: "other@example.com" },
        model,
        context,
      ),
    ).toEqual({ ok: false, error_code: "STUDIO_MAILBOX_OUT_OF_SCOPE" });
    expect(
      prepareStudioStaging(envelope, model, {
        ...context,
        knownContact: "yes",
      }),
    ).toEqual({ ok: false, error_code: "STUDIO_INVALID_CONTEXT" });
  });

  it.each([
    '=IMPORTXML("https://example.com","x")',
    " +SUM(1,2)",
    "@payload",
    "-payload",
    "\t=1",
  ])("rejects formula-like content before a Sheet write", (text) => {
    expect(
      prepareStudioStaging({ ...envelope, subject: text }, model, context),
    ).toEqual({ ok: false, error_code: "STUDIO_UNSAFE_CELL" });
    expect(
      prepareStudioStaging(envelope, { ...model, summary_hint: text }, context),
    ).toEqual({ ok: false, error_code: "STUDIO_UNSAFE_CELL" });
  });

  it("preserves relative deadline text without inventing a normalized date", () => {
    const result = prepareStudioStaging(
      envelope,
      { ...model, deadline_text: "next Friday" },
      context,
    );
    expect(result.ok && result.record.deadline_text).toBe("next Friday");
    expect(result.ok && result.record).not.toHaveProperty("deadline_at");
  });
});
