import { expect } from "vitest";
import {
  ConcurrentRowChangeError,
  type CellValue,
  type SheetTable,
  type SheetTableAdapter,
} from "../../src/adapters/sheets/sheet-table.js";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
const spreadsheetId = "synthetic-sheet";

export class FakeSheetTableAdapter implements SheetTableAdapter {
  readonly tables = new Map<string, SheetTable>();
  failNextAppendFor: string | null = null;
  failUpdateCall: number | null = null;
  beforeNextUpdate:
    ((sheetName: string, rowIndex: number, table: SheetTable) => void) | null =
    null;
  private transactionTail: Promise<void> = Promise.resolve();
  private undoActions: Array<() => void> | null = null;
  private updateCallCount = 0;

  initializeManifest(): void {
    for (const definition of WORKBOOK_MANIFEST) {
      this.tables.set(definition.name, {
        headers: [...definition.headers],
        rows: [],
      });
    }
  }

  failAfterUpcomingUpdates(count: number): void {
    this.failUpdateCall = this.updateCallCount + count;
  }

  async runTransaction<T>(
    requestedSpreadsheetId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    expect(requestedSpreadsheetId).toBe(spreadsheetId);
    const previous = this.transactionTail;
    let release: () => void = () => {};
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    this.undoActions = [];
    try {
      return await operation();
    } catch (error) {
      for (const undo of [...this.undoActions].reverse()) {
        undo();
      }
      throw error;
    } finally {
      this.undoActions = null;
      release();
    }
  }

  async readTable(
    requestedSpreadsheetId: string,
    sheetName: string,
  ): Promise<SheetTable> {
    expect(requestedSpreadsheetId).toBe(spreadsheetId);
    const table = this.tables.get(sheetName);
    if (!table) {
      throw new Error(`missing fake table: ${sheetName}`);
    }
    return {
      headers: [...table.headers],
      rows: table.rows.map((row) => [...row]),
    };
  }

  async appendRow(
    requestedSpreadsheetId: string,
    sheetName: string,
    row: readonly CellValue[],
  ): Promise<void> {
    expect(requestedSpreadsheetId).toBe(spreadsheetId);
    const table = this.requireTable(sheetName);
    if (this.failNextAppendFor === sheetName) {
      this.failNextAppendFor = null;
      throw new Error(`synthetic append failure: ${sheetName}`);
    }
    const rowIndex = table.rows.length;
    table.rows.push([...row]);
    this.undoActions?.push(() => table.rows.splice(rowIndex, 1));
  }

  async updateRow(
    requestedSpreadsheetId: string,
    sheetName: string,
    rowIndex: number,
    row: readonly CellValue[],
    expectedRow: readonly CellValue[],
  ): Promise<void> {
    expect(requestedSpreadsheetId).toBe(spreadsheetId);
    const table = this.requireTable(sheetName);
    if (this.beforeNextUpdate) {
      const mutate = this.beforeNextUpdate;
      this.beforeNextUpdate = null;
      mutate(sheetName, rowIndex, table);
    }
    this.updateCallCount += 1;
    if (this.failUpdateCall === this.updateCallCount) {
      throw new Error(`synthetic update failure: ${sheetName}`);
    }
    if (JSON.stringify(table.rows[rowIndex]) !== JSON.stringify(expectedRow)) {
      throw new ConcurrentRowChangeError(sheetName, rowIndex);
    }
    const previous = [...table.rows[rowIndex]];
    table.rows[rowIndex] = [...row];
    this.undoActions?.push(() => {
      table.rows[rowIndex] = previous;
    });
  }

  private requireTable(sheetName: string): SheetTable {
    const table = this.tables.get(sheetName);
    if (!table) {
      throw new Error(`missing fake table: ${sheetName}`);
    }
    return table;
  }
}
