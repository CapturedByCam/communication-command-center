import { describe, expect, it } from "vitest";
import { AuditRepository } from "../../src/adapters/sheets/audit-repository.js";
import { QueueRepository } from "../../src/adapters/sheets/queue-repository.js";
import {
  ConcurrentRowChangeError,
  type CellValue,
  type SheetTable,
  type SheetTableAdapter,
} from "../../src/adapters/sheets/sheet-table.js";
import { StagingRepository } from "../../src/adapters/sheets/staging-repository.js";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
import type {
  CommunicationItem,
  StudioStagingRecord,
} from "../../src/domain/types.js";
import { upsertCommunicationItem } from "../../src/services/upsert-item.js";

const spreadsheetId = "synthetic-sheet";

class FakeSheetTableAdapter implements SheetTableAdapter {
  readonly tables = new Map<string, SheetTable>();
  failNextAppendFor: string | null = null;
  failUpdateCall: number | null = null;
  beforeNextUpdate:
    ((sheetName: string, rowIndex: number, table: SheetTable) => void) | null =
    null;
  private transactionTail: Promise<void> = Promise.resolve();
  private undoActions: Array<() => void> | null = null;
  private updateCallCount = 0;

  initializeManifest(): void {
    for (const definition of WORKBOOK_MANIFEST) {
      this.tables.set(definition.name, {
        headers: [...definition.headers],
        rows: [],
      });
    }
  }

  failAfterUpcomingUpdates(count: number): void {
    this.failUpdateCall = this.updateCallCount + count;
  }

  async runTransaction<T>(
    requestedSpreadsheetId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    expect(requestedSpreadsheetId).toBe(spreadsheetId);
    const previous = this.transactionTail;
    let release: () => void = () => {};
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    this.undoActions = [];
    try {
      return await operation();
    } catch (error) {
      for (const undo of [...this.undoActions].reverse()) {
        undo();
      }
      throw error;
    } finally {
      this.undoActions = null;
      release();
    }
  }

  async readTable(
    requestedSpreadsheetId: string,
    sheetName: string,
  ): Promise<SheetTable> {
    expect(requestedSpreadsheetId).toBe(spreadsheetId);
    const table = this.tables.get(sheetName);
    if (!table) {
      throw new Error(`missing fake table: ${sheetName}`);
    }
    return {
      headers: [...table.headers],
      rows: table.rows.map((row) => [...row]),
    };
  }

  async appendRow(
    requestedSpreadsheetId: string,
    sheetName: string,
    row: readonly CellValue[],
  ): Promise<void> {
    expect(requestedSpreadsheetId).toBe(spreadsheetId);
    const table = this.requireTable(sheetName);
    if (this.failNextAppendFor === sheetName) {
      this.failNextAppendFor = null;
      throw new Error(`synthetic append failure: ${sheetName}`);
    }
    const rowIndex = table.rows.length;
    table.rows.push([...row]);
    this.undoActions?.push(() => table.rows.splice(rowIndex, 1));
  }

  async updateRow(
    requestedSpreadsheetId: string,
    sheetName: string,
    rowIndex: number,
    row: readonly CellValue[],
    expectedRow: readonly CellValue[],
  ): Promise<void> {
    expect(requestedSpreadsheetId).toBe(spreadsheetId);
    const table = this.requireTable(sheetName);
    if (this.beforeNextUpdate) {
      const mutate = this.beforeNextUpdate;
      this.beforeNextUpdate = null;
      mutate(sheetName, rowIndex, table);
    }
    this.updateCallCount += 1;
    if (this.failUpdateCall === this.updateCallCount) {
      throw new Error(`synthetic update failure: ${sheetName}`);
    }
    if (JSON.stringify(table.rows[rowIndex]) !== JSON.stringify(expectedRow)) {
      throw new ConcurrentRowChangeError(sheetName, rowIndex);
    }
    const previous = [...table.rows[rowIndex]];
    table.rows[rowIndex] = [...row];
    this.undoActions?.push(() => {
      table.rows[rowIndex] = previous;
    });
  }

