# Workspace Studio Flow — Gmail Intake v1

## Status and scope

Local configuration and contract preparation only. No flow has been created,
tested in an account, or enabled. Milestone 4's live exit criterion is **not met**.

[flow-manifest.json](flow-manifest.json) is a versioned manual-build blueprint,
not a supported Studio import file or a runnable flow. It keeps the flow and
draft step disabled, leaves resource bindings unresolved, and records activation
gates. Prompt hashes pin the reviewed UTF-8 files in [prompts](prompts).

The sole approved pilot mailbox is `contact@elev8mediaky.com`. The approved
30-day lookback belongs to Milestone 3 reconciliation; this Studio starter
handles new inbox mail. Start with one explicitly approved synthetic sender.

## Starter and built-in sequence

Use **When I get an email**, restricted to the approved mailbox and synthetic
sender, with flow-created messages excluded. Apply available inbox filters.
Backend filtering remains responsible for automated/bulk mail and authoritative
chronology. Do not assume custom labels or a date query are supported here.

1. **Decide** — use [decide-action.txt](prompts/decide-action.txt).
2. **Extract** — configure custom output fields using
   [extract-fields.txt](prompts/extract-fields.txt). This is a field-description
   template; Studio does not document a JSON-schema output mode. Match actual
   output types during the approved account test; do not silently coerce them.
3. **Add a row** — append validated operational metadata to `Studio_Inbox`.
   Use the exact column mappings in the manifest. Validation must precede this
   write; prompting the model is not validation.
4. **Check if** — require every manifest condition before drafting: a direct
   reply request, routine risk after validation, a trusted Contacts match,
   enabled intake/drafting, current source state, and a verified unused draft
   operation. Uncertainty or a high-consequence flag prevents routine drafting.
5. **Ask Gemini** — use [draft-reply.txt](prompts/draft-reply.txt) inside the
   conditional branch, using only explicitly approved sources.
6. **Draft an email** — remain in that branch and target the verified original
   message/thread. Keep this step disabled until all activation gates pass.

There is no send step. Informational/closed mail must not generate a routine
draft. Preserve the staging event for canonical reconciliation; a missed or
non-actionable intake event does not resolve an existing promise by itself.

## Deterministic boundary and persistence

`src/adapters/studio/prepare-staging.ts` provides a pure local preparation
function and an internal extraction contract at version 1.0. It is **not wired
to Studio, an Apps Script entrypoint, or a live Sheet adapter**. Names beginning
with `validated.` and `trusted.` in the manifest describe required bindings;
they are not built-in Studio variables. Do not substitute Gemini output chips
for these bindings or construct an apparently working flow that bypasses them.

The function takes three separately validated inputs:

- Source metadata: mailbox, actual Gmail resource ID, run ID, received timestamp,
  sender address, and a bounded subject. These never come from the model.
- Model suggestions: strict enums, booleans, numeric confidence, a 280-character
  summary, bounded action/project/deadline text, and complete risk fields.
- Trusted context: the approved mailbox and known-contact match from the curated
  Contacts registry. A model cannot supply its own known-contact override.

It returns either a schema-compatible `StudioStagingRecord` or a fixed,
content-free error code. It does not log inputs. Unknown keys, invalid types,
overlong fields, or formula-like cell text fail closed. It does not silently
truncate or rewrite source text. String length limits do not prove semantic
summarization: pilot review must also check that short bodies are not copied
verbatim into summaries. Raw content is not accepted by this boundary.

The staging schema and Sheet headers remain **1.0, unchanged**; no migration is
needed. The local extraction contract is new, not a replacement for persisted
staging. The staging event key is `studio:gmail:<actual Gmail message ID>` in
the single-mailbox pilot. It is independent of the run ID. IDs over 115
characters are rejected by this transport boundary to fit the existing
128-character ingest key; IDs are otherwise opaque. A future multi-account or
long-ID contract needs reviewed versioning rather than truncation.

