# Validate Studio interpretation through a private Apps Script custom step

## Status

Accepted implementation decision. The private test add-on is installed, the
custom step is visible and configurable, and literal-source metadata staging is
accepted. Actual starter-variable binding, real-model acceptance, and exact
resolved-input/source retention remain gated.

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
requests Gmail metadata only, selecting `From` and `Subject`; it does not fetch
or persist a body, snippet, attachment, thread history, or private prompt. It
parses the bounded interpretation JSON but does not persist the raw JSON. It
uses the unchanged staging `1.0` contract.

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
review acceptance; installation alone does not establish model acceptance.

On 2026-09-22, test add-on installation was verified in Test deployments: Application
shows Workspace Studio, the button is Uninstall, and Installed add-ons is present. No
new scope or consent was requested. Before Admin availability was inspected, the custom
action was absent from the reloaded manual-flow UI; that historical absence does not
prove permanent unavailability.

On 2026-09-22, Cam approved enabling Studio Custom steps access for the
CapturedByCam root organizational unit while retaining unpublished test-step
access. Admin saved ON with the test-step checkbox checked. The private
Communication Command Center action then appeared in the Studio picker and was
added to the manual synthetic flow as Step 3. Its initial configuration card
failed on the unused script.locale permission implied by useLocaleFromApp.
PR #45 removed that manifest option without adding an OAuth scope. The
authenticated Apps Script editor was updated with the exact field removal and
reported Saved to Drive. Reopening the Studio step then rendered both bounded
input fields with no permission error. No run of the new step, source binding,
Gmail action, or send occurred; CCC_STUDIO_PROCESSING remains false. The
existing owner-only deployment was later updated for separately reviewed
runtime work. On 2026-09-23 the private step passed a disabled synthetic run,
one literal eligible Gmail-resource staging run, an identical replay, and a
changed-immutable-input replay. The first live run appended exactly one
metadata-only `Studio_Inbox` row; the two replays changed neither that row nor
`Audit_Log`. The flag was restored to false, the live resource ID was removed
from the saved flow, and a final disabled run made no further change. The custom
step received and parsed the bounded interpretation JSON but did not persist the
raw JSON. No Gmail body, snippet, attachment, thread history, draft, or send was
used. Studio-side input and output retention remains unresolved.

The current app-owned flow is Start manually → Ask Gemini, with Web
search and Workspace sources off, no skills, Text output, and the private
metadata-only custom step. Its saved Gmail-ID input is synthetic and processing
is disabled outside deliberate checks.
One synthetic-only manual run succeeded at 12:26:22 EDT.
`StudioInterpretationSchema` accepted all 12 required fields with no extras; a pure
`prepareStudioStaging` call with wholly synthetic metadata and `knownContact:false`
returned `review_only` without persistence or provider calls. The synthetic details are
in [Studio synthetic probe](../../evaluation/STUDIO_SYNTHETIC_PROBE.md). The proposal's
`active_project`, `routine`, confidence `1.0`, and synthetic `No rush` deadline text lack
project evidence, so semantic review and model usefulness acceptance remain open. In
that earlier synthetic run, no Gmail starter, message ID, or private content was bound.
Activity says Data available for
40 days and exposes stored synthetic output; exact resolved-input/source retention remains
unknown. The literal-source run above did not expose or persist message content,
but it does not establish starter binding or model usefulness.

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
