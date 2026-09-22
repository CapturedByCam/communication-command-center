import { describe, expect, it } from "vitest";
import {
  RuntimeSheetAdapter,
  type TableGateway,
} from "../../src/apps-script/sheet-adapter.js";
import type { SheetTable } from "../../src/adapters/sheets/sheet-table.js";

function setup() {
  let table: SheetTable = { headers: ["a", "b"], rows: [["old", null]] };
  let locks = 0;
  let commits = 0;
  let fail = false;
  const gateway: TableGateway = {
    acquire: () => {
      locks++;
    },
    release: () => {
      locks--;
    },
    read: () => structuredClone(table),
    commit: (_id, changes) => {
      commits++;
      if (fail) throw new Error("provider-private-content");
      table = structuredClone(changes[0].after);
    },
  };
  return {
    adapter: new RuntimeSheetAdapter(gateway),
    table: () => table,
    locks: () => locks,
    commits: () => commits,
    fail: () => {
      fail = true;
    },
  };
}
describe("runtime atomic sheet unit of work", () => {
  it("buffers all writes until the operation succeeds", async () => {
    const t = setup();
    await expect(
      t.adapter.runTransaction("book", async () => {
        await t.adapter.appendRow("book", "Queue", ["new", null]);
        expect(t.table().rows).toHaveLength(1);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(t.table().rows).toHaveLength(1);
    expect(t.commits()).toBe(0);
    expect(t.locks()).toBe(0);
  });
  it("commits once and sees staged writes inside a transaction", async () => {
    const t = setup();
    await t.adapter.runTransaction("book", async () => {
      await t.adapter.updateRow(
        "book",
        "Queue",
        0,
        ["=not-a-formula", null],
        ["old", null],
      );
      await t.adapter.appendRow("book", "Queue", ["new", null]);
      expect((await t.adapter.readTable("book", "Queue")).rows).toHaveLength(2);
    });
    expect(t.commits()).toBe(1);
    expect(t.table().rows[0][0]).toBe("=not-a-formula");
    expect(t.locks()).toBe(0);
  });
  it("rejects stale row updates and out of transaction writes", async () => {
    const t = setup();
    await expect(
      t.adapter.appendRow("book", "Queue", ["x", null]),
    ).rejects.toThrow("TRANSACTION_REQUIRED");
    await expect(
      t.adapter.runTransaction("book", () =>
        t.adapter.updateRow("book", "Queue", 0, ["x", null], ["changed", null]),
      ),
    ).rejects.toThrow("Concurrent row change");
    expect(t.commits()).toBe(0);
  });
  it("releases locks on failed commit and does not retry an uncertain write", async () => {
    const t = setup();
    t.fail();
    await expect(
      t.adapter.runTransaction("book", () =>
        t.adapter.appendRow("book", "Queue", ["new", null]),
      ),
    ).rejects.toThrow("SHEET_COMMIT_UNCERTAIN");
    expect(t.commits()).toBe(1);
    expect(t.locks()).toBe(0);
  });
  it("rejects nested and cross-workbook transactions", async () => {
    const t = setup();
    await expect(
      t.adapter.runTransaction("book", () =>
        t.adapter.runTransaction("other", async () => undefined),
      ),
    ).rejects.toThrow("TRANSACTION_ACTIVE");
    expect(t.locks()).toBe(0);
  });
});
