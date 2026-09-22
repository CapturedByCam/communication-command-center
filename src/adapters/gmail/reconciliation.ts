import { z } from "zod";
import { StudioStagingSchema } from "../../domain/schemas.js";
import type { CommunicationItem } from "../../domain/types.js";
import {
  normalizeStagingItem,
  checkedHash,
  type Sha256,
} from "../../services/normalize-staging-item.js";
import {
  upsertCommunicationItemWithinTransaction,
  type UpsertResult,
} from "../../services/upsert-item.js";
import {
  queueItemFromRow,
  QueueRepository,
} from "../sheets/queue-repository.js";
import { AuditRepository } from "../sheets/audit-repository.js";
import {
  GmailSyncRepository,
  type GmailDeadLetter,
} from "../sheets/gmail-sync-repository.js";
import {
  assertHeaders,
  recordToRow,
  rowToRecord,
  type CellValue,
  type SheetTableAdapter,
} from "../sheets/sheet-table.js";
import {
  APPROVED_GMAIL_MAILBOX,
  GmailClient,
  type GmailSnapshotReader,
  type ThreadSnapshot,
} from "./gmail-client.js";
import type { ThreadCommitment } from "./thread-state.js";

const mailbox = APPROVED_GMAIL_MAILBOX;
const day = 86_400_000;
const checkpointKey = "gmail.reconciliation.v1";
const dateTime = z.string().datetime({ offset: true });
const id = z.string().min(1).max(512);
const token = z.string().min(1).max(2048).nullable();
const RetrySchema = z
  .object({ attempts: z.number().int().min(1).max(2), nextAttemptAt: dateTime })
  .strict();
export const GmailStudioRetrySchema = z
  .object({
    schema_version: z.literal("1.0"),
    retry: RetrySchema.nullable(),
  })
  .strict();
const PageSchema = z
  .object({ messageIds: z.array(id).max(100), nextPageToken: token })
  .strict();

export const GmailCheckpointSchema = z
  .object({
    schema_version: z.literal("1.0"),
    mailbox: z.literal(mailbox),
    completedThrough: dateTime.nullable(),
    window: z
      .object({
        from: dateTime,
        to: dateTime,
        pageToken: token,
        cursorResets: z.number().int().min(0).max(1),
      })
      .strict()
      .nullable(),
    pending: PageSchema.nullable(),
    retry: RetrySchema.nullable(),
    blocked: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (!value.window && (value.pending || value.retry || value.blocked)) ||
      (value.window &&
        (Date.parse(value.window.from) > Date.parse(value.window.to) ||
          Date.parse(value.window.to) - Date.parse(value.window.from) >
            30 * day))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid bounded Gmail checkpoint",
      });
    }
  });

type Checkpoint = z.infer<typeof GmailCheckpointSchema>;
type Retry = z.infer<typeof RetrySchema>;
type ErrorCode = GmailDeadLetter["error_code"];

export class GmailReadError extends Error {
  constructor(
    readonly code: "CURSOR_EXPIRED" | "NOT_FOUND" | "READ_FAILED",
    message: string = code,
  ) {
    super(message);
  }
}

/** The source is valid but has not yet been covered by a completed v2 scan. */
export class GmailProjectionDeferred extends Error {}

/** A bounded projection's provider read failed after its source was validated. */
export class GmailProjectionReadFailure extends Error {}

export interface GmailReconciliationReader extends GmailSnapshotReader {
  /** Adapter must apply the fixed mailbox, half-open time window, filters, and page limit. */
  listRecentMessages(request: {
    mailbox: typeof mailbox;
    from: string;
    to: string;
    pageToken: string | null;
    limit: number;
    excludeAutomated: true;
    excludeBulk: true;
  }): Promise<unknown>;
}

interface Dependencies {
  adapter: SheetTableAdapter;
  spreadsheetId: string;
  reader: GmailReconciliationReader;
  sha256: Sha256;
  getCommitments?: (snapshot: ThreadSnapshot) => Promise<ThreadCommitment[]>;
  /**
   * Optional authoritative projection for callers that have a complete,
   * bounded chronology. The generic reconciler deliberately has no opinion
   * about how that chronology is assembled.
   */
  project?: (input: {
    readonly snapshot: ThreadSnapshot;
    readonly requestedMessageId: string;
    readonly window: { readonly from: string; readonly to: string };
    readonly now: string;
    readonly restrictToCallerWindow: boolean;
  }) => Promise<CommunicationItem | null>;
}

