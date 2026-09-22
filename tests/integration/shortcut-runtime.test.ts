import { describe, expect, it } from "vitest";
import { createShortcutStorage } from "../../src/apps-script/shortcut-runtime.js";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
import { createShortcutHandler } from "../../src/adapters/http/shortcut-handler.js";
import { createHash } from "node:crypto";
describe("synchronous Shortcut persistence", () => {
  it("rechecks authorization while holding the persistence lock", () => {
    let table = {
      headers: [...WORKBOOK_MANIFEST[0].headers] as string[],
      rows: [] as (string | number | boolean | null)[][],
    };
    let held = false;
    let commits = 0;
    let enabledReads = 0;
    const storage = createShortcutStorage(
      {
        acquire: () => {
          expect(held).toBe(false);
          held = true;
        },
        release: () => {
          held = false;
        },
        read: () => structuredClone(table),
        commit: (_id, changes) => {
          commits++;
          table = structuredClone(changes[0].after);
        },
      },
      "book",
    );
    const handler = createShortcutHandler({
      storage,
      getToken: () => "x".repeat(64),
      isEnabled: () => ++enabledReads === 1,
      now: () => new Date("2026-09-22T12:00:00Z"),
      hash: (value) => createHash("sha256").update(value).digest("hex"),
      allowRequest: () => true,
    });
    const body = JSON.stringify({
      schema_version: "1.0",
      auth_token: "x".repeat(64),
      idempotency_key: "e6c2e652-fbaa-4f34-86a9-d7e54efb2111",
      captured_at: "2026-09-22T12:00:00Z",
      source: "apple_share_sheet",
      shared_text: "private synthetic source",
      model_fields: {
        classification_status: "needs_server_review",
        category: "other",
        urgency: "later",
        waiting_on: "unknown",
        deadline_at: null,
        deadline_text: null,
        next_action: "Review source",
        summary: "Requires review",
      },
    });

    expect(handler({ body, remoteAddress: null })).toEqual({
      status: "rejected",
      error_code: "disabled",
    });
    expect(enabledReads).toBe(3);
    expect(held).toBe(false);
    expect(commits).toBe(0);
    expect(table.rows).toHaveLength(0);
  });

  it("atomically stores one normalized row and treats repeated UUID as duplicate", () => {
    let table = {
      headers: [...WORKBOOK_MANIFEST[0].headers] as string[],
      rows: [] as (string | number | boolean | null)[][],
    };
    let commits = 0;
    let held = false;
    const storage = createShortcutStorage(
      {
        acquire: () => {
          expect(held).toBe(false);
          held = true;
        },
        release: () => {
          held = false;
        },
        read: () => structuredClone(table),
        commit: (_id, changes) => {
          expect(held).toBe(true);
          commits++;
          table = structuredClone(changes[0].after);
        },
      },
      "book",
    );
    const handler = createShortcutHandler({
      storage,
      getToken: () => "x".repeat(64),
      isEnabled: () => true,
      now: () => new Date("2026-09-22T12:00:00Z"),
      hash: (s) => createHash("sha256").update(s).digest("hex"),
      allowRequest: () => true,
    });
    const body = JSON.stringify({
      schema_version: "1.0",
      auth_token: "x".repeat(64),
      idempotency_key: "e6c2e652-fbaa-4f34-86a9-d7e54efb2111",
      captured_at: "2026-09-22T12:00:00Z",
      source: "apple_share_sheet",
      shared_text: "private synthetic source",
      model_fields: {
        classification_status: "needs_server_review",
        category: "other",
        urgency: "later",
        waiting_on: "unknown",
        deadline_at: null,
        deadline_text: null,
        next_action: "Review source",
        summary: "Requires review",
      },
    });
    expect(handler({ body, remoteAddress: null }).status).toBe("needs_review");
    expect(handler({ body, remoteAddress: null }).status).toBe("duplicate");
    expect(commits).toBe(1);
    expect(held).toBe(false);
    expect(JSON.stringify(table)).not.toContain("private synthetic source");
    expect(JSON.stringify(table)).not.toContain("x".repeat(64));
  });

  it("uses the injected replacement token immediately while retaining UUID idempotency", () => {
    let table = {
      headers: [...WORKBOOK_MANIFEST[0].headers] as string[],
      rows: [] as (string | number | boolean | null)[][],
    };
    let commits = 0;
    let held = false;
    let enabled = true;
    let token = "r".repeat(64);
    const storage = createShortcutStorage(
      {
        acquire: () => {
          expect(held).toBe(false);
          held = true;
        },
        release: () => {
          held = false;
        },
        read: () => structuredClone(table),
        commit: (_id, changes) => {
          expect(held).toBe(true);
          commits++;
          table = structuredClone(changes[0].after);
        },
      },
      "book",
    );
    const handler = createShortcutHandler({
      storage,
      getToken: () => token,
      isEnabled: () => enabled,
      now: () => new Date("2026-09-22T12:00:00Z"),
      hash: (value) => createHash("sha256").update(value).digest("hex"),
      allowRequest: () => true,
    });
    const bodyFor = (authToken: string) =>
      JSON.stringify({
        schema_version: "1.0",
        auth_token: authToken,
        idempotency_key: "a1c2e652-fbaa-4f34-86a9-d7e54efb2111",
        captured_at: "2026-09-22T12:00:00Z",
        source: "apple_share_sheet",
        shared_text: "synthetic rotation check",
        model_fields: {
          classification_status: "needs_server_review",
          category: "other",
          urgency: "later",
          waiting_on: "unknown",
          deadline_at: null,
          deadline_text: null,
          next_action: "Review source",
          summary: "Requires review",
        },
      });

    const retired = token;
    expect(
      handler({ body: bodyFor(retired), remoteAddress: null }).status,
    ).toBe("needs_review");
    token = "f".repeat(64);
    expect(handler({ body: bodyFor(retired), remoteAddress: null })).toEqual({
      status: "rejected",
      error_code: "unauthorized",
    });
    expect(handler({ body: bodyFor(token), remoteAddress: null }).status).toBe(
      "duplicate",
    );
    enabled = false;
    for (const candidate of [retired, token])
      expect(
        handler({ body: bodyFor(candidate), remoteAddress: null }),
      ).toEqual({
        status: "rejected",
        error_code: "disabled",
      });
    expect(commits).toBe(1);
    expect(table.rows).toHaveLength(1);
  });
});
