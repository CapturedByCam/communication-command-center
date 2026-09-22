# Runtime Operations

This runbook covers the private Apps Script pilot. Standing authorization covers the
private owner-only deployment and bounded checks. Following the verified Version 4
guarded-control checks and Version 5 same-code health, `CCC_MANUAL_WRITES` alone is
enabled for guarded Queue actions. This runbook does not itself change a flag or trigger,
provision a Shortcut token, create a draft, deliver a notification, or send a Google
message.

## Private deployment posture

The checked-in manifest configures the web app with
`webapp.access: "MYSELF"` and `webapp.executeAs: "USER_DEPLOYING"`. That is a
private operator deployment: only the deploying operator can access it and it
runs as that operator. Immutable Version 7 is deployed with this configuration. Its `SERVER_JS`
source exactly matches `dist/Code.js` after LF normalization and its manifest
semantically matches `dist/appsscript.json`; see the chronological evidence in
[V1 execution](../implementation/V1_EXECUTION.md).

The current live posture is `CCC_MANUAL_WRITES:true`; the other six feature flags remain
false. Post-deployment editor `cccHealth` at 15:07:25 EDT returned `ok:true`, ten
valid headers, `America/New_York`, and `send_capability:false`; only
`CCC_MANUAL_WRITES` was true. The unfiltered Apps Script Triggers page showed
`Showing 0 triggers`. Do not create time-driven triggers, enable an automatic feature, or
enable drafting from this pilot. The manifest's Gmail scope is read-only; V1 has no send
path. Historical Version 1–4 checks, including all-off kill-switch and disabled-worker
evidence, remain below and in [V1 execution](../implementation/V1_EXECUTION.md).

On 2026-09-22, IAB Settings confirmed all seven flags false after the kill switch. A
single enabled Gmail batch then returned zero processed, four excluded and one failed;
it wrote one controlled `SNAPSHOT_INVALID` Dead_Letter row and a Config cursor while
Queue and Audit_Log remained headers-only. The kill switch passed again immediately.
A briefing-only run persisted eight sections and one history row with no delivery. That controlled failure was retained for recovery; the later Version 4 recovery and
duplicate behavior are recorded below.

The 09:05:45 EDT duplicate briefing call returned `duplicate` with the same briefing
ID, eight sections and no delivery. A bounded Sheet read confirmed both the projection
and history were unchanged. This verifies briefing replay suppression only; it does not
clear the Gmail intake diagnosis.

At 09:06:16 EDT `cccDisableAll` again returned no enabled flags and zero remaining
managed triggers. IAB showed the bound workbook's Command Center menu, and disabled
Reopen displayed the fixed disabled toast. Queue and Audit_Log were still headers-only.
Version 4 deployed at 09:36 EDT from `fe558fc`; immutable source/manifest drift,
owner-only deployment posture and the unauthenticated Google sign-in redirect passed.
At 09:37:42 EDT, selected replay resolved the original Dead_Letter as
`manual_gmail_replay`, created one Queue and one Audit_Log row, and left Config
unchanged. Resolve, unchanged-row replay, Reopen and explicit-offset Snooze then
passed with `manual_override:true`; the replay preserved the entire one-row Queue
exactly while adding an audit event. At 09:41:34 EDT, cursor resume processed four
records with zero exclusions or failures; Config reported no pending or blocked retry
while the bounded window remained active. Direct Reopen of the Snoozed row returned
controlled `STALE_STATE`; the supported Resolve then Reopen sequence restored it to
`open` with `snooze_until:null` and `manual_override:true`. Bounded proof found five
Queue rows and eleven Audit_Log rows. At 09:50:20 EDT, `cccDisableAll` returned all
seven flags off and zero managed triggers.

Keep automatic intake, drafting, Shortcut capture, and briefing delivery disabled. The
owner may use only the accepted guarded Queue controls under `CCC_MANUAL_WRITES`; do not
install a trigger or enable drafting from this pilot. The create-only draft-provider
slice merged in PR #36 after independent review and full checks; it remains unbound
and unscoped, pending a trusted context resolver and separate live provider acceptance.

## Offline deployment-drift check

Build the exact candidate first, then obtain a `projects.getContent` JSON
response through an approved read-only mechanism and save it under `.local/`.
That response may contain deployed source, so it must remain untracked and
private. This checker makes no network calls:

```sh
node scripts/check-deployment-drift.mjs \
  --content .local/apps-script-project-content.json \
  --dist dist
```

It compares `dist/Code.js` with the sole deployed `SERVER_JS` file after LF
normalization, compares `appsscript.json` semantically, and rejects missing or
additional runnable `SERVER_JS` or `HTML` files. Its output contains statuses
and SHA-256 values only; it never prints deployed source. `STATUS=drift` or
`STATUS=invalid` stops deployment investigation until the mismatch is resolved.

## Workbook backup and restore

Before any pilot operation that could change Sheet metadata, create a private
backup copy in the verified account. Verify the source workbook ID, the new
backup resource ID, access restrictions, and that the original remains
unchanged. Record only approved operational identifiers in private records.

Restore by creating a **new** private workbook resource from the approved
backup. Validate its manifest headers and empty/sanitized state before binding
any new pilot deployment. Never overwrite, clear, replace, or import into an
existing workbook as a restore procedure.

## Rollback

If a private deployment behaves unexpectedly, first run `cccDisableAll()` in the authenticated Apps Script editor to turn off
flags and remove managed triggers.
Do not point an older version at the migrated 1.1 active workbook. Preserve
it and verify a new private copy of the pre-migration backup before coordinating
any Version 6-or-older deployment and workbook binding. Run `cccDisableAll()`
again after recovery when available, and verify all flags are false and managed
trigger count is zero.

Rollback does not notify Google contacts, send messages, delete Gmail drafts,
delete source messages, or delete workbook records. Preserve logs and the
private backup for diagnosis. Re-enabling any flag, trigger, or changing deployment access requires the
applicable live-test evidence. Preserve owner-only access.

## Guarded Queue operations

Use the owner-only Command Center menu after its live acceptance checks. Select
one Queue data row, then Resolve, Reopen, Snooze or Set waiting state. Waiting accepts
exactly `me`, `them`, `none`, or `unknown` for open/snoozed items and preserves status.
An identical waiting value is a no-op. Version 6 live change/retry/restoration passed,
leaving five Queue rows and thirteen Audit_Log rows. Snooze requires a future ISO
timestamp with a numeric offset. `CCC_MANUAL_WRITES` defaults false and
`cccDisableAll` disables it. The command checks owner and enablement before reading
Queue and again after the prompt within the shared lock. It rejects a changed row
and atomically commits Queue plus Audit_Log. Controlled toasts report the result.

Prefer these controls for status updates while workers are active. The Sheets API
has no atomic compare-and-swap against a simultaneous raw manual Sheet edit; the
shared Script Lock coordinates application writers only. Do not interpret these
controls as protection against concurrent edits made directly in the grid.
