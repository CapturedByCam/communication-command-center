import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { z } from "zod";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
import { itemToRecord } from "../../src/adapters/sheets/queue-repository.js";
import { recordToRow } from "../../src/adapters/sheets/sheet-table.js";
import { selectedSnapshotInvalidDeadLetter } from "../../src/adapters/sheets/gmail-sync-repository.js";
import type { CommunicationItem } from "../../src/domain/types.js";

interface MockTable {
  headers: string[];
  rows: unknown[][];
}

function selectedQueueRow(
  waitingOn: CommunicationItem["waiting_on"] = "me",
): unknown[] {
  const headers = WORKBOOK_MANIFEST.find(
    (sheet) => sheet.name === "Queue",
  )!.headers;
  const item: CommunicationItem = {
    schema_version: "1.0",
    item_id: "cc_bundlewaiting01",
    source: "gmail",
    source_record_id: "synthetic-message-1",
    source_thread_id: "synthetic-thread-1",
    source_link: "https://mail.google.com/mail/u/0/#all/synthetic-thread-1",
    captured_at: "2026-09-22T12:00:00-04:00",
    updated_at: "2026-09-22T12:00:00-04:00",
    contact: { email: "synthetic@example.test" },
    category: "active_project",
    project_id: "project-1",
    status: "open",
    waiting_on: waitingOn,
    urgency: "today",
    priority_score: 85,
    next_action_type: "reply",
    next_action: "Reply to the synthetic message",
    summary: "Synthetic Queue item",
    preview: "Synthetic preview",
    deadline_at: null,
    deadline_text: null,
    needs_date_review: false,
    follow_up_at: null,
    promised_follow_up: null,
    draft_status: "needed",
    gmail_draft_id: null,
    confidence: 0.9,
    classifier_version: "test",
    content_hash: "a".repeat(64),
    manual_override: false,
    snooze_until: null,
    resolved_at: null,
    raw_content_stored: false,
    last_error_code: null,
  };
  const record = itemToRecord(item);
  return headers.map((header) => record[header] ?? null);
}
let code: string;
beforeAll(() => {
  execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: process.cwd() });
  code = readFileSync("dist/Code.js", "utf8");
});

function studioServices() {
  const inputs: { field: string; mode: string; includeVariables: boolean }[] =
    [];
  const card = () => ({
    addSection() {
      return this;
    },
    addWidget() {
      return this;
    },
    setHeader() {
      return this;
    },
    setText() {
      return this;
    },
    build() {
      return { kind: "card" };
    },
  });
  return {
    inputs,
    CardService: {
      TextInputMode: { PLAIN_TEXT: "PLAIN_TEXT" },
      newTextInput: () => {
        const item = { field: "", mode: "", includeVariables: false };
        inputs.push(item);
        return {
          setFieldName(value: string) {
            item.field = value;
            return this;
          },
          setTitle() {
            return this;
          },
          setInputMode(value: string) {
            item.mode = value;
            return this;
          },
          setHostAppDataSource(value: { workflow: { include: boolean } }) {
            item.includeVariables = value.workflow.include;
            return this;
          },
        };
      },
      newHostAppDataSource: () => ({
        workflow: { include: false },
        setWorkflowDataSource(value: { include: boolean }) {
          this.workflow = value;
          return this;
        },
      }),
      newWorkflowDataSource: () => ({
        include: false,
        setIncludeVariables(value: boolean) {
          this.include = value;
          return this;
        },
      }),
      newCardBuilder: card,
      newCardSection: card,
      newTextParagraph: card,
    },
    AddOnsResponseService: {
      newVariableData: () => ({
        values: [] as string[],
        addStringValue(value: string) {
          this.values.push(value);
          return this;
        },
      }),
      newReturnOutputVariablesAction: () => ({
        variables: {} as Record<string, string[]>,
        addVariableData(id: string, data: { values: string[] }) {
          this.variables[id] = data.values;
          return this;
        },
      }),
      newHostAppAction: () => ({
        action: { variables: {} as Record<string, string[]> },
        setWorkflowAction(value: { variables: Record<string, string[]> }) {
          this.action = value;
          return this;
        },
      }),
      newRenderActionBuilder: () => ({
        host: { action: { variables: {} as Record<string, string[]> } },
        setHostAppAction(value: {
          action: { variables: Record<string, string[]> };
        }) {
          this.host = value;
          return this;
        },
        build() {
          return this.host.action.variables;
        },
      }),
    },
  };
}

