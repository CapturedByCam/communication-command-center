# Current State

Updated 2026-09-22.

## Verified position

- The authorized V1 release integrates private Sheets/Gmail runtime adapters, guarded
  synchronous Shortcut intake, commitments/deadlines, deterministic briefing, privacy
  tests and operational tooling. Required GitHub checks and reviews remain protected.
- The private pilot workbook has ten valid manifest tabs in America/New_York, a private
  pre-activation backup, and only the approved owner. Sheets hold bounded operational
  metadata, never bodies or credentials.
- Immutable owner-only Version 5 deployed at 11:09 EDT from `ae5d2ef`. Its source
  SHA `9a0ba51a70ac6d2d728581a00c3f31d407c2230176d65e7553e7cf59b6abf2af` and semantic
  manifest SHA `6d2df263d5686e5b903c655da411ce96d4403c71d249321f220be50ce7f0689d` match the
  verified build. Drift passed with unchanged `MYSELF`/`USER_DEPLOYING` access and an
  unauthenticated Google sign-in redirect. At 11:14:40 EDT, Version 5 `cccHealth`
  returned `ok:true`: all ten headers valid, all seven flags false,
  `America/New_York`, and `send_capability:false`. No fresh trigger count is claimed.
- At 09:37:42 EDT, selected replay of the original controlled Gmail Dead_Letter
  succeeded. Queue now has one item; Audit_Log has one new row; the same Dead_Letter is
  resolved as `manual_gmail_replay`; Config is unchanged. The 09:41:34 cursor resume
  then processed four records with zero exclusions or failures. Queue has five items,
  Audit_Log has eleven rows, the one Dead_Letter remains resolved, and Config records
  no pending or blocked retry while the window remains active.
- Guarded Resolve, unchanged-row replay, Reopen and explicit-offset Snooze have passed
  with `manual_override:true` and atomic audit behavior. At 09:45:58 EDT, direct Reopen correctly rejected the Snoozed row as
  `STALE_STATE`, leaving it unchanged. The supported Resolve then Reopen sequence restored the first
  row to `open` with `snooze_until:null` and `manual_override:true`. Bounded proof
  confirms five Queue rows and eleven Audit_Log rows.
- At 09:50:20 EDT, `cccDisableAll` returned all seven flags off and zero managed
  triggers. The later Version 5 health check again found all flags false; no later
  trigger count is claimed. All tested features are currently disabled.
- The accepted transient [Gmail source snapshot 1.1 decision](../docs/implementation/GMAIL_SNAPSHOT_V1_1.md)
  corrects valid RFC local-part handling without changing stored Sheet schemas. The
  detailed Version 1–5 evidence is in the [V1 execution record](../docs/implementation/V1_EXECUTION.md).
- No message send, draft creation, trigger installation, Google notification, or
  installed phone Shortcut is claimed. The Gmail pilot remains metadata-only and generic
  needs-review; it does not imply full-thread interpretation or draft readiness.

## Accepted decisions

- Standing authorization covers the private deployment, in-scope tests and reviewed
  merges. The remaining bounded acceptance actions need verified state and eligible data,
  not a separate approval.
- The sole mailbox is `contact@elev8mediaky.com`; the initial lookback is 30 days; all
  relative dates use America/New_York.
- Code owns validation, IDs, chronology, persistence, retries and manual overrides.
  Model output is untrusted and drafts require ownership/freshness checks.
- Briefing generation writes the private Sheet only; no delivery transport exists.

## Current gates

1. Keep all features disabled while the next integration is prepared. Do not install a
   trigger or enable drafting from this pilot.
2. Studio test add-on installation is verified in Test deployments: Application shows
   Workspace Studio, the button is Uninstall, and Installed add-ons is present. It added
   no scopes or consent. A freshly reloaded Studio flow, `CCC V1 — bounded staging
   acceptance`, has only a manual starter and no CCC/custom add-on entry after its step
   categories were inspected; no action, run, source ID, or model input was added. The
   empty draft scaffold leaves account UI/admin/rollout gating, actual step availability,
   starter binding, and model acceptance unresolved; the Admin passkey action is pending.
3. Complete local Shortcut token/device acceptance and collect the required real-world
   pilot observations and usefulness ratings. Synthetic fixtures do not replace them.

## Decision and operating records

- [Handoff](Handoff.md)
- [Runtime operations](../docs/runbooks/RUNTIME_OPERATIONS.md)
- [Deployment runbook](../docs/runbooks/DEPLOYMENT_AND_OPERATIONS_RUNBOOK.md)
- [Synthetic evaluation](../docs/evaluation/SYNTHETIC_V1_REPORT.md)
