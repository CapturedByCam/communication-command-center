import { queueItemFromRow } from "../adapters/sheets/queue-repository.js";
import { BoundedGmailCheckpointSchema } from "../domain/bounded-gmail-checkpoint.js";
import { GmailCheckpointSchema } from "../adapters/gmail/reconciliation.js";
import {
  assertHeaders,
  recordToRow,
  rowToRecord,
  type CellValue,
  type SheetTable,
} from "../adapters/sheets/sheet-table.js";
import {
  buildBriefing,
  type BriefingEntry,
  type BriefingHealth,
} from "../services/briefing-service.js";
import type { Commitment } from "../services/commitment-service.js";
import {
  commitmentFromStorageRow,
  commitmentStorageToCommitment,
} from "../adapters/sheets/commitment-repository.js";
import type { TableChange, TableGateway } from "./sheet-adapter.js";

const MAX_PROMISE_LENGTH = 500;
const ISO_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))$/u;

export interface BriefingRunResult {
  readonly status: "generated" | "duplicate";
  readonly briefingId: string;
  readonly sections: number;
  readonly deliveryChannel: "none";
}

function isTimestamp(value: CellValue): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_TIMESTAMP.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [
    1, 2, 3, 4, 5, 6, 7, 8,
  ].map((index) => Number(match[index] ?? 0));
  if (
    month < 1 ||
    month > 12 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  )
    return false;
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return (
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day
  );
}

function commitmentFromRow(
  headers: readonly string[],
  row: readonly CellValue[],
): Commitment {
  try {
    return commitmentStorageToCommitment(
      commitmentFromStorageRow(headers, row),
    );
  } catch {
    throw new Error("COMMITMENT_INVALID");
  }
}

function newYorkDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function table(gateway: TableGateway, id: string, name: string): SheetTable {
  const result = gateway.read(id, name);
  assertHeaders(name, result.headers);
  return result;
}