  private requireTable(sheetName: string): SheetTable {
    const table = this.tables.get(sheetName);
    if (!table) {
      throw new Error(`missing fake table: ${sheetName}`);
    }
    return table;
  }
}

const baseItem: CommunicationItem = {
  schema_version: "1.0",
  item_id: "cc_123456789012",
  source: "gmail",
  source_record_id: "message-1",
  source_thread_id: "thread-1",
  source_link: "https://mail.google.com/mail/u/0/#inbox/thread-1",
  captured_at: "2026-09-22T12:00:00Z",
  updated_at: "2026-09-22T12:00:00Z",
  contact: {
    name: "Synthetic Contact",
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
  next_action: "Reply to the synthetic request.",
  summary: "Synthetic request requiring a response.",
  preview: "Synthetic preview only.",
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
};

function context(sequence: number, correlationId = `correlation-${sequence}`) {
  return {
    auditEventId: `audit-${sequence}`,
    eventAt: `2026-09-22T12:0${sequence}:00Z`,
    actor: "system",
    correlationId,
    durationMs: sequence,
    payloadHash: String(sequence).repeat(64).slice(0, 64),
  } as const;
}

function repositories(adapter: SheetTableAdapter) {
  return {
    queue: new QueueRepository(adapter, spreadsheetId),
    audit: new AuditRepository(adapter, spreadsheetId),
  };
}

describe("idempotent Sheet repositories", () => {
  it("suppresses a duplicate event while auditing both outcomes", async () => {
    const adapter = new FakeSheetTableAdapter();
    adapter.initializeManifest();
    const { queue, audit } = repositories(adapter);

    const first = await upsertCommunicationItem(
      { queue, audit },
      baseItem,
      context(1),
    );
    const second = await upsertCommunicationItem(
      { queue, audit },
      baseItem,
      context(2, "correlation-1"),
    );

    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("duplicate_suppressed");
    expect(adapter.tables.get("Queue")?.rows).toHaveLength(1);
    expect((await audit.list()).map((event) => event.result)).toEqual([
      "created",
      "duplicate_suppressed",
    ]);
  });

  it("serializes simultaneous delivery of the same first event", async () => {
    const adapter = new FakeSheetTableAdapter();
    adapter.initializeManifest();
    const { queue, audit } = repositories(adapter);

    const results = await Promise.all([
      upsertCommunicationItem({ queue, audit }, baseItem, context(1)),
      upsertCommunicationItem(
        { queue, audit },
        baseItem,
        context(2, "correlation-1"),
      ),
    ]);

    expect(results.map((result) => result.outcome)).toEqual([
      "created",
      "duplicate_suppressed",
    ]);
    expect(adapter.tables.get("Queue")?.rows).toHaveLength(1);
  });

  it("preserves manual category, status, and waiting state", async () => {
    const adapter = new FakeSheetTableAdapter();
    adapter.initializeManifest();
    const { queue, audit } = repositories(adapter);
    const manual: CommunicationItem = {
      ...baseItem,
      category: "aviation",
      status: "snoozed",
      waiting_on: "them",
      manual_override: true,
      snooze_until: "2026-09-25T12:00:00Z",
    };
    await upsertCommunicationItem({ queue, audit }, manual, context(1));

    const incoming: CommunicationItem = {
      ...baseItem,
      item_id: "cc_abcdefghijkl",
      category: "personal",
      status: "resolved",
      waiting_on: "none",
      updated_at: "2026-09-22T13:00:00Z",
      content_hash: "b".repeat(64),
      manual_override: false,
    };
    const result = await upsertCommunicationItem(
      { queue, audit },
      incoming,
      context(2),
    );

    expect(result.outcome).toBe("updated");
    expect(await queue.getBySourceThread("gmail", "thread-1")).toMatchObject({
      category: "aviation",
      status: "snoozed",
      waiting_on: "them",
      manual_override: true,
      item_id: "cc_123456789012",
      updated_at: "2026-09-22T13:00:00Z",
      content_hash: "b".repeat(64),
    });
  });

  it("creates, updates, snoozes, and resolves one canonical item", async () => {
    const adapter = new FakeSheetTableAdapter();
    adapter.initializeManifest();
    const { queue, audit } = repositories(adapter);

    const states: CommunicationItem[] = [
      baseItem,
      {
        ...baseItem,
        updated_at: "2026-09-22T12:10:00Z",
        summary: "Updated synthetic summary.",
      },
      {
        ...baseItem,
        updated_at: "2026-09-22T12:20:00Z",
        status: "snoozed",
        snooze_until: "2026-09-25T12:00:00Z",
      },
      {
        ...baseItem,
        updated_at: "2026-09-22T12:30:00Z",
        status: "resolved",
        resolved_at: "2026-09-22T12:30:00Z",
      },
    ];

    for (const [index, item] of states.entries()) {
      await upsertCommunicationItem({ queue, audit }, item, context(index + 1));
    }

    expect(adapter.tables.get("Queue")?.rows).toHaveLength(1);
    expect(await queue.getBySourceThread("gmail", "thread-1")).toMatchObject({
      status: "resolved",
      resolved_at: "2026-09-22T12:30:00Z",
      content_hash: "a".repeat(64),
    });
    expect((await audit.list()).map((event) => event.result)).toEqual([
      "created",
      "updated",
      "updated",
      "updated",
    ]);
  });

  it("round-trips valid items with omitted optional booleans", async () => {
    const adapter = new FakeSheetTableAdapter();
    adapter.initializeManifest();
    const queue = new QueueRepository(adapter, spreadsheetId);
    const withoutOptionalBooleans: CommunicationItem = {
      ...baseItem,
      needs_date_review: undefined,
      manual_override: undefined,
    };

    await queue.runTransaction(async () => {
      await queue.upsert(withoutOptionalBooleans, null);
    });

    expect(await queue.getBySourceThread("gmail", "thread-1")).toMatchObject({
      needs_date_review: false,
      manual_override: false,
    });
  });

  it("rejects an interleaved manual edit instead of overwriting it", async () => {
    const adapter = new FakeSheetTableAdapter();
    adapter.initializeManifest();
    const { queue, audit } = repositories(adapter);
    await upsertCommunicationItem({ queue, audit }, baseItem, context(1));
    adapter.beforeNextUpdate = (sheetName, rowIndex, table) => {
      if (sheetName !== "Queue") {
        return;
      }
      const category = table.headers.indexOf("category");
      const status = table.headers.indexOf("status");
      const waitingOn = table.headers.indexOf("waiting_on");
      const manualOverride = table.headers.indexOf("manual_override");
      table.rows[rowIndex][category] = "aviation";
      table.rows[rowIndex][status] = "snoozed";
      table.rows[rowIndex][waitingOn] = "them";
      table.rows[rowIndex][manualOverride] = true;
    };

    await expect(
      upsertCommunicationItem(
        { queue, audit },
        {
          ...baseItem,
          updated_at: "2026-09-22T13:00:00Z",
          content_hash: "b".repeat(64),
        },
        context(2),
      ),
    ).rejects.toBeInstanceOf(ConcurrentRowChangeError);
    expect(await queue.getBySourceThread("gmail", "thread-1")).toMatchObject({
      category: "aviation",
      status: "snoozed",
      waiting_on: "them",
      manual_override: true,
    });
    expect(await audit.list()).toHaveLength(1);
  });

  it("rolls back a queue write when audit persistence fails", async () => {
    const adapter = new FakeSheetTableAdapter();
    adapter.initializeManifest();
    const { queue, audit } = repositories(adapter);
    adapter.failNextAppendFor = "Audit_Log";

    await expect(
      upsertCommunicationItem({ queue, audit }, baseItem, context(1)),
    ).rejects.toThrow(/synthetic append failure/i);
    expect(adapter.tables.get("Queue")?.rows).toHaveLength(0);
    expect(adapter.tables.get("Audit_Log")?.rows).toHaveLength(0);

    const newer: CommunicationItem = {
      ...baseItem,
      updated_at: "2026-09-22T13:00:00Z",
      content_hash: "b".repeat(64),
    };
    await upsertCommunicationItem({ queue, audit }, newer, context(2));
    const retry = await upsertCommunicationItem(
      { queue, audit },
      baseItem,
      context(1),
    );

    expect(retry.outcome).toBe("stale_suppressed");
    expect(await queue.getBySourceThread("gmail", "thread-1")).toMatchObject({
      updated_at: "2026-09-22T13:00:00Z",
      content_hash: "b".repeat(64),
    });
    expect((await audit.list()).map((event) => event.result)).toEqual([
      "created",
      "stale_suppressed",
    ]);
  });

  it("claims bounded new staging records and leaves other states alone", async () => {
    const adapter = new FakeSheetTableAdapter();
    adapter.initializeManifest();
    const staging = new StagingRepository(adapter, spreadsheetId);
    const records: StudioStagingRecord[] = [
      {
        schema_version: "1.0",
        ingest_id: "ingest_000001",
        flow_run_id: "flow-1",
        gmail_message_id: "message-1",
        received_at: "2026-09-22T12:00:00Z",
        sender_email: "sender@example.com",
        subject: "Synthetic subject",
        requires_response: true,
        draft_risk: "routine",
        processing_status: "new",
      },
      {
        schema_version: "1.0",
        ingest_id: "ingest_000002",
        flow_run_id: "flow-2",
        gmail_message_id: "message-2",
        received_at: "2026-09-22T12:01:00Z",
        sender_email: "sender@example.com",
        subject: "Already processed",
        requires_response: false,
        draft_risk: "no_draft",
        processing_status: "processed",
      },
    ];
    for (const record of records) {
      await staging.append(record);
    }

    const claimed = await staging.claimBatch(1);

    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({
      ingest_id: "ingest_000001",
      processing_status: "processing",
    });
    expect((await staging.list()).map((row) => row.processing_status)).toEqual([
      "processing",
      "processed",
    ]);
  });

  it("rolls back all staging claims when a later claim fails", async () => {
    const adapter = new FakeSheetTableAdapter();
    adapter.initializeManifest();
    const staging = new StagingRepository(adapter, spreadsheetId);
    const first: StudioStagingRecord = {
      schema_version: "1.0",
      ingest_id: "ingest_000001",
      flow_run_id: "flow-1",
      gmail_message_id: "message-1",
      received_at: "2026-09-22T12:00:00Z",
      sender_email: "sender@example.com",
      subject: "First synthetic subject",
      requires_response: true,
      draft_risk: "routine",
      processing_status: "new",
    };
    await staging.append(first);
    await staging.append({
      ...first,
      ingest_id: "ingest_000002",
      flow_run_id: "flow-2",
      gmail_message_id: "message-2",
      subject: "Second synthetic subject",
    });
    adapter.failAfterUpcomingUpdates(2);

    await expect(staging.claimBatch(2)).rejects.toThrow(
      /synthetic update failure/i,
    );
    expect((await staging.list()).map((row) => row.processing_status)).toEqual([
      "new",
      "new",
    ]);
  });

  it("rejects header drift before any write", async () => {
    const adapter = new FakeSheetTableAdapter();
    adapter.initializeManifest();
    adapter.tables.get("Queue")?.headers.reverse();
    const { queue, audit } = repositories(adapter);

    await expect(
      upsertCommunicationItem({ queue, audit }, baseItem, context(1)),
    ).rejects.toThrow(/header drift/i);
    expect(adapter.tables.get("Queue")?.rows).toHaveLength(0);
    expect(adapter.tables.get("Audit_Log")?.rows).toHaveLength(0);
  });
});
