# Preserve bounded Gmail chronology

## Status

Accepted under Cam's standing V1 implementation authorization, 2026-09-22.

## Decision

Replace native one-message reconciliation with a fixed-window, two-stage scan.
Enumerate all eligible message ID/thread ID references before processing a thread.
Fetch only listed Messages.get metadata, never Threads.get or older history.
The coverage claim is enumeration of the eligible query within the fixed window,
not an immutable Gmail snapshot or knowledge of older messages. Query exclusions
remain explicit; missing, conflicting or oversized evidence blocks the scan.

Use a separate versioned checkpoint and bounded Config reference shards. Preserve
the existing v1 checkpoint for recovery; do not migrate or overwrite it. Limit
one scan to 2,000 references, one shard/page to 20 references, IDs to 512 characters,
serialized shards to 30,000 characters, and one thread to 50 messages. Exceeding
any limit requires review, never truncation. Read one list page or one thread per
invocation. Retry transient reads with bounded backoff; expired cursors invalidate
the unfinished enumeration instead of treating collected IDs as complete.

Retain only IDs, window/cursor state, controlled errors and timestamps in the
checkpoint. Do not persist header maps, bodies, snippets or model responses.
Reuse shard slots on the next scan under the shared workbook transaction; do not
append unbounded per-run keys. Queue, audit and progress updates are atomic.
The scan is complete only after every enumerated thread is reconciled. Required
provider interpretation remains unbound and generic metadata must remain review-only.

Persisted open commitments whose source predates the window still contribute to
open/overdue state; they are not represented as fetched messages or auto-fulfilled.
For commitments inside the window, require exact outbound message provenance.
An absent in-window commitment source blocks processing. Manual overrides win.
Multiple independently due promises still require a provider contract decision;
this chronology change does not silently collapse them or activate extraction.

## Verification and release

Use targeted regressions for cross-page thread grouping, bounds, exact IDs and
window checks, cursor failures, old obligations, atomic progress and manual
preservation. Run the required integrated checks once and independent review.
A source merge does not deploy the new runtime: the Commitment 1.1 coordinated
migration, provider acceptance and live bounded pilot remain separate gates.

## Sources

Google's messages.list contract returns id/threadId references and page tokens:
https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list
Epoch-second query bounds are documented at:
https://developers.google.com/workspace/gmail/api/guides/filtering
