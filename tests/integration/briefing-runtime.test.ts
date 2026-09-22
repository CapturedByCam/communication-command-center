import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type {
  CellValue,
  SheetTable,
} from "../../src/adapters/sheets/sheet-table.js";
import { itemToRecord } from "../../src/adapters/sheets/queue-repository.js";
import { recordToRow } from "../../src/adapters/sheets/sheet-table.js";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
import { runBriefing } from "../../src/apps-script/briefing-runtime.js";
import type {
  TableChange,
  TableGateway,
} from "../../src/apps-script/sheet-adapter.js";

const headers = (name: string) => [
  ...WORKBOOK_MANIFEST.find((sheet) => sheet.name === name)!.headers,
];
const row = (name: string, values: Record<string, CellValue | undefined>) =>
  recordToRow(headers(name), values);

function item(id: string, overrides: Record<string, unknown> = {}) {
  return row(
    "Queue",
    itemToRecord({
      schema_version: "1.0",
      item_id: id,
      source: "gmail",
      source_record_id: id,
      source_thread_id: `thread-${id}`,
      source_link: `https://mail.google.com/mail/u/0/#all/${id}`,
      captured_at: "2026-09-22T12:00:00Z",
      updated_at: "2026-09-22T12:00:00Z",
      contact: undefined,
      category: "active_project",
      project_id: null,
      status: "open",
      waiting_on: "me",
      urgency: "today",
      priority_score: 80,
      next_action_type: "reply",
      next_action: "Reply",
      summary: `Summary ${id}`,
      preview: null,
      deadline_at: null,
      deadline_text: null,
      needs_date_review: false,
      follow_up_at: null,
      promised_follow_up: null,
      draft_status: "not_needed",
      gmail_draft_id: null,
      confidence: 1,
      classifier_version: "test",
      content_hash: "a".repeat(64),
      manual_override: false,
      snooze_until: null,
      resolved_at: null,
      raw_content_stored: false,
      last_error_code: null,
      ...overrides,
    }),
  );
}

function setup(
  options: {
    malformedCommitment?: boolean;
    invalidOffset?: boolean;
    failCommit?: boolean;
  } = {},
) {
  const tables = new Map<string, SheetTable>(
    WORKBOOK_MANIFEST.map((sheet) => [
      sheet.name,
      { headers: [...sheet.headers], rows: [] },
    ]),
  );
  tables
    .get("Queue")!
    .rows.push(
      item("cc_handlefirst01"),
      item("cc_waiting00001", { waiting_on: "them", urgency: "later" }),
    );
  tables.get("Commitments")!.rows.push(
    row("Commitments", {
      commitment_id: "com_due000001",
      item_id: "cc_handlefirst01",
      source_thread_id: "thread-cc_handlefirst01",
      promise_text: "Send the estimate",
      deadline_at: options.invalidOffset
        ? "2026-09-22T17:00:00+24:00"
        : "2026-09-22T17:00:00-04:00",
      deadline_text: "today",
      status: options.malformedCommitment ? "broken" : "open",
      fulfilled_at: null,
      fulfillment_evidence_id: null,
      manual_override: false,
      updated_at: "2026-09-22T12:00:00Z",
    }),
  );
  tables.get("Dead_Letter")!.rows.push(
    row("Dead_Letter", {
      dead_letter_id: "dl_001",
      received_at: "2026-09-22T12:00:00Z",
      source: "gmail",
      source_record_id: "source",
      error_code: "INVALID",
      payload_hash: "b".repeat(64),
      status: "open",
      resolved_at: null,
      resolution_actor: null,
    }),
  );
  tables.get("Audit_Log")!.rows.push(
    row("Audit_Log", {
      event_id: "evt_001",
      event_at: "2026-09-22T12:00:00Z",
      item_id: "cc_handlefirst01",
      source: "gmail",
      action: "upsert_item",
      result: "duplicate_suppressed",
      error_code: null,
      payload_hash: "c".repeat(64),
      duration_ms: 1,
      actor: "system",
      correlation_id: "run_001",
    }),
  );
  tables.get("Config")!.rows.push(
    row("Config", {
      key: "gmail.reconciliation.v1",
      value: JSON.stringify({
        schema_version: "1.0",
        mailbox: "contact@elev8mediaky.com",
        completedThrough: "2026-09-22T11:00:00Z",
        window: null,
        pending: null,
        retry: null,
        blocked: false,
      }),
      updated_at: "2026-09-22T11:00:00Z",
      updated_by: "system",
    }),
  );
  let held = false,
    commits = 0;
  const gateway: TableGateway = {
    acquire: () => {
      expect(held).toBe(false);
      held = true;
    },
    release: () => {
      held = false;
    },
    read: (_id, name) => structuredClone(tables.get(name)!),
    commit: (_id, changes: TableChange[]) => {
      expect(held).toBe(true);
      commits++;
      if (options.failCommit) throw new Error("SHEET_COMMIT_UNCERTAIN");
      for (const change of changes)
        tables.set(change.sheetName, structuredClone(change.after));
    },
  };
  return { gateway, tables, held: () => held, commits: () => commits };
}

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

