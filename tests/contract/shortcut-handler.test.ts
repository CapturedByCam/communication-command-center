import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createShortcutHandler,
  type ShortcutStorage,
} from "../../src/adapters/http/shortcut-handler.js";

const token = "t".repeat(64);
const payload = {
  schema_version: "1.0",
  auth_token: token,
  idempotency_key: "b0d4c229-8657-4df7-9c83-daf3cdca83ff",
  captured_at: "2026-09-22T19:00:00-04:00",
  source: "apple_share_sheet",
  shared_text: "Synthetic shared text that must never be retained.",
  contact_hint: "Synthetic Contact",
  app_hint: "Messages",
  model_fields: {
    classification_status: "parsed",
    category: "active_project",
    urgency: "this_week",
    waiting_on: "me",
    deadline_at: "2026-09-23T15:00:00-04:00",
    deadline_text: "by Wednesday afternoon",
    next_action: "Send the revised video",
    summary: "Synthetic model summary that may echo source text.",
  },
};

function request(body = JSON.stringify(payload), remoteAddress = "127.0.0.1") {
  return { body, remoteAddress };
}

function handlerWith(storage: ShortcutStorage, overrides = {}) {
  return createShortcutHandler({
    storage,
    getToken: () => token,
    isEnabled: () => true,
    now: () => new Date("2026-09-22T23:01:00.000Z"),
    hash: (value) => createHash("sha256").update(value).digest("hex"),
    allowRequest: () => true,
    allowPreAuthRequest: () => true,
    ...overrides,
  });
}

