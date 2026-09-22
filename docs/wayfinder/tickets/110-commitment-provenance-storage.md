# Persist immutable Commitment provenance

## Status

Accepted under Cam's standing V1 implementation authorization, 2026-09-22.

## Decision

Complete the missing storage layer for outbound promises before connecting an
interpretation provider. This is a required intermediate integration, not a
replacement for automatic outbound-promise extraction or daily-use acceptance.

Version the Commitments row contract as 1.1. Append schema_version,
source_message_id, source_evidence_id, observed_at, resolved_by and
needs_date_review to the existing eleven columns. New records require real
outbound Gmail provenance and bounded promise/deadline metadata. Code derives
stable IDs from the approved mailbox and authoritative message ID; a model may
suggest only promise summary and deadline text. Normalize deadlines against the
source message time in America/New_York. Preserve immutable evidence, manual
overrides and fulfilled records. Resolution requires fulfillment evidence or a
named manual actor, and persists the resolver. Never log promise text.

The writer uses the shared workbook transaction and content-free audit. It must
validate the exact requested outbound message, mailbox, thread and 30-day window
before accepting an observation. No message body is persisted. Provider binding
and its privacy acceptance remain separate requirements.

Migration is explicit and permitted only for an empty legacy Commitments table.
Append only the six new header cells; never overwrite existing headers or rows.
A populated legacy table stops for an evidence-preserving migration decision;
never manufacture message/evidence IDs or observation timestamps. An already
current table is a no-op. Deployment must be coordinated with the header change;
existing Version 6 remains deployed until the migration/release gates pass.

Do not bind stored obligations into the selected-message-only Gmail reader yet:
a later inbound snapshot lacks the outbound evidence required by thread-state
validation. Full bounded chronology and outbound interpretation remain required
for that connection. Briefing reads the new persisted provenance directly.

## Acceptance and rollback

Use targeted tests for strict row contracts, duplicate/conflicting evidence,
manual and fulfilled preservation, atomic writes, source validation, resolution,
briefing projection and empty-only migration refusal/idempotency. Run required
repository checks once on the integrated candidate and obtain independent review.
No live migration, provider activation or new OAuth scope is implied by merging
this slice. Preserve the old deployment and workbook backup for coordinated
rollback; never erase new records to restore the old header contract.
