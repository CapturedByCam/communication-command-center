import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prepareStudioStaging } from "../../src/adapters/studio/prepare-staging.js";
import { StagingRepository } from "../../src/adapters/sheets/staging-repository.js";
import {
  getExpectedHeaders,
  type CellValue,
  type SheetTableAdapter,
} from "../../src/adapters/sheets/sheet-table.js";

describe("Studio to existing staging repository contract", () => {
  it("round-trips the manifest-mapped metadata without treating append as deduplication", async () => {
    const rows: CellValue[][] = [];
    const headers = [...getExpectedHeaders("Studio_Inbox")];
    const adapter: SheetTableAdapter = {
      async runTransaction(operationSheet, operation) {
        expect(operationSheet).toBe("synthetic-sheet");
        return operation();
      },
      async readTable(spreadsheetId, sheetName) {
        expect([spreadsheetId, sheetName]).toEqual([
          "synthetic-sheet",
          "Studio_Inbox",
        ]);
        return { headers, rows: rows.map((row) => [...row]) };
      },
      async appendRow(spreadsheetId, sheetName, row) {
        expect([spreadsheetId, sheetName]).toEqual([
          "synthetic-sheet",
          "Studio_Inbox",
        ]);
        rows.push([...row]);
      },
      async updateRow() {
        throw new Error("Unexpected update");
      },
    };
    const fixture = JSON.parse(
      readFileSync("tests/fixtures/studio/routine.json", "utf8"),
    );
    const result = prepareStudioStaging(
      fixture.source,
      fixture.model,
      fixture.context,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error_code);
    const manifest = JSON.parse(
      readFileSync("studio/flow-manifest.json", "utf8"),
    );
    const mappings: Record<string, string> = manifest.steps[2].field_mappings;
    const mapped = Object.fromEntries(
      Object.entries(mappings).map(([column, binding]) => {
        const key = binding.slice(
          "validated.".length,
        ) as keyof typeof result.record;
        return [column, result.record[key]];
      }),
    );
    expect(mapped).toEqual(result.record);
    const repository = new StagingRepository(adapter, "synthetic-sheet");
    await repository.append(result.record);
    await repository.append(result.record);
    const stored = await repository.list();
    expect(stored).toHaveLength(2);
    expect(new Set(stored.map((record) => record.ingest_id)).size).toBe(1);
    expect(stored[0]).toEqual(result.record);
    expect(headers).not.toContain("body");
  });
});
