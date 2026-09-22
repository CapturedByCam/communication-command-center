# Deployment and Operations Runbook — Communication Command Center

## Runbook metadata

- **Mode:** authorized private V1 pilot preparation; live acceptance remains open.
- **Primary operator:** approved owner account, using the bound private workbook
  and Apps Script project.
- **Current resources:** the private workbook is initialized with all ten manifest
  tabs; its time zone is `America/New_York`; a private pre-activation backup is
  verified. The resource bindings remain in ignored local records.
- **Current safety state:** health verified every flag false; a later Gmail/briefing
  pilot flag save was interrupted by screen lock and its outcome is unknown. No trigger, Shortcut
  token, installed Shortcut, mailbox processing, or application-created draft
  exists, and no application-created Google message has been sent.
- **Deployment state:** immutable Apps Script version 1 is deployed as an
  owner-only web app (`access: "MYSELF"`, `executeAs: "USER_DEPLOYING"`). The
  deployed `Code.js` exactly matches `dist/Code.js` after LF normalization and
  its manifest semantically matches `dist/appsscript.json`.
- **Model state:** the privacy-compatible interpretation binding is blocked. The
  inspected Cloud billing account is on an expired free trial; no paid upgrade
  was authorized or made.

See [Runtime operations](RUNTIME_OPERATIONS.md) for offline deployment-drift
comparison, private backup handling, and version rollback.

## Safety classification

| Action | Current treatment |
| --- | --- |
| Local build, tests, and offline drift comparison | Safe local work |
| Private Apps Script test deployment | Version 1 deployed; owner-only and immutable |
| `cccHealth` | Passed: ten valid headers and all six flags false at check time |
| `cccGmailReadProbe` | Passed: approved mailbox, one bounded metadata message, no mutations |
| Pilot processing flags | Gmail/briefing save attempted; screen lock left its outcome unknown |
| Create a trigger, provision a Shortcut token, or install a Shortcut | Not yet performed; requires its documented live acceptance evidence |
| Bind a model provider or make a paid billing change | Blocked; no paid upgrade |
| Send Google email or Chat, including to the owner | Prohibited |
| Delete drafts, source messages, workbook records, or clear production ranges | Prohibited by this runbook |

## Global stop conditions

Stop the current operation and leave all flags false if the owner account,
bound workbook, or Apps Script project is not the verified target; a log or Sheet
would contain source content or a secret; a check would create a draft or send a
Google message; the model path requires a paid upgrade; or a command proposes
clearing/replacing existing workbook data.

## Phase 0 — Verify targets

The verified target is the existing private pilot workbook and bound Apps Script
project recorded in ignored local resource notes. Bootstrap already completed:
it created ten manifest tabs, set `America/New_York`, and set all flags false.
The backup is private and owned only by the approved account.

Open the verified bound Apps Script project for controlled checks. Do not create
a new workbook or repoint the project.

## Phase 1 — Local build and offline verification

From the repository root, run:

```sh
pnpm verify
pnpm build
node scripts/check-deployment-drift.mjs \
  --content .local/apps-script-project-content.json \
  --dist dist
```

Obtain the `projects.getContent` response through the approved read-only path and
keep it under `.local/`; it can contain source. `STATUS=drift` or
`STATUS=invalid` blocks the deployment investigation. The checker emits only
status and hashes, never source.

## Phase 2 — Workbook and bootstrap state

Do not rerun bootstrap as a routine operation. The initialized workbook is the
current pilot state. Its required checks are: exactly ten manifest tabs, matching
headers, `America/New_York`, empty operational rows, and these Script Properties
set to `false`:

```text
CCC_GMAIL_INTAKE
CCC_STUDIO_PROCESSING
CCC_SHORTCUT_INTAKE
CCC_DRAFT_CREATION
CCC_DRAFT_REPLACEMENT
CCC_BRIEFING_DELIVERY
```

If a private backup must be restored, create a **new** private workbook from it.
Never overwrite, clear, import into, or replace the initialized workbook. Follow
the detailed procedure in [Runtime operations](RUNTIME_OPERATIONS.md).

## Phase 3 — Private Apps Script test deployment

