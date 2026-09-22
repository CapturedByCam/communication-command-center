import { getExpectedHeaders } from "../adapters/sheets/sheet-table.js";
import { headersEqual } from "../adapters/sheets/workbook-manifest.js";
import {
  literalCell,
  type GoogleSheetServices,
} from "./google-sheet-gateway.js";
import { SheetCommitUncertainError } from "./sheet-adapter.js";

export const LEGACY_COMMITMENT_HEADERS = [
  "commitment_id",
  "item_id",
  "source_thread_id",
  "promise_text",
  "deadline_at",
  "deadline_text",
  "status",
  "fulfilled_at",
  "fulfillment_evidence_id",
  "manual_override",
  "updated_at",
] as const;

/** Explicit empty-table migration. The supplied reader must inspect all rows,
 * including formula cells, rather than the bounded operational table reader.
 * Never changes existing cells and never retries an uncertain provider batch.
 */
export function migrateEmptyCommitments(
  services: GoogleSheetServices,
  spreadsheetId: string,
  authorize: () => boolean,
): { status: "migrated" | "unchanged" | "disabled"; schema_version: "1.1" } {
  services.acquire();
  try {
    if (!authorize()) return { status: "disabled", schema_version: "1.1" };
    const before = services.read(spreadsheetId, "Commitments");
    const target = getExpectedHeaders("Commitments");
    if (headersEqual(before.headers, target))
      return { status: "unchanged", schema_version: "1.1" };
    if (!headersEqual(before.headers, LEGACY_COMMITMENT_HEADERS))
      throw new Error("HEADER_DRIFT");
    if (before.rows.length) throw new Error("POPULATED_LEGACY_COMMITMENTS");
    const sheetId = services.sheetIds(spreadsheetId).Commitments;
    if (!Number.isInteger(sheetId)) throw new Error("SHEET_MISSING");
    if (
      JSON.stringify(services.read(spreadsheetId, "Commitments")) !==
      JSON.stringify(before)
    )
      throw new Error("SHEET_CHANGED");
    if (!authorize()) return { status: "disabled", schema_version: "1.1" };
    try {
      services.batch(spreadsheetId, [
        {
          updateCells: {
            start: {
              sheetId,
              rowIndex: 0,
              columnIndex: LEGACY_COMMITMENT_HEADERS.length,
            },
            rows: [
              {
                values: target
                  .slice(LEGACY_COMMITMENT_HEADERS.length)
                  .map(literalCell),
              },
            ],
            fields: "userEnteredValue",
          },
        },
      ]);
    } catch {
      throw new SheetCommitUncertainError();
    }
    return { status: "migrated", schema_version: "1.1" };
  } finally {
    services.release();
  }
}
