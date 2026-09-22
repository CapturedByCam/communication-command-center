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
