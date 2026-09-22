# Morning handoff — Communication Command Center V1

Updated 2026-09-22. V1 is not yet accepted for daily unattended use.

## Current verified state

Version 4 deployed at 09:36 EDT from `fe558fc` to the private owner-only Apps Script
project. Its source/manifest drift verification passed, `MYSELF`/`USER_DEPLOYING` access
is unchanged, and unauthenticated access redirects to Google sign-in. The workbook has
ten valid tabs in America/New_York and a private pre-activation backup.

At 09:37:42 EDT, selected replay resolved the original controlled Gmail Dead_Letter as
`manual_gmail_replay`: Queue has one item, Audit_Log gained one row, and Config was
unchanged. The 09:41:34 cursor resume processed four further records with zero exclusions
or failures. Queue has five items, Audit_Log has eleven rows, the one Dead_Letter remains
resolved, and Config reports no pending or blocked retry while the bounded window remains
active. No send, draft, notification, trigger, or phone Shortcut installation occurred.

Resolve, unchanged-row replay, Reopen, and explicit-offset Snooze passed with
`manual_override:true` and atomic audit behavior. At 09:45:58 EDT, direct Reopen
correctly rejected the Snoozed row as `STALE_STATE`. The supported Resolve then Reopen
sequence restored the first row to `open` with `snooze_until:null` and
`manual_override:true`. Bounded proof confirms five Queue rows and eleven Audit_Log rows.
At 09:50:20 EDT, `cccDisableAll` returned all seven flags off and zero managed triggers.

The [Gmail source snapshot 1.1](../docs/implementation/GMAIL_SNAPSHOT_V1_1.md) correction
handles valid RFC local-parts only in the transient source contract. It does not alter Sheet
schemas. Detailed historical Version 1–4 evidence is in the
[V1 execution record](../docs/implementation/V1_EXECUTION.md).

Private resource links and local deployment bindings remain in ignored
`.local/PILOT_RESOURCES.md`. OAuth files must never be shared or committed.

## Required continuation

1. Keep all features disabled while the next integration is prepared. Do not install a
   trigger or enable drafting from this pilot.
2. Verify Studio’s current account capability after the required passkey action. Official
   custom Apps Script/webhook documentation is new evidence, but it does not prove this
   account can use the feature.
3. Complete Shortcut token/device acceptance, then collect real pilot observations and
   user usefulness ratings over the required working week. Keep all communications unsent.

## Reference evidence

- Full local verification: 355 tests in 34 files passed.
- [Runtime operations](../docs/runbooks/RUNTIME_OPERATIONS.md): deployment drift,
  disable and recovery procedures.
- [Synthetic evaluation](../docs/evaluation/SYNTHETIC_V1_REPORT.md): deterministic policy
  fixtures only; no real usefulness ratings.
- [Issue #32](https://github.com/CapturedByCam/communication-command-center/issues/32)
  tracks runtime/device/pilot acceptance; Gmail #21 and Studio #23 remain open.

## Disable and recover

Run `cccDisableAll` from the authenticated Apps Script editor. It sets every feature flag
false and removes only this app’s managed triggers. Preserve operational rows, source
messages and drafts. Restore only into a new workbook from the verified private backup;
do not clear production ranges. Revoke OAuth separately if access itself must be removed.
