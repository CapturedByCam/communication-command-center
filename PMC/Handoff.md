# Morning handoff — Communication Command Center V1

Updated 2026-09-22. V1 is not yet accepted for daily unattended use.

## Working now

The private Queue has five metadata-pilot items. Owner-only Version 6 is deployed
from `e23ee3a`, with source/manifest drift verified and unchanged private access.
At 12:12:37 EDT editor health passed all ten headers, New York time, no send capability,
and only `CCC_MANUAL_WRITES` enabled. The latest unfiltered trigger check found zero;
the 12:05:53 disable drill also confirmed zero managed triggers.

Select one Queue row and use **Resolve**, **Reopen**, **Snooze**, or **Set waiting
state**. All use owner/flag checks, full-row conflict detection, the shared lock,
manual-override preservation and atomic audit. Waiting input accepts exactly
`me`, `them`, `none`, or `unknown` for open/snoozed items. Its live change/retry/
restoration passed at 11:56 EDT; five Queue and thirteen audit rows remain. The
first row is restored to open / unknown / manual override, with no snooze.

The disable-first deployment drill switched Version 6 to retained Version 5 and
back, verifying each immutable build and unchanged owner-only access. Queue/Audit
snapshots were exact afterward. A separate private copy of the pre-activation
backup passed all ten exact manifest headers and New York time checks. This
headers-only recovery point does not establish populated-data recovery; the
active workbook was never repointed or overwritten. The integrated hardening
candidate passed 393 tests plus all repository verification checks.

Use [Run comms](../docs/runbooks/RUN_COMMS.md) for private source review and unsent
reply text. The existing briefing projection predates current Queue items;
review Queue directly until a fresh accepted briefing is available. Gmail's
initial 30-day cursor is incomplete and intake remains disabled.

## Remaining work and user action

- Complete the pending Google Admin passkey action and resolve Workspace Studio
  custom-step availability. The private test add-on is installed, but the own
  manual flow has no available CCC step, action, source binding or run.
- Bind a privacy-compatible interpretation provider within an existing permitted
  entitlement. Prove real source IDs, strict validation, outbound-promise
  Commitments, draft eligibility and useful output. The create-only native draft
  provider is merged in PR #36 but unbound; compose authorization/live acceptance
  remain open. Replacement and deletion stay unsupported to preserve human edits.
- Finish the local [Shortcut installation](../shortcuts/SHORTCUT_INSTALLATION.md)
  when native device access is available. Only a setup-blocked template exists;
  no token, endpoint, export or live capture was configured. Prove the endpoint's
  write-only authentication and invalid-token/replay/rate-limit/kill-switch behavior
  before capture. Owner-only web deployment is not phone acceptance.
- After bindings pass, collect the required real working-week observations and
  human usefulness ratings. Fifty passing synthetic cases cannot replace them.

These are account, provider, device and elapsed-pilot gates. Do not enable an
unverified feature, install a trigger, spend money or send a Google message to
work around them. Codex coordination and the standing V1 implementation/review
and deployment authorization remain valid.

## Evidence and access

- [Current State](Current%20State.md): exact deployed hashes and feature posture.
- [V1 execution](../docs/implementation/V1_EXECUTION.md): chronological live evidence.
- [Shortcut token rotation](../docs/runbooks/SHORTCUT_TOKEN_ROTATION.md): disable-first
  procedure and synthetic retired/current-token regression; live device gate remains.
- [Runtime operations](../docs/runbooks/RUNTIME_OPERATIONS.md): verified access,
  deployment drift, backup and rollback.
- [Issue #32](https://github.com/CapturedByCam/communication-command-center/issues/32):
  open runtime/device/pilot acceptance; Gmail #21 and Studio #23 remain open.
- Private Queue, backup, restore copy, Script and deployment links: ignored
  `.local/PILOT_RESOURCES.md` in the durable project folder. Do not commit or share
  OAuth files, token-bearing Shortcuts, source contents or private resource IDs.

## Disable and recover

Run `cccDisableAll` in the authenticated Apps Script editor to disable every flag
and remove only this app's managed triggers. Verify the controlled all-off result.
For code rollback, repoint the existing private deployment to verified Version 5
and verify immutable version/source and private access. Editor health runs current
project code, so it does not prove execution of the deployed older version. Restore workbook data
only into a new private copy of the verified backup. Preserve current rows,
source messages, drafts and audit evidence. Nothing in this procedure sends a
message or clears records.
