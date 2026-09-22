import { z } from "zod";
import {
  assertHeaders,
  recordToRow,
  rowToRecord,
  type SheetTableAdapter,
} from "./sheet-table.js";

const DeadLetterSchema = z
  .object({
    dead_letter_id: z.string().regex(/^dl_[a-f0-9]{64}$/),
    received_at: z.string().datetime({ offset: true }),
    source: z.literal("gmail"),
    source_record_id: z.string().min(1).max(512),
    error_code: z.enum([
      "READ_FAILED",
      "SNAPSHOT_INVALID",
      "PAGE_INVALID",
      "CURSOR_EXPIRED",
      "NOT_FOUND",
    ]),
    payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.enum(["open", "resolved"]),
    resolved_at: z.string().datetime({ offset: true }).nullable(),
    resolution_actor: z.string().max(128).nullable(),
  })
  .strict();

export type GmailDeadLetter = z.infer<typeof DeadLetterSchema>;

/** All mutations must run inside the caller's workbook transaction. */
export class GmailSyncRepository {
  constructor(
    private readonly adapter: SheetTableAdapter,
    private readonly spreadsheetId: string,
  ) {}

  async verifyHeaders(): Promise<void> {
    for (const name of [
      "Config",
      "Dead_Letter",
      "Queue",
      "Audit_Log",
      "Studio_Inbox",
    ]) {
      assertHeaders(
        name,
        (await this.adapter.readTable(this.spreadsheetId, name)).headers,
      );
    }
  }

  async load(key: string): Promise<unknown | null> {
    const table = await this.adapter.readTable(this.spreadsheetId, "Config");
    const headers = assertHeaders("Config", table.headers);
    const entries = table.rows
      .map((row) => rowToRecord(headers, row))
      .filter((row) => row.key === key);
    if (entries.length > 1) throw new Error("Duplicate Gmail checkpoint key");
    if (!entries.length) return null;
    if (typeof entries[0].value !== "string")
      throw new Error("Invalid Gmail checkpoint encoding");
    return JSON.parse(entries[0].value) as unknown;
  }

  async save(key: string, value: unknown, now: string): Promise<void> {
    const table = await this.adapter.readTable(this.spreadsheetId, "Config");
    const headers = assertHeaders("Config", table.headers);
    const index = table.rows.findIndex(
      (row) => rowToRecord(headers, row).key === key,
    );
    const row = recordToRow(headers, {
      key,
      value: JSON.stringify(value),
      updated_at: now,
      updated_by: "gmail_reconciliation",
    });
    if (index < 0)
      await this.adapter.appendRow(this.spreadsheetId, "Config", row);
    else
      await this.adapter.updateRow(
        this.spreadsheetId,
        "Config",
        index,
        row,
        table.rows[index],
      );
  }

  async hasOpenDeadLetter(sourceRecordId: string): Promise<boolean> {
    const table = await this.adapter.readTable(
      this.spreadsheetId,
      "Dead_Letter",
    );
    const headers = assertHeaders("Dead_Letter", table.headers);
    // Other source types share this sheet; only parse this adapter's Gmail rows.
    return table.rows.some((row) => {
      const record = rowToRecord(headers, row);
      return (
        record.source === "gmail" &&
        record.source_record_id === sourceRecordId &&
        record.status === "open"
      );
    });
  }

  async deadLetter(event: GmailDeadLetter): Promise<void> {
    const validated = DeadLetterSchema.parse(event);
    const table = await this.adapter.readTable(
      this.spreadsheetId,
      "Dead_Letter",
    );
    const headers = assertHeaders("Dead_Letter", table.headers);
    const index = table.rows.findIndex(
      (row) =>
        rowToRecord(headers, row).dead_letter_id === event.dead_letter_id,
    );
    const row = recordToRow(headers, validated);
    if (index < 0)
      await this.adapter.appendRow(this.spreadsheetId, "Dead_Letter", row);
    else if (rowToRecord(headers, table.rows[index]).status === "resolved") {
      await this.adapter.updateRow(
        this.spreadsheetId,
        "Dead_Letter",
        index,
        row,
        table.rows[index],
      );
    }
  }
}
