import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { itemToRecord } from "../../src/adapters/sheets/queue-repository.js";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
import {
  applyManualQueueControl,
  type ManualQueueControlRequest,
} from "../../src/apps-script/queue-controls.js";
import type { TableGateway } from "../../src/apps-script/sheet-adapter.js";
import type { SheetTable } from "../../src/adapters/sheets/sheet-table.js";
import type { CommunicationItem } from "../../src/domain/types.js";

const now = "2026-09-22T12:00:00-04:00";
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function item(overrides: Partial<CommunicationItem> = {}): CommunicationItem {
  return {
    schema_version: "1.0",
    item_id: "cc_queuecontrol01",
    source: "gmail",
    source_record_id: "message-1",
    source_thread_id: "thread-1",
    source_link: "https://mail.google.com/mail/u/0/#all/thread-1",
    captured_at: "2026-09-21T12:00:00-04:00",
    updated_at: "2026-09-21T12:00:00-04:00",
    contact: { email: "private@example.com" },
    category: "active_project",
    project_id: "project-1",
    status: "open",
    waiting_on: "me",
    urgency: "today",
    priority_score: 85,
    next_action_type: "reply",
    next_action: "Reply privately",
    summary: "Private summary",
    preview: "Private preview",
    deadline_at: null,
    deadline_text: null,
    needs_date_review: false,
    follow_up_at: null,
    promised_follow_up: null,
    draft_status: "reviewed",
    gmail_draft_id: "draft-1",
    confidence: 0.9,
    classifier_version: "test",
    content_hash: "a".repeat(64),
    manual_override: false,
    snooze_until: null,
    resolved_at: null,
    raw_content_stored: false,
    last_error_code: null,
    ...overrides,
  };
}

function setup(initial = item()) {
  const tables = new Map<string, SheetTable>(
    WORKBOOK_MANIFEST.map((definition) => [
      definition.name,
      { headers: [...definition.headers], rows: [] },
    ]),
  );
  const queue = tables.get("Queue")!;
  queue.rows.push(
    queue.headers.map((header) => itemToRecord(initial)[header] ?? null),
  );
  let commits = 0;
  let reads = 0;
  let failCommit = false;
  const gateway: TableGateway = {
    acquire: () => undefined,
    release: () => undefined,
    read: (_id, sheetName) => {
      reads++;
      return structuredClone(tables.get(sheetName)!);
    },
    commit: (_id, changes) => {
      commits++;
      if (failCommit) throw new Error("COMMIT_FAILED");
      for (const change of changes)
        tables.set(change.sheetName, structuredClone(change.after));
    },
  };
  const request = (operation: ManualQueueControlRequest["operation"]) => ({
    operation,
    spreadsheetId: "book",
    selectedRowIndex: 0,
    selectedRow: structuredClone(queue.rows[0]!),
    now: () => new Date(now),
    sha256,
    authorize: () => true,
  });
  return {
    gateway,
    request,
    tables,
    commits: () => commits,
    reads: () => reads,
    failNextCommit: () => {
      failCommit = true;
    },
  };
}

describe("manual Queue controls", () => {
  it("resolves one snapshot-verified item, preserves draft and context fields, and writes one audit event", async () => {
    const t = setup();
    await expect(
      applyManualQueueControl(t.gateway, t.request("resolve")),
    ).resolves.toEqual({
      ok: true,
      status: "resolved",
    });
    const queue = t.tables.get("Queue")!;
    const headers = queue.headers;
    const row = Object.fromEntries(
      headers.map((header, index) => [header, queue.rows[0]![index]]),
    );
    expect(row).toMatchObject({
      status: "resolved",
      resolved_at: "2026-09-22T16:00:00.000Z",
      snooze_until: null,
      manual_override: true,
      gmail_draft_id: "draft-1",
      draft_status: "reviewed",
      summary: "Private summary",
      content_hash: "a".repeat(64),
    });
    expect(t.tables.get("Audit_Log")!.rows).toHaveLength(1);
    expect(t.commits()).toBe(1);
  });

  it("fails closed when the selected snapshot is stale and does not append audit data", async () => {
    const t = setup();
    const request = t.request("resolve");
    t.tables.get("Queue")!.rows[0]![20] = "Changed privately";
    await expect(applyManualQueueControl(t.gateway, request)).resolves.toEqual({
      ok: false,
      error_code: "SELECTION_CHANGED",
    });
    expect(t.tables.get("Audit_Log")!.rows).toHaveLength(0);
    expect(t.commits()).toBe(0);
  });

  it("rolls back Queue and Audit_Log together when the provider batch fails", async () => {
    const t = setup();
    t.failNextCommit();
    await expect(
      applyManualQueueControl(t.gateway, t.request("resolve")),
    ).resolves.toEqual({
      ok: false,
      error_code: "WRITE_UNCERTAIN",
    });
    expect(t.tables.get("Queue")!.rows[0]![14]).toBe("open");
    expect(t.tables.get("Audit_Log")!.rows).toHaveLength(0);
    expect(t.commits()).toBe(1);
  });

  it("requires a future timestamp with an explicit numeric offset for snooze", async () => {
    const t = setup();
    await expect(
      applyManualQueueControl(t.gateway, {
        ...t.request("snooze"),
        snoozeUntil: "2026-09-23T10:00:00Z",
      }),
    ).resolves.toEqual({ ok: false, error_code: "INVALID_SNOOZE_TIMESTAMP" });
    await expect(
      applyManualQueueControl(t.gateway, {
        ...t.request("snooze"),
        snoozeUntil: "2026-09-21T10:00:00-04:00",
      }),
    ).resolves.toEqual({ ok: false, error_code: "INVALID_SNOOZE_TIMESTAMP" });
  });

  it("rechecks authorization under the lock after the prompt snapshot and reads or writes nothing when disabled", async () => {
    const t = setup();
    await expect(
      applyManualQueueControl(t.gateway, {
        ...t.request("resolve"),
        authorize: () => false,
      }),
    ).resolves.toEqual({ ok: true, status: "disabled" });
    expect(t.reads()).toBe(0);
    expect(t.commits()).toBe(0);
    expect(t.tables.get("Audit_Log")!.rows).toHaveLength(0);
  });
});

