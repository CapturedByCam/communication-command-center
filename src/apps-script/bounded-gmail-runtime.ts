import { z } from "zod";
import {
  BoundedGmailCheckpointSchema,
  BoundedReferenceShardSchema,
  type BoundedGmailCheckpoint,
} from "../domain/bounded-gmail-checkpoint.js";
import { GmailSyncRepository } from "../adapters/sheets/gmail-sync-repository.js";
import { CommitmentRepository } from "../adapters/sheets/commitment-repository.js";
import { QueueRepository } from "../adapters/sheets/queue-repository.js";
import { AuditRepository } from "../adapters/sheets/audit-repository.js";
import { GmailReadError } from "../adapters/gmail/reconciliation.js";
import {
  APPROVED_GMAIL_MAILBOX,
  ThreadSnapshotSchema,
} from "../adapters/gmail/gmail-client.js";
import { deriveBoundedThreadState } from "../adapters/gmail/bounded-thread-state.js";
import {
  checkedHash,
  normalizeDerivedThreadState,
} from "../services/normalize-staging-item.js";
import { upsertCommunicationItemWithinTransaction } from "../services/upsert-item.js";
import {
  GmailMetadataReader,
  type GmailMetadataGateway,
  type BoundedGmailReference,
} from "./gmail-reader.js";
import { RuntimeSheetAdapter, type TableGateway } from "./sheet-adapter.js";

export const BOUNDED_GMAIL_CHECKPOINT_KEY = "gmail.reconciliation.v2";
const shardKey = (i: number) => `gmail.references.v1.${i}`;
class Disabled extends Error {}
class InvalidEvidence extends Error {}
class LimitExceeded extends Error {}
export interface BoundedGmailResult {
  status: "more" | "complete" | "blocked" | "retry" | "disabled";
  processed: number;
  excluded: number;
  failed: number;
}

