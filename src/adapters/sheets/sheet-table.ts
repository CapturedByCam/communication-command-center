import { WORKBOOK_MANIFEST, headersEqual } from "./workbook-manifest.js";

export type CellValue = string | number | boolean | null;

export interface SheetTable {
  readonly headers: string[];
  readonly rows: CellValue[][];
}

export interface SheetTableAdapter {
  readTable(spreadsheetId: string, sheetName: string): Promise<SheetTable>;
  appendRow(
    spreadsheetId: string,
    sheetName: string,
    row: readonly CellValue[],
  ): Promise<void>;
  updateRow(
    spreadsheetId: string,
    sheetName: string,
    rowIndex: number,
    row: readonly CellValue[],
    expectedRow: readonly CellValue[],
  ): Promise<void>;
}

export class HeaderDriftError extends Error {
  constructor(
    readonly sheetName: string,
    readonly expected: readonly string[],
    readonly actual: readonly string[],
  ) {
    super(`Header drift detected in ${sheetName}`);
    this.name = "HeaderDriftError";
  }
}

export class ConcurrentRowChangeError extends Error {
  constructor(
    readonly sheetName: string,
    readonly rowIndex: number,
  ) {
    super(`Concurrent row change detected in ${sheetName} at ${rowIndex}`);
    this.name = "ConcurrentRowChangeError";
  }
}

export function getExpectedHeaders(sheetName: string): readonly string[] {
  const definition = WORKBOOK_MANIFEST.find(
    (candidate) => candidate.name === sheetName,
  );
  if (!definition) {
    throw new Error(`No manifest entry for ${sheetName}`);
  }
  return definition.headers;
}

export function assertHeaders(
  sheetName: string,
  actual: readonly string[],
): readonly string[] {
  const expected = getExpectedHeaders(sheetName);
  if (!headersEqual(actual, expected)) {
    throw new HeaderDriftError(sheetName, expected, actual);
  }
  return expected;
}

export function rowToRecord(
  headers: readonly string[],
  row: readonly CellValue[],
): Record<string, CellValue> {
  if (row.length !== headers.length) {
    throw new Error("Row width does not match the verified header width");
  }
  return Object.fromEntries(
    headers.map((header, index) => [header, row[index] ?? null]),
  );
}

export function recordToRow(
  headers: readonly string[],
  record: Readonly<Record<string, CellValue | undefined>>,
): CellValue[] {
  return headers.map((header) => record[header] ?? null);
}
