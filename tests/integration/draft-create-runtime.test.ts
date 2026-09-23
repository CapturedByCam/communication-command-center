import { afterEach, describe, expect, it, vi } from "vitest";
import {
  itemToRecord,
  queueItemFromRow,
} from "../../src/adapters/sheets/queue-repository.js";
import {
  recordToRow,
  type CellValue,
  type SheetTable,
} from "../../src/adapters/sheets/sheet-table.js";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
import { createSelectedQueueDraft } from "../../src/apps-script/draft-create-runtime.js";
import { manualDraftMessage } from "../../src/apps-script/entrypoints.js";
import type {
  TableChange,
  TableGateway,
} from "../../src/apps-script/sheet-adapter.js";
import type { CommunicationItem } from "../../src/domain/types.js";

const workbook = "book_abcdefghijklmnopqrstuv";
const mailbox = "contact@elev8mediaky.com";
const now = "2026-09-23T16:00:00.000Z";

const item: CommunicationItem = {
  schema_version: "1.0",
  item_id: "cc_runtimefixture01",
  source: "gmail",
  source_record_id: "message-one",
  source_thread_id: "thread-one",
  captured_at: "2026-09-23T15:00:00.000Z",
  updated_at: "2026-09-23T15:00:00.000Z",
  contact: { email: "known@example.com" },
  category: "active_project",
  project_id: null,
  status: "open",
  waiting_on: "me",
  urgency: "today",
  priority_score: 80,
  next_action_type: "reply",
  next_action: "Reply to the synthetic request",
  summary: "Synthetic request",
  preview: null,
  deadline_at: null,
  deadline_text: null,
  needs_date_review: false,
  follow_up_at: null,
  promised_follow_up: null,
  draft_status: "needed",
  gmail_draft_id: null,
  confidence: 0.9,
  classifier_version: "fixture-v1",
  content_hash: "a".repeat(64),
  manual_override: false,
  snooze_until: null,
  resolved_at: null,
  raw_content_stored: false,
  last_error_code: null,
};

const interpretation = {
  requires_response: true,
  direct_response_requested: true,
  draft_risk: "routine" as const,
  category_hint: "active_project" as const,
  project_hint: null,
  deadline_text: null,
  next_action_hint: "Reply",
  summary_hint: "Synthetic request",
  confidence_hint: 0.9,
  message_kind: null,
  consequences: [],
  model_uncertain: false,
};

class Gateway implements TableGateway {
  readonly tables = new Map<string, SheetTable>();
  commits = 0;
  reads = 0;
  acquire(): void {}
  release(): void {}
  read(_spreadsheetId: string, sheetName: string): SheetTable {
    this.reads += 1;
    const table = this.tables.get(sheetName);
    if (!table) throw new Error("missing table");
    return {
      headers: [...table.headers],
      rows: table.rows.map((row) => [...row]),
    };
  }
  commit(_spreadsheetId: string, changes: TableChange[]): void {
    this.commits += 1;
    for (const change of changes) {
      this.tables.set(change.sheetName, {
        headers: [...change.after.headers],
        rows: change.after.rows.map((row) => [...row]),
      });
    }
  }
}

function headers(name: string): readonly string[] {
  return WORKBOOK_MANIFEST.find((sheet) => sheet.name === name)!.headers;
}