describe("synchronous briefing runtime", () => {
  it("atomically appends all eight sections and a no-delivery history record, then suppresses an identical snapshot", () => {
    const t = setup();
    const first = runBriefing(
      t.gateway,
      "book",
      "2026-09-22T09:00:00-04:00",
      hash,
    );
    expect(first).toMatchObject({
      status: "generated",
      sections: 8,
      deliveryChannel: "none",
    });
    expect(t.commits()).toBe(1);
    const view = t.tables.get("Briefing_View")!;
    expect(new Set(view.rows.map((value) => value[1]))).toEqual(
      new Set([
        "handle_first",
        "quick_wins",
        "promises_due",
        "needs_judgment",
        "drafts_ready",
        "waiting_on_others",
        "upcoming_this_week",
        "system_health",
      ]),
    );
    expect(view.rows.some((value) => value[5] === "No items")).toBe(true);
    expect(
      view.rows.some(
        (value) =>
          value[6] === "Reply" &&
          value[7]!.toString().includes("mail.google.com"),
      ),
    ).toBe(true);
    expect(t.tables.get("Briefing_History")!.rows[0]![2]).toBe("none");
    expect(t.tables.get("Briefing_History")!.rows[0]![3]).toBe("generated");
    const second = runBriefing(
      t.gateway,
      "book",
      "2026-09-22T09:00:00-04:00",
      hash,
    );
    expect(second).toMatchObject({ status: "duplicate" });
    expect(t.commits()).toBe(1);
    expect(t.held()).toBe(false);
  });

  it("fails closed for a malformed commitment and leaves both projections untouched", () => {
    const t = setup({ malformedCommitment: true });
    expect(() =>
      runBriefing(t.gateway, "book", "2026-09-22T09:00:00-04:00", hash),
    ).toThrow("COMMITMENT_INVALID");
    expect(t.commits()).toBe(0);
    expect(t.tables.get("Briefing_View")!.rows).toEqual([]);
    expect(t.tables.get("Briefing_History")!.rows).toEqual([]);
  });

  it("rejects a commitment timestamp with an invalid ISO offset", () => {
    const t = setup({ invalidOffset: true });

    expect(() =>
      runBriefing(t.gateway, "book", "2026-09-22T09:00:00-04:00", hash),
    ).toThrow("COMMITMENT_INVALID");
    expect(t.commits()).toBe(0);
  });

  it("derives stale-draft and reconciler health from validated operational rows", () => {
    const t = setup();
    const draftStatus = headers("Queue").indexOf("draft_status");
    t.tables.get("Queue")!.rows[0]![draftStatus] = "stale";

    runBriefing(t.gateway, "book", "2026-09-22T09:00:00-04:00", hash);

    const summaries = t.tables
      .get("Briefing_View")!
      .rows.map((value) => value[5]);
    expect(summaries).toContain("Stale drafts: 1");
    expect(summaries).toContain(
      "Last successful reconciliation: 2026-09-22T11:00:00Z",
    );
  });

  it("does not trust an invalid reconciler checkpoint", () => {
    const t = setup();
    const configValue = headers("Config").indexOf("value");
    t.tables.get("Config")!.rows[0]![configValue] = "{}";

    runBriefing(t.gateway, "book", "2026-09-22T09:00:00-04:00", hash);

    expect(
      t.tables.get("Briefing_View")!.rows.map((value) => value[5]),
    ).toContain("Last successful reconciliation: none recorded");
  });

  it("creates a new same-day projection when an expired snooze changes the briefing", () => {
    const t = setup();
    t.tables.get("Queue")!.rows.push(
      item("cc_snoozed000001", {
        urgency: "later",
        snooze_until: "2026-09-22T10:00:00-04:00",
      }),
    );

    const beforeWake = runBriefing(
      t.gateway,
      "book",
      "2026-09-22T09:00:00-04:00",
      hash,
    );
    const afterWake = runBriefing(
      t.gateway,
      "book",
      "2026-09-22T11:00:00-04:00",
      hash,
    );

    expect(beforeWake.status).toBe("generated");
    expect(afterWake.status).toBe("generated");
    expect(t.tables.get("Briefing_History")!.rows).toHaveLength(2);
    expect(
      t.tables
        .get("Briefing_View")!
        .rows.some((value) => value[3] === "cc_snoozed000001"),
    ).toBe(true);
  });

  it("appends a dated version without overwriting an existing projection", () => {
    const t = setup();
    const priorView = row("Briefing_View", {
      briefing_date: "2026-09-21",
      section: "handle_first",
      sort_order: 0,
      item_id: "cc_prior",
      priority_score: 1,
      summary: "Prior projection",
      next_action: null,
      source_link: "https://mail.google.com/mail/u/0/#all/prior",
      draft_status: "not_needed",
      waiting_on: "me",
      deadline_at: null,
    });
    const priorHistory = row("Briefing_History", {
      briefing_id: "brief_prior",
      generated_at: "2026-09-21T09:00:00-04:00",
      delivery_channel: "none",
      delivery_status: "generated",
      item_count: 1,
      content_hash: "d".repeat(64),
      error_code: null,
    });
    t.tables.get("Briefing_View")!.rows.push(priorView);
    t.tables.get("Briefing_History")!.rows.push(priorHistory);

    runBriefing(t.gateway, "book", "2026-09-22T09:00:00-04:00", hash);

    expect(t.tables.get("Briefing_View")!.rows[0]).toEqual(priorView);
    expect(t.tables.get("Briefing_History")!.rows[0]).toEqual(priorHistory);
    expect(t.tables.get("Briefing_History")!.rows).toHaveLength(2);
  });

  it("does not partially write either table when the atomic commit fails", () => {
    const t = setup({ failCommit: true });
    expect(() =>
      runBriefing(t.gateway, "book", "2026-09-22T09:00:00-04:00", hash),
    ).toThrow("SHEET_COMMIT_UNCERTAIN");
    expect(t.tables.get("Briefing_View")!.rows).toEqual([]);
    expect(t.tables.get("Briefing_History")!.rows).toEqual([]);
    expect(t.held()).toBe(false);
  });
});