Immutable Apps Script version 1 is deployed privately with `MYSELF` /
`USER_DEPLOYING`; exact deployed code and semantic manifest comparison against
`dist` passed. Do not create a domain, logged-in-user, or anonymous deployment.
No token or phone test is active.

`cccHealth()` passed at 03:14:57 EDT. Its controlled result confirmed `ok: true`, valid headers, all six flags false,
`time_zone: "America/New_York"`, and `send_capability: false`. After that
result, run `cccGmailReadProbe()` and require `ok: true`,
`mailbox_verified: true`, `bounded_days: 30`, `raw_content_stored: false`, and
`mutations: 0`. Then run `cccDisableAll()` and require `ok: true`, empty
`flags_enabled`, and `managed_triggers_remaining: 0`.

These checks use controlled counts/statuses. They do not enable processing,
create drafts, or send messages. Stop if any expected result is absent.

## Phase 4 — Workspace Studio and model binding

Keep Studio disabled. The native metadata path is bounded and review-only; it
does not establish a model interpretation binding, full-thread classification,
or draft ownership. The current free-trial billing state cannot be upgraded for
this pilot. Resume this phase only when an existing permitted entitlement can
meet the privacy and validation requirements.

## Phase 5 — Apple Shortcut

No token is provisioned and no Shortcut is installed. Keep
`CCC_SHORTCUT_INTAKE=false` and retain the owner-only test deployment. After the
private endpoint and token live acceptance tests are complete, use the exact
local action inventory in [Add to Command Center](../../shortcuts/ADD_TO_COMMAND_CENTER.md).
Do not change web-app access for a phone before invalid-token, replay, redaction,
and kill-switch behavior are evidenced.

## Phase 6 — Briefing and drafts

The deterministic briefing implementation writes only the private Sheet and has
no delivery transport. Keep `CCC_BRIEFING_DELIVERY=false`. Keep
`CCC_DRAFT_CREATION=false` and `CCC_DRAFT_REPLACEMENT=false`: there is no bound
draft provider or compose scope. No Gmail or Chat message, including a self
notification, may be sent.

## Phase 7 — Pilot evaluation

Live processing and unattended daily use are not accepted. After health and
probe checks, provider binding, Shortcut acceptance, and each single-feature test are
complete, collect the required working-week observations and human draft-usefulness
ratings. The 50 synthetic cases remain implementation evidence, not real-pilot
acceptance.

## Routine operations

Until live acceptance completes, the only routine operational action is to keep
the flags false and use the Sheet as a private initialized record. When resuming
after an interruption, run `cccHealth()` and then `cccDisableAll()` before any
new bounded test. Keep source context in Gmail and never copy bodies to Sheets,
logs, fixtures, or operational notes.

## Incident procedures

### Suspected Shortcut token exposure

There is no provisioned token today. If a token later exists and exposure is
suspected, run `cccDisableAll()`, keep the owner-only deployment private, inspect
content-free audit metadata, and follow the assisted rotation procedure before
any later test. Do not send a notification or delete unrelated data.

### Unexpected runtime behavior

Run `cccDisableAll()` from the authenticated Apps Script editor. Confirm every
flag is false and `managed_triggers_remaining` is zero. Preserve the private
workbook, source messages, drafts, and audit evidence. If code rollback is
needed, repoint only the private deployment to the previously verified version;
then run `cccDisableAll()` again. See [Runtime operations](RUNTIME_OPERATIONS.md).

### Source content or secret appears in a Sheet or log

Run `cccDisableAll()` and preserve minimal evidence without reproducing the
content. Stop further processing, identify the writer and affected range, and
fix the writer plus a regression test. Do not clear, overwrite, delete, or export
records under this runbook.

## Final evidence packet

Before claiming an accepted pilot, record the verified commit/version, local
check results, manifest/header check, private deployment posture, current flag
state, controlled live-check results, model-binding evidence, Shortcut acceptance
evidence, and unresolved gates. Include links to
[V1 execution](../implementation/V1_EXECUTION.md), [PMC current state](../../PMC/Current%20State.md),
and [runtime operations](RUNTIME_OPERATIONS.md). Never include resource IDs,
tokens, source content, or OAuth material.