function createRuntime(
  options: {
    readonly properties?: Record<string, string>;
    readonly sheets?: { title: string; sheetId: number }[];
    readonly queueHeaders?: readonly string[];
    readonly queueRows?: unknown[][];
    readonly deadLetterRows?: unknown[][];
    readonly gmail?: {
      messages?: { id: string; threadId?: string }[];
      metadata?: unknown;
    };
    readonly triggers?: { readonly handler: string }[];
    readonly selection?: {
      readonly sheetName: string;
      readonly row: number;
      readonly numRows?: number;
    };
    readonly promptButton?: "OK" | "CANCEL";
    readonly promptText?: string;
    readonly failBatch?: boolean;
    readonly failValuesRead?: boolean;
    readonly failValuesReadTimes?: number;
    readonly failMetadataRead?: boolean;
    readonly applyBatchWrites?: boolean;
    readonly onPrompt?: (
      properties: Map<string, string>,
      reads: readonly string[],
    ) => void;
  } = {},
) {
  const properties = new Map(Object.entries(options.properties ?? {}));
  let remainingValuesReadFailures = options.failValuesReadTimes ?? 0;
  const batchUpdate = vi.fn();
  if (options.failBatch)
    batchUpdate.mockImplementation(() => {
      throw new Error("private provider failure detail");
    });
  const deleted: string[] = [];
  const triggers = [...(options.triggers ?? [])];
  const tables = new Map<string, MockTable>(
    WORKBOOK_MANIFEST.map((sheet) => [
      sheet.name,
      { headers: [...sheet.headers], rows: [] as unknown[][] },
    ]),
  );
  if (options.applyBatchWrites)
    batchUpdate.mockImplementation(
      (body: {
        requests: {
          updateCells: {
            start: { sheetId: number; rowIndex: number };
            rows: {
              values: {
                userEnteredValue?: {
                  stringValue?: string;
                  numberValue?: number;
                  boolValue?: boolean;
                };
              }[];
            }[];
          };
        }[];
      }) => {
        for (const request of body.requests) {
          const change = request.updateCells;
          const sheet = WORKBOOK_MANIFEST[change.start.sheetId - 1]!;
          const rows = change.rows.map((row) =>
            row.values.map(
              (cell) =>
                cell.userEnteredValue?.stringValue ??
                cell.userEnteredValue?.numberValue ??
                cell.userEnteredValue?.boolValue ??
                "",
            ),
          );
          tables
            .get(sheet.name)!
            .rows.splice(change.start.rowIndex - 1, rows.length, ...rows);
        }
        return {};
      },
    );
  const queue = tables.get("Queue")!;
  queue.headers = [...(options.queueHeaders ?? queue.headers)];
  queue.rows = (options.queueRows ?? []).map((row) =>
    row.map((value) => (value === null ? "" : value)),
  );
  tables.get("Dead_Letter")!.rows = (options.deadLetterRows ?? []).map((row) =>
    row.map((value) => (value === null ? "" : value)),
  );
  const sheets =
    options.sheets ??
    WORKBOOK_MANIFEST.map((sheet, index) => ({
      title: sheet.name,
      sheetId: index + 1,
    }));
  const reads: string[] = [];
  const logs = vi.fn();
  const toast = vi.fn();
  const prompt = vi.fn(() => {
    options.onPrompt?.(properties, reads);
    return {
      getSelectedButton: () => options.promptButton ?? "OK",
      getResponseText: () => options.promptText ?? "2026-09-25T14:30:00-04:00",
    };
  });
  const gmailGets = vi.fn();
  const sleep = vi.fn();
  const menu = {
    addItem: vi.fn().mockReturnThis(),
    addSeparator: vi.fn().mockReturnThis(),
    addToUi: vi.fn(),
  };
  const ui = {
    Button: { OK: "OK" },
    ButtonSet: { OK_CANCEL: "OK_CANCEL" },
    prompt,
    createMenu: vi.fn(() => menu),
  };
  const lock = { tryLock: vi.fn(() => true), releaseLock: vi.fn() };
  const cacheValues = new Map<string, string>();
  const cachePut = vi.fn((key: string, value: string) => {
    cacheValues.set(key, value);
  });
  const studio = studioServices();
  const context = vm.createContext({
    CardService: studio.CardService,
    AddOnsResponseService: studio.AddOnsResponseService,
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
      getActiveSpreadsheet: () => ({
        getId: () => "book_abcdefghijklmnop",
        toast,
        getActiveRange: () =>
          options.selection
            ? {
                getSheet: () => ({
                  getName: () => options.selection!.sheetName,
                }),
                getNumRows: () => options.selection!.numRows ?? 1,
                getRow: () => options.selection!.row,
              }
            : null,
      }),
      getUi: () => ui,
    },
    LockService: { getScriptLock: () => lock },
    CacheService: {
      getScriptCache: () => ({
        get: (key: string) => cacheValues.get(key) ?? null,
        put: cachePut,
      }),
    },
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
      sleep,
    },
    Sheets: {
      Spreadsheets: {
        get: () => {
          if (options.failMetadataRead)
            throw new Error("private provider failure detail");
          return {
            sheets: sheets.map(({ title, sheetId }) => ({
              properties: { title, sheetId },
            })),
          };
        },
        batchUpdate,
        Values: {
          get: (_id: string, range: string) => {
            const failThisRead =
              options.failValuesRead || remainingValuesReadFailures > 0;
            if (remainingValuesReadFailures > 0) remainingValuesReadFailures--;
            if (failThisRead)
              throw new Error("private provider failure detail");
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
          get: (...args: unknown[]) => (
            gmailGets(...args),
            options.gmail?.metadata ?? {
              id: options.gmail?.messages?.[0]?.id,
              threadId: "thread-1",
              internalDate: "1780000000000",
              labelIds: ["INBOX"],
              payload: {
                headers: [{ name: "From", value: "private@example.com" }],
              },
            }
          ),
        },
      },
    },
  });
  vm.runInContext(code, context);
  return {
    context,
    tables,
    properties,
    batchUpdate,
    deleted,
    lock,
    cacheValues,
    cachePut,
    logs,
    reads,
    prompt,
    menu,
    toast,
    gmailGets,
    sleep,
    studioInputs: studio.inputs,
  };
}

