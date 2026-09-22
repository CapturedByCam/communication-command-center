import {
  DraftOperationSchema,
  type DraftOperation,
} from "../gmail/draft-state.js";
import {
  assertHeaders,
  recordToRow,
  rowToRecord,
  type CellValue,
  type SheetTable,
  type SheetTableAdapter,
} from "./sheet-table.js";

const sheetName = "Config";
const namespace = "gmail.draft.v1.";
const itemIdPattern = /^cc_[A-Za-z0-9_-]{12,}$/;

interface StateRow {
  readonly rowIndex: number;
  readonly expectedRow: readonly CellValue[];
  readonly operation: DraftOperation;
}

function invalidState(): never {
  throw new Error("DRAFT_STATE_INVALID");
}

function parseOperation(value: CellValue, key: string): DraftOperation {
  if (typeof value !== "string") {
    return invalidState();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return invalidState();
  }

  const result = DraftOperationSchema.safeParse(parsed);
  if (!result.success) {
    return invalidState();
  }
  if (key !== `${namespace}${result.data.item_id}`) {
    throw new Error("DRAFT_STATE_KEY_MISMATCH");
  }
  return result.data;
}

function assertItemId(itemId: string): void {
  if (!itemIdPattern.test(itemId)) {
    invalidState();
  }
}

function stateRows(table: SheetTable): StateRow[] {
  const headers = assertHeaders(sheetName, table.headers);
  const seen = new Set<string>();
  const states: StateRow[] = [];

  for (const [rowIndex, row] of table.rows.entries()) {
    const record = rowToRecord(headers, row);
    const key = record.key;
    if (typeof key !== "string" || !key.startsWith(namespace)) {
      continue;
    }
    if (seen.has(key)) {
      throw new Error("DRAFT_STATE_DUPLICATE");
    }
    seen.add(key);
    states.push({
      rowIndex,
      expectedRow: row,
      operation: parseOperation(record.value, key),
    });
  }

  return states;
}

function assertSynchronous(value: unknown): void {
  if (
    value !== null &&
    typeof value === "object" &&
    "then" in value &&
    typeof value.then === "function"
  ) {
    throw new Error("DRAFT_STATE_CALLBACK_ASYNC");
  }
}

export { type DraftOperation };

export class DraftRepository {
  constructor(
    private readonly adapter: SheetTableAdapter,
    private readonly spreadsheetId: string,
  ) {}

  async get(itemId: string): Promise<DraftOperation | null> {
    assertItemId(itemId);
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    const matches = stateRows(table).filter(
      (state) => state.operation.item_id === itemId,
    );
    if (matches.length > 1) {
      throw new Error("DRAFT_STATE_DUPLICATE");
    }
    return matches[0]?.operation ?? null;
  }

  async list(): Promise<DraftOperation[]> {
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    return stateRows(table).map((state) => state.operation);
  }

  async mutate(
    itemId: string,
    update: (current: DraftOperation | null) => DraftOperation | null,
  ): Promise<DraftOperation | null> {
    assertItemId(itemId);
    return this.adapter.runTransaction(this.spreadsheetId, async () => {
      const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
      const headers = assertHeaders(sheetName, table.headers);
      const matches = stateRows(table).filter(
        (state) => state.operation.item_id === itemId,
      );
      if (matches.length > 1) {
        throw new Error("DRAFT_STATE_DUPLICATE");
      }

      const current = matches[0] ?? null;
      const next = update(current?.operation ?? null);
      assertSynchronous(next);
      if (next === null) {
        return null;
      }

      const parsed = DraftOperationSchema.safeParse(next);
      if (!parsed.success) {
        return invalidState();
      }
      if (parsed.data.item_id !== itemId) {
        throw new Error("DRAFT_STATE_KEY_MISMATCH");
      }
      const stored = parsed.data;
      const row = recordToRow(headers, {
        key: `${namespace}${itemId}`,
        value: JSON.stringify(stored),
        updated_at: stored.updated_at,
        updated_by: "gmail_draft_writer",
      });

      if (current) {
        await this.adapter.updateRow(
          this.spreadsheetId,
          sheetName,
          current.rowIndex,
          row,
          current.expectedRow,
        );
      } else {
        await this.adapter.appendRow(this.spreadsheetId, sheetName, row);
      }
      return stored;
    });
  }
}
