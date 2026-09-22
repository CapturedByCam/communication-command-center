import {
  WORKBOOK_MANIFEST,
  headersEqual,
  type BootstrapResult,
  type HeaderConflict,
  type WorkbookAdapter,
  type WorkbookVerification,
} from "../adapters/sheets/workbook-manifest.js";

async function inspectWorkbook(
  spreadsheetId: string,
  adapter: WorkbookAdapter,
): Promise<{
  existingSheets: Set<string>;
  emptySheets: Set<string>;
  conflicts: HeaderConflict[];
}> {
  const existingSheets = new Set(await adapter.listSheetNames(spreadsheetId));
  const emptySheets = new Set<string>();
  const conflicts: HeaderConflict[] = [];

  for (const definition of WORKBOOK_MANIFEST) {
    if (!existingSheets.has(definition.name)) {
      continue;
    }

    const actual = await adapter.readHeaders(spreadsheetId, definition.name);
    if (actual.length === 0) {
      emptySheets.add(definition.name);
    } else if (!headersEqual(actual, definition.headers)) {
      conflicts.push({
        sheetName: definition.name,
        expected: [...definition.headers],
        actual,
      });
    }
  }

  return { existingSheets, emptySheets, conflicts };
}

export async function bootstrapWorkbook(
  spreadsheetId: string,
  adapter: WorkbookAdapter,
): Promise<BootstrapResult> {
  const inspection = await inspectWorkbook(spreadsheetId, adapter);
  if (inspection.conflicts.length > 0) {
    return {
      status: "conflict",
      createdSheets: [],
      initializedHeaders: [],
      conflicts: inspection.conflicts,
    };
  }

  const createdSheets: string[] = [];
  const initializedHeaders: string[] = [];

  for (const definition of WORKBOOK_MANIFEST) {
    if (!inspection.existingSheets.has(definition.name)) {
      await adapter.createSheet(spreadsheetId, definition.name);
      createdSheets.push(definition.name);
      await adapter.writeHeaders(
        spreadsheetId,
        definition.name,
        definition.headers,
      );
      initializedHeaders.push(definition.name);
    } else if (inspection.emptySheets.has(definition.name)) {
      await adapter.writeHeaders(
        spreadsheetId,
        definition.name,
        definition.headers,
      );
      initializedHeaders.push(definition.name);
    }
  }

  return {
    status:
      createdSheets.length > 0 || initializedHeaders.length > 0
        ? "changed"
        : "unchanged",
    createdSheets,
    initializedHeaders,
    conflicts: [],
  };
}

export async function verifyWorkbook(
  spreadsheetId: string,
  adapter: WorkbookAdapter,
): Promise<WorkbookVerification> {
  const existingSheets = new Set(await adapter.listSheetNames(spreadsheetId));
  const missingSheets: string[] = [];
  const conflicts: HeaderConflict[] = [];

  for (const definition of WORKBOOK_MANIFEST) {
    if (!existingSheets.has(definition.name)) {
      missingSheets.push(definition.name);
      continue;
    }

    const actual = await adapter.readHeaders(spreadsheetId, definition.name);
    if (!headersEqual(actual, definition.headers)) {
      conflicts.push({
        sheetName: definition.name,
        expected: [...definition.headers],
        actual,
      });
    }
  }

  return {
    valid: missingSheets.length === 0 && conflicts.length === 0,
    missingSheets,
    conflicts,
  };
}