export interface ReconciliationResult {
  status: "complete" | "more" | "retry" | "blocked";
  processed: number;
  excluded: number;
  failed: number;
}

export interface SelectedGmailReplay {
  readonly selectedRowIndex: number;
  readonly selectedRow: readonly CellValue[];
  /** Checked under the shared transaction lock before replay reads or writes. */
  readonly authorize: () => boolean;
}

export type GmailReplayResult =
  | { readonly ok: true; readonly status: "disabled" | "replayed" }
  | {
      readonly ok: false;
      readonly error_code: "SELECTION_CHANGED" | "NOT_ELIGIBLE";
    };

function validateRun(now: string, batchSize: number): string {
  z.number().int().min(1).max(100).parse(batchSize);
  return new Date(dateTime.parse(now)).toISOString();
}

function failureCode(error: unknown): ErrorCode {
  if (error instanceof z.ZodError) return "SNAPSHOT_INVALID";
  if (error instanceof GmailReadError) return error.code;
  return "READ_FAILED";
}

/** Local orchestration only. No Google service globals, triggers, drafts, or sends. */
export class GmailReconciler {
  private readonly sync: GmailSyncRepository;
  private readonly queue: QueueRepository;
  private readonly audit: AuditRepository;
  private readonly client: GmailClient;

  constructor(private readonly dependencies: Dependencies) {
    const { adapter, spreadsheetId, reader } = dependencies;
    this.sync = new GmailSyncRepository(adapter, spreadsheetId);
    this.queue = new QueueRepository(adapter, spreadsheetId);
    this.audit = new AuditRepository(adapter, spreadsheetId);
    this.client = new GmailClient(reader);
  }

  private hash(value: string): string {
    return checkedHash(this.dependencies.sha256, value);
  }

  private async recordFailure(
    sourceRecordId: string,
    code: ErrorCode,
    now: string,
  ): Promise<void> {
    const hash = this.hash(`gmail-failure:${sourceRecordId}`);
    await this.sync.deadLetter({
      dead_letter_id: `dl_${hash}`,
      received_at: now,
      source: "gmail",
      source_record_id: sourceRecordId,
      error_code: code,
      payload_hash: hash,
      status: "open",
      resolved_at: null,
      resolution_actor: null,
    });
  }

  private async retryOrDeadLetter(
    sourceRecordId: string,
    code: ErrorCode,
    prior: Retry | null,
    now: string,
  ): Promise<Retry | null> {
    const attempts = (prior?.attempts ?? 0) + 1;
    if (code !== "READ_FAILED" || attempts >= 3) {
      await this.recordFailure(sourceRecordId, code, now);
      return null;
    }
    return {
      attempts,
      nextAttemptAt: new Date(
        Date.parse(now) + 60_000 * 2 ** (attempts - 1),
      ).toISOString(),
    };
  }

  private async prepare(
    messageId: string,
    now: string,
    from: string,
    to: string,
    inclusiveEnd = false,
    restrictProjectionToCallerWindow = false,
  ) {
    let snapshot: ThreadSnapshot;
    let commitments: ThreadCommitment[] = [];
    try {
      snapshot = await this.client.getThreadSnapshot(messageId);
      if (!this.dependencies.project)
        commitments =
          (await this.dependencies.getCommitments?.(snapshot)) ?? [];
    } catch (error) {
      return { error: failureCode(error) } as const;
    }
    try {
      const reference = snapshot.messages.find(
        (message) => message.id === messageId,
      )!;
      if (
        reference.internalDate < Date.parse(from) ||
        reference.internalDate > Date.parse(to) ||
        (!inclusiveEnd && reference.internalDate === Date.parse(to))
      )
        return { error: "SNAPSHOT_INVALID" } as const;
      return {
        item: this.dependencies.project
          ? await this.dependencies.project({
              snapshot,
              requestedMessageId: messageId,
              window: { from, to },
              now,
              restrictToCallerWindow: restrictProjectionToCallerWindow,
            })
          : normalizeStagingItem(
              snapshot,
              commitments,
              now,
              this.dependencies.sha256,
            ),
      } as const;
    } catch (error) {
      if (error instanceof GmailProjectionDeferred)
        return { deferred: true } as const;
      if (error instanceof GmailProjectionReadFailure)
        return { error: "READ_FAILED" } as const;
      return { error: "SNAPSHOT_INVALID" } as const;
    }
  }

