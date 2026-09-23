import type { CellValue, SheetTable } from "../adapters/sheets/sheet-table.js";
import {
  createGoogleSheetGateway,
  type GoogleSheetServices,
} from "./google-sheet-gateway.js";
import { APPROVED_GMAIL_MAILBOX } from "../adapters/gmail/gmail-client.js";

/** Fixed diagnostic only; never retain a provider exception or response. */
export class SheetApiReadError extends Error {
  constructor(
    readonly operation: "values" | "metadata",
    readonly target: string | null = null,
  ) {
    super("SHEET_API_READ_FAILED");
    this.name = "SheetApiReadError";
  }
}

export function assertOwner(): void {
  if (
    Session.getEffectiveUser().getEmail().toLowerCase() !==
    APPROVED_GMAIL_MAILBOX
  )
    throw new Error("ACCOUNT_MISMATCH");
}
export function workbookId(): string {
  const id =
    PropertiesService.getScriptProperties().getProperty("CCC_WORKBOOK_ID");
  if (!id || !/^[A-Za-z0-9_-]{20,}$/.test(id))
    throw new Error("WORKBOOK_NOT_CONFIGURED");
  return id;
}
export function flag(name: string): boolean {
  return (
    PropertiesService.getScriptProperties().getProperty("CCC_" + name) ===
    "true"
  );
}
export function sha256(value: string): string {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8,
  )
    .map((byte) => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, "0"))
    .join("");
}
function readTable(id: string, name: string): SheetTable {
  if (!/^[A-Za-z_]+$/.test(name)) throw new Error("SHEET_NAME_INVALID");
  const service = Sheets!.Spreadsheets!;
  const readValues = (
    range: string,
    phase: "headers" | "rows",
    options: object,
  ) => {
    try {
      return service.Values!.get(id, range, options);
    } catch {
      throw new SheetApiReadError("values", `${name}:${phase}`);
    }
  };
  const headers = (
    readValues(`'${name}'!A1:ZZ1`, "headers", {
      valueRenderOption: "UNFORMATTED_VALUE",
    }).values?.[0] ?? []
  ).map(String);
  if (headers.length > 100) throw new Error("HEADER_LIMIT");
  if (!headers.length) return { headers: [], rows: [] };
  const lastColumn = (() => {
    let n = headers.length,
      s = "";
    while (n) {
      n--;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  })();
  const rows =
    readValues(`'${name}'!A2:${lastColumn}5002`, "rows", {
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    }).values ?? [];
  if (rows.length >= 5001) throw new Error("TABLE_LIMIT_REVIEW_REQUIRED");
  return {
    headers,
    rows: rows.map((row) =>
      headers.map((_, i): CellValue => {
        const value = row[i];
        if (value === undefined || value === "") return null;
        if (
          typeof value !== "string" &&
          typeof value !== "number" &&
          typeof value !== "boolean"
        )
          throw new Error("CELL_TYPE_INVALID");
        return value;
      }),
    ),
  };
}
export function googleSheetServices(): GoogleSheetServices {
  const lock = LockService.getScriptLock();
  return {
    acquire: () => {
      assertOwner();
      if (!lock.tryLock(5000)) throw new Error("BUSY");
    },
    release: () => lock.releaseLock(),
    read: readTable,
    sheetIds: (id) => {
      try {
        return Object.fromEntries(
          (
            Sheets!.Spreadsheets!.get(id, { fields: "sheets.properties" })
              .sheets ?? []
          ).map((sheet) => [
            sheet.properties!.title!,
            sheet.properties!.sheetId!,
          ]),
        );
      } catch {
        throw new SheetApiReadError("metadata");
      }
    },
    batch: (id, requests) => {
      Sheets!.Spreadsheets!.batchUpdate({ requests }, id);
    },
  };
}
export function googleGateway() {
  return createGoogleSheetGateway(googleSheetServices());
}
