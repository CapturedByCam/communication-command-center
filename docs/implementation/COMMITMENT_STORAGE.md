# Commitment storage 1.1

This release supplies the missing persistence boundary for outbound promises.
It does not activate model extraction, Gmail reconciliation, or a new manual UI.
The guarded empty-table migration completed on 2026-09-22. The existing
owner-only deployment now points to verified immutable Version 7; the
Commitments table has the 17-column 1.1 header and remains empty. Automatic
promise extraction and provider reconciliation remain disabled and unaccepted.

## Data contract

The existing eleven Commitments columns retain their order. Six trailing columns
add `schema_version` (exactly `1.1`), `source_message_id`, `source_evidence_id`,
`observed_at`, `resolved_by`, and `needs_date_review`. IDs and observation time
come from verified Gmail metadata. Promise summaries are bounded to 500 characters
and deadline suggestions to 200. Unknown model properties are rejected. No body,
snippet, attachment or raw model response is retained.

The runtime validates one exact outbound message in the sole approved mailbox
and 30-day window. Stable IDs are derived by code; deadlines are normalized
against the source timestamp in America/New_York. The repository validates the
persisted row, suppresses repeat evidence, preserves manual and fulfilled rows,
and refuses conflicting identity. A fulfillment needs an evidence ID or a named
manual actor. Observation and content-free audit writes share one transaction.
The low-level resolution repository does not create an audit by itself; its future
authorized caller must couple resolution and audit within the shared transaction.
An uncertain provider commit is never blindly retried inside the adapter.

The new briefing parser uses persisted provenance. It does not invent source
evidence, observation time or a resolver from the row identity. Older records
cannot be passed off as valid 1.1 records.

## Migration and deployment gate

1. Keep the existing deployment running and prepare a private workbook backup.
   Disable all app controls and managed triggers before the coordinated change.
2. Inspect the exact bound workbook and Commitments table. A populated legacy
   table is a hard stop for a separate evidence-preserving migration decision.
   Do not infer missing provenance or clear rows.
3. Push only the reviewed candidate source to the existing Apps Script project.
   Run `cccMigrateEmptyCommitments` explicitly from its authenticated editor.
   This owner-only operation rechecks the workbook binding and all flags under
   the script lock, reads all Commitment rows including blank-rendering formulas,
   and appends only the six new header cells to an unchanged, empty legacy table.
   It neither changes an existing cell nor touches another table. A current
   header is an idempotent no-op. Controlled results contain no row values.
4. Verify the exact 17-column header, still-empty table, unchanged other tables,
   and `cccHealth`. Create/deploy the verified immutable version with unchanged
   private access. Keep unaccepted provider integrations disabled.
5. On an uncertain migration result, inspect headers before taking another
   action. Never automatically rerun a write whose outcome is unknown.

Sheets offers no cross-client compare-and-swap. The final reread plus script lock
protects cooperating app writes, not an owner edit made during the provider call.
Run this release step while the workbook is not being edited.

## Recovery

Do not remove columns or records to fit Version 6. That older runtime expects the
legacy header and cannot pass its Commitment health/briefing checks on 1.1.
Keep controls off and preserve the migrated workbook. Restore the pre-migration
backup to a new private copy and verify its header/data before coordinating an
older deployment and binding; later accepted records must be reconciled, never
discarded. The private pre-migration backup is retained. Version 6 is not a direct
rollback target on the migrated active workbook; it requires a separately
verified new copy of the legacy backup and coordinated binding.

## Remaining V1 integration

A privacy-compatible model provider must supply real outbound-promise proposals.
The current observation boundary accepts one summary per source message. Before
provider activation, resolve how multiple independently due promises are represented
or explicitly flagged for review; do not silently discard additional obligations.
The current selected-message-only reconciliation snapshot lacks an earlier
outbound message when reading a later inbound one. Do not inject fabricated
thread evidence or silently drop an overdue obligation to make that path pass.
Complete bounded authoritative chronology and the interpretation binding before
connecting persisted commitments to automatic Queue reconciliation. Then verify
real source, waiting-state and draft behavior under the existing acceptance gates.
