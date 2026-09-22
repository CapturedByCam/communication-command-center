import {
  GmailProjectionDeferred,
  GmailProjectionReadFailure,
  GmailReadError,
  GmailReconciler,
} from "../adapters/gmail/reconciliation.js";
import {
  BoundedGmailCheckpointSchema,
  BoundedReferenceShardSchema,
} from "../domain/bounded-gmail-checkpoint.js";
import { deriveBoundedThreadState } from "../adapters/gmail/bounded-thread-state.js";
import {
  APPROVED_GMAIL_MAILBOX,
  ThreadSnapshotSchema,
  type ThreadSnapshot,
} from "../adapters/gmail/gmail-client.js";
import { CommitmentRepository } from "../adapters/sheets/commitment-repository.js";
import { GmailSyncRepository } from "../adapters/sheets/gmail-sync-repository.js";
import {
  checkedHash,
  normalizeDerivedThreadState,
  normalizeStagingItem,
} from "../services/normalize-staging-item.js";
import {
  GmailMetadataReader,
  type BoundedGmailReference,
  type GmailMetadataGateway,
} from "./gmail-reader.js";
import { RuntimeSheetAdapter, type TableGateway } from "./sheet-adapter.js";

const boundedCheckpointKey = "gmail.reconciliation.v2";
const boundedShardKey = (index: number) => `gmail.references.v1.${index}`;

function boundedProjection(
  adapter: RuntimeSheetAdapter,
  gmail: GmailMetadataGateway,
  spreadsheetId: string,
  sha256: (value: string) => string,
) {
  const sync = new GmailSyncRepository(adapter, spreadsheetId);
  const commitments = new CommitmentRepository(adapter, spreadsheetId);
  const boundedReader = new GmailMetadataReader(gmail);
  return async ({
    snapshot,
    requestedMessageId,
    window,
    now,
    restrictToCallerWindow,
  }: {
    readonly snapshot: ThreadSnapshot;
    readonly requestedMessageId: string;
    readonly window: { readonly from: string; readonly to: string };
    readonly now: string;
    readonly restrictToCallerWindow: boolean;
  }) => {
    const records = (await commitments.list()).filter(
      (record) => record.source_thread_id === snapshot.threadId,
    );
    const expectedItemId = `cc_${checkedHash(
      sha256,
      `gmail:${APPROVED_GMAIL_MAILBOX}:${snapshot.threadId}`,
    )}`;
    if (records.some((record) => record.item_id !== expectedItemId))
      throw new Error("Commitment item identity conflicts with its thread.");
    const saved = await sync.load(boundedCheckpointKey);
    if (saved === null) {
      if (records.length) throw new GmailProjectionDeferred();
      // Legacy Studio/recovery behavior is only retained until a thread has
      // commitment evidence that requires the bounded chronology.
      return normalizeStagingItem(snapshot, [], now, sha256);
    }
    const checkpoint = BoundedGmailCheckpointSchema.parse(saved);
    if (checkpoint.phase !== "processing" && checkpoint.phase !== "complete")
      throw new GmailProjectionDeferred();
    if (
      Date.parse(checkpoint.window.to) > Date.parse(now) ||
      Date.parse(checkpoint.window.to) - Date.parse(checkpoint.window.from) >
        30 * 86_400_000
    )
      throw new Error("Bounded Gmail checkpoint window is invalid.");
    if (
      restrictToCallerWindow &&
      (Date.parse(checkpoint.window.from) < Date.parse(window.from) ||
        Date.parse(checkpoint.window.to) > Date.parse(window.to))
    )
      throw new GmailProjectionDeferred();

    const references = new Map<string, BoundedGmailReference>();
    for (let index = 0; index < checkpoint.shardCount; index++) {
      const shard = BoundedReferenceShardSchema.parse(
        await sync.load(boundedShardKey(index)),
      );
      if (
        shard.window_from !== checkpoint.window.from ||
        shard.window_to !== checkpoint.window.to
      )
        throw new Error("Bounded Gmail reference shard window conflicts.");
      for (const reference of shard.references) {
        const existing = references.get(reference.id);
        if (existing && existing.threadId !== reference.threadId)
          throw new Error("Bounded Gmail reference ID conflicts.");
        references.set(reference.id, reference);
      }
    }
    const requested = references.get(requestedMessageId);
    if (!requested || requested.threadId !== snapshot.threadId)
      throw new GmailProjectionDeferred();
    const snapshotReference = snapshot.messages.find(
      (message) => message.id === requestedMessageId,
    );
    if (
      !snapshotReference ||
      snapshotReference.internalDate < Date.parse(window.from) ||
      snapshotReference.internalDate >= Date.parse(window.to) ||
      snapshotReference.internalDate < Date.parse(checkpoint.window.from) ||
      snapshotReference.internalDate >= Date.parse(checkpoint.window.to)
    )
      throw new GmailProjectionDeferred();
    const threadReferences = [...references.values()].filter(
      (reference) => reference.threadId === snapshot.threadId,
    );
    if (!threadReferences.length || threadReferences.length > 50)
      throw new Error("Bounded Gmail thread reference count is invalid.");
    let boundedSnapshot: ThreadSnapshot;
    try {
      boundedSnapshot = ThreadSnapshotSchema.parse(
        await boundedReader.getBoundedThreadSnapshot(
          threadReferences,
          checkpoint.window,
        ),
      );
    } catch (error) {
      if (error instanceof GmailReadError && error.code === "READ_FAILED")
        throw new GmailProjectionReadFailure();
      throw error;
    }
    const state = deriveBoundedThreadState(
      boundedSnapshot,
      records,
      checkpoint.window,
      now,
    );
    return normalizeDerivedThreadState(boundedSnapshot, state, now, sha256);
  };
}

export function runtimeReconciler(
  gateway: TableGateway,
  gmail: GmailMetadataGateway,
  spreadsheetId: string,
  sha256: (value: string) => string,
) {
  const adapter = new RuntimeSheetAdapter(gateway);
  return new GmailReconciler({
    adapter,
    // Advanced Gmail's thread endpoint cannot bound older history. The native
    // pilot therefore derives a generic, review-only state from the requested
    // message that was already selected inside the 30-day list window.
    reader: new GmailMetadataReader(gmail, { mode: "requested_message_only" }),
    spreadsheetId,
    sha256,
    project: boundedProjection(adapter, gmail, spreadsheetId, sha256),
  });
}

/** Five metadata records maximum per invocation; the durable cursor owns continuation. */
export function runGmailReconciliation(
  gateway: TableGateway,
  gmail: GmailMetadataGateway,
  spreadsheetId: string,
  now: string,
  sha256: (value: string) => string,
) {
  return runtimeReconciler(
    gateway,
    gmail,
    spreadsheetId,
    sha256,
  ).reconcileRecentGmail(now, 5);
}
