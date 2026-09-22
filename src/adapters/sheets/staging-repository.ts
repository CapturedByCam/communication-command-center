import { StudioStagingSchema } from "../../domain/schemas.js";
import type { StudioStagingRecord } from "../../domain/types.js";
import {
  assertHeaders,
  recordToRow,
  rowToRecord,
  type CellValue,
  type SheetTableAdapter,
} from "./sheet-table.js";

const sheetName = "Studio_Inbox";

function toRecord(
  record: StudioStagingRecord,
): Record<string, CellValue | undefined> {
  return {
    schema_version: record.schema_version,
    ingest_id: record.ingest_id,
    flow_run_id: record.flow_run_id,
    gmail_message_id: record.gmail_message_id,
    received_at: record.received_at,
    sender_email: record.sender_email,
    subject: record.subject,
    requires_response: record.requires_response,
    draft_risk: record.draft_risk,
    category_hint: record.category_hint,
    project_hint: record.project_hint,
    deadline_text: record.deadline_text,
    next_action_hint: record.next_action_hint,
    summary_hint: record.summary_hint,
    confidence_hint: record.confidence_hint,
    processing_status: record.processing_status,
    processed_at: record.processed_at,
    error_code: record.error_code,
  };
}

function fromRow(
  headers: readonly string[],
  row: readonly CellValue[],
): StudioStagingRecord {
  return StudioStagingSchema.parse(rowToRecord(headers, row));
}

export class StagingRepository {
  constructor(
    private readonly adapter: SheetTableAdapter,
    private readonly spreadsheetId: string,
  ) {}

  async append(record: StudioStagingRecord): Promise<void> {
    const validated = StudioStagingSchema.parse(record);
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    const headers = assertHeaders(sheetName, table.headers);
    await this.adapter.appendRow(
      this.spreadsheetId,
      sheetName,
      recordToRow(headers, toRecord(validated)),
    );
  }

  async list(): Promise<StudioStagingRecord[]> {
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    const headers = assertHeaders(sheetName, table.headers);
    return table.rows.map((row) => fromRow(headers, row));
  }

  async claimBatch(batchSize: number): Promise<StudioStagingRecord[]> {
    if (!Number.isInteger(batchSize) || batchSize < 0) {
      throw new Error("batchSize must be a non-negative integer");
    }
    if (batchSize === 0) {
      return [];
    }

    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    const headers = assertHeaders(sheetName, table.headers);
    const claimed: StudioStagingRecord[] = [];

    for (const [rowIndex, row] of table.rows.entries()) {
      if (claimed.length >= batchSize) {
        break;
      }
      const current = fromRow(headers, row);
      if (current.processing_status !== "new") {
        continue;
      }

      const next = StudioStagingSchema.parse({
        ...current,
        processing_status: "processing",
      });
      await this.adapter.updateRow(
        this.spreadsheetId,
        sheetName,
        rowIndex,
        recordToRow(headers, toRecord(next)),
        row,
      );
      claimed.push(next);
    }

    return claimed;
  }
}
