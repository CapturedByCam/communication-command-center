import { z } from "zod";
import { AuditRepository } from "../adapters/sheets/audit-repository.js";
import {
  queueItemFromRow,
  QueueRepository,
} from "../adapters/sheets/queue-repository.js";
import {
  assertHeaders,
  type CellValue,
} from "../adapters/sheets/sheet-table.js";
import { RuntimeSheetAdapter, type TableGateway } from "./sheet-adapter.js";

const SnoozeTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2}$/)
  .datetime({ offset: true });

export type ManualQueueOperation = "resolve" | "reopen" | "snooze";

export interface ManualQueueControlRequest {
  readonly operation: ManualQueueOperation;
  readonly spreadsheetId: string;
  readonly selectedRowIndex: number;
  readonly selectedRow: readonly CellValue[];
  readonly snoozeUntil?: string;
  readonly now: () => Date;
  readonly sha256: (value: string) => string;
  /** Trusted runtime gate rechecked after the prompt, while the shared lock is held. */
  readonly authorize: () => boolean;
}

export type ManualQueueControlResult =
  | {
      readonly ok: true;
      readonly status: "resolved" | "open" | "snoozed" | "disabled";
    }
  | { readonly ok: false; readonly error_code: string };

function rejected(error_code: string): ManualQueueControlResult {
  return { ok: false, error_code };
}

function validSnooze(value: string | undefined, now: Date): string | null {
  const parsed = SnoozeTimestampSchema.safeParse(value);
  if (!parsed.success || !Number.isFinite(Date.parse(parsed.data))) return null;
  return Date.parse(parsed.data) > now.getTime() ? parsed.data : null;
}

function transition(
  operation: ManualQueueOperation,
  item: ReturnType<typeof queueItemFromRow>,
  now: Date,
  snoozeUntil: string | undefined,
) {
  const timestamp = now.toISOString();
  if (item.status === "archived") return null;
  if (operation === "resolve") {
    if (item.status !== "open" && item.status !== "snoozed") return null;
    return {
      ...item,
      status: "resolved" as const,
      snooze_until: null,
      resolved_at: timestamp,
      manual_override: true,
      updated_at: timestamp,
    };
  }
  if (operation === "reopen") {
    if (item.status !== "resolved") return null;
    return {
      ...item,
      status: "open" as const,
      snooze_until: null,
      resolved_at: null,
      manual_override: true,
      updated_at: timestamp,
    };
  }
  const explicitSnooze = validSnooze(snoozeUntil, now);
  if (item.status !== "open" || !explicitSnooze) return undefined;
  return {
    ...item,
    status: "snoozed" as const,
    snooze_until: explicitSnooze,
    resolved_at: null,
    manual_override: true,
    updated_at: timestamp,
  };
}

/** Applies a selected-row operation after the UI has already collected confirmation. */
export async function applyManualQueueControl(
  gateway: TableGateway,
  request: ManualQueueControlRequest,
): Promise<ManualQueueControlResult> {
  if (
    !Number.isInteger(request.selectedRowIndex) ||
    request.selectedRowIndex < 0 ||
    !["resolve", "reopen", "snooze"].includes(request.operation)
  )
    return rejected("INVALID_SELECTION");

  const now = request.now();
  if (Number.isNaN(now.getTime())) return rejected("INVALID_CLOCK");
  if (request.operation === "snooze" && !validSnooze(request.snoozeUntil, now))
    return rejected("INVALID_SNOOZE_TIMESTAMP");

  const adapter = new RuntimeSheetAdapter(gateway);
  const queue = new QueueRepository(adapter, request.spreadsheetId);
  const audit = new AuditRepository(adapter, request.spreadsheetId);
  try {
    return await queue.runTransaction(async () => {
      if (!request.authorize()) return { ok: true, status: "disabled" };
      const table = await adapter.readTable(request.spreadsheetId, "Queue");
      const headers = assertHeaders("Queue", table.headers);
      const row = table.rows[request.selectedRowIndex];
      if (!row || JSON.stringify(row) !== JSON.stringify(request.selectedRow))
        return rejected("SELECTION_CHANGED");

      const item = queueItemFromRow(headers, row);
      const updated = transition(
        request.operation,
        item,
        now,
        request.snoozeUntil,
      );
      if (updated === undefined) return rejected("INVALID_SNOOZE_TIMESTAMP");
      if (updated === null) return rejected("STALE_STATE");

      await audit.verifyHeaders();
      await queue.upsert(updated, {
        item,
        rowIndex: request.selectedRowIndex,
        expectedRow: row,
      });
      const eventAt = now.toISOString();
      const auditIdentity = `${request.operation}:${item.item_id}:${eventAt}`;
      await audit.append({
        event_id: `aqc_${request.sha256(auditIdentity).slice(0, 32)}`,
        event_at: eventAt,
        item_id: item.item_id,
        source: item.source,
        action: "upsert_item",
        result: "updated",
        error_code: null,
        payload_hash: request.sha256(
          JSON.stringify({
            operation: request.operation,
            item_id: item.item_id,
          }),
        ),
        duration_ms: 0,
        actor: "manual_queue_control",
        correlation_id: `manual_queue_control:${auditIdentity}`,
      });
      return {
        ok: true,
        status: updated.status,
      };
    });
  } catch {
    // Provider uncertainty is deliberately not retried; neither source values nor errors escape.
    return rejected("WRITE_UNCERTAIN");
  }
}

export function selectedQueueSnapshot(
  headers: readonly string[],
  rows: readonly (readonly CellValue[])[],
  selectedRowIndex: number,
): readonly CellValue[] | null {
  try {
    assertHeaders("Queue", headers);
    const row = rows[selectedRowIndex];
    return row ? [...row] : null;
  } catch {
    return null;
  }
}
