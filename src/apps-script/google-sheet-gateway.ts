import type { CellValue, SheetTable } from "../adapters/sheets/sheet-table.js";
import {
  SheetCommitUncertainError,
  type TableGateway,
} from "./sheet-adapter.js";

export type Cell = {
  userEnteredValue:
    { stringValue: string } | { numberValue: number } | { boolValue: boolean };
};
export interface UpdateRequest {
  updateCells: {
    start: { sheetId: number; rowIndex: number; columnIndex: number };
    rows: { values: Cell[] }[];
    fields: "userEnteredValue";
  };
}
export interface GoogleSheetServices {
  acquire(): void;
  release(): void;
  read(id: string, name: string): SheetTable;
  sheetIds(id: string): Record<string, number>;
  batch(id: string, requests: UpdateRequest[]): void;
}
export function literalCell(value: CellValue): Cell {
  return {
    userEnteredValue:
      typeof value === "number"
        ? { numberValue: value }
        : typeof value === "boolean"
          ? { boolValue: value }
          : { stringValue: value ?? "" },
  };
}

/** Google batchUpdate is atomic; the snapshot check detects earlier human edits.
 * Sheets has no compare-and-swap: owner edits during the final network call are
 * not protected by a script lock. Use audited script mutations for Queue state.
 */
export function createGoogleSheetGateway(
  services: GoogleSheetServices,
): TableGateway {
  return {
    acquire: () => services.acquire(),
    release: () => services.release(),
    read: (id, name) => services.read(id, name),
    commit(id, changes) {
      const ids = services.sheetIds(id);
      const requests: UpdateRequest[] = [];
      for (const { sheetName, before, after } of changes) {
        if (
          JSON.stringify(before.headers) !== JSON.stringify(after.headers) ||
          after.rows.length < before.rows.length
        )
          throw new Error("DESTRUCTIVE_CHANGE");
        if (
          JSON.stringify(services.read(id, sheetName)) !==
          JSON.stringify(before)
        )
          throw new Error("SHEET_CHANGED");
        if (!Number.isInteger(ids[sheetName])) throw new Error("SHEET_MISSING");
        for (const [index, row] of after.rows.entries()) {
          if (JSON.stringify(row) === JSON.stringify(before.rows[index]))
            continue;
          if (row.length !== after.headers.length) throw new Error("ROW_WIDTH");
          requests.push({
            updateCells: {
              start: {
                sheetId: ids[sheetName],
                rowIndex: index + 1,
                columnIndex: 0,
              },
              rows: [{ values: row.map(literalCell) }],
              fields: "userEnteredValue",
            },
          });
        }
      }
      if (
        requests.length > 200 ||
        requests.reduce(
          (sum, request) =>
            sum +
            request.updateCells.rows.reduce(
              (n, row) => n + row.values.length,
              0,
            ),
          0,
        ) > 10000 ||
        JSON.stringify(requests).length > 500000
      )
        throw new Error("BATCH_LIMIT_REVIEW_REQUIRED");
      if (requests.length) {
        try {
          services.batch(id, requests);
        } catch {
          throw new SheetCommitUncertainError();
        }
      }
    },
  };
}
