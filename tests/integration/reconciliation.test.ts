import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GmailReconciler,
  GmailReadError,
  type GmailReconciliationReader,
} from "../../src/adapters/gmail/reconciliation.js";
import type { ThreadSnapshot } from "../../src/adapters/gmail/gmail-client.js";
import { QueueRepository } from "../../src/adapters/sheets/queue-repository.js";
import { AuditRepository } from "../../src/adapters/sheets/audit-repository.js";
import { StagingRepository } from "../../src/adapters/sheets/staging-repository.js";
import { recordToRow } from "../../src/adapters/sheets/sheet-table.js";
import { FakeSheetTableAdapter } from "../helpers/fake-sheet-table.js";
import type { ThreadCommitment } from "../../src/adapters/gmail/thread-state.js";

const now = "2026-09-22T12:00:00Z";
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const message = (
  id = "message-1",
  internalDate = Date.parse("2026-09-22T10:00:00Z"),
) => ({
  id,
  internalDate,
  sender: "person@example.com",
  recipients: ["contact@elev8mediaky.com"],
  labels: ["INBOX"],
  automated: false,
  bulk: false,
  interpretation: {
    kind: "question",
    category: "client_lead",
    risk: "routine",
    summary: "Synthetic question about a fictional project.",
    confidence: 0.95,
  } as const,
});
const snapshot = (id = "message-1"): ThreadSnapshot => ({
  schema_version: "1.0",
  mailbox: "contact@elev8mediaky.com",
  threadId: "thread-1",
  messages: [message(id)],
});

class Reader implements GmailReconciliationReader {
  snapshots = new Map<string, unknown>([["message-1", snapshot()]]);
  requests: Parameters<GmailReconciliationReader["listRecentMessages"]>[0][] =
    [];
  fetches: string[] = [];
  pages = new Map<string | null, unknown>([
    [null, { messageIds: ["message-1"], nextPageToken: null }],
  ]);
  fetchFailure: Error | null = null;
  pageFailure: Error | null = null;
  async listRecentMessages(
    request: Parameters<GmailReconciliationReader["listRecentMessages"]>[0],
  ): Promise<unknown> {
    this.requests.push(request);
    if (this.pageFailure) throw this.pageFailure;
    return this.pages.get(request.pageToken);
  }
  async getThreadSnapshot(messageId: string): Promise<unknown> {
    this.fetches.push(messageId);
    if (this.fetchFailure) throw this.fetchFailure;
    return this.snapshots.get(messageId);
  }
}

function setup() {
  const adapter = new FakeSheetTableAdapter();
  adapter.initializeManifest();
  const reader = new Reader();
  const createWorker = () =>
    new GmailReconciler({
      adapter,
      spreadsheetId: "synthetic-sheet",
      reader,
      sha256,
    });
  return {
    adapter,
    reader,
    createWorker,
    worker: createWorker(),
    queue: new QueueRepository(adapter, "synthetic-sheet"),
    audit: new AuditRepository(adapter, "synthetic-sheet"),
    staging: new StagingRepository(adapter, "synthetic-sheet"),
  };
}

const stagingRecord = {
  schema_version: "1.0",
  ingest_id: "synthetic_ingest_1",
  flow_run_id: "synthetic-flow",
  gmail_message_id: "message-1",
  received_at: now,
  sender_email: "person@example.com",
  subject: "Synthetic subject NEVER IN LOGS",
  requires_response: false,
  draft_risk: "no_draft",
  category_hint: "personal",
  summary_hint: "Untrusted staging interpretation",
  processing_status: "new",
} as const;

