# Studio custom Apps Script step

## Purpose and current gate

This is the accepted implementation design for a private Workspace Studio step
that validates one Gmail message and persists one `Studio_Inbox` staging row.
It is a bounded, synchronous Apps Script action: validation, metadata read, and
one transaction happen during the action invocation. It is not an HTTP endpoint,
a background worker, or a send/draft path.

The checked-in manifest uses the current Studio extension point,
`addOns.studio.flows.workflowElements`. The current official installation guide
is [Build a step](https://developers.google.com/workspace/add-ons/studio/build-a-step).
Older calculator quickstart material is useful background, but is not the
installation authority for this flow shape.

As of 2026-09-22, the account's Studio menu did not expose a custom-step option
and the Google Admin passkey action remains pending. No custom step has been
installed, no starter-variable binding has been run, and no real model output has
been accepted.

## Private action contract

The manifest exposes one active action with exactly two `SINGLE` `STRING` inputs:

| Input | Constraint | Use |
| --- | --- | --- |
| `gmail_message_id` | Exactly one non-empty Gmail message resource ID, at most 115 characters | The only requested source message |
| `model_json` | Exactly one non-empty UTF-8 JSON value, at most 12,000 bytes | Strict `StudioInterpretationSchema` proposal |

Unknown input names, multiple values, malformed JSON, schema-invalid proposals,
and oversized input are rejected. Nothing is truncated or persisted for a
rejected invocation. The controlled result contains a status and, only when
available, the deterministic staging ingest ID.

The handler validates before reading operational data, then independently checks:

- owner identity and the bound workbook;
- the approved Gmail mailbox/profile;
- equality between the requested message ID and fetched metadata ID;
- a non-future, at-most-30-day `internalDate`;
- metadata-only source fields selected as `From` and `Subject`;
- no `DRAFT`, `SENT`, `SPAM`, `TRASH`, `CATEGORY_PROMOTIONS`, or
  `CATEGORY_FORUMS` label.

It never requests a body, snippet, attachment, thread history, or raw model
prompt/output. The source selector is Gmail metadata mode with only those
headers. Sender, subject, message ID, received time, and the strict
interpretation fields are passed to `prepareStudioStaging`; staging stays at
version `1.0`. The existing Gmail reconciliation reader is not broadened by
this step.

## Persistence and context

`TableGateway` provides the existing transaction lock and single atomic commit.
Inside that locked transaction, the action rechecks owner,
workbook binding, and `CCC_STUDIO_PROCESSING` before reading `Contacts` or
`Studio_Inbox` and before a commit can occur. A flag change while an invocation
is in progress therefore fails closed.

Curated contacts are read lazily only after the source passes validation and
inside the authorized transaction. Matching is exact against active curated
records. Contact context permits `routine` only when every existing risk gate
passes; an unknown contact remains review-only. No contact is created from Gmail metadata or model input.

For one matching deterministic ingest ID, equal immutable source and model-input
cells return `duplicate` without writing, even if reconciliation bookkeeping
(`processing_status`, `processed_at`, or `error_code`) changed. Different
immutable content, or more than one matching row, returns `conflict` without
replacing the existing row. Reconciliation bookkeeping is preserved. A commit
whose provider outcome cannot be confirmed returns `uncertain` and is never
retried automatically.

The step appends only the approved staging row. It adds no OAuth scopes and does
not add a send action, Gmail draft action, or provider mutation. The private,
owner-only deployment remains unchanged.

## Installation and evidence checklist

Complete each item in order and retain only controlled outputs, counts, and
schema/version evidence in the execution record.

1. Build the checked-in manifest and inspect that the only new Studio element is
   under `addOns.studio.flows.workflowElements`, with the two exact `SINGLE`
   `STRING` inputs and controlled outputs.
2. With the authorized owner and required Admin access, install the private test
   add-on. Verify the visible consent screen adds no scope and that the Studio
   UI actually exposes the custom action. Record the account-policy result; do
   not infer it from a successful build.
3. Keep `CCC_STUDIO_PROCESSING` false and run a disabled invocation. Verify its
   controlled disabled response and no `Studio_Inbox`/audit mutation before any
   Gmail or Contacts read.
4. For a literal existing Gmail message inside the 30-day window, manually enter
   its exact resource ID and one bounded, schema-valid interpretation JSON with
   the flag enabled. Verify source-ID equality, metadata-only selection, one
   atomic staging result, and no body/snippet/raw JSON in Sheets or logs. Turn
   the flag off after the run.
5. Configure a Studio flow to bind its actual Gmail starter message-ID variable
   to `gmail_message_id` and bind the interpretation string separately. Run the
   same controlled checks. This is the only evidence that establishes the
   starter-variable binding; the literal-message test does not establish it.
6. Evaluate real model usefulness only after the binding works. Validate each
   model proposal through the strict schema and existing review policy; do not
   treat a successful literal test as model acceptance.
7. Exercise duplicate, conflict, and mid-invocation flag-off paths. Verify existing
   processing bookkeeping is preserved and an uncertain commit is not retried.

## Rollback

Set `CCC_STUDIO_PROCESSING` false, turn any test flow off, and verify that an
invocation returns the controlled disabled result before reads or writes. If the
account installation must be removed, uninstall only the private project test
add-on. This does not alter source Gmail data, create drafts, send messages, or
change the existing private deployment; the prior immutable runtime remains the
rollback target.
