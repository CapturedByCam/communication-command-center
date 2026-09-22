import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { runBoundedGmailReconciliation } from "../../src/apps-script/bounded-gmail-runtime.js";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
import {
  rowToRecord,
  type SheetTable,
} from "../../src/adapters/sheets/sheet-table.js";
import type { TableGateway } from "../../src/apps-script/sheet-adapter.js";
import type { GmailMetadataGateway } from "../../src/apps-script/gmail-reader.js";
const now = "2026-09-22T12:00:00Z";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function setup() {
  const tables = new Map<string, SheetTable>(
    WORKBOOK_MANIFEST.map((d) => [
      d.name,
      { headers: [...d.headers], rows: [] },
    ]),
  );
  let reads = 0,
    gets = 0,
    commits = 0;
  const gateway: TableGateway = {
    acquire() {},
    release() {},
    read(_id, n) {
      reads++;
      return structuredClone(tables.get(n)!);
    },
    commit(_id, changes) {
      commits++;
      for (const c of changes)
        tables.set(c.sheetName, structuredClone(c.after));
    },
  };
  const gmail: GmailMetadataGateway = {
    getProfile: () => ({ emailAddress: "contact@elev8mediaky.com" }),
    listMessages(_u, o) {
      return o.pageToken
        ? { messages: [{ id: "later", threadId: "thread" }] }
        : {
            messages: [{ id: "earlier", threadId: "thread" }],
            nextPageToken: "page2",
          };
    },
    getMessage(_u, id) {
      gets++;
      return {
        id,
        threadId: "thread",
        internalDate: String(
          Date.parse(
            id === "earlier" ? "2026-09-21T10:00:00Z" : "2026-09-22T10:00:00Z",
          ),
        ),
        labelIds: ["INBOX"],
        payload: {
          headers: [
            { name: "From", value: "sender@example.com" },
            { name: "To", value: "contact@elev8mediaky.com" },
          ],
        },
        snippet: "must not persist",
      };
    },
    getThread() {
      throw Error("Unbounded history must not be read");
    },
  };
  const run = (authorize = () => true) =>
    runBoundedGmailReconciliation(
      gateway,
      gmail,
      "sheet",
      now,
      hash,
      authorize,
    );
  return {
    tables,
    gateway,
    gmail,
    run,
    counts: () => ({ reads, gets, commits }),
  };
}
it("enumerates cross-page thread references before one atomic review-only reconciliation", async () => {
  const s = setup();
  expect(await s.run()).toMatchObject({ status: "more", processed: 0 });
  expect(s.counts().gets).toBe(0);
  expect(s.tables.get("Queue")!.rows).toHaveLength(0);
  expect(await s.run()).toMatchObject({ status: "more", processed: 0 });
  expect(s.counts().gets).toBe(0);
  expect(await s.run()).toMatchObject({ status: "complete", processed: 1 });
  expect(s.counts().gets).toBe(2);
  const q = s.tables.get("Queue")!;
  expect(rowToRecord(q.headers, q.rows[0]!)).toMatchObject({
    source_record_id: "later",
    waiting_on: "unknown",
    draft_status: "not_needed",
    next_action_type: "review",
  });
  expect(s.tables.get("Audit_Log")!.rows).toHaveLength(1);
  expect(JSON.stringify([...s.tables])).not.toMatch(
    /sender@example.com|must not persist/,
  );
  const counts = s.counts();
  expect(await s.run()).toMatchObject({ status: "complete", processed: 0 });
  expect(s.counts()).toEqual({ ...counts, reads: expect.any(Number) });
});
it("does not read or write when disabled and aborts staged work on lost authorization", async () => {
  const s = setup();
  expect(await s.run(() => false)).toMatchObject({ status: "disabled" });
  expect(s.counts()).toEqual({ reads: 0, gets: 0, commits: 0 });
  let enabled = true;
  const original = s.gmail.listMessages;
  s.gmail.listMessages = (...args) => {
    const r = original(...args);
    enabled = false;
    return r;
  };
  expect(await s.run(() => enabled)).toMatchObject({ status: "disabled" });
  expect(s.counts().commits).toBe(0);
});
it("blocks conflicting references without fetching a partial thread", async () => {
  const s = setup();
  await s.run();
  s.gmail.listMessages = () => ({
    messages: [{ id: "earlier", threadId: "different" }],
  });
  expect(await s.run()).toMatchObject({ status: "blocked", failed: 1 });
  expect(s.counts().gets).toBe(0);
  expect(s.tables.get("Queue")!.rows).toHaveLength(0);
});
it("does not advance progress when the atomic provider commit is uncertain", async () => {
  const s = setup();
  await s.run();
  await s.run();
  const before = structuredClone([...s.tables]);
  s.gateway.commit = () => {
    throw Error("SHEET_COMMIT_UNCERTAIN");
  };
  await expect(s.run()).rejects.toThrow("SHEET_COMMIT_UNCERTAIN");
  expect([...s.tables]).toEqual(before);
});

it("backs off transient reads and blocks after the third failure", async () => {
  const s = setup();
  let calls = 0;
  s.gmail.listMessages = () => {
    calls++;
    throw Error("temporary");
  };
  const at = (time: string) =>
    runBoundedGmailReconciliation(
      s.gateway,
      s.gmail,
      "sheet",
      time,
      hash,
      () => true,
    );
  expect(await at(now)).toMatchObject({ status: "retry", failed: 1 });
  expect(await at(now)).toMatchObject({ status: "retry", failed: 0 });
  expect(calls).toBe(1);
  expect(await at("2026-09-22T12:01:00Z")).toMatchObject({
    status: "retry",
    failed: 1,
  });
  expect(await at("2026-09-22T12:03:00Z")).toMatchObject({
    status: "blocked",
    failed: 1,
  });
  expect(await at("2026-09-22T12:04:00Z")).toMatchObject({
    status: "blocked",
    failed: 0,
  });
  expect(calls).toBe(3);
  expect(s.counts().gets).toBe(0);
});
it("blocks repeated cursors without treating collected references as complete", async () => {
  const s = setup();
  await s.run();
  s.gmail.listMessages = () => ({ messages: [], nextPageToken: "page2" });
  expect(await s.run()).toMatchObject({ status: "blocked", failed: 1 });
  expect(s.counts().gets).toBe(0);
});
it("blocks a thread exceeding fifty references before metadata fetching", async () => {
  const s = setup();
  let page = 0;
  s.gmail.listMessages = () => ({
    messages: Array.from({ length: 20 }, (_, i) => ({
      id: `m${page * 20 + i}`,
      threadId: "thread",
    })),
    nextPageToken: `page${++page}`,
  });
  await s.run();
  await s.run();
  expect(await s.run()).toMatchObject({ status: "blocked", failed: 1 });
  expect(s.counts().gets).toBe(0);
});

it("blocks an expired list cursor and retains the last complete boundary", async () => {
  const s = setup();
  await s.run();
  s.gmail.listMessages = () => {
    throw { code: 400, message: "Expired page token" };
  };
  expect(await s.run()).toMatchObject({ status: "blocked", failed: 1 });
  const table = s.tables.get("Config")!;
  const cp = table.rows
    .map((r) => rowToRecord(table.headers, r))
    .find((r) => r.key === "gmail.reconciliation.v2")!;
  expect(JSON.parse(String(cp.value))).toMatchObject({
    phase: "blocked",
    error_code: "CURSOR_EXPIRED",
    completedThrough: null,
  });
  expect(s.counts().gets).toBe(0);
});