function healthFromTables(
  items: readonly { readonly draft_status: string }[],
  deadLetters: SheetTable,
  audit: SheetTable,
  config: SheetTable,
): BriefingHealth {
  const deadHeaders = assertHeaders("Dead_Letter", deadLetters.headers);
  const auditHeaders = assertHeaders("Audit_Log", audit.headers);
  const configHeaders = assertHeaders("Config", config.headers);
  const failedIntakeCount = deadLetters.rows.filter(
    (row) => rowToRecord(deadHeaders, row).status === "open",
  ).length;
  const duplicateSuppressedCount = audit.rows.filter(
    (row) => rowToRecord(auditHeaders, row).result === "duplicate_suppressed",
  ).length;
  const last = config.rows
    .map((row) => rowToRecord(configHeaders, row))
    .flatMap((record) => {
      if (
        !["gmail.reconciliation.v1", "gmail.reconciliation.v2"].includes(
          String(record.key),
        ) ||
        typeof record.value !== "string" ||
        !isTimestamp(record.updated_at)
      )
        return [];
      try {
        const parsed = (
          record.key === "gmail.reconciliation.v2"
            ? BoundedGmailCheckpointSchema
            : GmailCheckpointSchema
        ).safeParse(JSON.parse(record.value));
        return parsed.success
          ? [{ checkpoint: parsed.data, updatedAt: record.updated_at }]
          : [];
      } catch {
        return [];
      }
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  return {
    failedIntakeCount:
      failedIntakeCount +
      (last &&
      "error_code" in last.checkpoint &&
      last.checkpoint.error_code !== null
        ? 1
        : 0),
    duplicateSuppressedCount,
    staleDraftCount: items.filter((item) => item.draft_status === "stale")
      .length,
    lastSuccessfulReconciliationAt:
      last?.checkpoint.completedThrough ?? undefined,
  };
}

function entryRow(
  briefingDate: string,
  section: string,
  sortOrder: number,
  entry: BriefingEntry | null,
  itemMetadata: ReadonlyMap<
    string,
    {
      readonly sourceLink: string | null;
      readonly draftStatus: string;
      readonly waitingOn: string;
      readonly deadlineAt: string | null;
    }
  >,
  commitmentItemIds: ReadonlyMap<string, string>,
): Record<string, CellValue> {
  if (!entry)
    return {
      briefing_date: briefingDate,
      section,
      sort_order: sortOrder,
      item_id: null,
      priority_score: null,
      summary: "No items",
      next_action: null,
      source_link: null,
      draft_status: null,
      waiting_on: null,
      deadline_at: null,
    };
  const itemId =
    entry.itemId ??
    (entry.commitmentId
      ? (commitmentItemIds.get(entry.commitmentId) ?? null)
      : null);
  const metadata = itemId ? itemMetadata.get(itemId) : undefined;
  return {
    briefing_date: briefingDate,
    section,
    sort_order: sortOrder,
    item_id: itemId,
    priority_score: entry.priorityScore,
    summary: entry.summary.slice(0, MAX_PROMISE_LENGTH),
    next_action: entry.nextAction?.slice(0, MAX_PROMISE_LENGTH) ?? null,
    source_link: metadata?.sourceLink ?? null,
    draft_status: metadata?.draftStatus ?? null,
    waiting_on: metadata?.waitingOn ?? null,
    deadline_at: metadata?.deadlineAt ?? null,
  };
}

/**
 * Builds one append-only, date-versioned projection. It never delivers a
 * message or changes a prior projection. A repeated source snapshot is a no-op.
 */
export function runBriefing(
  gateway: TableGateway,
  spreadsheetId: string,
  now: string,
  sha256: (value: string) => string,
): BriefingRunResult {
  const generatedAt = new Date(now);
  if (!isTimestamp(now) || Number.isNaN(generatedAt.valueOf()))
    throw new Error("BRIEFING_NOW_INVALID");
  gateway.acquire();
  try {
    const queue = table(gateway, spreadsheetId, "Queue");
    const commitmentsTable = table(gateway, spreadsheetId, "Commitments");
    const deadLetters = table(gateway, spreadsheetId, "Dead_Letter");
    const audit = table(gateway, spreadsheetId, "Audit_Log");
    const config = table(gateway, spreadsheetId, "Config");
    const view = table(gateway, spreadsheetId, "Briefing_View");
    const history = table(gateway, spreadsheetId, "Briefing_History");
    const queueHeaders = assertHeaders("Queue", queue.headers);
    const commitmentHeaders = assertHeaders(
      "Commitments",
      commitmentsTable.headers,
    );
    const items = queue.rows.map((row) => queueItemFromRow(queueHeaders, row));
    const commitments = commitmentsTable.rows.map((row) =>
      commitmentFromRow(commitmentHeaders, row),
    );
    const health = healthFromTables(items, deadLetters, audit, config);
    const briefingDate = newYorkDate(generatedAt);
    const briefing = buildBriefing(items, commitments, health, now);
    const idempotencyKey = sha256(
      JSON.stringify({
        briefingDate,
        sections: briefing.sections,
        health,
      }),
    );
    if (!/^[a-f0-9]{64}$/u.test(idempotencyKey))
      throw new Error("BRIEFING_HASH_INVALID");
    const historyHeaders = assertHeaders("Briefing_History", history.headers);
    const contentHashIndex = historyHeaders.indexOf("content_hash");
    if (history.rows.some((row) => row[contentHashIndex] === idempotencyKey)) {
      return {
        status: "duplicate",
        briefingId: `brief_${idempotencyKey.slice(0, 24)}`,
        sections: 8,
        deliveryChannel: "none",
      };
    }
    const itemMetadata = new Map(
      items.map((item) => [
        item.item_id,
        {
          sourceLink: item.source_link ?? null,
          draftStatus: item.draft_status,
          waitingOn: item.waiting_on,
          deadlineAt: item.deadline_at ?? null,
        },
      ]),
    );
    const commitmentItemIds = new Map(
      commitments.map((commitment) => [
        commitment.commitmentId,
        commitment.itemId,
      ]),
    );
    const viewHeaders = assertHeaders("Briefing_View", view.headers);
    const viewRows: CellValue[][] = [];
    let sortOrder = 0;
    for (const section of briefing.sections) {
      const entries = section.entries.length ? section.entries : [null];
      for (const entry of entries)
        viewRows.push(
          recordToRow(
            viewHeaders,
            entryRow(
              briefingDate,
              section.key,
              sortOrder++,
              entry,
              itemMetadata,
              commitmentItemIds,
            ),
          ),
        );
    }
    const briefingId = `brief_${idempotencyKey.slice(0, 24)}`;
    const itemCount = new Set(
      briefing.sections.flatMap((section) =>
        section.entries
          .map((entry) => entry.itemId)
          .filter((value): value is string => Boolean(value)),
      ),
    ).size;
    const historyRow = recordToRow(historyHeaders, {
      briefing_id: briefingId,
      generated_at: now,
      delivery_channel: "none",
      delivery_status: "generated",
      item_count: itemCount,
      content_hash: idempotencyKey,
      error_code: null,
    });
    const changes: TableChange[] = [
      {
        sheetName: "Briefing_View",
        before: view,
        after: {
          headers: [...view.headers],
          rows: [...view.rows, ...viewRows],
        },
      },
      {
        sheetName: "Briefing_History",
        before: history,
        after: {
          headers: [...history.headers],
          rows: [...history.rows, historyRow],
        },
      },
    ];
    gateway.commit(spreadsheetId, changes);
    return {
      status: "generated",
      briefingId,
      sections: briefing.sections.length,
      deliveryChannel: "none",
    };
  } finally {
    gateway.release();
  }
}