describe("deployable Apps Script bundle", () => {
  it("exports real callable globals and blocks all GET reads", () => {
    const { context } = createRuntime();
    for (const name of [
      "doGet",
      "doPost",
      "onOpen",
      "cccInitializePilot",
      "cccMigrateEmptyCommitments",
      "cccHealth",
      "cccDisableAll",
      "cccBuildBriefing",
      "cccReconcileGmail",
      "cccReconcileGmailBatch",
      "cccStartGmailReconciliationWindow",
      "cccProcessStudio",
      "cccConfigureStudioStep",
      "cccExecuteStudioStep",
      "cccResolveSelectedQueueRow",
      "cccReopenSelectedQueueRow",
      "cccSnoozeSelectedQueueRow",
      "cccSetSelectedQueueWaiting",
      "cccRetrySelectedGmailSnapshotFailure",
      "cccReplaySelectedGmailQueueItem",
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

  it("rate limits unauthenticated Shortcut requests before parsing their body", () => {
    const runtime = createRuntime({
      properties: {
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
        CCC_SHORTCUT_INTAKE: "true",
      },
    });
    const post = () =>
      JSON.parse(
        runtime.context.doPost({ postData: { contents: "not JSON" } }).value,
      );

    for (let request = 0; request < 10; request++)
      expect(post()).toEqual({
        status: "rejected",
        error_code: "invalid_payload",
      });
    expect(post()).toEqual({
      status: "rejected",
      error_code: "rate_limited",
    });
    expect(runtime.cacheValues.size).toBe(1);
    expect(runtime.cachePut).toHaveBeenCalledTimes(10);
    expect(runtime.reads).toEqual([]);
    expect(runtime.batchUpdate).not.toHaveBeenCalled();
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
        "MANUAL_WRITES",
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
    expect(runtime.lock.tryLock).toHaveBeenCalledWith(5000);
    expect(runtime.lock.releaseLock).toHaveBeenCalledOnce();
    for (const name of [
      "GMAIL_INTAKE",
      "STUDIO_PROCESSING",
      "SHORTCUT_INTAKE",
      "DRAFT_CREATION",
      "DRAFT_REPLACEMENT",
      "BRIEFING_DELIVERY",
      "MANUAL_WRITES",
    ])
      expect(runtime.properties.get(`CCC_${name}`)).toBe("false");
  });

  it("shows guarded controls but does not inspect Queue when manual writes are disabled", async () => {
    const runtime = createRuntime({
      properties: {
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
        CCC_MANUAL_WRITES: "false",
      },
      selection: { sheetName: "Queue", row: 2 },
    });
    runtime.context.onOpen();
    expect(runtime.menu.addItem).toHaveBeenCalledWith(
      "Resolve selected Queue row",
      "cccResolveSelectedQueueRow",
    );
    expect(runtime.menu.addItem).toHaveBeenCalledWith(
      "Set selected Queue waiting state",
      "cccSetSelectedQueueWaiting",
    );
    await expect(runtime.context.cccResolveSelectedQueueRow()).resolves.toEqual(
      {
        ok: true,
        status: "disabled",
      },
    );
    await expect(runtime.context.cccSetSelectedQueueWaiting()).resolves.toEqual(
      {
        ok: true,
        status: "disabled",
      },
    );
    expect(runtime.reads).toEqual([]);
    expect(runtime.prompt).not.toHaveBeenCalled();
    expect(runtime.toast).toHaveBeenCalledWith(
      "Manual Queue controls are disabled.",
      "Communication Command Center",
      5,
    );
    await expect(
      runtime.context.cccRetrySelectedGmailSnapshotFailure(),
    ).resolves.toEqual({ ok: true, status: "disabled" });
    await expect(
      runtime.context.cccReplaySelectedGmailQueueItem(),
    ).resolves.toEqual({ ok: true, status: "disabled" });
    expect(runtime.reads).toEqual([]);
    expect(runtime.prompt).toHaveBeenCalledTimes(0);
  });

  it("passes an exact waiting state through the native prompt and fails closed after cancellation or prompt-time disable", async () => {
    const configured = createRuntime({
      properties: {
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
        CCC_MANUAL_WRITES: "true",
      },
      selection: { sheetName: "Queue", row: 2 },
      queueRows: [selectedQueueRow("me")],
      promptText: "them",
    });
    await expect(
      configured.context.cccSetSelectedQueueWaiting(),
    ).resolves.toEqual({ ok: true, status: "waiting_updated" });
    expect(configured.prompt).toHaveBeenCalledWith(
      "Set selected Queue waiting state",
      "Enter exactly one value: me, them, none, or unknown.",
      "OK_CANCEL",
    );
    expect(configured.batchUpdate).toHaveBeenCalledOnce();
    const changedSheetIds =
      configured.batchUpdate.mock.calls[0]![0].requests.map(
        (request: { updateCells: { start: { sheetId: number } } }) =>
          request.updateCells.start.sheetId,
      );
    expect(changedSheetIds).toEqual(
      ["Queue", "Audit_Log"].map(
        (name) =>
          WORKBOOK_MANIFEST.findIndex((sheet) => sheet.name === name) + 1,
      ),
    );
    expect(JSON.stringify(configured.batchUpdate.mock.calls)).toContain("them");

    const cancelled = createRuntime({
      properties: {
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
        CCC_MANUAL_WRITES: "true",
      },
      selection: { sheetName: "Queue", row: 2 },
      queueRows: [selectedQueueRow("me")],
      promptButton: "CANCEL",
    });
    await expect(
      cancelled.context.cccSetSelectedQueueWaiting(),
    ).resolves.toEqual({ ok: true, status: "cancelled" });
    expect(cancelled.batchUpdate).not.toHaveBeenCalled();

    let readsAtPrompt = -1;
    const disabledDuringPrompt = createRuntime({
      properties: {
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
        CCC_MANUAL_WRITES: "true",
      },
      selection: { sheetName: "Queue", row: 2 },
      queueRows: [selectedQueueRow("me")],
      promptText: "them",
      onPrompt: (properties, reads) => {
        readsAtPrompt = reads.length;
        properties.set("CCC_MANUAL_WRITES", "false");
      },
    });
    await expect(
      disabledDuringPrompt.context.cccSetSelectedQueueWaiting(),
    ).resolves.toEqual({ ok: true, status: "disabled" });
    expect(readsAtPrompt).toBeGreaterThan(0);
    expect(disabledDuringPrompt.reads).toHaveLength(readsAtPrompt);
    expect(disabledDuringPrompt.batchUpdate).not.toHaveBeenCalled();
  });

  it("does not inspect a selected row when Gmail intake is disabled", async () => {
    const runtime = createRuntime({
      properties: {
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
        CCC_MANUAL_WRITES: "true",
        CCC_GMAIL_INTAKE: "false",
      },
      selection: { sheetName: "Dead_Letter", row: 2 },
    });
    await expect(
      runtime.context.cccRetrySelectedGmailSnapshotFailure(),
    ).resolves.toEqual({ ok: true, status: "disabled" });
    expect(runtime.reads).toEqual([]);
    expect(runtime.prompt).not.toHaveBeenCalled();
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

  it("reconciles eligible Gmail metadata without browser URL globals", async () => {
    const privateMarker = "SANITIZED-SENDER@example.com";
    const runtime = createRuntime({
      properties: {
        CCC_GMAIL_INTAKE: "true",
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
      },
      gmail: {
        messages: [{ id: "synthetic-message", threadId: "synthetic-thread" }],
        metadata: {
          id: "synthetic-message",
          threadId: "synthetic-thread",
          internalDate: String(Date.now() - 60_000),
          labelIds: ["INBOX"],
          payload: {
            headers: [
              { name: "From", value: privateMarker },
              { name: "To", value: "contact@elev8mediaky.com" },
            ],
          },
        },
      },
    });
    expect(vm.runInContext("typeof URL", runtime.context)).toBe("function");
    expect(vm.runInContext("typeof URLSearchParams", runtime.context)).toBe(
      "function",
    );
    for (const name of [
      "window",
      "navigator",
      "process",
      "setTimeout",
      "fetch",
      "TextEncoder",
    ])
      expect(vm.runInContext(`typeof ${name}`, runtime.context)).toBe(
        "undefined",
      );

    await expect(runtime.context.cccReconcileGmail()).resolves.toMatchObject({
      ok: true,
      status: "more",
      processed: 0,
      failed: 0,
    });
    expect(runtime.reads).not.toContain("'Studio_Inbox'!A1:ZZ1");
    expect(runtime.gmailGets).not.toHaveBeenCalled();
    // Apply the first Config batch so the next invocation sees persisted enumeration.
    for (const request of runtime.batchUpdate.mock.calls[0]![0].requests) {
      const change = request.updateCells;
      const sheet = WORKBOOK_MANIFEST[change.start.sheetId - 1]!;
      expect(sheet.name).toBe("Config");
      const rows = change.rows.map(
        (row: {
          values: {
            userEnteredValue?: {
              stringValue?: string;
              numberValue?: number;
              boolValue?: boolean;
            };
          }[];
        }) =>
          row.values.map(
            (cell) =>
              cell.userEnteredValue?.stringValue ??
              cell.userEnteredValue?.numberValue ??
              cell.userEnteredValue?.boolValue ??
              "",
          ),
      );
      runtime.tables
        .get(sheet.name)!
        .rows.splice(change.start.rowIndex - 1, rows.length, ...rows);
    }
    await expect(runtime.context.cccReconcileGmail()).resolves.toMatchObject({
      ok: true,
      status: "complete",
      processed: 1,
      excluded: 0,
      failed: 0,
    });
    expect(runtime.batchUpdate).toHaveBeenCalledTimes(2);
    const requestSheetIds = runtime.batchUpdate.mock.calls[1]![0].requests.map(
      (request: { updateCells: { start: { sheetId: number } } }) =>
        request.updateCells.start.sheetId,
    );
    const sheetId = (name: string) =>
      WORKBOOK_MANIFEST.findIndex((sheet) => sheet.name === name) + 1;
    expect(requestSheetIds).toEqual(
      expect.arrayContaining([sheetId("Queue"), sheetId("Audit_Log")]),
    );
    expect(requestSheetIds).not.toContain(sheetId("Dead_Letter"));
    expect(JSON.stringify(runtime.batchUpdate.mock.calls)).not.toContain(
      privateMarker,
    );
  });

  it("runs bounded Gmail steps until the durable cursor completes", async () => {
    const runtime = createRuntime({
      applyBatchWrites: true,
      properties: {
        CCC_GMAIL_INTAKE: "true",
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
      },
      gmail: {
        messages: [{ id: "synthetic-message", threadId: "synthetic-thread" }],
        metadata: {
          id: "synthetic-message",
          threadId: "synthetic-thread",
          internalDate: String(Date.now() - 60_000),
          labelIds: ["INBOX"],
          payload: {
            headers: [
              { name: "From", value: "SANITIZED-SENDER@example.com" },
              { name: "To", value: "contact@elev8mediaky.com" },
            ],
          },
        },
      },
    });

    await expect(runtime.context.cccReconcileGmailBatch()).resolves.toEqual({
      ok: true,
      status: "complete",
      steps: 2,
      processed: 1,
      excluded: 0,
      failed: 0,
    });
    expect(runtime.batchUpdate).toHaveBeenCalledTimes(2);
    expect(runtime.sleep).toHaveBeenCalledOnce();
    expect(runtime.sleep).toHaveBeenCalledWith(6000);
  });

  it("retries transient Sheets reads before advancing the durable Gmail step", async () => {
    const runtime = createRuntime({
      applyBatchWrites: true,
      failValuesReadTimes: 1,
      properties: {
        CCC_GMAIL_INTAKE: "true",
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
      },
      gmail: {
        messages: [{ id: "synthetic-message", threadId: "synthetic-thread" }],
        metadata: {
          id: "synthetic-message",
          threadId: "synthetic-thread",
          internalDate: String(Date.now() - 60_000),
          labelIds: ["INBOX"],
          payload: {
            headers: [
              { name: "From", value: "SANITIZED-SENDER@example.com" },
              { name: "To", value: "contact@elev8mediaky.com" },
            ],
          },
        },
      },
    });

    await expect(runtime.context.cccReconcileGmailBatch()).resolves.toEqual({
      ok: true,
      status: "complete",
      steps: 2,
      processed: 1,
      excluded: 0,
      failed: 0,
    });
    expect(runtime.batchUpdate).toHaveBeenCalledTimes(2);
    expect(runtime.sleep.mock.calls).toEqual([[30_000], [6000]]);
  });

  it("returns a persistent Sheets read failure after bounded backoff", async () => {
    const runtime = createRuntime({
      properties: {
        CCC_GMAIL_INTAKE: "true",
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
      },
      failValuesRead: true,
    });

    await expect(runtime.context.cccReconcileGmailBatch()).resolves.toEqual({
      ok: false,
      error_code: "RECONCILIATION_FAILED",
      failure_stage: "reconciliation",
      failure_kind: "sheet_values_read_failure",
      failure_target: "Config:headers",
    });
    expect(runtime.sleep.mock.calls).toEqual([[30_000], [60_000]]);
    expect(runtime.batchUpdate).not.toHaveBeenCalled();
  });

  it("returns only a controlled diagnostic when a Sheets batch outcome is uncertain", async () => {
    const runtime = createRuntime({
      properties: {
        CCC_GMAIL_INTAKE: "true",
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
      },
      failBatch: true,
    });

    const result = await runtime.context.cccReconcileGmail();

    expect(result).toEqual({
      ok: false,
      error_code: "RECONCILIATION_FAILED",
      failure_stage: "reconciliation",
      failure_kind: "sheet_commit_uncertain",
    });
    expect(JSON.stringify(result)).not.toContain(
      "private provider failure detail",
    );
    expect(JSON.stringify(runtime.logs.mock.calls)).not.toContain(
      "private provider failure detail",
    );
    expect(runtime.tables.get("Queue")!.rows).toHaveLength(0);
  });

  it("distinguishes a Sheets values read failure without logging provider detail", async () => {
    const runtime = createRuntime({
      properties: {
        CCC_GMAIL_INTAKE: "true",
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
      },
      failValuesRead: true,
    });
    const result = await runtime.context.cccReconcileGmail();
    expect(result).toEqual({
      ok: false,
      error_code: "RECONCILIATION_FAILED",
      failure_stage: "reconciliation",
      failure_kind: "sheet_values_read_failure",
      failure_target: "Config:headers",
    });
    expect(JSON.stringify(runtime.logs.mock.calls)).not.toContain(
      "private provider failure detail",
    );
    expect(runtime.batchUpdate).not.toHaveBeenCalled();
  });

  it("distinguishes a Sheets metadata read failure before any batch write", async () => {
    const runtime = createRuntime({
      properties: {
        CCC_GMAIL_INTAKE: "true",
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
      },
      failMetadataRead: true,
    });
    const result = await runtime.context.cccReconcileGmail();
    expect(result).toEqual({
      ok: false,
      error_code: "RECONCILIATION_FAILED",
      failure_stage: "reconciliation",
      failure_kind: "sheet_metadata_read_failure",
    });
    expect(JSON.stringify(runtime.logs.mock.calls)).not.toContain(
      "private provider failure detail",
    );
    expect(runtime.batchUpdate).not.toHaveBeenCalled();
  });

  it("retries a selected Gmail snapshot failure through the URL-less native bundle in one Queue, Audit, and Dead_Letter commit", async () => {
    const privateMarker = "SANITIZED-RECOVERY-SENDER@example.com";
    const receiptAt = new Date(Date.now() + 60_000).toISOString();
    const deadHeaders = WORKBOOK_MANIFEST.find(
      (sheet) => sheet.name === "Dead_Letter",
    )!.headers;
    const runtime = createRuntime({
      properties: {
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
        CCC_MANUAL_WRITES: "true",
        CCC_GMAIL_INTAKE: "true",
      },
      selection: { sheetName: "Dead_Letter", row: 2 },
      deadLetterRows: (() => {
        const row = recordToRow(deadHeaders, {
          dead_letter_id: `dl_${"a".repeat(64)}`,
          received_at: receiptAt,
          source: "gmail",
          source_record_id: "synthetic-message",
          error_code: "SNAPSHOT_INVALID",
          payload_hash: "a".repeat(64),
          status: "open",
          resolved_at: null,
          resolution_actor: null,
        });
        expect(
          selectedSnapshotInvalidDeadLetter(deadHeaders, [row], 0),
        ).toEqual(row);
        return [row];
      })(),
      gmail: {
        metadata: {
          id: "synthetic-message",
          threadId: "synthetic-thread",
          internalDate: String(Date.now()),
          labelIds: ["INBOX"],
          payload: {
            headers: [
              { name: "From", value: privateMarker },
              { name: "To", value: "contact@elev8mediaky.com" },
            ],
          },
        },
      },
    });

    await expect(
      runtime.context.cccRetrySelectedGmailSnapshotFailure(),
    ).resolves.toEqual({ ok: true, status: "replayed" });
    expect(runtime.gmailGets).toHaveBeenCalledOnce();
    expect(runtime.batchUpdate).toHaveBeenCalledOnce();
    const requestSheetIds = runtime.batchUpdate.mock.calls[0]![0].requests.map(
      (request: { updateCells: { start: { sheetId: number } } }) =>
        request.updateCells.start.sheetId,
    );
    const sheetId = (name: string) =>
      WORKBOOK_MANIFEST.findIndex((sheet) => sheet.name === name) + 1;
    expect(requestSheetIds).toEqual(
      expect.arrayContaining([
        sheetId("Queue"),
        sheetId("Audit_Log"),
        sheetId("Dead_Letter"),
      ]),
    );
    expect(requestSheetIds).not.toContain(sheetId("Config"));
    expect(runtime.reads.some((range) => range.includes("Config"))).toBe(true);
    expect(JSON.stringify(runtime.batchUpdate.mock.calls)).not.toContain(
      privateMarker,
    );
    expect(JSON.stringify(runtime.logs.mock.calls)).not.toContain(
      privateMarker,
    );
  });

  it("stops a selected Gmail failure replay after its confirmation when a required flag is disabled", async () => {
    const deadHeaders = WORKBOOK_MANIFEST.find(
      (sheet) => sheet.name === "Dead_Letter",
    )!.headers;
    const runtime = createRuntime({
      properties: {
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
        CCC_MANUAL_WRITES: "true",
        CCC_GMAIL_INTAKE: "true",
      },
      selection: { sheetName: "Dead_Letter", row: 2 },
      deadLetterRows: [
        recordToRow(deadHeaders, {
          dead_letter_id: `dl_${"b".repeat(64)}`,
          received_at: new Date(Date.now() + 60_000).toISOString(),
          source: "gmail",
          source_record_id: "synthetic-message",
          error_code: "SNAPSHOT_INVALID",
          payload_hash: "b".repeat(64),
          status: "open",
          resolved_at: null,
          resolution_actor: null,
        }),
      ],
      onPrompt: (properties) => properties.set("CCC_GMAIL_INTAKE", "false"),
    });

    await expect(
      runtime.context.cccRetrySelectedGmailSnapshotFailure(),
    ).resolves.toEqual({ ok: true, status: "disabled" });
    expect(runtime.prompt).toHaveBeenCalledOnce();
    expect(runtime.gmailGets).not.toHaveBeenCalled();
    expect(runtime.batchUpdate).not.toHaveBeenCalled();
  });

  it("preserves canonical URL rejection", () => {
    expect(z.string().url().safeParse("not a URL").success).toBe(false);
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
      bounded_days: 7,
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

describe("native Studio callback", () => {
  it("builds single-variable inputs and synchronously returns disabled outputs without reads", () => {
    const r = createRuntime();
    expect(r.context.cccConfigureStudioStep()).toEqual({ kind: "card" });
    expect(r.studioInputs).toEqual([
      { field: "gmail_message_id", mode: "PLAIN_TEXT", includeVariables: true },
      { field: "model_json", mode: "PLAIN_TEXT", includeVariables: true },
    ]);
    const result = r.context.cccExecuteStudioStep({
      untrusted: "private event",
    });
    expect(result).toEqual({ status: ["disabled"], ingest_id: [""] });
    expect(result.then).toBeUndefined();
    expect(r.reads).toEqual([]);
    expect(r.gmailGets).not.toHaveBeenCalled();
    expect(r.batchUpdate).not.toHaveBeenCalled();
    expect(r.logs).not.toHaveBeenCalled();
  });

  it("returns a synchronous staged output after one native atomic metadata-only append", () => {
    const r = createRuntime({
      properties: {
        CCC_STUDIO_PROCESSING: "true",
        CCC_WORKBOOK_ID: "book_abcdefghijklmnop",
      },
      gmail: {
        metadata: {
          id: "studio-message-1",
          threadId: "studio-thread-1",
          internalDate: String(Date.now() - 86_400_000),
          labelIds: ["INBOX"],
          payload: {
            headers: [
              { name: "From", value: "Known Person <known@example.com>" },
              { name: "Subject", value: "Status request" },
            ],
          },
        },
      },
    });
    const result = r.context.cccExecuteStudioStep({
      workflow: {
        actionInvocation: {
          inputs: {
            gmail_message_id: { stringValues: ["studio-message-1"] },
            model_json: {
              stringValues: [
                JSON.stringify({
                  requires_response: true,
                  direct_response_requested: true,
                  draft_risk: "routine",
                  category_hint: "client_lead",
                  project_hint: null,
                  deadline_text: null,
                  next_action_hint: "Review availability.",
                  summary_hint: "A short request.",
                  confidence_hint: 0.8,
                  message_kind: null,
                  consequences: [],
                  model_uncertain: false,
                }),
              ],
            },
          },
        },
      },
    });
    expect(result).toEqual({
      status: ["staged"],
      ingest_id: ["studio:gmail:studio-message-1"],
    });
    expect(result.then).toBeUndefined();
    expect(r.gmailGets).toHaveBeenCalledWith("me", "studio-message-1", {
      format: "metadata",
      metadataHeaders: ["From", "Subject"],
      fields: "id,threadId,internalDate,labelIds,payload/headers",
    });
    expect(r.batchUpdate).toHaveBeenCalledTimes(1);
    const serialized = JSON.stringify(r.batchUpdate.mock.calls);
    expect(serialized).toContain("review_only");
    expect(serialized).not.toContain("model_json");
    expect(
      r.reads.every((range) => /'(Contacts|Studio_Inbox)'!/u.test(range)),
    ).toBe(true);
    expect(r.logs).not.toHaveBeenCalled();
    expect(r.lock.releaseLock).toHaveBeenCalledTimes(1);
  });
});
