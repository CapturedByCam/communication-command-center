import { z } from "zod";
import { SourceSchema } from "../../domain/schemas.js";
import {
  assertHeaders,
  recordToRow,
  rowToRecord,
  type CellValue,
  type SheetTableAdapter,
} from "./sheet-table.js";

const sheetName = "Audit_Log";

export const AuditResultSchema = z.enum([
  "created",
  "updated",
  "duplicate_suppressed",
]);

const AuditEventSchema = z
  .object({
    event_id: z.string().min(1).max(128),
    event_at: z.string().datetime({ offset: true }),
    item_id: z.string().regex(/^cc_[A-Za-z0-9_-]{12,}$/),
    source: SourceSchema,
    action: z.literal("upsert_item"),
    result: AuditResultSchema,
    error_code: z.string().max(128).nullable(),
    payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
    duration_ms: z.number().int().min(0),
    actor: z.string().min(1).max(128),
    correlation_id: z.string().min(1).max(128),
  })
  .strict();

export type AuditEvent = z.infer<typeof AuditEventSchema>;

function toRecord(event: AuditEvent): Record<string, CellValue> {
  return {
    event_id: event.event_id,
    event_at: event.event_at,
    item_id: event.item_id,
    source: event.source,
    action: event.action,
    result: event.result,
    error_code: event.error_code,
    payload_hash: event.payload_hash,
    duration_ms: event.duration_ms,
    actor: event.actor,
    correlation_id: event.correlation_id,
  };
}

function fromRow(
  headers: readonly string[],
  row: readonly CellValue[],
): AuditEvent {
  return AuditEventSchema.parse(rowToRecord(headers, row));
}

export class AuditRepository {
  constructor(
    private readonly adapter: SheetTableAdapter,
    private readonly spreadsheetId: string,
  ) {}

  async verifyHeaders(): Promise<void> {
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    assertHeaders(sheetName, table.headers);
  }

  async append(event: AuditEvent): Promise<void> {
    const validated = AuditEventSchema.parse(event);
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    const headers = assertHeaders(sheetName, table.headers);
    await this.adapter.appendRow(
      this.spreadsheetId,
      sheetName,
      recordToRow(headers, toRecord(validated)),
    );
  }

  async list(): Promise<AuditEvent[]> {
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    const headers = assertHeaders(sheetName, table.headers);
    return table.rows.map((row) => fromRow(headers, row));
  }
}
