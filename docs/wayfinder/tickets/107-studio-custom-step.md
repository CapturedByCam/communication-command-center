# Validate Studio interpretation through a private Apps Script custom step

## Status

Accepted implementation decision. Account installation, actual starter-variable
binding, and real-model acceptance remain gated.

## Decision

Use a private Workspace Studio custom Apps Script step when the account exposes
and permits it. Its checked-in manifest entry is under
`addOns.studio.flows.workflowElements`. The step receives exactly one Gmail
message resource ID and exactly one bounded JSON interpretation string: both are
`SINGLE` `STRING` values, the ID is at most 115 characters, and the JSON is at
most 12,000 UTF-8 bytes. Unknown/multiple inputs, malformed JSON, and strict
schema failures are rejected without truncation or persistence.

One bounded action invocation validates owner, workbook, approved mailbox,
requested/fetched message identity, and a non-future 30-day metadata window. It
requests Gmail metadata only, selecting `From` and `Subject`; it never reads or
persists a body, snippet, attachment, thread history, raw model JSON, or private
prompt. It uses the unchanged staging `1.0` contract.

The existing `TableGateway` lock and atomic commit are the persistence boundary.
Inside that transaction, the handler rechecks the owner, workbook binding, and
`CCC_STUDIO_PROCESSING`. It reads active curated contacts lazily and matches
them exactly; contact context permits `routine` only if every existing risk gate
passes, while unknown contacts remain review-only. It does not create contacts
from Gmail or model input.

For exactly one matching deterministic ingest ID, equal immutable source and
model-input cells return a controlled duplicate result without a write even when
processing bookkeeping changed. Different immutable content, or multiple matching
rows, returns conflict and is never replaced; reconciliation bookkeeping is
preserved. An uncertain commit is reported and never automatically retried. The
step adds no scope, sending, draft, or provider-mutation capability.

See [Studio custom Apps Script step](../../implementation/STUDIO_CUSTOM_STEP.md)
for the runtime behavior and evidence checklist.

## Acceptance gates

A literal existing message inside the window verifies requested-message metadata
identity and one atomic staging result. It does **not** prove that a Studio
starter supplies the intended Gmail ID. A separate actual starter-variable run
must prove that binding. Real model usefulness requires its own strict-schema and
review acceptance; neither installation nor model acceptance is currently
claimed.

On 2026-09-22, the Studio menu did not expose a custom step and the Google Admin
passkey action remained pending. Those are account/install gates, not evidence
that the checked-in action is installed or usable.

## Sources

- [Google: Build a step](https://developers.google.com/workspace/add-ons/studio/build-a-step)
- [Studio event objects](https://developers.google.com/workspace/add-ons/studio/event-objects)
- [Input variables](https://developers.google.com/workspace/add-ons/studio/input-variables)
- [Output variables](https://developers.google.com/workspace/add-ons/studio/output-variables)

The older calculator quickstart is historical background and is not the current
installation authority for this action shape.

## Rollback

Leave `CCC_STUDIO_PROCESSING` false, keep any test flow off, and uninstall only
the private project test add-on if removal is required. No source Gmail data,
drafts, sending behavior, scopes, or private deployment configuration is changed.
