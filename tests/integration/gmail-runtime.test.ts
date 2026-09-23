import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  runGmailReconciliation,
  runtimeReconciler,
} from "../../src/apps-script/gmail-runtime.js";
import { runBoundedGmailReconciliation } from "../../src/apps-script/bounded-gmail-runtime.js";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
import type { SheetTable } from "../../src/adapters/sheets/sheet-table.js";
import {
  recordToRow,
  rowToRecord,
  type CellValue,
} from "../../src/adapters/sheets/sheet-table.js";
import type { TableGateway } from "../../src/apps-script/sheet-adapter.js";
import type { GmailMetadataGateway } from "../../src/apps-script/gmail-reader.js";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
it("binds real service surfaces to one bounded atomic metadata reconciliation and deduplicates replay", async () => {
  const tables = new Map<string, SheetTable>(
    WORKBOOK_MANIFEST.map((d) => [
      d.name,
      { headers: [...d.headers], rows: [] },
    ]),
  );
  let locks = 0,
    batches = 0;
  const gateway: TableGateway = {
    acquire() {
      locks++;
    },
    release() {
      locks--;
    },
    read(_id, n) {
      return structuredClone(tables.get(n)!);
    },
    commit(_id, changes) {
      batches++;
      for (const c of changes)
        tables.set(c.sheetName, structuredClone(c.after));
    },
  };
  const message = {
    id: "synthetic-msg",
    threadId: "synthetic-thread",
    internalDate: String(Date.parse("2026-09-22T10:00:00Z")),
    labelIds: ["INBOX"],
    payload: {
      headers: [
        { name: "From", value: "sender@example.com" },
        { name: "To", value: "contact@elev8mediaky.com" },
      ],
    },
  };
  let query = "";
  const gmail: GmailMetadataGateway = {
    getProfile: () => ({ emailAddress: "contact@elev8mediaky.com" }),
    listMessages(_u, o) {
      query = o.q;
      expect(o.maxResults).toBe(5);
      return { messages: [{ id: message.id, threadId: message.threadId }] };
    },
    getMessage: () => message,
    getThread: () => {
      throw new Error("native runtime must not fetch unbounded thread history");
    },
  };
  const result = await runGmailReconciliation(
    gateway,
    gmail,
    "synthetic-sheet",
    "2026-09-22T12:00:00Z",
    hash,
  );
  expect(result.status).toBe("complete");
  expect(result.processed).toBe(1);
  expect(locks).toBe(0);
  expect(batches).toBe(1);
  expect(query).toContain("after:");
  expect(query).toContain("-category:promotions");
  expect(tables.get("Queue")!.rows).toHaveLength(1);
  const queue = tables.get("Queue")!;
  expect(rowToRecord(queue.headers, queue.rows[0]!)).toMatchObject({
    category: "other",
    confidence: 0,
    draft_status: "not_needed",
    next_action_type: "review",
    waiting_on: "unknown",
  });
  await runGmailReconciliation(
    gateway,
    gmail,
    "synthetic-sheet",
    "2026-09-22T12:00:01Z",
    hash,
  );
  expect(tables.get("Queue")!.rows).toHaveLength(1);
  expect(JSON.stringify([...tables])).not.toContain("sender@example.com");
});
describe("mailbox identity failure", () => {
  it("does not read mailbox messages or create queue records when profile is wrong", async () => {
    const tables = new Map<string, SheetTable>(
      WORKBOOK_MANIFEST.map((d) => [
        d.name,
        { headers: [...d.headers], rows: [] },
      ]),
    );
    let fetched = false;
    const gateway: TableGateway = {
      acquire() {},
      release() {},
      read(_id, n) {
        return structuredClone(tables.get(n)!);
      },
      commit(_id, changes) {
        for (const c of changes) tables.set(c.sheetName, c.after);
      },
    };
    const gmail: GmailMetadataGateway = {
      getProfile: () => ({ emailAddress: "wrong@example.com" }),
      listMessages() {
        fetched = true;
        return {};
      },
      getMessage() {
        throw Error("unexpected");
      },
      getThread() {
        throw Error("unexpected");
      },
    };
    const result = await runGmailReconciliation(
      gateway,
      gmail,
      "synthetic-sheet",
      "2026-09-22T12:00:00Z",
      hash,
    );
    expect(result.status).toBe("retry");
    expect(fetched).toBe(false);
    expect(tables.get("Queue")!.rows).toHaveLength(0);
  });
});