  private async persist(
    item: CommunicationItem,
    now: string,
    actor = "gmail_reconciliation",
    correlationSuffix = "",
  ): Promise<UpsertResult> {
    const correlationId = `gmail_${this.hash(`${item.item_id}:${item.content_hash}`)}`;
    const auditSeed = correlationSuffix
      ? `${correlationId}:${now}:${correlationSuffix}`
      : `${correlationId}:${now}`;
    return upsertCommunicationItemWithinTransaction(
      { queue: this.queue, audit: this.audit },
      item,
      {
        auditEventId: `gmail_${this.hash(auditSeed)}`,
        eventAt: now,
        actor,
        correlationId,
        durationMs: 0,
        payloadHash: item.content_hash,
        deduplication: "current_state",
      },
    );
  }

  private currentWindow(now: string): { from: string; to: string } {
    return {
      from: new Date(Date.parse(now) - 30 * day).toISOString(),
      to: now,
    };
  }

  /**
   * Retries exactly the selected historical SNAPSHOT_INVALID record. It neither
   * reads nor updates Config, and it never widens the original eligibility window.
   */
  async replaySelectedSnapshotInvalid(
    request: SelectedGmailReplay,
    at: string,
  ): Promise<GmailReplayResult> {
    const now = validateRun(at, 1);
    const { adapter, spreadsheetId } = this.dependencies;
    return adapter.runTransaction(spreadsheetId, async () => {
      if (!request.authorize()) return { ok: true, status: "disabled" };
      await this.sync.verifyRecoveryHeaders();
      const entry = await this.sync.selectedOpenSnapshotInvalid(
        request.selectedRowIndex,
        request.selectedRow,
      );
      if (!entry) return { ok: false, error_code: "SELECTION_CHANGED" };

      const current = this.currentWindow(now);
      const from = new Date(
        Math.max(
          Date.parse(current.from),
          Date.parse(entry.event.received_at) - 30 * day,
        ),
      ).toISOString();
      const to = new Date(
        Math.min(Date.parse(current.to), Date.parse(entry.event.received_at)),
      ).toISOString();
      if (Date.parse(from) >= Date.parse(to))
        return { ok: false, error_code: "NOT_ELIGIBLE" };
      const prepared = await this.prepare(
        entry.event.source_record_id,
        now,
        from,
        to,
        false,
        true,
      );
      if (prepared.error || !prepared.item)
        return { ok: false, error_code: "NOT_ELIGIBLE" };
      await this.persist(
        prepared.item,
        now,
        "manual_gmail_replay",
        entry.event.dead_letter_id,
      );
      await this.sync.resolve(entry, now, "manual_gmail_replay");
      return { ok: true, status: "replayed" };
    });
  }

  /** Replays only a current selected Gmail Queue item; no cursor/list operation is involved. */
  async replaySelectedQueueItem(
    request: SelectedGmailReplay,
    at: string,
  ): Promise<GmailReplayResult> {
    const now = validateRun(at, 1);
    const { adapter, spreadsheetId } = this.dependencies;
    return adapter.runTransaction(spreadsheetId, async () => {
      if (!request.authorize()) return { ok: true, status: "disabled" };
      await Promise.all([
        this.queue.verifyHeaders(),
        this.audit.verifyHeaders(),
      ]);
      const table = await adapter.readTable(spreadsheetId, "Queue");
      const headers = assertHeaders("Queue", table.headers);
      const selected = table.rows[request.selectedRowIndex];
      if (
        !Number.isInteger(request.selectedRowIndex) ||
        request.selectedRowIndex < 0 ||
        !selected ||
        JSON.stringify(selected) !== JSON.stringify(request.selectedRow)
      )
        return { ok: false, error_code: "SELECTION_CHANGED" };
      const item = queueItemFromRow(headers, selected);
      const window = this.currentWindow(now);
      if (
        item.source !== "gmail" ||
        Date.parse(item.captured_at) < Date.parse(window.from) ||
        Date.parse(item.captured_at) >= Date.parse(window.to)
      )
        return { ok: false, error_code: "NOT_ELIGIBLE" };
      const prepared = await this.prepare(
        item.source_record_id,
        now,
        window.from,
        window.to,
      );
      if (prepared.error || !prepared.item)
        return { ok: false, error_code: "NOT_ELIGIBLE" };
      if (
        prepared.item.item_id !== item.item_id ||
        prepared.item.source_thread_id !== item.source_thread_id
      )
        return { ok: false, error_code: "NOT_ELIGIBLE" };
      await this.persist(
        prepared.item,
        now,
        "manual_gmail_replay",
        `queue:${item.item_id}`,
      );
      return { ok: true, status: "replayed" };
    });
  }

