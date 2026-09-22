import { describe, expect, it } from "vitest";
import {
  WORKBOOK_MANIFEST,
  type WorkbookAdapter,
} from "../../src/adapters/sheets/workbook-manifest.js";
import {
  bootstrapWorkbook,
  verifyWorkbook,
} from "../../src/apps-script/menu.js";

const expectedManifest = [
  {
    name: "Queue",
    headers: [
      "schema_version",
      "item_id",
      "source",
      "source_record_id",
      "source_thread_id",
      "source_link",
      "captured_at",
      "updated_at",
      "contact_name",
      "contact_email",
      "contact_phone",
      "contact_handle",
      "category",
      "project_id",
      "status",
      "waiting_on",
      "urgency",
      "priority_score",
      "next_action_type",
      "next_action",
      "summary",
      "preview",
      "deadline_at",
      "deadline_text",
      "needs_date_review",
      "follow_up_at",
      "promised_follow_up",
      "draft_status",
      "gmail_draft_id",
      "confidence",
      "classifier_version",
      "content_hash",
      "manual_override",
      "snooze_until",
      "resolved_at",
      "raw_content_stored",
      "last_error_code",
    ],
  },
  {
    name: "Studio_Inbox",
    headers: [
      "schema_version",
      "ingest_id",
      "flow_run_id",
      "gmail_message_id",
      "received_at",
      "sender_email",
      "subject",
      "requires_response",
      "draft_risk",
      "category_hint",
      "project_hint",
      "deadline_text",
      "next_action_hint",
      "summary_hint",
      "confidence_hint",
      "processing_status",
      "processed_at",
      "error_code",
    ],
  },
  {
    name: "Contacts",
    headers: [
      "contact_id",
      "name",
      "email",
      "phone",
      "handle",
      "default_category",
      "default_project_id",
      "priority_boost",
      "tone_notes",
      "active",
      "updated_at",
    ],
  },
  {
    name: "Projects",
    headers: [
      "project_id",
      "name",
      "status",
      "drive_link",
      "client_contact_id",
      "default_category",
      "context_summary",
      "updated_at",
    ],
  },
  {
    name: "Commitments",
    headers: [
      "commitment_id",
      "item_id",
      "source_thread_id",
      "promise_text",
      "deadline_at",
      "deadline_text",
      "status",
      "fulfilled_at",
      "fulfillment_evidence_id",
      "manual_override",
      "updated_at",
    ],
  },
  {
    name: "Briefing_View",
    headers: [
      "briefing_date",
      "section",
      "sort_order",
      "item_id",
      "priority_score",
      "summary",
      "next_action",
      "source_link",
      "draft_status",
      "waiting_on",
      "deadline_at",
    ],
  },
  {
    name: "Briefing_History",
    headers: [
      "briefing_id",
      "generated_at",
      "delivery_channel",
      "delivery_status",
      "item_count",
      "content_hash",
      "error_code",
    ],
  },
  {
    name: "Audit_Log",
    headers: [
      "event_id",
      "event_at",
      "item_id",
      "source",
      "action",
      "result",
      "error_code",
      "payload_hash",
      "duration_ms",
      "actor",
      "correlation_id",
    ],
  },
  {
    name: "Dead_Letter",
    headers: [
      "dead_letter_id",
      "received_at",
      "source",
      "source_record_id",
      "error_code",
      "payload_hash",
      "status",
      "resolved_at",
      "resolution_actor",
    ],
  },
  {
    name: "Config",
    headers: ["key", "value", "updated_at", "updated_by"],
  },
] as const;

class FakeWorkbookAdapter implements WorkbookAdapter {
  readonly sheets = new Map<string, string[]>();

  constructor(initial: Record<string, string[]> = {}) {
    for (const [name, headers] of Object.entries(initial)) {
      this.sheets.set(name, [...headers]);
    }
  }

  async listSheetNames(spreadsheetId: string): Promise<string[]> {
    void spreadsheetId;
    return [...this.sheets.keys()];
  }

  async readHeaders(
    spreadsheetId: string,
    sheetName: string,
  ): Promise<string[]> {
    void spreadsheetId;
    return [...(this.sheets.get(sheetName) ?? [])];
  }

  async createSheet(spreadsheetId: string, sheetName: string): Promise<void> {
    void spreadsheetId;
    if (this.sheets.has(sheetName)) {
      throw new Error(`duplicate sheet: ${sheetName}`);
    }
    this.sheets.set(sheetName, []);
  }

  async writeHeaders(
    spreadsheetId: string,
    sheetName: string,
    headers: readonly string[],
  ): Promise<void> {
    void spreadsheetId;
    this.sheets.set(sheetName, [...headers]);
  }
}

describe("WORKBOOK_MANIFEST", () => {
  it("pins the exact tab order and header contracts", () => {
    expect(WORKBOOK_MANIFEST).toEqual(expectedManifest);
  });
});

describe("bootstrapWorkbook", () => {
  it("creates and initializes the workbook idempotently", async () => {
    const adapter = new FakeWorkbookAdapter();

    const first = await bootstrapWorkbook("sheet-1", adapter);
    expect(first.status).toBe("changed");
    expect(first.createdSheets).toEqual(
      expectedManifest.map(({ name }) => name),
    );
    expect([...adapter.sheets.keys()]).toEqual(
      expectedManifest.map(({ name }) => name),
    );

    const second = await bootstrapWorkbook("sheet-1", adapter);
    expect(second).toEqual({
      status: "unchanged",
      createdSheets: [],
      initializedHeaders: [],
      conflicts: [],
    });
    expect(adapter.sheets.size).toBe(expectedManifest.length);
  });

  it("initializes an existing empty tab", async () => {
    const adapter = new FakeWorkbookAdapter({ Queue: [] });

    const result = await bootstrapWorkbook("sheet-1", adapter);

    expect(result.status).toBe("changed");
    expect(result.createdSheets).not.toContain("Queue");
    expect(result.initializedHeaders).toContain("Queue");
    expect(adapter.sheets.get("Queue")).toEqual(expectedManifest[0].headers);
  });

  it("stops before mutation when a non-empty header conflicts", async () => {
    const adapter = new FakeWorkbookAdapter({ Queue: ["wrong_header"] });

    const result = await bootstrapWorkbook("sheet-1", adapter);

    expect(result.status).toBe("conflict");
    expect(result.conflicts).toEqual([
      {
        sheetName: "Queue",
        expected: [...expectedManifest[0].headers],
        actual: ["wrong_header"],
      },
    ]);
    expect([...adapter.sheets.entries()]).toEqual([
      ["Queue", ["wrong_header"]],
    ]);
  });
});

describe("verifyWorkbook", () => {
  it("reports missing tabs and header drift without mutation", async () => {
    const adapter = new FakeWorkbookAdapter({ Queue: ["wrong_header"] });

    const result = await verifyWorkbook("sheet-1", adapter);

    expect(result.valid).toBe(false);
    expect(result.missingSheets).toEqual(
      expectedManifest.slice(1).map(({ name }) => name),
    );
    expect(result.conflicts).toHaveLength(1);
    expect([...adapter.sheets.entries()]).toEqual([
      ["Queue", ["wrong_header"]],
    ]);
  });
});