describe("manual waiting-state control", () => {
  it.each(["me", "them", "none", "unknown"] as const)(
    "sets %s while preserving every unrelated Queue value and appending one hashed audit event",
    async (waitingOn) => {
      const t = setup(
        item({
          status: "snoozed",
          snooze_until: "2026-09-25T12:00:00-04:00",
          waiting_on: waitingOn === "unknown" ? "me" : "unknown",
        }),
      );
      const before = structuredClone(t.tables.get("Queue")!.rows[0]!);
      await expect(
        applyManualQueueControl(t.gateway, {
          ...t.request("set_waiting"),
          waitingOn,
        }),
      ).resolves.toEqual({ ok: true, status: "waiting_updated" });
      const after = t.tables.get("Queue")!.rows[0]!;
      const headers = t.tables.get("Queue")!.headers;
      for (const [index, header] of headers.entries()) {
        if (["waiting_on", "manual_override", "updated_at"].includes(header))
          continue;
        expect(after[index]).toEqual(before[index]);
      }
      expect(after[headers.indexOf("waiting_on")]).toBe(waitingOn);
      expect(after[headers.indexOf("manual_override")]).toBe(true);
      const audit = t.tables.get("Audit_Log")!;
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0]![audit.headers.indexOf("payload_hash")]).toBe(
        sha256(
          JSON.stringify({
            operation: "set_waiting",
            waiting_on: waitingOn,
            item_id: "cc_queuecontrol01",
          }),
        ),
      );
      expect(JSON.stringify(audit.rows)).not.toContain(waitingOn);
    },
  );

  it("rejects invalid or stale states and makes identical values a true no-op", async () => {
    const invalid = setup();
    await expect(
      applyManualQueueControl(invalid.gateway, {
        ...invalid.request("set_waiting"),
        waitingOn: "model-guessed",
      }),
    ).resolves.toEqual({ ok: false, error_code: "INVALID_WAITING_STATE" });
    expect(invalid.reads()).toBe(0);

    const closed = setup(item({ status: "resolved" }));
    await expect(
      applyManualQueueControl(closed.gateway, {
        ...closed.request("set_waiting"),
        waitingOn: "them",
      }),
    ).resolves.toEqual({ ok: false, error_code: "STALE_STATE" });
    expect(closed.commits()).toBe(0);

    const unchanged = setup();
    const before = structuredClone(unchanged.tables.get("Queue")!.rows[0]!);
    await expect(
      applyManualQueueControl(unchanged.gateway, {
        ...unchanged.request("set_waiting"),
        waitingOn: "me",
      }),
    ).resolves.toEqual({ ok: true, status: "unchanged" });
    expect(unchanged.tables.get("Queue")!.rows[0]).toEqual(before);
    expect(unchanged.tables.get("Audit_Log")!.rows).toHaveLength(0);
    expect(unchanged.commits()).toBe(0);

    const disabled = setup();
    await expect(
      applyManualQueueControl(disabled.gateway, {
        ...disabled.request("set_waiting"),
        waitingOn: "them",
        authorize: () => false,
      }),
    ).resolves.toEqual({ ok: true, status: "disabled" });
    expect(disabled.reads()).toBe(0);
    expect(disabled.commits()).toBe(0);
  });
});
