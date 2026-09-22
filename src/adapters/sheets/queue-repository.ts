import { CommunicationItemSchema } from "../../domain/schemas.js";
import type { CommunicationItem, Source } from "../../domain/types.js";
import {
  assertHeaders,
  ConcurrentRowChangeError,
  recordToRow,
  rowToRecord,
  type CellValue,
  type SheetTableAdapter,
} from "./sheet-table.js";

const sheetName = "Queue";

export interface QueueEntry {
  readonly item: CommunicationItem;
  readonly rowIndex: number;
  readonly expectedRow: readonly CellValue[];
}

export function itemToRecord(
  item: CommunicationItem,
): Record<string, CellValue | undefined> {
  return {
    schema_version: item.schema_version,
    item_id: item.item_id,
    source: item.source,
    source_record_id: item.source_record_id,
    source_thread_id: item.source_thread_id,
    source_link: item.source_link,
    captured_at: item.captured_at,
    updated_at: item.updated_at,
    contact_name: item.contact?.name,
    contact_email: item.contact?.email,
    contact_phone: item.contact?.phone,
    contact_handle: item.contact?.handle,
    category: item.category,
    project_id: item.project_id,
    status: item.status,
    waiting_on: item.waiting_on,
    urgency: item.urgency,
    priority_score: item.priority_score,
    next_action_type: item.next_action_type,
    next_action: item.next_action,
    summary: item.summary,
    preview: item.preview,
    deadline_at: item.deadline_at,
    deadline_text: item.deadline_text,
    needs_date_review: item.needs_date_review ?? false,
    follow_up_at: item.follow_up_at,
    promised_follow_up: item.promised_follow_up,
    draft_status: item.draft_status,
    gmail_draft_id: item.gmail_draft_id,
    confidence: item.confidence,
    classifier_version: item.classifier_version,
    content_hash: item.content_hash,
    manual_override: item.manual_override ?? false,
    snooze_until: item.snooze_until,
    resolved_at: item.resolved_at,
    raw_content_stored: item.raw_content_stored,
    last_error_code: item.last_error_code,
  };
}

export function queueItemFromRow(
  headers: readonly string[],
  row: readonly CellValue[],
): CommunicationItem {
  const record = rowToRecord(headers, row);
  const contactValues = [
    record.contact_name,
    record.contact_email,
    record.contact_phone,
    record.contact_handle,
  ];
  const hasContact = contactValues.some(
    (value) => value !== null && value !== "",
  );

  return CommunicationItemSchema.parse({
    schema_version: record.schema_version,
    item_id: record.item_id,
    source: record.source,
    source_record_id: record.source_record_id,
    source_thread_id: record.source_thread_id,
    source_link: record.source_link,
    captured_at: record.captured_at,
    updated_at: record.updated_at,
    contact: hasContact
      ? {
          name: record.contact_name,
          email: record.contact_email,
          phone: record.contact_phone,
          handle: record.contact_handle,
        }
      : undefined,
    category: record.category,
    project_id: record.project_id,
    status: record.status,
    waiting_on: record.waiting_on,
    urgency: record.urgency,
    priority_score: record.priority_score,
    next_action_type: record.next_action_type,
    next_action: record.next_action,
    summary: record.summary,
    preview: record.preview,
    deadline_at: record.deadline_at,
    deadline_text: record.deadline_text,
    needs_date_review: record.needs_date_review,
    follow_up_at: record.follow_up_at,
    promised_follow_up: record.promised_follow_up,
    draft_status: record.draft_status,
    gmail_draft_id: record.gmail_draft_id,
    confidence: record.confidence,
    classifier_version: record.classifier_version,
    content_hash: record.content_hash,
    manual_override: record.manual_override,
    snooze_until: record.snooze_until,
    resolved_at: record.resolved_at,
    raw_content_stored: record.raw_content_stored,
    last_error_code: record.last_error_code,
  });
}

export class QueueRepository {
  constructor(
    private readonly adapter: SheetTableAdapter,
    private readonly spreadsheetId: string,
  ) {}

  async runTransaction<T>(operation: () => Promise<T>): Promise<T> {
    return this.adapter.runTransaction(this.spreadsheetId, operation);
  }

  async verifyHeaders(): Promise<void> {
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    assertHeaders(sheetName, table.headers);
  }

  async list(): Promise<CommunicationItem[]> {
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    const headers = assertHeaders(sheetName, table.headers);
    return table.rows.map((row) => queueItemFromRow(headers, row));
  }

  async getBySourceThread(
    source: Source,
    sourceThreadId: string,
  ): Promise<CommunicationItem | null> {
    return (
      (await this.findBySourceThread(source, sourceThreadId))?.item ?? null
    );
  }

  async findBySourceThread(
    source: Source,
    sourceThreadId: string,
  ): Promise<QueueEntry | null> {
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    const headers = assertHeaders(sheetName, table.headers);
    for (const [rowIndex, row] of table.rows.entries()) {
      const item = queueItemFromRow(headers, row);
      if (item.source === source && item.source_thread_id === sourceThreadId) {
        return { item, rowIndex, expectedRow: row };
      }
    }
    return null;
  }

  async upsert(
    item: CommunicationItem,
    expected: QueueEntry | null,
  ): Promise<"created" | "updated"> {
    const validated = CommunicationItemSchema.parse(item);
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    const headers = assertHeaders(sheetName, table.headers);
    const nextRow = recordToRow(headers, itemToRecord(validated));

    if (!expected) {
      const duplicateExists = table.rows.some((row) => {
        const candidate = queueItemFromRow(headers, row);
        return (
          candidate.source === validated.source &&
          candidate.source_thread_id === validated.source_thread_id
        );
      });
      if (duplicateExists) {
        throw new ConcurrentRowChangeError(sheetName, -1);
      }
      await this.adapter.appendRow(this.spreadsheetId, sheetName, nextRow);
      return "created";
    }

    await this.adapter.updateRow(
      this.spreadsheetId,
      sheetName,
      expected.rowIndex,
      nextRow,
      expected.expectedRow,
    );
    return "updated";
  }
}
