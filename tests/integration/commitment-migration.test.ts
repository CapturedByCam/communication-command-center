import { describe, expect, it, vi } from "vitest";
import {
  migrateEmptyCommitments,
  LEGACY_COMMITMENT_HEADERS,
} from "../../src/apps-script/commitment-migration.js";
import {
  getExpectedHeaders,
  type SheetTable,
} from "../../src/adapters/sheets/sheet-table.js";
import type { GoogleSheetServices } from "../../src/apps-script/google-sheet-gateway.js";

function setup(table: SheetTable) {
  const services: GoogleSheetServices = {
    acquire: vi.fn(),
    release: vi.fn(),
    read: vi.fn(() => structuredClone(table)),
    sheetIds: vi.fn(() => ({ Commitments: 7 })),
    batch: vi.fn(),
  };
  return services;
}
describe("empty-only Commitment migration", () => {
  it("appends only new headers after checking the unchanged empty table", () => {
    const services = setup({
      headers: [...LEGACY_COMMITMENT_HEADERS],
      rows: [],
    });
    expect(migrateEmptyCommitments(services, "workbook", () => true)).toEqual({
      status: "migrated",
      schema_version: "1.1",
    });
    expect(services.batch).toHaveBeenCalledWith("workbook", [
      {
        updateCells: {
          start: { sheetId: 7, rowIndex: 0, columnIndex: 11 },
          rows: [
            {
              values: getExpectedHeaders("Commitments")
                .slice(11)
                .map((stringValue) => ({ userEnteredValue: { stringValue } })),
            },
          ],
          fields: "userEnteredValue",
        },
      },
    ]);
    expect(services.read).toHaveBeenCalledTimes(2);
    expect(services.release).toHaveBeenCalledOnce();
  });
  it("is idempotent and refuses populated, drifted, changed or unauthorized tables", () => {
    const current = setup({
      headers: [...getExpectedHeaders("Commitments")],
      rows: [],
    });
    expect(
      migrateEmptyCommitments(current, "workbook", () => true).status,
    ).toBe("unchanged");
    expect(current.batch).not.toHaveBeenCalled();
    for (const table of [
      { headers: [...LEGACY_COMMITMENT_HEADERS], rows: [["preserve me"]] },
      { headers: ["wrong"], rows: [] },
    ]) {
      const services = setup(table);
      expect(() =>
        migrateEmptyCommitments(services, "workbook", () => true),
      ).toThrow();
      expect(services.batch).not.toHaveBeenCalled();
      expect(services.release).toHaveBeenCalledOnce();
    }
    const changed = setup({
      headers: [...LEGACY_COMMITMENT_HEADERS],
      rows: [],
    });
    vi.mocked(changed.read)
      .mockReturnValueOnce({
        headers: [...LEGACY_COMMITMENT_HEADERS],
        rows: [],
      })
      .mockReturnValueOnce({
        headers: [...LEGACY_COMMITMENT_HEADERS],
        rows: [["new"]],
      });
    expect(() =>
      migrateEmptyCommitments(changed, "workbook", () => true),
    ).toThrow("SHEET_CHANGED");
    expect(changed.batch).not.toHaveBeenCalled();
    const denied = setup({ headers: [...LEGACY_COMMITMENT_HEADERS], rows: [] });
    expect(
      migrateEmptyCommitments(denied, "workbook", () => false).status,
    ).toBe("disabled");
    expect(denied.read).not.toHaveBeenCalled();
    expect(denied.batch).not.toHaveBeenCalled();
    const lost = setup({ headers: [...LEGACY_COMMITMENT_HEADERS], rows: [] });
    const authorize = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    expect(migrateEmptyCommitments(lost, "workbook", authorize).status).toBe(
      "disabled",
    );
    expect(lost.batch).not.toHaveBeenCalled();
  });
  it("reports an uncertain provider write without retrying", () => {
    const services = setup({
      headers: [...LEGACY_COMMITMENT_HEADERS],
      rows: [],
    });
    vi.mocked(services.batch).mockImplementation(() => {
      throw new Error("provider secret");
    });
    expect(() =>
      migrateEmptyCommitments(services, "workbook", () => true),
    ).toThrow("SHEET_COMMIT_UNCERTAIN");
    expect(services.batch).toHaveBeenCalledOnce();
    expect(services.release).toHaveBeenCalledOnce();
  });
});