  async reconcileRecentGmail(
    at: string,
    batchSize = 20,
  ): Promise<ReconciliationResult> {
    const now = validateRun(at, batchSize);
    const { adapter, spreadsheetId, reader } = this.dependencies;
    return adapter.runTransaction(spreadsheetId, async () => {
      await this.sync.verifyHeaders();
      const saved = await this.sync.load(checkpointKey);
      const checkpoint: Checkpoint =
        saved === null
          ? {
              schema_version: "1.0",
              mailbox,
              completedThrough: null,
              window: null,
              pending: null,
              retry: null,
              blocked: false,
            }
          : GmailCheckpointSchema.parse(saved);
      const result: ReconciliationResult = {
        status: "complete",
        processed: 0,
        excluded: 0,
        failed: 0,
      };
      if (checkpoint.blocked) return { ...result, status: "blocked" };
      if (
        Date.parse(
          checkpoint.window?.to ?? checkpoint.completedThrough ?? now,
        ) > Date.parse(now)
      )
        throw new Error("Reconciliation clock cannot move backward");
      if (
        checkpoint.retry &&
        Date.parse(checkpoint.retry.nextAttemptAt) > Date.parse(now)
      )
        return { ...result, status: "retry" };
      if (!checkpoint.window) {
        const floor = Date.parse(now) - 30 * day;
        checkpoint.window = {
          from: new Date(
            Math.max(
              floor,
              checkpoint.completedThrough
                ? Date.parse(checkpoint.completedThrough) - day
                : floor,
            ),
          ).toISOString(),
          to: now,
          pageToken: null,
          cursorResets: 0,
        };
      }
      const window = checkpoint.window;
      if (!checkpoint.pending) {
        let page: z.infer<typeof PageSchema> | null = null;
        let errorCode: ErrorCode | null = null;
        try {
          const parsed = PageSchema.safeParse(
            await reader.listRecentMessages({
              mailbox,
              from: window.from,
              to: window.to,
              pageToken: window.pageToken,
              limit: batchSize,
              excludeAutomated: true,
              excludeBulk: true,
            }),
          );
          if (
            !parsed.success ||
            parsed.data.messageIds.length > batchSize ||
            (parsed.data.nextPageToken !== null &&
              parsed.data.nextPageToken === window.pageToken)
          )
            errorCode = "PAGE_INVALID";
          else page = parsed.data;
        } catch (error) {
          errorCode = failureCode(error);
        }
        if (errorCode) {
          if (
            errorCode === "CURSOR_EXPIRED" &&
            window.pageToken &&
            window.cursorResets === 0
          ) {
            window.pageToken = null;
            window.cursorResets = 1;
            checkpoint.retry = null;
            result.status = "more";
          } else {
            checkpoint.retry = await this.retryOrDeadLetter(
              `page_${this.hash(JSON.stringify(window))}`,
              errorCode,
              checkpoint.retry,
              now,
            );
            checkpoint.blocked = checkpoint.retry === null;
            result.status = checkpoint.blocked ? "blocked" : "retry";
            result.failed++;
          }
          await this.sync.save(
            checkpointKey,
            GmailCheckpointSchema.parse(checkpoint),
            now,
          );
          return result;
        }
        checkpoint.pending = {
          ...page!,
          messageIds: [...new Set(page!.messageIds)],
        };
        checkpoint.retry = null;
      }
      const pending = checkpoint.pending;
      let attempted = 0;
      while (pending.messageIds.length > 0 && attempted < batchSize) {
        const messageId = pending.messageIds[0];
        attempted++;
        if (await this.sync.hasOpenDeadLetter(messageId)) {
          pending.messageIds.shift();
          checkpoint.retry = null;
          result.failed++;
          continue;
        }
        const prepared = await this.prepare(
          messageId,
          now,
          window.from,
          window.to,
        );
        if ("deferred" in prepared) {
          // Keep this exact pending ID for a later completed bounded scan.
          // It is neither an invalid snapshot nor a provider retry.
          result.status = "more";
          break;
        }
        if (prepared.error) {
          checkpoint.retry = await this.retryOrDeadLetter(
            messageId,
            prepared.error,
            checkpoint.retry,
            now,
          );
          result.failed++;
          if (checkpoint.retry) {
            result.status = "retry";
            break;
          }
        } else if (prepared.item) {
          await this.persist(prepared.item, now);
          result.processed++;
        } else result.excluded++;
        pending.messageIds.shift();
        checkpoint.retry = null;
      }
      if (!pending.messageIds.length) {
        window.pageToken = pending.nextPageToken;
        checkpoint.pending = null;
        if (window.pageToken === null) {
          checkpoint.completedThrough = window.to;
          checkpoint.window = null;
        }
      }
      if (result.status !== "retry")
        result.status = checkpoint.window ? "more" : "complete";
      await this.sync.save(
        checkpointKey,
        GmailCheckpointSchema.parse(checkpoint),
        now,
      );
      return result;
    });
  }

