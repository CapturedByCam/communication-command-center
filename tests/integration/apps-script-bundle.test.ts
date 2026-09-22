import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";

interface MockTable {
  headers: string[];
  rows: unknown[][];
}
let code: string;
beforeAll(() => {
  execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: process.cwd() });
  code = readFileSync("dist/Code.js", "utf8");
});

function createRuntime(
  options: {
    readonly properties?: Record<string, string>;
    readonly sheets?: { title: string; sheetId: number }[];
    readonly queueHeaders?: readonly string[];
    readonly queueRows?: unknown[][];
    readonly gmail?: { messages?: { id: string }[]; metadata?: unknown };
    readonly triggers?: { readonly handler: string }[];
  } = {},
) {
  const properties = new Map(Object.entries(options.properties ?? {}));
  const batchUpdate = vi.fn();
  const deleted: string[] = [];
  const triggers = [...(options.triggers ?? [])];
  const tables = new Map<string, MockTable>(
    WORKBOOK_MANIFEST.map((sheet) => [
      sheet.name,
      { headers: [...sheet.headers], rows: [] as unknown[][] },
    ]),
  );
  const queue = tables.get("Queue")!;
  queue.headers = [...(options.queueHeaders ?? queue.headers)];
  queue.rows = options.queueRows ?? [];
  const sheets =
    options.sheets ??
    WORKBOOK_MANIFEST.map((sheet, index) => ({
      title: sheet.name,
      sheetId: index + 1,
    }));
  const reads: string[] = [];
  const logs = vi.fn();
  const lock = { tryLock: vi.fn(() => true), releaseLock: vi.fn() };
  const context = vm.createContext({
    console: { info: logs },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (value: string) => ({
        value,
        setMimeType() {
          return this;
        },
      }),
    },
    Session: {
      getEffectiveUser: () => ({ getEmail: () => "contact@elev8mediaky.com" }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties.get(key) ?? null,
        setProperty: (key: string, value: string) => properties.set(key, value),
      }),
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getId: () => "book_abcdefghijklmnop" }),
    },
    LockService: { getScriptLock: () => lock },
    CacheService: { getScriptCache: () => ({ get: () => null, put: vi.fn() }) },
    ScriptApp: {
      getProjectTriggers: () =>
        triggers.map(({ handler }) => ({
          getHandlerFunction: () => handler,
          handler,
        })),
      deleteTrigger: (trigger: { handler: string }) => {
        deleted.push(trigger.handler);
        const index = triggers.findIndex(
          ({ handler }) => handler === trigger.handler,
        );
        if (index >= 0) triggers.splice(index, 1);
      },
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: "sha256" },
      Charset: { UTF_8: "utf8" },
      computeDigest: () => Array.from({ length: 32 }, () => 0),
      newBlob: (value: string) => ({
        getBytes: () => Array.from(Buffer.from(value)),
      }),
      getUuid: () => "00000000-0000-4000-8000-000000000000",
    },
    Sheets: {
      Spreadsheets: {
        get: () => ({
          sheets: sheets.map(({ title, sheetId }) => ({
            properties: { title, sheetId },
          })),
        }),
        batchUpdate,
        Values: {
          get: (_id: string, range: string) => {
            reads.push(range);
            const match = /'([A-Za-z_]+)'!A([12])/u.exec(range);
            const table = match ? tables.get(match[1]!) : undefined;
            if (table && match?.[2] === "1") return { values: [table.headers] };
            if (table && match?.[2] === "2") return { values: table.rows };
            return { values: [] };
          },
        },
      },
    },
    Gmail: {
      Users: {
        getProfile: () => ({ emailAddress: "contact@elev8mediaky.com" }),
        Messages: {
          list: () => ({ messages: options.gmail?.messages ?? [] }),
          get: () =>
            options.gmail?.metadata ?? {
              id: options.gmail?.messages?.[0]?.id,
              threadId: "thread-1",
              internalDate: "1780000000000",
              labelIds: ["INBOX"],
              payload: {
                headers: [{ name: "From", value: "private@example.com" }],
              },
            },
        },
      },
    },
  });
  vm.runInContext(code, context);
  return { context, properties, batchUpdate, deleted, lock, logs, reads };
}

