import { describe, it, expect, vi } from "vitest";
import {
  createGoogleSheetGateway,
  literalCell,
} from "../../src/apps-script/google-sheet-gateway.js";
describe("Google sheet gateway", () => {
  it("writes text as explicit stringValue, including formula-like content", () => {
    expect(literalCell("=IMPORTXML(private)")).toEqual({
      userEnteredValue: { stringValue: "=IMPORTXML(private)" },
    });
    expect(literalCell(null)).toEqual({
      userEnteredValue: { stringValue: "" },
    });
  });
  it("submits only changed cells in one batch and rejects a changed snapshot", () => {
    const data = { headers: ["id", "value"], rows: [["x", "old"]] };
    const batch = vi.fn();
    const gateway = createGoogleSheetGateway({
      acquire: vi.fn(),
      release: vi.fn(),
      read: () => data,
      sheetIds: () => ({ Queue: 42 }),
      batch,
    });
    const after = {
      headers: ["id", "value"],
      rows: [
        ["x", "new"],
        ["y", "=text"],
      ],
    };
    gateway.commit("book", [
      { sheetName: "Queue", before: structuredClone(data), after },
    ]);
    expect(batch).toHaveBeenCalledOnce();
    expect(batch.mock.calls[0][1]).toHaveLength(2);
    expect(batch.mock.calls[0][1][1].updateCells.rows[0].values[1]).toEqual(
      literalCell("=text"),
    );
    expect(() =>
      gateway.commit("book", [
        {
          sheetName: "Queue",
          before: { headers: ["id", "value"], rows: [] },
          after,
        },
      ]),
    ).toThrow("SHEET_CHANGED");
    expect(batch).toHaveBeenCalledOnce();
  });
  it("rejects any shrink or header change before writing", () => {
    const data = { headers: ["id"], rows: [["x"]] };
    const batch = vi.fn();
    const gateway = createGoogleSheetGateway({
      acquire: vi.fn(),
      release: vi.fn(),
      read: () => data,
      sheetIds: () => ({ Queue: 1 }),
      batch,
    });
    expect(() =>
      gateway.commit("book", [
        {
          sheetName: "Queue",
          before: data,
          after: { headers: ["id"], rows: [] },
        },
      ]),
    ).toThrow("DESTRUCTIVE_CHANGE");
    expect(batch).not.toHaveBeenCalled();
  });
});

it("rejects oversized batches before provider calls and distinguishes uncertain writes", () => {
  const before = { headers: ["id"], rows: [] };
  const batch = vi.fn();
  const gateway = createGoogleSheetGateway({
    acquire: vi.fn(),
    release: vi.fn(),
    read: () => before,
    sheetIds: () => ({ Queue: 1 }),
    batch,
  });
  expect(() =>
    gateway.commit("book", [
      {
        sheetName: "Queue",
        before,
        after: {
          headers: ["id"],
          rows: Array.from({ length: 201 }, (_, i) => [String(i)]),
        },
      },
    ]),
  ).toThrow("BATCH_LIMIT_REVIEW_REQUIRED");
  expect(batch).not.toHaveBeenCalled();
  batch.mockImplementation(() => {
    throw new Error("private provider detail");
  });
  expect(() =>
    gateway.commit("book", [
      {
        sheetName: "Queue",
        before,
        after: { headers: ["id"], rows: [["one"]] },
      },
    ]),
  ).toThrow("SHEET_COMMIT_UNCERTAIN");
  expect(batch).toHaveBeenCalledOnce();
});
