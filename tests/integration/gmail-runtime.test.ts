import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { runGmailReconciliation } from "../../src/apps-script/gmail-runtime.js";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
import type { SheetTable } from "../../src/adapters/sheets/sheet-table.js";
import { rowToRecord } from "../../src/adapters/sheets/sheet-table.js";
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
