import type { AuditEvent } from "../adapters/sheets/audit-repository.js";
import { AuditRepository } from "../adapters/sheets/audit-repository.js";
import { QueueRepository } from "../adapters/sheets/queue-repository.js";
import type { CommunicationItem } from "../domain/types.js";

export interface UpsertDependencies {
  readonly queue: QueueRepository;
  readonly audit: AuditRepository;
}

export interface UpsertContext {
  readonly auditEventId: string;
  readonly eventAt: string;
  readonly actor: string;
  readonly correlationId: string;
  readonly durationMs: number;
  readonly payloadHash: string;
}

export interface UpsertResult {
  readonly outcome: AuditEvent["result"];
  readonly item: CommunicationItem;
}

function preserveManualFields(
  existing: CommunicationItem,
  incoming: CommunicationItem,
): CommunicationItem {
  if (!existing.manual_override) {
    return incoming;
  }

  return {
    ...incoming,
    category: existing.category,
    status: existing.status,
    waiting_on: existing.waiting_on,
    manual_override: true,
    snooze_until: existing.snooze_until,
    resolved_at: existing.resolved_at,
  };
}

function buildAuditEvent(
  item: CommunicationItem,
  result: AuditEvent["result"],
  context: UpsertContext,
): AuditEvent {
  return {
    event_id: context.auditEventId,
    event_at: context.eventAt,
    item_id: item.item_id,
    source: item.source,
    action: "upsert_item",
    result,
    error_code: null,
    payload_hash: context.payloadHash,
    duration_ms: context.durationMs,
    actor: context.actor,
    correlation_id: context.correlationId,
  };
}

export async function upsertCommunicationItem(
  dependencies: UpsertDependencies,
  incoming: CommunicationItem,
  context: UpsertContext,
): Promise<UpsertResult> {
  await Promise.all([
    dependencies.queue.verifyHeaders(),
    dependencies.audit.verifyHeaders(),
  ]);

  const existing = await dependencies.queue.getBySourceThread(
    incoming.source,
    incoming.source_thread_id,
  );

  if (existing?.content_hash === incoming.content_hash) {
    const outcome = "duplicate_suppressed" as const;
    await dependencies.audit.append(
      buildAuditEvent(existing, outcome, context),
    );
    return { outcome, item: existing };
  }

  const next = existing ? preserveManualFields(existing, incoming) : incoming;
  const outcome = await dependencies.queue.upsert(next);
  await dependencies.audit.append(buildAuditEvent(next, outcome, context));
  return { outcome, item: next };
}
