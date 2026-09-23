import {
  DraftWriter,
  type DraftWriteResult,
} from "../adapters/gmail/draft-writer.js";
import { APPROVED_GMAIL_MAILBOX } from "../adapters/gmail/gmail-client.js";
import { DraftRepository } from "../adapters/sheets/draft-repository.js";
import {
  QueueRepository,
  queueItemFromRow,
} from "../adapters/sheets/queue-repository.js";
import {
  assertHeaders,
  type CellValue,
} from "../adapters/sheets/sheet-table.js";
import { WORKBOOK_MANIFEST } from "../adapters/sheets/workbook-manifest.js";
import { StudioInterpretationSchema } from "../adapters/studio/prepare-staging.js";
import {
  resolveContact,
  type CuratedContact,
} from "../services/context-registry.js";
import { createNativeDraftBinding } from "./draft-create-native.js";
import { RuntimeSheetAdapter, type TableGateway } from "./sheet-adapter.js";

export interface SelectedQueueDraftDependencies {
  readonly gateway: TableGateway;
  readonly spreadsheetId: string;
  readonly selectedRowIndex: number;
  readonly selectedRow: readonly CellValue[];
  readonly interpretation: unknown;
  readonly draftText: unknown;
  readonly now: () => string;
  readonly hash: (value: string) => string;
  readonly newOperationId: () => string;
  readonly getCuratedContacts: () => readonly CuratedContact[];
}

const invalidInput = (): DraftWriteResult => ({
  outcome: "blocked",
  code: "INVALID_INPUT",
});

/**
 * Owner-invoked acceptance boundary for one currently selected Queue row.
 * Model fields and draft text remain transient; only the existing operation
 * ledger and the unsent Gmail draft can be written.
 */
export async function createSelectedQueueDraft(
  dependencies: SelectedQueueDraftDependencies,
): Promise<DraftWriteResult> {
  const interpretation = StudioInterpretationSchema.safeParse(
    dependencies.interpretation,
  );
  if (
    !interpretation.success ||
    !Number.isInteger(dependencies.selectedRowIndex) ||
    dependencies.selectedRowIndex < 0
  )
    return invalidInput();

  const loadContext = async (itemId: string) => {
    try {
      const table = dependencies.gateway.read(
        dependencies.spreadsheetId,
        "Queue",
      );
      const headers = assertHeaders("Queue", table.headers);
      const row = table.rows[dependencies.selectedRowIndex];
      if (
        !row ||
        JSON.stringify(row) !== JSON.stringify(dependencies.selectedRow)
      )
        return null;
      const item = queueItemFromRow(headers, row);
      if (item.item_id !== itemId || !item.contact?.email) return null;

      const contacts = dependencies.getCuratedContacts();
      const knownContact =
        resolveContact(contacts, { email: item.contact.email }).kind !==
        "unresolved";
      const model = interpretation.data;
      return {
        mailbox: APPROVED_GMAIL_MAILBOX,
        item,
        sourceMessageId: item.source_record_id,
        sourceThreadId: item.source_thread_id,
        sourceContentHash: item.content_hash,
        knownContact,
        directResponseRequested:
          model.requires_response && model.direct_response_requested,
        modelDraftRisk: model.draft_risk,
        messageKind: model.message_kind,
        consequences: model.consequences,
        modelUncertain: model.model_uncertain,
        synthetic: false,
      };
    } catch {
      return null;
    }
  };

  const binding = createNativeDraftBinding(
    dependencies.spreadsheetId,
    loadContext,
  );
  const adapter = new RuntimeSheetAdapter(dependencies.gateway);
  const writer = new DraftWriter({
    repository: new DraftRepository(adapter, dependencies.spreadsheetId),
    transport: binding.transport,
    approvedMailbox: APPROVED_GMAIL_MAILBOX,
    loadContext: binding.loadContext,
    readFlags: binding.readFlags,
    hash: dependencies.hash,
    newOperationId: dependencies.newOperationId,
    now: dependencies.now,
  });

  let selected;
  try {
    const queueHeaders = WORKBOOK_MANIFEST.find(
      (definition) => definition.name === "Queue",
    )?.headers;
    if (!queueHeaders) return invalidInput();
    selected = queueItemFromRow(
      assertHeaders("Queue", queueHeaders),
      dependencies.selectedRow,
    );
  } catch {
    return invalidInput();
  }
  const result = await writer.createOrReplaceRoutineDraft(
    selected,
    dependencies.draftText,
  );
  if (
    (result.outcome !== "created" && result.outcome !== "existing") ||
    !result.draftId
  )
    return result;

  try {
    const queue = new QueueRepository(adapter, dependencies.spreadsheetId);
    await queue.runTransaction(async () => {
      const current = await queue.findBySourceThread(
        selected.source,
        selected.source_thread_id,
      );
      if (
        !current ||
        current.item.item_id !== selected.item_id ||
        JSON.stringify(current.expectedRow) !==
          JSON.stringify(dependencies.selectedRow)
      )
        throw new Error("QUEUE_DRAFT_PROJECTION_CHANGED");
      await queue.upsert(
        {
          ...current.item,
          updated_at: dependencies.now(),
          draft_status: "generated",
          gmail_draft_id: result.draftId,
        },
        current,
      );
    });
    return result;
  } catch {
    return { outcome: "recovery_required", code: "RECOVERY_REQUIRED" };
  }
}
