# Add a guarded manual waiting-state control

## Status

Accepted under Cam's standing 2026-09-22 V1 implementation authorization.

## Decision

Complete the documented `Mark <item_id> waiting on them` command through the
existing owner-only selected-Queue-row control path. One explicit menu command
asks for exactly `me`, `them`, `none`, or `unknown`; it never infers chronology.
Allow changes only on open or snoozed items. A resolved item must be explicitly
reopened first; an archived item cannot be changed by this control.

Reuse `CCC_MANUAL_WRITES`, the shared Script Lock, owner/workbook rechecks, the
complete pre-prompt row snapshot and atomic Queue plus Audit_Log transaction.
A successful change sets `manual_override:true` and changes only `waiting_on`
and `updated_at`. Preserve status, snooze, resolution, source, draft, commitment,
priority, summary and other fields. Existing drafts remain untouched and must
be reviewed separately; this command makes no Gmail call. An identical waiting
state is a no-op with no audit append or timestamp change. Invalid text, prompt
cancellation, lost authorization or a stale snapshot produces no write.

The existing Queue waiting enum and audit `upsert_item`/`updated` contract remain
unchanged. Hash the requested operation and waiting value in the audit payload;
never log selected-row contents. No schema migration, new scope, new flag or
background worker is needed. Clearing a manual override is outside this slice.

## Acceptance and rollback

Tests cover each waiting enum, preserved unrelated fields and snooze state,
no-op, invalid values, closed states, stale selection, prompt cancellation,
authorization loss and atomic audit. Run full required repository checks and
independent review before merge. Deploy only a verified bundle and perform a
bounded owner-controlled acceptance check, preserving the original waiting state.
`cccDisableAll` disables this action with the other manual controls. Roll back the
private deployment to the prior verified version if necessary; do not clear rows.