function setup(enabled = true) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  const gateway = new Gateway();
  const queueRow = recordToRow(headers("Queue"), itemToRecord(item));
  gateway.tables.set("Queue", {
    headers: [...headers("Queue")],
    rows: [queueRow],
  });
  gateway.tables.set("Config", {
    headers: [...headers("Config")],
    rows: [],
  });
  gateway.tables.set("Contacts", {
    headers: [...headers("Contacts")],
    rows: [
      recordToRow(headers("Contacts"), {
        contact_id: "contact_fixture",
        name: "Known Person",
        email: "known@example.com",
        phone: null,
        handle: null,
        approved_aliases: null,
        active: true,
        notes: null,
        updated_at: now,
      }),
    ],
  });
  const properties: Record<string, string> = {
    CCC_WORKBOOK_ID: workbook,
    CCC_DRAFT_CREATION: String(enabled),
  };
  const create = vi.fn(() => ({
    id: "draft-one",
    message: { id: "draft-message-one", threadId: item.source_thread_id },
  }));
  const getMessage = vi.fn(() => ({
    id: item.source_record_id,
    threadId: item.source_thread_id,
    internalDate: String(Date.parse(now) - 60_000),
    labelIds: ["INBOX"],
    payload: {
      headers: [
        { name: "From", value: "Known Person <known@example.com>" },
        { name: "To", value: mailbox },
        { name: "Subject", value: "Synthetic request" },
        { name: "Message-ID", value: "<request-1@example.com>" },
      ],
    },
  }));
  vi.stubGlobal("Session", {
    getEffectiveUser: () => ({ getEmail: () => mailbox }),
  });
  vi.stubGlobal("PropertiesService", {
    getScriptProperties: () => ({
      getProperty: (key: string) => properties[key] ?? null,
    }),
  });
  vi.stubGlobal("Gmail", {
    Users: {
      getProfile: () => ({ emailAddress: mailbox }),
      Messages: { get: getMessage },
      Drafts: { create },
    },
  });
  vi.stubGlobal("Utilities", {
    Charset: { UTF_8: "UTF_8" },
    base64EncodeWebSafe: (value: string) =>
      Buffer.from(value, "utf8").toString("base64url"),
  });
  return { gateway, queueRow, properties, create, getMessage };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("selected Queue create-only Gmail draft runtime", () => {
  it("warns that a stale successful write created a draft", () => {
    expect(manualDraftMessage({ outcome: "stale", draftId: "draft-one" })).toBe(
      "An unsent Gmail draft was created but became stale; review recovery before retrying.",
    );
  });

  it("creates one unsent draft and persists only operation metadata", async () => {
    const state = setup();
    const result = await createSelectedQueueDraft({
      gateway: state.gateway,
      spreadsheetId: workbook,
      selectedRowIndex: 0,
      selectedRow: state.queueRow,
      interpretation,
      draftText: "Thanks for the update.",
      getCuratedContacts: () => [
        {
          contactId: "contact_fixture",
          name: "Known Person",
          emails: ["known@example.com"],
          approvedAliases: [],
          active: true,
        },
      ],
      now: () => now,
      hash: () => "b".repeat(64),
      newOperationId: () => "11111111-1111-4111-8111-111111111111",
    });

    expect(result).toEqual({ outcome: "created", draftId: "draft-one" });
    expect(state.create).toHaveBeenCalledOnce();
    const stored = JSON.stringify(state.gateway.tables.get("Config"));
    expect(stored).toContain("gmail.draft.v1.cc_runtimefixture01");
    expect(stored).not.toContain("Thanks for the update.");
    const projected = queueItemFromRow(
      headers("Queue"),
      state.gateway.tables.get("Queue")!.rows[0],
    );
    expect(projected.draft_status).toBe("generated");
    expect(projected.gmail_draft_id).toBe("draft-one");
  });

  it("blocks the Gmail write when the Queue recipient changes after source inspection", async () => {
    const state = setup();
    const inspect = state.getMessage.getMockImplementation()!;
    state.getMessage.mockImplementationOnce(() => {
      const changed = [...state.gateway.tables.get("Queue")!.rows[0]];
      changed[headers("Queue").indexOf("contact_email")] = "other@example.com";
      state.gateway.tables.set("Queue", {
        headers: [...headers("Queue")],
        rows: [changed],
      });
      return inspect();
    });

    const result = await createSelectedQueueDraft({
      gateway: state.gateway,
      spreadsheetId: workbook,
      selectedRowIndex: 0,
      selectedRow: state.queueRow,
      interpretation,
      draftText: "Private draft text",
      getCuratedContacts: () => [
        {
          contactId: "contact_fixture",
          name: "Known Person",
          emails: ["known@example.com"],
          approvedAliases: [],
          active: true,
        },
      ],
      now: () => now,
      hash: () => "b".repeat(64),
      newOperationId: () => "11111111-1111-4111-8111-111111111111",
    });

    expect(result).toEqual({
      outcome: "blocked",
      code: "INELIGIBLE",
    });
    expect(state.create).not.toHaveBeenCalled();
  });

  it("does no Sheet or Gmail work while draft creation is disabled", async () => {
    const state = setup(false);
    const result = await createSelectedQueueDraft({
      gateway: state.gateway,
      spreadsheetId: workbook,
      selectedRowIndex: 0,
      selectedRow: state.queueRow,
      interpretation,
      draftText: "Private draft text",
      getCuratedContacts: () => [],
      now: () => now,
      hash: () => "b".repeat(64),
      newOperationId: () => "11111111-1111-4111-8111-111111111111",
    });

    expect(result).toEqual({ outcome: "blocked", code: "DISABLED" });
    expect(state.gateway.reads).toBe(0);
    expect(state.getMessage).not.toHaveBeenCalled();
    expect(state.create).not.toHaveBeenCalled();
  });

  it("rejects an uncurated selected contact before reserving or creating", async () => {
    const state = setup();
    state.gateway.tables.set("Contacts", {
      headers: [...headers("Contacts")],
      rows: [],
    });
    const result = await createSelectedQueueDraft({
      gateway: state.gateway,
      spreadsheetId: workbook,
      selectedRowIndex: 0,
      selectedRow: state.queueRow,
      interpretation,
      draftText: "Private draft text",
      getCuratedContacts: () => [],
      now: () => now,
      hash: () => "b".repeat(64),
      newOperationId: () => "11111111-1111-4111-8111-111111111111",
    });

    expect(result).toEqual({ outcome: "blocked", code: "INELIGIBLE" });
    expect(state.create).not.toHaveBeenCalled();
    expect(state.gateway.commits).toBe(0);
  });

  it("rejects a changed selected row and malformed interpretation", async () => {
    const state = setup();
    const changed = [...state.queueRow] as CellValue[];
    changed[0] = "changed";
    state.gateway.tables.set("Queue", {
      headers: [...headers("Queue")],
      rows: [changed],
    });
    await expect(
      createSelectedQueueDraft({
        gateway: state.gateway,
        spreadsheetId: workbook,
        selectedRowIndex: 0,
        selectedRow: state.queueRow,
        interpretation: { ...interpretation, model_uncertain: "no" },
        draftText: "Private draft text",
        getCuratedContacts: () => [],
        now: () => now,
        hash: () => "b".repeat(64),
        newOperationId: () => "11111111-1111-4111-8111-111111111111",
      }),
    ).resolves.toEqual({ outcome: "blocked", code: "INVALID_INPUT" });
    expect(state.create).not.toHaveBeenCalled();
  });
});