describe("Shortcut write-only intake contract", () => {
  it("creates a conservative needs-review record without retaining raw text", async () => {
    const createIfAbsent = vi.fn().mockReturnValue("created" as const);
    const storage: ShortcutStorage = {
      createIfAbsent,
      findByIdempotencyKey: vi.fn(),
    };

    const response = handlerWith(storage)(request());

    expect(response).toEqual({
      status: "needs_review",
      item_id: expect.stringMatching(/^cc_[a-f0-9]{20}$/),
    });
    expect(createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({
          source_record_id: `shortcut:${payload.idempotency_key}`,
          source_thread_id: `shortcut:${payload.idempotency_key}`,
          raw_content_stored: false,
          preview: null,
          summary: "Manual Shortcut capture requires review.",
          next_action: "Review manually shared content in its source app.",
          category: "other",
          waiting_on: "unknown",
          needs_date_review: true,
          deadline_at: null,
          deadline_text: "Unverified model-suggested deadline",
          contact: undefined,
        }),
        idempotencyKey: payload.idempotency_key,
        contentHash: createHash("sha256")
          .update(payload.shared_text)
          .digest("hex"),
      }),
    );
    expect(JSON.stringify(createIfAbsent.mock.calls)).not.toContain(
      payload.shared_text,
    );
    expect(JSON.stringify(createIfAbsent.mock.calls)).not.toContain(
      payload.contact_hint,
    );
    expect(JSON.stringify(createIfAbsent.mock.calls)).not.toContain(
      payload.model_fields.deadline_text,
    );
  });

  it("rejects invalid tokens without writing or disclosing intake data", async () => {
    const storage: ShortcutStorage = {
      createIfAbsent: vi.fn(),
      findByIdempotencyKey: vi.fn(),
    };
    const response = handlerWith(storage)(
      request(JSON.stringify({ ...payload, auth_token: "x".repeat(64) })),
    );

    expect(response).toEqual({
      status: "rejected",
      error_code: "unauthorized",
    });
    expect(storage.createIfAbsent).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain(payload.shared_text);
  });

  it("uses the bounded pre-auth guard before parsing", async () => {
    const storage: ShortcutStorage = {
      createIfAbsent: vi.fn(),
      findByIdempotencyKey: vi.fn(),
    };
    const response = handlerWith(storage, { allowPreAuthRequest: () => false })(
      request("{not JSON"),
    );

    expect(response).toEqual({
      status: "rejected",
      error_code: "rate_limited",
    });
    expect(storage.createIfAbsent).not.toHaveBeenCalled();
  });

  it("does not consume authenticated quota for an invalid token", () => {
    const storage: ShortcutStorage = {
      createIfAbsent: vi.fn(),
      findByIdempotencyKey: vi.fn(),
    };
    const allowRequest = vi.fn(() => true);

    const response = handlerWith(storage, { allowRequest })(
      request(JSON.stringify({ ...payload, auth_token: "x".repeat(64) })),
    );

    expect(response).toEqual({
      status: "rejected",
      error_code: "unauthorized",
    });
    expect(allowRequest).not.toHaveBeenCalled();
  });

  it("checks authenticated quota after constant-time token validation", () => {
    const storage: ShortcutStorage = {
      createIfAbsent: vi.fn(),
      findByIdempotencyKey: vi.fn(),
    };
    const allowRequest = vi.fn(() => false);

    const response = handlerWith(storage, { allowRequest })(request());

    expect(response).toEqual({
      status: "rejected",
      error_code: "rate_limited",
    });
    expect(allowRequest).toHaveBeenCalledOnce();
    expect(storage.createIfAbsent).not.toHaveBeenCalled();
  });

  it("records a redacted rejection only for an authenticated schema-invalid body", async () => {
    const storage: ShortcutStorage = {
      createIfAbsent: vi.fn(),
      findByIdempotencyKey: vi.fn(),
    };
    const rejectionSink = { recordRejected: vi.fn() };
    const handler = handlerWith(storage, { rejectionSink });

    expect(handler(request("x".repeat(24_001)))).toEqual({
      status: "rejected",
      error_code: "payload_too_large",
    });
    expect(
      handler(request(JSON.stringify({ ...payload, unexpected: true }))),
    ).toEqual({
      status: "rejected",
      error_code: "invalid_payload",
    });
    expect(rejectionSink.recordRejected).toHaveBeenCalledWith({
      errorCode: "invalid_payload",
    });
    expect(
      JSON.stringify(rejectionSink.recordRejected.mock.calls),
    ).not.toContain(payload.shared_text);
    expect(
      JSON.stringify(rejectionSink.recordRejected.mock.calls),
    ).not.toContain(payload.auth_token);
    expect(
      JSON.stringify(rejectionSink.recordRejected.mock.calls),
    ).not.toContain(payload.contact_hint);

    rejectionSink.recordRejected.mockClear();
    expect(
      handler(
        request(
          JSON.stringify({
            ...payload,
            auth_token: "x".repeat(64),
            unexpected: true,
          }),
        ),
      ),
    ).toEqual({ status: "rejected", error_code: "invalid_payload" });
    expect(rejectionSink.recordRejected).not.toHaveBeenCalled();
    expect(storage.createIfAbsent).not.toHaveBeenCalled();
  });

  it("returns duplicate only and recovers safely after an uncertain write", async () => {
    const storage: ShortcutStorage = {
      createIfAbsent: vi.fn().mockImplementation(() => {
        throw new Error("timeout");
      }),
      findByIdempotencyKey: vi.fn().mockReturnValue({
        itemId: "cc_12345678901234567890",
      }),
    };
    const response = handlerWith(storage)(request());

    expect(response).toEqual({
      status: "duplicate",
      item_id: "cc_12345678901234567890",
    });
    expect(storage.findByIdempotencyKey).toHaveBeenCalledWith(
      payload.idempotency_key,
    );
  });

  it("honors the kill switch without parsing or writing the payload", async () => {
    const storage: ShortcutStorage = {
      createIfAbsent: vi.fn(),
      findByIdempotencyKey: vi.fn(),
    };
    const response = handlerWith(storage, { isEnabled: () => false })(
      request("{not JSON"),
    );

    expect(response).toEqual({ status: "rejected", error_code: "disabled" });
    expect(storage.createIfAbsent).not.toHaveBeenCalled();
  });
});