/** One reference page or one complete bounded thread per atomic invocation. */
export async function runBoundedGmailReconciliation(
  gateway: TableGateway,
  gmail: GmailMetadataGateway,
  spreadsheetId: string,
  at: string,
  sha256: (value: string) => string,
  authorize: () => boolean,
): Promise<BoundedGmailResult> {
  const now = new Date(
    z.string().datetime({ offset: true }).parse(at),
  ).toISOString();
  const secondNow = new Date(
    Math.floor(Date.parse(now) / 1000) * 1000,
  ).toISOString();
  const empty: BoundedGmailResult = {
    status: "complete",
    processed: 0,
    excluded: 0,
    failed: 0,
  };
  const check = () => {
    if (!authorize()) throw new Disabled();
  };
  const hash = (s: string) => checkedHash(sha256, s);
  const adapter = new RuntimeSheetAdapter(gateway);
  const sync = new GmailSyncRepository(adapter, spreadsheetId);
  const reader = new GmailMetadataReader(gmail);
  try {
    check();
    return await adapter.runTransaction(spreadsheetId, async () => {
      check();
      await sync.verifyHeaders();
      const saved = await sync.load(BOUNDED_GMAIL_CHECKPOINT_KEY);
      let checkpoint: BoundedGmailCheckpoint | null =
        saved === null ? null : BoundedGmailCheckpointSchema.parse(saved);
      if (
        checkpoint &&
        Date.parse(checkpoint.window.to) > Date.parse(secondNow)
      )
        throw Error("RECONCILIATION_CLOCK_BACKWARD");
      if (checkpoint?.phase === "blocked") {
        check();
        return { ...empty, status: "blocked" };
      }
      if (
        checkpoint?.retry &&
        Date.parse(checkpoint.retry.nextAttemptAt) > Date.parse(now)
      ) {
        check();
        return { ...empty, status: "retry" };
      }
      if (
        checkpoint?.phase === "complete" &&
        checkpoint.window.to === secondNow
      ) {
        check();
        return empty;
      }
      if (!checkpoint || checkpoint.phase === "complete")
        checkpoint = {
          schema_version: "2.0",
          mailbox: APPROVED_GMAIL_MAILBOX,
          window: {
            from: new Date(
              Date.parse(secondNow) - 30 * 86_400_000,
            ).toISOString(),
            to: secondNow,
          },
          phase: "enumerating",
          pageToken: null,
          seenPageTokenHashes: [],
          shardCount: 0,
          nextThread: 0,
          completedThrough: checkpoint?.completedThrough ?? null,
          retry: null,
          error_code: null,
        };
      const cp = checkpoint;
      const save = async () => {
        check();
        await sync.save(
          BOUNDED_GMAIL_CHECKPOINT_KEY,
          BoundedGmailCheckpointSchema.parse(cp),
          now,
        );
        check();
      };
      const loadReferences = async () => {
        const byId = new Map<string, BoundedGmailReference>();
        for (let i = 0; i < cp.shardCount; i++) {
          const shard = BoundedReferenceShardSchema.parse(
            await sync.load(shardKey(i)),
          );
          if (
            shard.window_from !== cp.window.from ||
            shard.window_to !== cp.window.to
          )
            throw new InvalidEvidence();
          for (const ref of shard.references) {
            const prior = byId.get(ref.id);
            if (prior && prior.threadId !== ref.threadId)
              throw new InvalidEvidence();
            byId.set(ref.id, ref);
          }
        }
        return byId;
      };
      const group = (references: Map<string, BoundedGmailReference>) => {
        if (references.size > 2000) throw new LimitExceeded();
        const threads = new Map<string, BoundedGmailReference[]>();
        for (const ref of references.values()) {
          const refs = threads.get(ref.threadId) ?? [];
          refs.push(ref);
          if (refs.length > 50) throw new LimitExceeded();
          threads.set(ref.threadId, refs);
        }
        return [...threads.entries()].sort(([a], [b]) => a.localeCompare(b));
      };
      let result: BoundedGmailResult = { ...empty, status: "more" };
      // Only source preparation errors are retried. Persistence errors must escape so
      // the adapter discards staged writes and never guesses whether a commit applied.
      let prepared: ReturnType<typeof normalizeDerivedThreadState> | undefined;
      let pendingShard:
        | { key: string; value: z.infer<typeof BoundedReferenceShardSchema> }
        | undefined;
      try {
        check();
        const references = await loadReferences();
        if (cp.phase === "enumerating") {
          if (cp.shardCount >= 100) throw new LimitExceeded();
          check();
          const page = await reader.listBoundedReferences({
            mailbox: APPROVED_GMAIL_MAILBOX,
            ...cp.window,
            pageToken: cp.pageToken,
            limit: 20,
            excludeAutomated: true,
            excludeBulk: true,
          });
          check();
          for (const ref of page.references) {
            const prior = references.get(ref.id);
            if (prior && prior.threadId !== ref.threadId)
              throw new InvalidEvidence();
            references.set(ref.id, ref);
          }
          group(references);
          if (page.nextPageToken !== null) {
            const digest = hash(page.nextPageToken);
            if (cp.seenPageTokenHashes.includes(digest))
              throw new InvalidEvidence();
            cp.seenPageTokenHashes.push(digest);
          }
          const shard = BoundedReferenceShardSchema.parse({
            schema_version: "1.0",
            window_from: cp.window.from,
            window_to: cp.window.to,
            references: page.references,
          });
          // Stage only after every source check passes. A transaction failure is not a read failure.
          pendingShard = { key: shardKey(cp.shardCount), value: shard };
          cp.shardCount++;
          cp.pageToken = page.nextPageToken;
          cp.retry = null;
          cp.error_code = null;
          if (page.nextPageToken === null)
            cp.phase = references.size ? "processing" : "complete";
          if (cp.phase === "complete") {
            cp.completedThrough = cp.window.to;
            result.status = "complete";
          }
        } else {
          const threads = group(references);
          const target = threads[cp.nextThread];
          if (!target) throw new InvalidEvidence();
          check();
          const snapshot = ThreadSnapshotSchema.parse(
            await reader.getBoundedThreadSnapshot(target[1], cp.window),
          );
          check();
          const commitments = (
            await new CommitmentRepository(adapter, spreadsheetId).list()
          ).filter((record) => record.source_thread_id === target[0]);
          const expectedId = `cc_${hash(`gmail:${APPROVED_GMAIL_MAILBOX}:${target[0]}`)}`;
          if (commitments.some((record) => record.item_id !== expectedId))
            throw new InvalidEvidence();
          const state = deriveBoundedThreadState(
            snapshot,
            commitments,
            cp.window,
            now,
          );
          prepared = normalizeDerivedThreadState(snapshot, state, now, sha256);
          cp.retry = null;
          cp.error_code = null;
        }
      } catch (error) {
        if (error instanceof Disabled) throw error;
        cp.error_code =
          error instanceof LimitExceeded
            ? "LIMIT_EXCEEDED"
            : error instanceof GmailReadError && error.code === "CURSOR_EXPIRED"
              ? "CURSOR_EXPIRED"
              : error instanceof InvalidEvidence ||
                  error instanceof z.ZodError ||
                  (error instanceof GmailReadError &&
                    error.code !== "READ_FAILED")
                ? "EVIDENCE_INVALID"
                : "READ_FAILED";
        const attempts = (cp.retry?.attempts ?? 0) + 1;
        if (cp.error_code === "READ_FAILED" && attempts < 3) {
          cp.retry = {
            attempts: attempts as 1 | 2,
            nextAttemptAt: new Date(
              Date.parse(now) + 60_000 * 2 ** (attempts - 1),
            ).toISOString(),
          };
          result = { ...empty, status: "retry", failed: 1 };
        } else {
          cp.phase = "blocked";
          cp.pageToken = null;
          cp.retry = null;
          result = { ...empty, status: "blocked", failed: 1 };
        }
        await save();
        return result;
      }
      if (pendingShard) {
        check();
        await sync.save(pendingShard.key, pendingShard.value, now);
      }
      if (prepared !== undefined) {
        check();
        if (prepared) {
          const correlationId = `gmail_${hash(`${prepared.item_id}:${prepared.content_hash}`)}`;
          await upsertCommunicationItemWithinTransaction(
            {
              queue: new QueueRepository(adapter, spreadsheetId),
              audit: new AuditRepository(adapter, spreadsheetId),
            },
            prepared,
            {
              auditEventId: `gmail_${hash(`${correlationId}:${now}`)}`,
              eventAt: now,
              actor: "bounded_gmail_reconciliation",
              correlationId,
              durationMs: 0,
              payloadHash: prepared.content_hash,
              deduplication: "current_state",
            },
          );
          result.processed = 1;
        } else result.excluded = 1;
        cp.nextThread++;
        if (cp.nextThread === group(await loadReferences()).length) {
          cp.phase = "complete";
          cp.completedThrough = cp.window.to;
          result.status = "complete";
        }
      }
      await save();
      return result;
    });
  } catch (error) {
    if (error instanceof Disabled) return { ...empty, status: "disabled" };
    throw error;
  }
}
