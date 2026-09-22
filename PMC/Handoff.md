# Morning handoff — Communication Command Center V1

Updated 2026-09-22. V1 is not yet accepted for daily unattended use.

## Current verified state

Version 5 deployed at 11:09 EDT from `ae5d2ef` to the private owner-only Apps Script
project. Source SHA `9a0ba51a70ac6d2d728581a00c3f31d407c2230176d65e7553e7cf59b6abf2af`
and semantic manifest SHA `6d2df263d5686e5b903c655da411ce96d4403c71d249321f220be50ce7f0689d`
match the verified build. Drift passed, `MYSELF`/`USER_DEPLOYING` access is unchanged,
and unauthenticated access redirects to Google sign-in. At 11:14:40 EDT, Version 5
`cccHealth` returned `ok:true`: all ten headers valid, all seven flags false,
`America/New_York`, and `send_capability:false`; no fresh trigger count is claimed. The
workbook has ten valid tabs in America/New_York and a private pre-activation backup.

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
At 09:50:20 EDT, `cccDisableAll` returned all seven flags off and zero managed triggers;
this remains the latest trigger-count evidence.

The [Gmail source snapshot 1.1](../docs/implementation/GMAIL_SNAPSHOT_V1_1.md) correction
handles valid RFC local-parts only in the transient source contract. It does not alter Sheet
schemas. Detailed historical Version 1–5 evidence is in the
[V1 execution record](../docs/implementation/V1_EXECUTION.md).

Private resource links and local deployment bindings remain in ignored
`.local/PILOT_RESOURCES.md`. OAuth files must never be shared or committed.

## Required continuation

1. Keep all features disabled while the next integration is prepared. Do not install a
   trigger or enable drafting from this pilot.
2. Studio's test add-on installation is verified: Test deployments shows Application
   Workspace Studio, an Uninstall button, and Installed add-ons, with no new scopes or
   consent. A reloaded empty manual flow titled `CCC V1 — bounded staging acceptance`
   has no CCC/custom add-on step after all visible categories were inspected. No action,
   run, source ID, or model input was added. Account UI/admin/rollout gating, actual step
   availability, starter binding, and model acceptance remain pending; the Admin passkey
   action is still pending.
3. Complete Shortcut token/device acceptance, then collect real pilot observations and
   user usefulness ratings over the required working week. Keep all communications unsent.

## Reference evidence

- Studio branch full local verification: 370 tests in 37 files passed. Gmail
  recovery PR #34 is merged; the Studio release PR is pending.
- [Runtime operations](../docs/runbooks/RUNTIME_OPERATIONS.md): deployment drift,
  disable and recovery procedures.
- [Shortcut installation](../shortcuts/SHORTCUT_INSTALLATION.md): safe setup template
  only; no export, network request, or token has occurred.
- [Synthetic evaluation](../docs/evaluation/SYNTHETIC_V1_REPORT.md): deterministic policy
  fixtures only; no real usefulness ratings.
- [Issue #32](https://github.com/CapturedByCam/communication-command-center/issues/32)
  tracks runtime/device/pilot acceptance; Gmail #21 and Studio #23 remain open.

## Disable and recover

Run `cccDisableAll` from the authenticated Apps Script editor. It sets every feature flag
false and removes only this app’s managed triggers. Preserve operational rows, source
messages and drafts. Restore only into a new workbook from the verified private backup;
do not clear production ranges. Revoke OAuth separately if access itself must be removed.