describe("deployable Apps Script bundle", () => {
  it("exports real callable globals and blocks all GET reads", () => {
    const { context } = createRuntime();
    for (const name of [
      "doGet",
      "doPost",
      "cccInitializePilot",
      "cccHealth",
      "cccDisableAll",
      "cccBuildBriefing",
      "cccReconcileGmail",
      "cccProcessStudio",
    ])
      expect(typeof context[name]).toBe("function");
    expect(JSON.parse(context.doGet().value)).toEqual({
      status: "rejected",
      error_code: "method_not_allowed",
    });
    expect(
      JSON.parse(context.doPost({ postData: { contents: "private" } }).value),
    ).toEqual({ status: "rejected", error_code: "unavailable" });
  });

  it("bootstraps with every feature flag false and makes no workbook mutation when headers drift", () => {
    const enabled = Object.fromEntries(
      [
        "GMAIL_INTAKE",
        "STUDIO_PROCESSING",
        "SHORTCUT_INTAKE",
        "DRAFT_CREATION",
        "DRAFT_REPLACEMENT",
        "BRIEFING_DELIVERY",
      ].map((name) => [`CCC_${name}`, "true"]),
    );
    const initialized = createRuntime({ properties: enabled });
    expect(initialized.context.cccInitializePilot()).toMatchObject({
      ok: true,
      flags_enabled: [],
    });
    for (const name of Object.keys(enabled))
      expect(initialized.properties.get(name)).toBe("false");

    const drifted = createRuntime({
      sheets: [{ title: "Queue", sheetId: 1 }],
      queueHeaders: ["unexpected_header"],
    });
    expect(drifted.context.cccInitializePilot()).toEqual({
      ok: false,
      error_code: "OPERATION_FAILED",
    });
    expect(drifted.batchUpdate).not.toHaveBeenCalled();
    expect(drifted.properties.has("CCC_WORKBOOK_ID")).toBe(false);

    const unheadedRows = createRuntime({
      sheets: [{ title: "Queue", sheetId: 1 }],
      queueHeaders: [],
      queueRows: [["orphaned", "data"]],
    });
    expect(unheadedRows.context.cccInitializePilot()).toEqual({
      ok: false,
      error_code: "OPERATION_FAILED",
    });
    expect(unheadedRows.batchUpdate).not.toHaveBeenCalled();
    expect(unheadedRows.properties.has("CCC_WORKBOOK_ID")).toBe(false);
  });

  it("disables every feature and reports managed trigger removal", () => {
    const runtime = createRuntime({
      properties: { CCC_GMAIL_INTAKE: "true", CCC_SHORTCUT_INTAKE: "true" },
      triggers: [
        { handler: "cccBuildBriefing" },
        { handler: "unmanagedTrigger" },
      ],
    });
    expect(runtime.context.cccDisableAll()).toEqual({
      ok: true,
      flags_enabled: [],
      managed_triggers_deleted: 1,
      managed_triggers_remaining: 0,
    });
    expect(runtime.deleted).toEqual(["cccBuildBriefing"]);
    for (const name of [
      "GMAIL_INTAKE",
      "STUDIO_PROCESSING",
      "SHORTCUT_INTAKE",
      "DRAFT_CREATION",
      "DRAFT_REPLACEMENT",
      "BRIEFING_DELIVERY",
    ])
      expect(runtime.properties.get(`CCC_${name}`)).toBe("false");
  });

  it("runs a content-free persisted briefing synchronously and keeps disabled workers inert", async () => {
    const disabled = createRuntime({
      properties: { CCC_BRIEFING_DELIVERY: "false" },
    });
    const disabledResult = disabled.context.cccBuildBriefing();
    expect(disabledResult).toEqual({ ok: true, status: "disabled" });
    expect(disabled.reads).not.toContain("'Queue'!A1:ZZ1");
    await expect(disabled.context.cccReconcileGmail()).resolves.toEqual({
      ok: true,
      status: "disabled",
    });
    await expect(disabled.context.cccProcessStudio()).resolves.toEqual({
      ok: true,
      status: "disabled",
    });
    expect(disabled.reads).toEqual([]);

    const enabled = createRuntime({
      properties: {
        CCC_BRIEFING_DELIVERY: "true",
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
      },
    });
    const result = enabled.context.cccBuildBriefing();
    expect(result).not.toBeInstanceOf(Promise);
    expect(result).toMatchObject({
      ok: true,
      status: "generated",
      sections: 8,
      deliveryChannel: "none",
    });
    expect(result).not.toHaveProperty("briefing");
    expect(JSON.stringify(result)).not.toContain("No items");
    expect(enabled.reads).toContain("'Queue'!A1:ZZ1");
    expect(enabled.batchUpdate).toHaveBeenCalledOnce();
    expect(JSON.stringify(enabled.logs.mock.calls)).not.toContain("private");
  });

  it("reports Gmail probe metadata status without returning source content", () => {
    const runtime = createRuntime({
      gmail: {
        messages: [{ id: "message-1" }],
        metadata: {
          id: "message-1",
          threadId: "thread-1",
          internalDate: "1780000000000",
          labelIds: ["INBOX"],
          snippet: "PRIVATE SNIPPET",
          payload: {
            headers: [{ name: "From", value: "private@example.com" }],
            body: { data: "PRIVATE BODY" },
          },
        },
      },
    });
    const result = runtime.context.cccGmailReadProbe();
    expect(result).toEqual({
      ok: true,
      mailbox_verified: true,
      bounded_days: 30,
      sampled_messages: 1,
      metadata_verified: true,
      raw_content_stored: false,
      mutations: 0,
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("copies an explicit least-privilege manifest with no send-capable Gmail scope", () => {
    const manifest = JSON.parse(readFileSync("dist/appsscript.json", "utf8"));
    expect(manifest.timeZone).toBe("America/New_York");
    expect(manifest.oauthScopes).toContain(
      "https://www.googleapis.com/auth/gmail.readonly",
    );
    expect(manifest.oauthScopes).not.toContain(
      "https://www.googleapis.com/auth/gmail.send",
    );
    expect(manifest.oauthScopes).not.toContain(
      "https://www.googleapis.com/auth/gmail.compose",
    );
    expect(code).not.toMatch(/GmailApp|MailApp|\.Messages\.send\(/);
  });
});
