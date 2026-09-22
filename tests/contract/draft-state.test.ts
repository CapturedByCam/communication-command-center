import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  DraftRepository,
  type DraftOperation,
} from "../../src/adapters/sheets/draft-repository.js";
import type {
  CellValue,
  SheetTable,
  SheetTableAdapter,
} from "../../src/adapters/sheets/sheet-table.js";

const spreadsheetId = "synthetic-sheet";
const itemId = "cc_draftfixture01";
const configHeaders = ["key", "value", "updated_at", "updated_by"];

class FakeAdapter implements SheetTableAdapter {
  readonly config: CellValue[][] = [];

  async runTransaction<T>(
    requestedSpreadsheetId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    expect(requestedSpreadsheetId).toBe(spreadsheetId);
    return operation();
  }

  async readTable(
    requestedSpreadsheetId: string,
    sheetName: string,
  ): Promise<SheetTable> {
    expect(requestedSpreadsheetId).toBe(spreadsheetId);
    expect(sheetName).toBe("Config");
    return { headers: configHeaders, rows: this.config.map((row) => [...row]) };
  }

  async appendRow(
    _spreadsheetId: string,
    _sheetName: string,
    row: readonly CellValue[],
  ): Promise<void> {
    this.config.push([...row]);
  }

  async updateRow(
    _spreadsheetId: string,
    _sheetName: string,
    rowIndex: number,
    row: readonly CellValue[],
    expectedRow: readonly CellValue[],
  ): Promise<void> {
    expect(this.config[rowIndex]).toEqual(expectedRow);
    this.config[rowIndex] = [...row];
  }
}

async function fixture(): Promise<DraftOperation> {
  return JSON.parse(
    await readFile(
      new URL("../fixtures/gmail-drafts/operation-v1.json", import.meta.url),
      "utf8",
    ),
  ) as DraftOperation;
}

describe("DraftOperation persistence contract", () => {
  it("accepts the versioned, body-free synthetic fixture", async () => {
    const adapter = new FakeAdapter();
    const repository = new DraftRepository(adapter, spreadsheetId);
    const operation = await fixture();

    await repository.mutate(itemId, () => operation);

    expect(await repository.get(itemId)).toEqual(operation);
    expect(JSON.stringify(adapter.config)).not.toContain("body_text");
  });

  it.each([
    ["unknown fields", { extra_body: "never persist" }],
    ["unsupported version", { schema_version: "2.0" }],
    ["missing generated draft", { status: "generated", draft_id: null }],
    ["draft without revision", { draft_id: "synthetic-draft-1" }],
    ["revision without draft", { draft_revision: "revision-1" }],
    [
      "replace without expected hash",
      { operation: "replace", expected_body_hash: null },
    ],
    ["uppercase source hash", { source_content_hash: "A".repeat(64) }],
  ])("rejects %s with a fixed error", async (_name, change) => {
    const repository = new DraftRepository(new FakeAdapter(), spreadsheetId);
    const operation = { ...(await fixture()), ...change } as DraftOperation;

    await expect(repository.mutate(itemId, () => operation)).rejects.toThrow(
      "DRAFT_STATE_INVALID",
    );
  });

  it("requires a matching namespace item id", async () => {
    const repository = new DraftRepository(new FakeAdapter(), spreadsheetId);
    const operation = { ...(await fixture()), item_id: "cc_draftfixture02" };

    await expect(repository.mutate(itemId, () => operation)).rejects.toThrow(
      "DRAFT_STATE_KEY_MISMATCH",
    );
  });

  it("requires draft ids and prior body hashes for destructive operations", async () => {
    const repository = new DraftRepository(new FakeAdapter(), spreadsheetId);
    const operation = {
      ...(await fixture()),
      operation: "delete" as const,
      draft_id: "synthetic-draft-1",
      draft_revision: "revision-1",
      expected_body_hash: "c".repeat(64),
      status: "deleted" as const,
    };

    await expect(
      repository.mutate(itemId, () => operation),
    ).resolves.toMatchObject({
      status: "deleted",
    });
  });

  it("allows a cancelled create without a draft id", async () => {
    const repository = new DraftRepository(new FakeAdapter(), spreadsheetId);
    const operation = { ...(await fixture()), status: "cancelled" as const };

    await expect(
      repository.mutate(itemId, () => operation),
    ).resolves.toMatchObject({
      status: "cancelled",
      draft_id: null,
      draft_revision: null,
    });
  });
});
