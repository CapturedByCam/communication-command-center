# Local Gmail chronology and reconciliation

This is the local implementation for issue #21, Tasks 7 and 8. It runs only with injected snapshot and workbook adapters. No production Gmail reader, Google authorization, trigger installer, deployment entrypoint, draft action, or send action is included. The full Milestone 3 mailbox pilot is still gated.

## Interfaces and source boundaries

- `GmailClient.getThreadSnapshot(messageId)` validates a plain version 1.0 snapshot and verifies the requested message belongs to it. Only `contact@elev8mediaky.com` is an own identity; matching is case-insensitive. No aliases are enabled.
- `deriveThreadState(snapshot, commitments, now)` orders internal timestamps, validates commitment references, excludes automated/bulk/no-reply/spam/draft/receipt messages, and derives waiting state. Equal timestamps with conflicting interpretations require review. Unaddressed and self-addressed messages remain ambiguous. An overdue open outbound commitment survives acknowledgements and ambiguous chronology.
- `normalizeStagingItem` builds a canonical version 1.0 item. Both intake paths use authoritative snapshots rather than trusting Studio's state/category hints. Interpretation enums and short summaries are validated; bodies and subjects are not accepted in snapshots. Manual category, status, waiting state, snooze, and resolution overrides are preserved by the existing upsert service.
- `GmailReconciler.processStudioInbox(now, batchSize)` processes pending, failed, or previously claimed staging records using current snapshots. It updates staging status and a fixed error code in the same transaction as queue/audit writes. A message exactly at `now` is eligible.
- `GmailReconciler.reconcileRecentGmail(now, batchSize)` recovers messages absent from Studio. Readers receive the fixed mailbox, filtering flags, a half-open time window, a page token, and an explicit limit. The requested message must be inside that window. Local fixture readers may verify a full selected thread; the native Apps Script pilot uses only the requested metadata message and does not read thread history.

Models supply only validated meaning/category/risk/summary/confidence. They do not supply direction, chronology, IDs, hashes, cursors, retries, or persistence decisions. Automated/bulk/receipt flags and labels must come from the trusted reader's filtering logic. No extraction model or real-mail classifier is connected by this implementation. Commitment extraction, date interpretation, and the `Commitments` repository are deferred; the chronology accepts already normalized, explicitly supplied commitments.

## Bounded recovery

The initial window is 30 days. After completing a window, the next window overlaps the previous completion by one day, capped at the current 30-day lookback. One invocation fetches at most one page and processes at most `batchSize` references (default 20, maximum 100). Each full-thread fixture snapshot is capped at 1,000 messages. Exceeding a bound is an explicit failure; snapshots must never be silently truncated by a future reader.

### Native Apps Script metadata pilot caveat

Advanced Gmail `Threads.get` can return older thread messages outside the requested search window. To preserve the native pilot's 30-day boundary, the Apps Script runtime never calls that endpoint. It constructs a one-message snapshot from the requested `Messages.get` metadata record only. That partial snapshot is explicitly generic (`ambiguous` / `other` / `review_only`, confidence `0`) and must not be treated as complete thread chronology, interpreted content, or a basis for drafting. Full-thread chronology and model interpretation remain blocked until a provider-supported bounded thread-read design is approved.

The window end remains fixed while pages are being consumed. Pending IDs, the next-page token, and retry timing survive worker recreation in `Config`. Already processed references are removed from the pending page. Completion advances the watermark only after all pending references are handled or have durable dead-letter evidence. A page cursor can restart once within the same bounded window; repeated expiration blocks the window. Backwards worker time and malformed checkpoints fail closed.

An overlap beyond one day is not a guarantee against arbitrarily late source indexing. An outage longer than 30 days also cannot recover the entire gap under this scope. A wider recovery window requires a separately approved scope change.

Transient read failures get at most three attempts, with 1-minute and 2-minute backoff; calls before the due time do not access the source. Invalid payloads and not-found references go directly to `Dead_Letter`. A terminal message failure does not starve later page references. Exhausted or invalid page listing blocks the window instead of advancing its watermark. An open dead-letter record prevents automatic retries; local operators can mark a message dead letter resolved after correcting the fixture/reader and rerun the appropriate path. A blocked page requires an explicit local checkpoint repair/reset after the cause is fixed. There is no automatic deletion or broad rescan.