  async processStudioInbox(
    at: string,
    batchSize = 20,
  ): Promise<ReconciliationResult> {
    const now = validateRun(at, batchSize);
    const { adapter, spreadsheetId } = this.dependencies;
    return adapter.runTransaction(spreadsheetId, async () => {
      await this.sync.verifyHeaders();
      const table = await adapter.readTable(spreadsheetId, "Studio_Inbox");
      const headers = assertHeaders("Studio_Inbox", table.headers);
      const result: ReconciliationResult = {
        status: "complete",
        processed: 0,
        excluded: 0,
        failed: 0,
      };
      let attempted = 0;
      for (const [index, row] of table.rows.entries()) {
        const record = rowToRecord(headers, row);
        if (record.processing_status === "processed") continue;
        const recordId = `studio_${this.hash(String(record.ingest_id))}`;
        if (await this.sync.hasOpenDeadLetter(recordId)) continue;
        const retryKey = `gmail.studio.retry.v1.${this.hash(recordId)}`;
        const retryValue = await this.sync.load(retryKey);
        const retry =
          retryValue === null
            ? null
            : GmailStudioRetrySchema.parse(retryValue).retry;
        if (retry && Date.parse(retry.nextAttemptAt) > Date.parse(now)) {
          result.status = "retry";
          continue;
        }
        if (attempted >= batchSize) {
          result.status = "more";
          break;
        }
        attempted++;
        const parsed = StudioStagingSchema.safeParse(record);
        const prepared = parsed.success
          ? await this.prepare(
              parsed.data.gmail_message_id,
              now,
              new Date(Date.parse(now) - 30 * day).toISOString(),
              now,
              true,
            )
          : { error: "SNAPSHOT_INVALID" as const };
        let errorCode: ErrorCode | null = null;
        if ("deferred" in prepared) {
          result.status = "more";
          continue;
        }
        if (prepared.error) {
          errorCode = prepared.error;
          const nextRetry = await this.retryOrDeadLetter(
            recordId,
            errorCode,
            retry,
            now,
          );
          await this.sync.save(
            retryKey,
            GmailStudioRetrySchema.parse({
              schema_version: "1.0",
              retry: nextRetry,
            }),
            now,
          );
          if (nextRetry) result.status = "retry";
          result.failed++;
        } else {
          if (prepared.item) {
            await this.persist(prepared.item, now);
            result.processed++;
          } else result.excluded++;
          if (retry)
            await this.sync.save(
              retryKey,
              { schema_version: "1.0", retry: null },
              now,
            );
        }
        await adapter.updateRow(
          spreadsheetId,
          "Studio_Inbox",
          index,
          recordToRow(headers, {
            ...record,
            processing_status: errorCode ? "failed" : "processed",
            processed_at: errorCode ? null : now,
            error_code: errorCode,
          }),
          row,
        );
      }
      return result;
    });
  }
}
