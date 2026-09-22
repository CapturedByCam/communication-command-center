# Commitments and Briefing Local Contracts

This module is pure local domain logic. The integration layer may persist its
results to the existing `Commitments` and `Briefing_View` tabs, but these APIs do
not write Sheets, create Calendar events, access Google services, or send
messages.

## Commitments

`upsertCommitment(existing, proposal)` creates an open commitment from an
outbound-promise observation. Its idempotency key is the immutable
`sourceEvidenceId`; retrying that source evidence returns
`duplicate_suppressed`. Existing manual overrides are preserved.

`resolveCommitment(commitment, resolution)` requires either a fulfillment
source-evidence ID or a named manual actor. It never infers fulfillment from a
new inbound message. Manual resolution sets `manualOverride` and records the
actor.

## Deadline normalization

`normalizeDeadlineSuggestion({ text, anchorAt })` retains at most 200 characters
of original text. It recognizes only explicit ISO calendar dates, `today`,
`tomorrow` and `in N days`, interpreted using the required
`America/New_York` anchor. Absolute ISO timestamps and explicit local calendar
dates with a valid AM/PM time can be normalized without an anchor. A date without
a time, missing relative-date anchor, unsupported/ambiguous language, invalid
time, DST spring gap, or DST fall fold returns `deadlineAt: null` with
`needsDateReview: true`.

## Calendar candidates

`buildCalendarCandidate()` returns a candidate record only. The
`creationEligible` requires an approved, enabled integration and a strict,
valid ISO timestamp with an explicit offset. Other deadline text is retained
only as data with `needsDateReview: true`; it cannot become a creation
candidate. `writePerformed` is always `false`, and this module contains no
Calendar client.

## Briefing

`buildBriefing(items, commitments, health, generatedAt, options)` returns the
eight product sections in fixed order. Resolved and archived items, plus active
snoozes, are excluded; an expired snooze returns to active work. Every remaining
active item is assigned exactly once. The upcoming-week section uses New York
calendar-day boundaries, including across DST changes.
`Handle first` has at most five entries; remaining active work appears in its
next applicable section, with unclassified overflow placed under `Needs
judgment` as `active item awaiting triage`. Commitment and system-health rows
are supplementary and do not duplicate an item assignment.

`writeBriefingView()` exposes adapter-neutral ordered sections for the future
Sheet writer. `renderBriefingMarkdown()` is deterministic and contains item IDs
where an item is present.

## Apps Script projection runtime

`runBriefing(gateway, spreadsheetId, now, sha256)` is the synchronous runtime
adapter for the existing manifest tables. It reads `Queue`, `Commitments`,
`Dead_Letter`, `Audit_Log`, and `Config` under one gateway lock, then validates
each queue row through `queueItemFromRow`. Commitment rows are fail-closed:
their IDs, bounded promise text, enum status, boolean override, and all
present timestamps must be valid before a briefing can be persisted. The
current `Commitments` sheet has no columns for `sourceEvidenceId`, `observedAt`,
or `resolvedBy`; the adapter derives those internal fields from the stable row
identity and `updated_at` without changing the workbook schema.

Health is calculated from open `Dead_Letter` rows, `duplicate_suppressed`
`Audit_Log` rows, Queue rows whose `draft_status` is `stale`, and the newest
valid `gmail.reconciliation.v1` Config value. Its JSON is accepted only when
`GmailCheckpointSchema.safeParse` validates it, and then only its
`completedThrough` timestamp is used. The runtime calls the pure
`buildBriefing` service and appends every one of its eight ordered sections to
`Briefing_View`. An empty section is represented by a `No items` row. Item and
promise rows carry only bounded operational metadata and their existing Queue
`source_link`; no source body or message is persisted. A commitment row uses
its linked Queue item ID to retain that source link.

The projection is append-only. `briefing_date` is the `YYYY-MM-DD`
America/New_York local date and `generated_at` is the full supplied timestamp.
Prior `Briefing_View` rows are never replaced. A SHA-256 key over the local
date, built sections, and health is stored as
`Briefing_History.content_hash`; an identical rendered briefing returns
`duplicate` without appending view or history rows. This includes the
time-dependent result of an expired snooze, so a same-day change in active work
creates a new version. Each append starts `sort_order` at zero, making the
first row after the prior projection the boundary of the latest dated version.
Otherwise the gateway atomically commits both appended tables with a history
row whose `delivery_channel` is `none` and `delivery_status` is `generated`.
The runtime has no Gmail, Calendar, or delivery client and does not send or
draft messages.