A stable key is not duplicate suppression. The existing staging repository
appends rows; repeated runs may append the same event key. Milestone 3/backend
integration must deduplicate canonical processing. Similarly, routine risk is
only an eligibility suggestion: this helper neither authorizes nor creates a
draft. Source freshness, manual overrides, feature flags, an operation ledger,
and source/draft ID persistence must be checked at the actual side-effect
boundary. Never retry an uncertain draft creation automatically.

Relative deadline text remains unchanged for backend normalization against
`America/New_York`; this step invents no normalized date.

## Capability evidence and unresolved bindings

Verified against official Google documentation on 2026-09-22:

- Gmail arrival, Decide, Extract, Check if, Sheets Add a row, Ask Gemini, and
  Draft an email are documented built-in actions. Decide produces true/false;
  Extract provides custom field descriptions, without a documented strict enum,
  required-field, or numeric schema guarantee.
  [Starter and step guide](https://support.google.com/workspace-studio/table/17176961?hl=en)
- Check if supports conditions and nested actions. Outputs inside a conditional
  branch cannot be used later in the main flow.
  [Conditional steps](https://support.google.com/workspace-studio/answer/16431010?hl=en)
- Sheets write steps require a private, unshared spreadsheet and unique,
  non-empty headers starting at A1. Literal/formula behavior and idempotent
  insertion are not documented guarantees.
  [Sheets behavior](https://support.google.com/workspace-studio/answer/16655443?hl=en)
- Test runs use real data and perform real actions, including writes. They are
  not a dry run. Keep all account tests behind the approval gate.
  [Test runs](https://support.google.com/workspace-studio/answer/16663517?hl=en)
- Turning off a flow stops it, including in-progress runs. Verify the operational
  consequences before relying on it as the draft/intake kill switch.
  [Managing flows](https://support.google.com/a/users/answer/16433729?hl=en)

The guide names an `Email ID` variable but does not establish its correspondence
to Gmail `Message.id`, its received-time binding, an in-flow run-ID variable,
or exact draft reply/thread targeting. Check actual account variables against
the [Gmail Message resource](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages).
Do not use the RFC Message-ID header as an API message ID. Admin audit Run ID
visibility alone does not establish an in-flow variable.

**Integration blocker:** the documented built-ins do not establish a path for
the deterministic boundary, registry/freshness checks, or a draft operation
ledger before side effects. Record the UI evidence and resolve this binding
with Cam before changing the architecture. A custom step, webhook, or moving
the draft writer to Apps Script is not silently approved by this blueprint.

## Verification and activation evidence

Local commands:

```sh
pnpm vitest run tests/contract/studio-flow-manifest.test.ts tests/unit/studio-prepare-staging.test.ts tests/integration/studio-staging.test.ts
pnpm verify
pnpm validate:planning
```

The actual account must later prove these cases with approved synthetic data:

| Case | Required result |
| --- | --- |
| Known contact, routine direct question | One canonical item and one draft in the correct thread |
| Newsletter, receipt, closed acknowledgement | No routine draft; no new actionable item absent a promise |
| Pricing, complaint, contract, schedule commitment, aviation employment | Review-only, no automatic draft |
| Unknown contact or uncertain interpretation | Review-only |
| Same message replayed in another run | One canonical item; no extra draft |
| New reply while a draft is pending | Stale draft detected; no silent replacement of Cam's edits |
| Relative or ambiguous deadline | Original phrase retained; ambiguous date flagged by backend |
| Invalid enum/type, extra body field, overlong or formula-like value | No unsafe write; content-free failure evidence |
| Intake off / drafting off | Independently verified stop behavior, including in-flight execution |

Record only run references, synthetic IDs, expected/actual outcomes, draft count,
sent count (must be zero), and error codes. Review Studio activity access and
retention before using private content. Do not save email bodies, prompts with
private context, credentials, or raw activity screenshots to Git.

Prepare the exact account, pilot Sheet, synthetic sender/message, requested
scopes, action list, and rollback for Cam before granting access or testing.
Rollback begins by turning off the flow and disabling drafting. Retain staging
and audit evidence; deleting drafts or rows requires the existing explicit
approval. The milestone is complete only after those live results pass.