it("keeps a bounded overdue commitment when Studio replays its current message", async () => {
  const tables = new Map<string, SheetTable>(
    WORKBOOK_MANIFEST.map((definition) => [
      definition.name,
      { headers: [...definition.headers], rows: [] },
    ]),
  );
  const write = (sheet: string, record: Record<string, CellValue>) => {
    const table = tables.get(sheet)!;
    table.rows.push(recordToRow(table.headers, record));
  };
  const window = {
    from: "2026-08-23T12:00:00.000Z",
    to: "2026-09-22T12:00:00.000Z",
  };
  const message = {
    id: "current-message",
    threadId: "commitment-thread",
    internalDate: String(Date.parse("2026-09-22T10:00:00.000Z")),
    labelIds: ["INBOX"],
    payload: {
      headers: [
        { name: "From", value: "client@example.com" },
        { name: "To", value: "contact@elev8mediaky.com" },
      ],
    },
  };
  write("Config", {
    key: "gmail.reconciliation.v2",
    value: JSON.stringify({
      schema_version: "2.0",
      mailbox: "contact@elev8mediaky.com",
      window,
      phase: "enumerating",
      pageToken: null,
      seenPageTokenHashes: [],
      shardCount: 0,
      nextThread: 0,
      completedThrough: null,
      retry: null,
      error_code: null,
    }),
    updated_at: window.to,
    updated_by: "test",
  });
  write("Commitments", {
    commitment_id: "com_oldercommitment",
    item_id: `cc_${hash("gmail:contact@elev8mediaky.com:commitment-thread")}`,
    source_thread_id: message.threadId,
    promise_text: "I will follow up.",
    deadline_at: "2026-09-01T12:00:00.000Z",
    deadline_text: null,
    status: "open",
    fulfilled_at: null,
    fulfillment_evidence_id: null,
    manual_override: false,
    updated_at: "2026-09-22T11:00:00.000Z",
    schema_version: "1.1",
    source_message_id: "older-outbound-message",
    source_evidence_id: "evi_oldercommitment",
    observed_at: "2026-08-22T10:00:00.000Z",
    resolved_by: null,
    needs_date_review: false,
  });
  write("Studio_Inbox", {
    schema_version: "1.0",
    ingest_id: "studio-replay-1",
    flow_run_id: "flow-1",
    gmail_message_id: message.id,
    received_at: "2026-09-22T10:00:00.000Z",
    sender_email: "client@example.com",
    subject: "",
    requires_response: true,
    draft_risk: "review_only",
    category_hint: null,
    project_hint: null,
    deadline_text: null,
    next_action_hint: null,
    summary_hint: null,
    confidence_hint: null,
    processing_status: "new",
    processed_at: null,
    error_code: null,
  });
  const gateway: TableGateway = {
    acquire() {},
    release() {},
    read(_id, name) {
      return structuredClone(tables.get(name)!);
    },
    commit(_id, changes) {
      for (const change of changes)
        tables.set(change.sheetName, structuredClone(change.after));
    },
  };
  let boundedReadFails = false;
  let getMessageCalls = 0;
  const gmail: GmailMetadataGateway = {
    getProfile: () => ({ emailAddress: "contact@elev8mediaky.com" }),
    listMessages: () => ({
      messages: [{ id: message.id, threadId: message.threadId }],
    }),
    getMessage: () => {
      getMessageCalls++;
      if (boundedReadFails && getMessageCalls === 2)
        throw new Error("temporary provider failure");
      return message;
    },
    getThread: () => {
      throw new Error(
        "the bounded path must not fetch unbounded thread history",
      );
    },
  };
  const deferred = await runtimeReconciler(
    gateway,
    gmail,
    "synthetic-sheet",
    hash,
  ).processStudioInbox(window.to, 1);
  expect(deferred).toMatchObject({ status: "more", processed: 0, failed: 0 });
  let studio = tables.get("Studio_Inbox")!;
  expect(rowToRecord(studio.headers, studio.rows[0]!)).toMatchObject({
    processing_status: "new",
    error_code: null,
  });
  const config = tables.get("Config")!;
  config.rows[0] = recordToRow(config.headers, {
    key: "gmail.reconciliation.v2",
    value: JSON.stringify({
      schema_version: "2.0",
      mailbox: "contact@elev8mediaky.com",
      window,
      phase: "processing",
      pageToken: null,
      seenPageTokenHashes: [],
      shardCount: 1,
      nextThread: 0,
      completedThrough: null,
      retry: null,
      error_code: null,
    }),
    updated_at: window.to,
    updated_by: "test",
  });
  write("Config", {
    key: "gmail.references.v1.0",
    value: JSON.stringify({
      schema_version: "1.0",
      window_from: window.from,
      window_to: window.to,
      references: [{ id: message.id, threadId: message.threadId }],
    }),
    updated_at: window.to,
    updated_by: "test",
  });
  await runBoundedGmailReconciliation(
    gateway,
    gmail,
    "synthetic-sheet",
    window.to,
    hash,
    () => true,
    30,
  );
  let queue = tables.get("Queue")!;
  expect(rowToRecord(queue.headers, queue.rows[0]!)).toMatchObject({
    waiting_on: "me",
    urgency: "today",
    draft_status: "not_needed",
  });
  const replayed = await runtimeReconciler(
    gateway,
    gmail,
    "synthetic-sheet",
    hash,
  ).processStudioInbox(window.to, 1);
  expect(replayed).toMatchObject({ status: "complete", processed: 1 });
  studio = tables.get("Studio_Inbox")!;
  expect(rowToRecord(studio.headers, studio.rows[0]!)).toMatchObject({
    processing_status: "processed",
    error_code: null,
  });
  queue = tables.get("Queue")!;
  expect(queue.rows).toHaveLength(1);
  expect(rowToRecord(queue.headers, queue.rows[0]!)).toMatchObject({
    waiting_on: "me",
    urgency: "today",
    draft_status: "not_needed",
  });
  studio.rows[0] = recordToRow(studio.headers, {
    ...rowToRecord(studio.headers, studio.rows[0]!),
    processing_status: "new",
    processed_at: null,
    error_code: null,
  });
  getMessageCalls = 0;
  boundedReadFails = true;
  const transient = await runtimeReconciler(
    gateway,
    gmail,
    "synthetic-sheet",
    hash,
  ).processStudioInbox(window.to, 1);
  expect(transient).toMatchObject({ status: "retry", failed: 1 });
  studio = tables.get("Studio_Inbox")!;
  expect(rowToRecord(studio.headers, studio.rows[0]!)).toMatchObject({
    processing_status: "failed",
    error_code: "READ_FAILED",
  });
});
