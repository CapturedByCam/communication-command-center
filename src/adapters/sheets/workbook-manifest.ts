export interface WorkbookSheetDefinition {
  readonly name: string;
  readonly headers: readonly string[];
}

export interface WorkbookAdapter {
  listSheetNames(spreadsheetId: string): Promise<string[]>;
  readHeaders(spreadsheetId: string, sheetName: string): Promise<string[]>;
  createSheet(spreadsheetId: string, sheetName: string): Promise<void>;
  writeHeaders(
    spreadsheetId: string,
    sheetName: string,
    headers: readonly string[],
  ): Promise<void>;
}

export interface HeaderConflict {
  readonly sheetName: string;
  readonly expected: string[];
  readonly actual: string[];
}

export interface BootstrapResult {
  readonly status: "changed" | "unchanged" | "conflict";
  readonly createdSheets: string[];
  readonly initializedHeaders: string[];
  readonly conflicts: HeaderConflict[];
}

export interface WorkbookVerification {
  readonly valid: boolean;
  readonly missingSheets: string[];
  readonly conflicts: HeaderConflict[];
}

export const WORKBOOK_MANIFEST = [
  {
    name: "Queue",
    headers: [
      "schema_version",
      "item_id",
      "source",
      "source_record_id",
      "source_thread_id",
      "source_link",
      "captured_at",
      "updated_at",
      "contact_name",
      "contact_email",
      "contact_phone",
      "contact_handle",
      "category",
      "project_id",
      "status",
      "waiting_on",
      "urgency",
      "priority_score",
      "next_action_type",
      "next_action",
      "summary",
      "preview",
      "deadline_at",
      "deadline_text",
      "needs_date_review",
      "follow_up_at",
      "promised_follow_up",
      "draft_status",
      "gmail_draft_id",
      "confidence",
      "classifier_version",
      "content_hash",
      "manual_override",
      "snooze_until",
      "resolved_at",
      "raw_content_stored",
      "last_error_code",
    ],
  },
  {
    name: "Studio_Inbox",
    headers: [
      "schema_version",
      "ingest_id",
      "flow_run_id",
      "gmail_message_id",
      "received_at",
      "sender_email",
      "subject",
      "requires_response",
      "draft_risk",
      "category_hint",
      "project_hint",
      "deadline_text",
      "next_action_hint",
      "summary_hint",
      "confidence_hint",
      "processing_status",
      "processed_at",
      "error_code",
    ],
  },
  {
    name: "Contacts",
    headers: [
      "contact_id",
      "name",
      "email",
      "phone",
      "handle",
      "default_category",
      "default_project_id",
      "priority_boost",
      "tone_notes",
      "active",
      "updated_at",
    ],
  },
  {
    name: "Projects",
    headers: [
      "project_id",
      "name",
      "status",
      "drive_link",
      "client_contact_id",
      "default_category",
      "context_summary",
      "updated_at",
    ],
  },
  {
    name: "Commitments",
    headers: [
      "commitment_id",
      "item_id",
      "source_thread_id",
      "promise_text",
      "deadline_at",
      "deadline_text",
      "status",
      "fulfilled_at",
      "fulfillment_evidence_id",
      "manual_override",
      "updated_at",
      "schema_version",
      "source_message_id",
      "source_evidence_id",
      "observed_at",
      "resolved_by",
      "needs_date_review",
    ],
  },
  {
    name: "Briefing_View",
    headers: [
      "briefing_date",
      "section",
      "sort_order",
      "item_id",
      "priority_score",
      "summary",
      "next_action",
      "source_link",
      "draft_status",
      "waiting_on",
      "deadline_at",
    ],
  },
  {
    name: "Briefing_History",
    headers: [
      "briefing_id",
      "generated_at",
      "delivery_channel",
      "delivery_status",
      "item_count",
      "content_hash",
      "error_code",
    ],
  },
  {
    name: "Audit_Log",
    headers: [
      "event_id",
      "event_at",
      "item_id",
      "source",
      "action",
      "result",
      "error_code",
      "payload_hash",
      "duration_ms",
      "actor",
      "correlation_id",
    ],
  },
  {
    name: "Dead_Letter",
    headers: [
      "dead_letter_id",
      "received_at",
      "source",
      "source_record_id",
      "error_code",
      "payload_hash",
      "status",
      "resolved_at",
      "resolution_actor",
    ],
  },
  {
    name: "Config",
    headers: ["key", "value", "updated_at", "updated_by"],
  },
] as const satisfies readonly WorkbookSheetDefinition[];

export function headersEqual(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((header, index) => header === expected[index])
  );
}
