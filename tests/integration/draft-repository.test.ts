import { describe, expect, it } from "vitest";
import {
  DraftRepository,
  type DraftOperation,
} from "../../src/adapters/sheets/draft-repository.js";
import {
  ConcurrentRowChangeError,
  type CellValue,
  type SheetTable,
  type SheetTableAdapter,
} from "../../src/adapters/sheets/sheet-table.js";

const spreadsheetId = "synthetic-sheet";
const itemId = "cc_draftrepository1";
const configHeaders = ["key", "value", "updated_at", "updated_by"];

function operation(): DraftOperation {
  return {
    schema_version: "1.0",
    item_id: itemId,
    mailbox: "drafts@example.com",
    thread_id: "synthetic-thread",
    source_message_id: "synthetic-message",
    source_content_hash: "a".repeat(64),
    operation_id: "123e4567-e89b-42d3-a456-426614174000",
    operation: "create",
    status: "pending",
    draft_id: null,
    draft_revision: null,
    body_hash: "b".repeat(64),
    expected_body_hash: null,
    synthetic: true,
    stale_requested: false,
    updated_at: "2026-09-22T12:00:00Z",
    error_code: null,
  };
}

class FakeAdapter implements SheetTableAdapter {
  readonly config: CellValue[][] = [];
  private tail = Promise.resolve();
  beforeUpdate: (() => void) | null = null;

  async runTransaction<T>(
    requestedSpreadsheetId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    expect(requestedSpreadsheetId).toBe(spreadsheetId);
    const previous = this.tail;
    let release: () => void = () => {};
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async readTable(
    _spreadsheetId: string,
    sheetName: string,
  ): Promise<SheetTable> {
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
    this.beforeUpdate?.();
    this.beforeUpdate = null;
    if (JSON.stringify(this.config[rowIndex]) !== JSON.stringify(expectedRow)) {
      throw new ConcurrentRowChangeError("Config", rowIndex);
    }
    this.config[rowIndex] = [...row];
  }
}

describe("DraftRepository", () => {
  it("preserves unrelated Config rows and survives a repository restart", async () => {
    const adapter = new FakeAdapter();
    adapter.config.push([
      "intake_enabled",
      "true",
      "2026-09-22T12:00:00Z",
      "system",
    ]);
    const repository = new DraftRepository(adapter, spreadsheetId);

    await repository.mutate(itemId, () => operation());

    expect(
      await new DraftRepository(adapter, spreadsheetId).list(),
    ).toHaveLength(1);
    expect(adapter.config[0]).toEqual([
      "intake_enabled",
      "true",
      "2026-09-22T12:00:00Z",
      "system",
    ]);
  });

  it("serializes concurrent mutations and uses the current operation", async () => {
    const adapter = new FakeAdapter();
    const repository = new DraftRepository(adapter, spreadsheetId);

    await Promise.all([
      repository.mutate(itemId, (current) => current ?? operation()),
      repository.mutate(itemId, (current) =>
        current ? { ...current, status: "cancelled" } : operation(),
      ),
    ]);

    expect((await repository.get(itemId))?.status).toBe("cancelled");
    expect(adapter.config).toHaveLength(1);
  });

  it("uses expected-row comparison to reject a concurrent external change", async () => {
    const adapter = new FakeAdapter();
    const repository = new DraftRepository(adapter, spreadsheetId);
    await repository.mutate(itemId, () => operation());
    adapter.beforeUpdate = () => {
      adapter.config[0][1] = "{}";
    };

    await expect(
      repository.mutate(itemId, (current) => ({
        ...current!,
        status: "cancelled",
      })),
    ).rejects.toBeInstanceOf(ConcurrentRowChangeError);
  });

  it("rejects duplicate, malformed, and body-bearing namespace records", async () => {
    const adapter = new FakeAdapter();
    const key = `gmail.draft.v1.${itemId}`;
    adapter.config.push(
      [key, JSON.stringify(operation()), "2026-09-22T12:00:00Z", "writer"],
      [key, JSON.stringify(operation()), "2026-09-22T12:00:00Z", "writer"],
    );
    const repository = new DraftRepository(adapter, spreadsheetId);
    await expect(repository.get(itemId)).rejects.toThrow(
      "DRAFT_STATE_DUPLICATE",
    );

    adapter.config.splice(1);
    adapter.config[0][1] = "not-json";
    await expect(repository.list()).rejects.toThrow("DRAFT_STATE_INVALID");

    adapter.config[0][1] = JSON.stringify({
      ...operation(),
      raw_body: "private",
    });
    await expect(repository.list()).rejects.toThrow("DRAFT_STATE_INVALID");
  });

  it("does not write when the synchronous mutation returns null", async () => {
    const adapter = new FakeAdapter();
    const repository = new DraftRepository(adapter, spreadsheetId);

    await expect(repository.mutate(itemId, () => null)).resolves.toBeNull();
    expect(adapter.config).toHaveLength(0);
  });
});
