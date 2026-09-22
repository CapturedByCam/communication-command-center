# Bounded Gmail chronology

Decision: [111](../wayfinder/tickets/111-bounded-gmail-chronology.md).

## Merged source; private activation pending

The native intake candidate enumerates eligible ID/thread ID references in a
fixed 30-day window, twenty per invocation. Only after enumeration finishes does
it read one complete enumerated thread, at most fifty metadata messages per
invocation. It never calls Threads.get. Query enumeration is not an immutable
Gmail snapshot and does not establish older message history.

Config key `gmail.reconciliation.v2` contains the strict version 2.0 checkpoint.
Keys `gmail.references.v1.0` through `gmail.references.v1.99` hold reusable version
1.0 reference shards. Limits are 2,000 references, 100 shards, 20 references per
shard, 512 characters per ID, and 30,000 serialized characters per shard. No
source headers, snippets, bodies or model responses are persisted there.
The legacy checkpoint remains intact; this is an additive checkpoint migration.
Old shard slots outside the current shard count are ignored and reused later.

Enumeration and Queue/Audit/progress commits share the workbook transaction.
Uncertain persistence failures escape without speculative retries. Transient
reads retry after one then two minutes; a third failure blocks the scan. Invalid
or missing evidence, cursor loops and limits block instead of truncating.
Briefing health counts the active checkpoint error alongside open dead letters
and preserves the timestamp of the previous completed scan.

Persisted older open obligations remain open and review-only, with overdue
obligations waiting on Cam. Their source messages are not fabricated or fetched.
Threads absent from the eligible current window receive no new Queue projection;
their persisted commitments remain available to the commitment briefing.
In-window obligations require exact outbound ID and timestamp provenance.

## Recovery and deployment gates

A blocked checkpoint requires operator investigation of its controlled error and
window. Automatic restart is intentionally absent. Preserve the private Config
checkpoint and Queue/Audit recovery point before any approved repair. Do not
change the phase to complete or erase missing evidence to force progress. A
reviewed reset/migration path is required before restarting a blocked scan.

PR #42 merged as `4789030589d1f0168aff87de788f29dd80155e85` after independent
review, full repository CI and CodeQL. Version 6 remains deployed. Coordinate the
Commitment 1.1 migration before pushing or deploying this source. A fresh private
backup was created and verified; its ID is recorded only in ignored
`.local/PILOT_RESOURCES.md`.

The editor action is currently blocked by tooling: authenticated `clasp run
cccHealth` returned storage `NOT_FOUND`, and an authenticated editor control path is
unavailable in this environment. Thus live flags/triggers and full-table emptiness are
unverified; the guarded migration and disable function have not run. No source
push or deployment occurred. Provider interpretation, Studio installation,
live bounded acceptance and pilot usefulness remain release requirements.

Studio processing and selected replay use the same bounded projection when a v2
checkpoint exists. They require completed enumeration and an exact requested
reference in its shards. Unavailable scan coverage defers Studio work without replacing Queue state.
Malformed evidence remains a controlled failure. Transient provider reads retain
bounded backoff; they are distinct from validation failures. Before a v2 checkpoint
exists, legacy projection is permitted only for a thread with no persisted
commitments. This preserves recovery compatibility without discarding obligations.

Focused reader, older-obligation and runtime checks pass. The legacy overwrite
repair passes focused verification and independent review. Historical dead-letter
recovery additionally requires the reused fixed window to fit its original caller
bounds before reading thread metadata. Required local checks pass: formatting, lint, types, three JSON/Zod contracts,
423 tests across 45 files, build and planning validation. Required PR CI and
CodeQL passed before merge.
