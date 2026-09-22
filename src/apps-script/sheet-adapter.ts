import {
  ConcurrentRowChangeError,
  type CellValue,
  type SheetTable,
  type SheetTableAdapter,
} from "../adapters/sheets/sheet-table.js";

export class SheetCommitUncertainError extends Error {
  constructor() {
    super("SHEET_COMMIT_UNCERTAIN");
    this.name = "SheetCommitUncertainError";
  }
}

export interface TableChange {
  sheetName: string;
  before: SheetTable;
  after: SheetTable;
}
export interface TableGateway {
  acquire(): void;
  release(): void;
  read(spreadsheetId: string, sheetName: string): SheetTable;
  /** Validate snapshots, then submit all changes as one atomic provider batch. Never retry here. */
  commit(spreadsheetId: string, changes: TableChange[]): void;
}
const clone = (table: SheetTable): SheetTable => ({
  headers: [...table.headers],
  rows: table.rows.map((row) => [...row]),
});

/** A script-lock unit of work. Network writes occur only after the callback succeeds. */
export class RuntimeSheetAdapter implements SheetTableAdapter {
  private active: string | null = null;
  private originals = new Map<string, SheetTable>();
  private staged = new Map<string, SheetTable>();
  constructor(private readonly gateway: TableGateway) {}

  async runTransaction<T>(
    spreadsheetId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (this.active) throw new Error("TRANSACTION_ACTIVE");
    this.gateway.acquire();
    this.active = spreadsheetId;
    try {
      const result = await operation();
      const changes = [...this.staged].flatMap(([sheetName, after]) => {
        const before = this.originals.get(sheetName)!;
        return JSON.stringify(before) === JSON.stringify(after)
          ? []
          : [{ sheetName, before, after }];
      });
      if (changes.length) {
        this.gateway.commit(spreadsheetId, changes);
      }
      return result;
    } finally {
      this.active = null;
      this.originals.clear();
      this.staged.clear();
      this.gateway.release();
    }
  }

  async readTable(
    spreadsheetId: string,
    sheetName: string,
  ): Promise<SheetTable> {
    if (this.active && this.active !== spreadsheetId)
      throw new Error("WORKBOOK_MISMATCH");
    if (!this.active) return clone(this.gateway.read(spreadsheetId, sheetName));
    if (!this.staged.has(sheetName)) {
      const table = this.gateway.read(spreadsheetId, sheetName);
      this.originals.set(sheetName, clone(table));
      this.staged.set(sheetName, clone(table));
    }
    return clone(this.staged.get(sheetName)!);
  }
  private requireTransaction(id: string): void {
    if (!this.active) throw new Error("TRANSACTION_REQUIRED");
    if (id !== this.active) throw new Error("WORKBOOK_MISMATCH");
  }
  async appendRow(
    id: string,
    name: string,
    row: readonly CellValue[],
  ): Promise<void> {
    this.requireTransaction(id);
    const table = await this.readTable(id, name);
    if (row.length !== table.headers.length) throw new Error("ROW_WIDTH");
    table.rows.push([...row]);
    this.staged.set(name, table);
  }
  async updateRow(
    id: string,
    name: string,
    index: number,
    row: readonly CellValue[],
    expected: readonly CellValue[],
  ): Promise<void> {
    this.requireTransaction(id);
    const table = await this.readTable(id, name);
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      JSON.stringify(table.rows[index]) !== JSON.stringify(expected)
    )
      throw new ConcurrentRowChangeError(name, index);
    if (row.length !== table.headers.length) throw new Error("ROW_WIDTH");
    table.rows[index] = [...row];
    this.staged.set(name, table);
  }
}