Gmail snapshots dedupe against the current canonical content hash. This permits a state to recur (for example, resolved → overdue promise → resolved) while repeated unchanged snapshots are suppressed. Other event intake retains the existing historical correlation-ID replay protection. Older snapshot timestamps cannot overwrite newer queue state.

## Atomicity and privacy

The worker holds the workbook adapter's transaction across a bounded run. Queue, audit, staging status, dead letters, and checkpoint writes commit together or roll back together. Read/validation failures are handled as source failures; storage failures propagate and roll back instead of marking valid messages as poison records. `upsertCommunicationItemWithinTransaction` is internal composition for callers already holding that same transaction; normal callers use `upsertCommunicationItem`.

This relies on the existing `SheetTableAdapter` mutual-exclusion, compare-and-swap, and rollback contract. Google Sheets does not gain transaction semantics from this interface. A real adapter must prove that contract, execution-time bounds, and crash recovery before connection or deployment. Local tests use an in-memory adapter with rollback and simulated concurrent edits.

Operational records include IDs or hashed staging IDs, fixed error codes, timing, cursor metadata, and SHA-256 hashes. Exception text, bodies, subjects, sender text, and model hints are never copied into `Config`, `Audit_Log`, or `Dead_Letter`. Dead-letter `payload_hash` hashes the operational source reference, not a retained failed payload. Existing Studio metadata is left in its staging row. Queue summaries are bounded, and previews are omitted by this normalizer. All fixtures are authored synthetic examples using reserved example domains; the sole real address is the already approved mailbox configuration.

## Versioning and migration

- Existing canonical item/Studio schemas and workbook headers stay at their existing versions; no row migration is required.
- Plain `ThreadSnapshot` is a new adapter contract at version `1.0`.
- `Config` key `gmail.reconciliation.v1` holds a strict checkpoint with `schema_version: "1.0"`.
- Keys `gmail.studio.retry.v1.<hash>` hold strict version `1.0` retry envelopes.
- Missing state initializes a local checkpoint; unknown versions, extra properties, duplicate checkpoint keys, or malformed existing state fail closed. No migration overwrites an existing row silently.
- Golden snapshots, checkpoint/retry fixtures, and contract tests accompany these new contracts. Future incompatible changes must use a new version and explicit migration notes/tests.

## Local verification and remaining gate

Run focused chronology/reconciliation and contract tests, `pnpm verify`, and `pnpm validate:planning`. Bundle the reconciliation entry module with esbuild's neutral platform as a local smoke check; the repository's normal build still has no deployed entrypoint. Test evidence covers missed-event recovery, current-state idempotency, reply transitions, manual overrides, pagination, restart/retry/dead-letter behavior, failed checkpoint rollback, redaction, and concurrent workers.

Before any Google permission request, real mailbox read, trigger installation, Apps Script deployment, draft creation, or production communication access, present the exact OAuth scopes, account, query/lookback, redaction rules, and rollback plan for Cam's approval. Workspace Studio configuration remains Milestone 4; Shortcut work remains Milestone 5. PMC acceptance records are updated only when the milestone is accepted, not when this local PR is opened.

## Google runtime transaction limits

The live Sheet adapter buffers writes and sends one atomic Sheets batch after
revalidating every changed table. Deterministic conflicts return before mutation.
A transport failure during the batch is indeterminate; no blind retry is allowed.
Recovery must re-read durable source IDs/checkpoints before choosing another write.

Google Sheets has no conditional compare-and-swap against simultaneous owner edits.
The script lock serializes this application's writers only. All operational Queue
edits must go through script-controlled actions using the same lock; direct owner
editing during a transaction can race the final network call. Background Queue
mutation remains disabled until this guarded manual-control workflow is accepted.
Header drift, table overflow, or a batch above 200 changed rows, 10,000 cells, or
500,000 serialized characters fails closed. These are bounded pilot limits.