describe("local bounded Gmail reconciliation", () => {
  it("replays one selected SNAPSHOT_INVALID failure without moving Config and resolves its evidence atomically", async () => {
    const { worker, adapter, queue, audit, reader } = setup();
    const dead = adapter.tables.get("Dead_Letter")!;
    const failure = {
      dead_letter_id: `dl_${"b".repeat(64)}`,
      received_at: now,
      source: "gmail" as const,
      source_record_id: "message-1",
      error_code: "SNAPSHOT_INVALID" as const,
      payload_hash: "b".repeat(64),
      status: "open" as const,
      resolved_at: null,
      resolution_actor: null,
    };
    dead.rows.push(recordToRow(dead.headers, failure));
    const config = adapter.tables.get("Config")!;
    config.rows.push([
      "gmail.reconciliation.v1",
      '{"private":"cursor"}',
      now,
      "gmail_reconciliation",
    ]);
    const originalConfig = structuredClone(config.rows);

    await expect(
      worker.replaySelectedSnapshotInvalid(
        {
          selectedRowIndex: 0,
          selectedRow: structuredClone(dead.rows[0]!),
          authorize: () => true,
        },
        now,
      ),
    ).resolves.toEqual({ ok: true, status: "replayed" });

    expect(reader.requests).toEqual([]);
    expect(reader.fetches).toEqual(["message-1"]);
    expect(await queue.list()).toHaveLength(1);
    expect((await audit.list())[0]).toMatchObject({
      actor: "manual_gmail_replay",
      result: "created",
    });
    expect(dead.rows[0]).toEqual(
      recordToRow(dead.headers, {
        ...failure,
        status: "resolved",
        resolved_at: "2026-09-22T12:00:00.000Z",
        resolution_actor: "manual_gmail_replay",
      }),
    );
    expect(config.rows).toEqual(originalConfig);
  });

  it("keeps a selected failure open when replay cannot be normalized or committed", async () => {
    const { worker, adapter, queue, audit, reader } = setup();
    const dead = adapter.tables.get("Dead_Letter")!;
    const failure = {
      dead_letter_id: `dl_${"c".repeat(64)}`,
      received_at: now,
      source: "gmail" as const,
      source_record_id: "message-1",
      error_code: "SNAPSHOT_INVALID" as const,
      payload_hash: "c".repeat(64),
      status: "open" as const,
      resolved_at: null,
      resolution_actor: null,
    };
    dead.rows.push(recordToRow(dead.headers, failure));
    reader.snapshots.set("message-1", { invalid: "PRIVATE" });
    await expect(
      worker.replaySelectedSnapshotInvalid(
        {
          selectedRowIndex: 0,
          selectedRow: structuredClone(dead.rows[0]!),
          authorize: () => true,
        },
        now,
      ),
    ).resolves.toEqual({ ok: false, error_code: "NOT_ELIGIBLE" });
    expect(dead.rows[0]).toEqual(recordToRow(dead.headers, failure));
    expect(await queue.list()).toEqual([]);
    expect(await audit.list()).toEqual([]);

    reader.snapshots.set("message-1", snapshot());
    adapter.failNextAppendFor = "Audit_Log";
    await expect(
      worker.replaySelectedSnapshotInvalid(
        {
          selectedRowIndex: 0,
          selectedRow: structuredClone(dead.rows[0]!),
          authorize: () => true,
        },
        now,
      ),
    ).rejects.toThrow(/synthetic append failure/);
    expect(dead.rows[0]).toEqual(recordToRow(dead.headers, failure));
    expect(await queue.list()).toEqual([]);
    expect(await audit.list()).toEqual([]);
  });

  it("does not extend a historical failure beyond both 30-day eligibility windows", async () => {
    const { worker, adapter, reader } = setup();
    const dead = adapter.tables.get("Dead_Letter")!;
    const failure = {
      dead_letter_id: `dl_${"d".repeat(64)}`,
      received_at: "2026-08-20T12:00:00Z",
      source: "gmail" as const,
      source_record_id: "message-1",
      error_code: "SNAPSHOT_INVALID" as const,
      payload_hash: "d".repeat(64),
      status: "open" as const,
      resolved_at: null,
      resolution_actor: null,
    };
    dead.rows.push(recordToRow(dead.headers, failure));
    await expect(
      worker.replaySelectedSnapshotInvalid(
        {
          selectedRowIndex: 0,
          selectedRow: structuredClone(dead.rows[0]!),
          authorize: () => true,
        },
        now,
      ),
    ).resolves.toEqual({ ok: false, error_code: "NOT_ELIGIBLE" });
    expect(reader.fetches).toEqual([]);
    expect(dead.rows[0]).toEqual(recordToRow(dead.headers, failure));
  });

  it("replays a selected current Gmail Queue item as a duplicate without replacing a manual override", async () => {
    const { worker, adapter, queue, audit, reader } = setup();
    await worker.reconcileRecentGmail(now, 1);
    const entry = (await queue.findBySourceThread("gmail", "thread-1"))!;
    const overridden = {
      ...entry.item,
      status: "snoozed" as const,
      manual_override: true,
      snooze_until: "2026-09-25T12:00:00Z",
    };
    await queue.upsert(overridden, entry);
    const queueTable = adapter.tables.get("Queue")!;
    const configBefore = structuredClone(adapter.tables.get("Config")!.rows);
    const listCalls = reader.requests.length;

    await expect(
      worker.replaySelectedQueueItem(
        {
          selectedRowIndex: 0,
          selectedRow: structuredClone(queueTable.rows[0]!),
          authorize: () => true,
        },
        "2026-09-22T12:30:00Z",
      ),
    ).resolves.toEqual({ ok: true, status: "replayed" });
    expect(reader.requests).toHaveLength(listCalls);
    expect((await queue.list())[0]).toMatchObject({
      status: "snoozed",
      manual_override: true,
      snooze_until: "2026-09-25T12:00:00Z",
    });
    expect((await audit.list()).at(-1)).toMatchObject({
      actor: "manual_gmail_replay",
      result: "duplicate_suppressed",
    });
    expect(adapter.tables.get("Config")!.rows).toEqual(configBefore);
  });

  it("does not fetch a Queue record whose source capture is older than the current 30-day window", async () => {
    const { worker, adapter, queue, reader } = setup();
    await worker.reconcileRecentGmail(now, 1);
    const entry = (await queue.findBySourceThread("gmail", "thread-1"))!;
    await queue.upsert(
      {
        ...entry.item,
        captured_at: "2026-08-20T12:00:00Z",
        updated_at: now,
        manual_override: true,
      },
      entry,
    );
    const queueTable = adapter.tables.get("Queue")!;
    const fetches = reader.fetches.length;
    const auditRows = structuredClone(adapter.tables.get("Audit_Log")!.rows);
    await expect(
      worker.replaySelectedQueueItem(
        {
          selectedRowIndex: 0,
          selectedRow: structuredClone(queueTable.rows[0]!),
          authorize: () => true,
        },
        now,
      ),
    ).resolves.toEqual({ ok: false, error_code: "NOT_ELIGIBLE" });
    expect(reader.fetches).toHaveLength(fetches);
    expect(adapter.tables.get("Audit_Log")!.rows).toEqual(auditRows);
  });

  it("does not persist a Queue replay that resolves to a different Gmail thread", async () => {
    const { worker, adapter, queue, reader, audit } = setup();
    await worker.reconcileRecentGmail(now, 1);
    const entry = (await queue.findBySourceThread("gmail", "thread-1"))!;
    await queue.upsert(
      {
        ...entry.item,
        source_record_id: "message-2",
        updated_at: now,
        manual_override: true,
      },
      entry,
    );
    reader.snapshots.set("message-2", {
      ...snapshot("message-2"),
      threadId: "thread-2",
    });
    const queueTable = adapter.tables.get("Queue")!;
    const auditRows = structuredClone(adapter.tables.get("Audit_Log")!.rows);
    await expect(
      worker.replaySelectedQueueItem(
        {
          selectedRowIndex: 0,
          selectedRow: structuredClone(queueTable.rows[0]!),
          authorize: () => true,
        },
        now,
      ),
    ).resolves.toEqual({ ok: false, error_code: "NOT_ELIGIBLE" });
    expect(reader.fetches).toContain("message-2");
    expect((await queue.list())[0].source_thread_id).toBe("thread-1");
    expect(await audit.list()).toHaveLength(auditRows.length);
  });

  it("accepts Studio messages stamped exactly at the worker's current time", async () => {
    const { worker, reader, staging, queue, adapter } = setup();
    reader.snapshots.set("message-1", {
      ...snapshot(),
      messages: [message("message-1", Date.parse(now))],
    });
    await staging.append(stagingRecord);
    await worker.processStudioInbox(now, 1);
    expect(await queue.list()).toHaveLength(1);
    expect((await staging.list())[0].processing_status).toBe("processed");
    expect(adapter.tables.get("Dead_Letter")!.rows).toEqual([]);
  });

  it("retains a partially processed page and retries only its failed reference", async () => {
    const { worker, reader, createWorker, queue } = setup();
    reader.pages.set(null, {
      messageIds: ["message-1", "message-2"],
      nextPageToken: null,
    });
    reader.snapshots.set("message-2", {
      ...snapshot("message-2"),
      threadId: "thread-2",
    });
    const originalRead = reader.getThreadSnapshot.bind(reader);
    let failSecond = true;
    reader.getThreadSnapshot = async (id) => {
      if (id === "message-2" && failSecond) {
        reader.fetches.push(id);
        throw new Error("synthetic temporary read failure");
      }
      return originalRead(id);
    };
    expect((await worker.reconcileRecentGmail(now, 2)).status).toBe("retry");
    expect(await queue.list()).toHaveLength(1);
    failSecond = false;
    expect(
      (await createWorker().reconcileRecentGmail("2026-09-22T12:01:00Z", 1))
        .status,
    ).toBe("complete");
    expect(reader.requests).toHaveLength(1);
    expect(reader.fetches).toEqual(["message-1", "message-2", "message-2"]);
    expect(await queue.list()).toHaveLength(2);
  });

  it("rejects a reader that exceeds the requested page bound without reading messages", async () => {
    const { worker, reader, adapter } = setup();
    reader.pages.set(null, {
      messageIds: ["message-1", "message-2"],
      nextPageToken: null,
    });
    expect((await worker.reconcileRecentGmail(now, 1)).status).toBe("blocked");
    expect(reader.fetches).toEqual([]);
    expect(adapter.tables.get("Dead_Letter")!.rows).toHaveLength(1);
  });

  it("excludes bulk snapshots without creating items or copying summaries into operational records", async () => {
    const { worker, reader, queue, adapter } = setup();
    reader.snapshots.set("message-1", {
      ...snapshot(),
      messages: [{ ...message(), bulk: true }],
    });
    expect((await worker.reconcileRecentGmail(now, 1)).excluded).toBe(1);
    expect(await queue.list()).toEqual([]);
    expect(JSON.stringify([...adapter.tables])).not.toContain(
      "fictional project",
    );
  });

  it("suppresses an older snapshot without regressing the canonical reply state", async () => {
    const { worker, reader, queue, audit } = setup();
    const reply = {
      ...message("message-2", Date.parse("2026-09-22T11:00:00Z")),
      sender: "contact@elev8mediaky.com",
      recipients: ["person@example.com"],
    };
    reader.snapshots.set("message-1", {
      ...snapshot(),
      messages: [message(), reply],
    });
    await worker.reconcileRecentGmail(now, 1);
    reader.snapshots.set("message-1", snapshot());
    await worker.reconcileRecentGmail("2026-09-22T13:00:00Z", 1);
    expect((await queue.list())[0]).toMatchObject({
      waiting_on: "them",
      source_record_id: "message-2",
    });
    expect((await audit.list()).at(-1)!.result).toBe("stale_suppressed");
  });

  it("atomically rolls back successful queue writes if a later dead-letter append fails", async () => {
    const { worker, reader, queue, adapter } = setup();
    reader.pages.set(null, {
      messageIds: ["message-1", "message-2"],
      nextPageToken: null,
    });
    reader.snapshots.set("message-2", { invalid: "PRIVATE BODY" });
    adapter.failNextAppendFor = "Dead_Letter";
    await expect(worker.reconcileRecentGmail(now, 2)).rejects.toThrow();
    expect(await queue.list()).toEqual([]);
    expect(adapter.tables.get("Config")!.rows).toEqual([]);
    expect(adapter.tables.get("Audit_Log")!.rows).toEqual([]);
  });

  it("does not read source data after invalid checkpoint state or clock regression", async () => {
    const { worker, reader, adapter } = setup();
    await worker.reconcileRecentGmail(now, 1);
    await expect(
      worker.reconcileRecentGmail("2026-09-22T11:00:00Z", 1),
    ).rejects.toThrow(/clock/);
    expect(reader.requests).toHaveLength(1);
    const table = adapter.tables.get("Config")!;
    table.rows[0][table.headers.indexOf("value")] = JSON.stringify({
      schema_version: "2.0",
      body: "PRIVATE BODY",
    });
    await expect(
      worker.reconcileRecentGmail("2026-09-22T13:00:00Z", 1),
    ).rejects.toThrow();
    expect(reader.requests).toHaveLength(1);
  });

  it("recovers a previously claimed Studio record and respects the per-run work bound", async () => {
    const { worker, staging, reader, queue } = setup();
    await staging.append({ ...stagingRecord, processing_status: "processing" });
    await staging.append({
      ...stagingRecord,
      ingest_id: "synthetic_ingest_2",
      gmail_message_id: "message-2",
    });
    reader.snapshots.set("message-2", {
      ...snapshot("message-2"),
      threadId: "thread-2",
    });
    expect((await worker.processStudioInbox(now, 1)).status).toBe("more");
    expect(await queue.list()).toHaveLength(1);
    expect((await staging.list()).map((row) => row.processing_status)).toEqual([
      "processed",
      "new",
    ]);
  });
  it("allows a state to recur after an overdue promise is fulfilled", async () => {
    const { adapter, reader, queue, audit } = setup();
    reader.snapshots.set("message-1", {
      ...snapshot(),
      messages: [
        {
          ...message("promise", Date.parse("2026-09-22T09:00:00Z")),
          sender: "contact@elev8mediaky.com",
          recipients: ["person@example.com"],
          interpretation: { ...message().interpretation, kind: "promise" },
        },
        {
          ...message(),
          interpretation: {
            ...message().interpretation,
            kind: "acknowledgement",
          },
        },
      ],
    });
    let commitments: ThreadCommitment[] = [];
    const worker = new GmailReconciler({
      adapter,
      spreadsheetId: "synthetic-sheet",
      reader,
      sha256,
      getCommitments: async () => commitments,
    });
    await worker.reconcileRecentGmail(now, 1);
    expect((await queue.list())[0].status).toBe("resolved");
    commitments = [
      {
        messageId: "promise",
        status: "open",
        deadlineAt: "2026-09-22T11:00:00Z",
      },
    ];
    await worker.reconcileRecentGmail("2026-09-22T13:00:00Z", 1);
    expect((await queue.list())[0]).toMatchObject({
      status: "open",
      waiting_on: "me",
    });
    commitments[0].status = "fulfilled";
    await worker.reconcileRecentGmail("2026-09-22T14:00:00Z", 1);
    expect((await queue.list())[0]).toMatchObject({
      status: "resolved",
      waiting_on: "none",
    });
    await worker.reconcileRecentGmail("2026-09-22T15:00:00Z", 1);
    expect((await audit.list()).map((event) => event.result)).toEqual([
      "created",
      "updated",
      "updated",
      "duplicate_suppressed",
    ]);
  });
  it("recovers a missed Studio event exactly once across restarts and overlap", async () => {
    const { worker, createWorker, queue, audit, staging, reader } = setup();
    expect(await staging.list()).toEqual([]);
    expect((await worker.reconcileRecentGmail(now, 2)).processed).toBe(1);
    await createWorker().reconcileRecentGmail("2026-09-22T13:00:00Z", 2);
    expect(await queue.list()).toHaveLength(1);
    expect((await audit.list()).map((e) => e.result)).toEqual([
      "created",
      "duplicate_suppressed",
    ]);
    expect(reader.requests[0]).toMatchObject({
      mailbox: "contact@elev8mediaky.com",
      from: "2026-08-23T12:00:00.000Z",
      to: "2026-09-22T12:00:00.000Z",
      limit: 2,
      excludeAutomated: true,
      excludeBulk: true,
    });
    expect(reader.requests[1].from).toBe("2026-09-21T12:00:00.000Z");
  });

  it("uses authoritative chronology for Studio intake and dedupes both paths", async () => {
    const { worker, queue, staging, audit } = setup();
    await staging.append(stagingRecord);
    await worker.processStudioInbox(now, 1);
    await worker.reconcileRecentGmail(now, 1);
    expect((await queue.list())[0]).toMatchObject({
      waiting_on: "me",
      category: "client_lead",
    });
    expect((await staging.list())[0]).toMatchObject({
      processing_status: "processed",
      error_code: null,
    });
    expect((await audit.list()).map((e) => e.result)).toEqual([
      "created",
      "duplicate_suppressed",
    ]);
  });

  it("updates waiting state after Cam replies and preserves manual overrides", async () => {
    const { worker, reader, queue } = setup();
    await worker.reconcileRecentGmail(now, 2);
    const reply = {
      ...message("message-2", Date.parse("2026-09-22T12:30:00Z")),
      sender: "contact@elev8mediaky.com",
      recipients: ["person@example.com"],
    };
    reader.snapshots.set("message-1", {
      ...snapshot(),
      messages: [reply, message()],
    });
    await worker.reconcileRecentGmail("2026-09-22T13:00:00Z", 2);
    expect((await queue.list())[0].waiting_on).toBe("them");
    const entry = (await queue.findBySourceThread("gmail", "thread-1"))!;
    await queue.upsert(
      {
        ...entry.item,
        category: "aviation",
        status: "snoozed",
        waiting_on: "unknown",
        manual_override: true,
        snooze_until: "2026-09-25T12:00:00Z",
      },
      entry,
    );
    reader.snapshots.set("message-1", {
      ...snapshot(),
      messages: [
        message(),
        reply,
        { ...message("message-3", Date.parse("2026-09-22T13:30:00Z")) },
      ],
    });
    await worker.reconcileRecentGmail("2026-09-22T14:00:00Z", 2);
    expect((await queue.list())[0]).toMatchObject({
      category: "aviation",
      status: "snoozed",
      waiting_on: "unknown",
      manual_override: true,
      snooze_until: "2026-09-25T12:00:00Z",
      source_record_id: "message-3",
    });
  });

  it("pins a bounded paginated window and resumes its cursor in a new worker", async () => {
    const { worker, createWorker, reader, queue } = setup();
    reader.pages.set(null, {
      messageIds: ["message-1"],
      nextPageToken: "page-2",
    });
    reader.pages.set("page-2", {
      messageIds: ["message-2"],
      nextPageToken: null,
    });
    reader.snapshots.set("message-2", {
      ...snapshot("message-2"),
      threadId: "thread-2",
    });
    expect((await worker.reconcileRecentGmail(now, 1)).status).toBe("more");
    expect(
      (await createWorker().reconcileRecentGmail("2026-09-22T13:00:00Z", 1))
        .status,
    ).toBe("complete");
    expect(reader.requests[1]).toMatchObject({
      pageToken: "page-2",
      from: reader.requests[0].from,
      to: reader.requests[0].to,
    });
    expect(await queue.list()).toHaveLength(2);
  });

  it("backs off transient reads, retains progress, and writes content-free dead letters after three attempts", async () => {
    const { worker, createWorker, reader, adapter } = setup();
    reader.fetchFailure = new Error(
      "PRIVATE BODY synthetic credential NEVER IN LOGS",
    );
    expect((await worker.reconcileRecentGmail(now, 2)).status).toBe("retry");
    expect(
      (await createWorker().reconcileRecentGmail("2026-09-22T12:00:30Z", 2))
        .status,
    ).toBe("retry");
    expect(reader.fetches).toHaveLength(1);
    await createWorker().reconcileRecentGmail("2026-09-22T12:01:00Z", 2);
    expect(
      (await createWorker().reconcileRecentGmail("2026-09-22T12:03:00Z", 2))
        .status,
    ).toBe("complete");
    expect(reader.fetches).toHaveLength(3);
    expect(adapter.tables.get("Dead_Letter")!.rows).toHaveLength(1);
    expect(JSON.stringify([...adapter.tables])).not.toMatch(
      /PRIVATE BODY|credential|NEVER IN LOGS/,
    );
    await createWorker().reconcileRecentGmail("2026-09-22T13:00:00Z", 2);
    expect(reader.fetches).toHaveLength(3);
    expect(adapter.tables.get("Dead_Letter")!.rows).toHaveLength(1);
  });

  it("rejects invalid snapshot/model data to dead letter without copying content", async () => {
    const { worker, reader, adapter, queue } = setup();
    reader.snapshots.set("message-1", {
      ...snapshot(),
      body: "PRIVATE BODY",
      messages: [
        {
          ...message(),
          interpretation: { ...message().interpretation, category: "invalid" },
        },
      ],
    });
    await worker.reconcileRecentGmail(now, 2);
    expect(await queue.list()).toEqual([]);
    expect(adapter.tables.get("Dead_Letter")!.rows).toHaveLength(1);
    expect(JSON.stringify([...adapter.tables])).not.toContain("PRIVATE BODY");
  });

  it("restarts an expired page cursor within the same bounded window", async () => {
    const { worker, reader, queue } = setup();
    reader.pages.set(null, {
      messageIds: ["message-1"],
      nextPageToken: "expired",
    });
    await worker.reconcileRecentGmail(now, 1);
    reader.pageFailure = new GmailReadError("CURSOR_EXPIRED");
    expect(
      (await worker.reconcileRecentGmail("2026-09-22T12:01:00Z", 1)).status,
    ).toBe("more");
    reader.pageFailure = null;
    reader.pages.set(null, { messageIds: ["message-1"], nextPageToken: null });
    await worker.reconcileRecentGmail("2026-09-22T12:02:00Z", 1);
    expect(reader.requests[2]).toMatchObject({
      pageToken: null,
      from: reader.requests[0].from,
      to: reader.requests[0].to,
    });
    expect(await queue.list()).toHaveLength(1);
  });

  it("blocks after exhausted page reads without advancing the watermark", async () => {
    const { worker, reader, adapter } = setup();
    reader.pageFailure = new Error("PRIVATE BODY");
    await worker.reconcileRecentGmail(now, 1);
    await worker.reconcileRecentGmail("2026-09-22T12:01:00Z", 1);
    expect(
      (await worker.reconcileRecentGmail("2026-09-22T12:03:00Z", 1)).status,
    ).toBe("blocked");
    await worker.reconcileRecentGmail("2026-09-22T13:00:00Z", 1);
    expect(reader.requests).toHaveLength(3);
    expect(adapter.tables.get("Dead_Letter")!.rows).toHaveLength(1);
  });

  it("rolls back queue, audit, and cursor when checkpoint persistence fails", async () => {
    const { worker, adapter, queue, audit, createWorker } = setup();
    adapter.failNextAppendFor = "Config";
    await expect(worker.reconcileRecentGmail(now, 1)).rejects.toThrow(
      /synthetic append failure/,
    );
    expect(await queue.list()).toEqual([]);
    expect(await audit.list()).toEqual([]);
    await createWorker().reconcileRecentGmail(now, 1);
    expect(await queue.list()).toHaveLength(1);
  });

  it("does not turn persistence failure into a poisoned message", async () => {
    const { worker, adapter, queue } = setup();
    adapter.failNextAppendFor = "Audit_Log";
    await expect(worker.reconcileRecentGmail(now, 1)).rejects.toThrow();
    expect(await queue.list()).toEqual([]);
    expect(adapter.tables.get("Dead_Letter")!.rows).toEqual([]);
    expect(adapter.tables.get("Config")!.rows).toEqual([]);
  });

  it("bounds Studio retries and preserves staging hints without logging them", async () => {
    const { worker, staging, reader, adapter } = setup();
    await staging.append(stagingRecord);
    reader.fetchFailure = new Error("PRIVATE BODY");
    await worker.processStudioInbox(now, 1);
    expect((await staging.list())[0]).toMatchObject({
      processing_status: "failed",
      error_code: "READ_FAILED",
    });
    await worker.processStudioInbox("2026-09-22T12:00:30Z", 1);
    expect(reader.fetches).toHaveLength(1);
    await worker.processStudioInbox("2026-09-22T12:01:00Z", 1);
    await worker.processStudioInbox("2026-09-22T12:03:00Z", 1);
    await worker.processStudioInbox("2026-09-22T13:00:00Z", 1);
    expect(reader.fetches).toHaveLength(3);
    const logs = JSON.stringify([
      adapter.tables.get("Audit_Log"),
      adapter.tables.get("Dead_Letter"),
      adapter.tables.get("Config"),
    ]);
    expect(logs).not.toMatch(/PRIVATE BODY|NEVER IN LOGS|Untrusted staging/);
  });

  it("serializes concurrent workers to prevent duplicate creation or cursor regression", async () => {
    const { worker, createWorker, queue, audit } = setup();
    await Promise.all([
      worker.reconcileRecentGmail(now, 1),
      createWorker().reconcileRecentGmail(now, 1),
    ]);
    expect(await queue.list()).toHaveLength(1);
    expect(
      (await audit.list()).filter((e) => e.result === "created"),
    ).toHaveLength(1);
  });

  it("rejects invalid batch sizes and header drift before source reads or writes", async () => {
    const { worker, reader, adapter } = setup();
    for (const size of [0, -1, 101, 1.5])
      await expect(worker.reconcileRecentGmail(now, size)).rejects.toThrow();
    adapter.tables.get("Config")!.headers.reverse();
    await expect(worker.reconcileRecentGmail(now, 1)).rejects.toThrow(
      /header drift/i,
    );
    expect(reader.requests).toEqual([]);
  });
});
