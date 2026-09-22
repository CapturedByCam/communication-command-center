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

## Prepared Commitment storage release

The source implements version 1.1 persisted outbound message/evidence IDs,
observation time, a manual resolver and date-review status. A guarded writer
validates selected outbound metadata before an atomic Commitment/audit write.
The explicit migration appends headers only to an unchanged empty legacy table;
populated legacy rows stop without mutation. Briefing reads real persisted
provenance. See [storage release](../docs/implementation/COMMITMENT_STORAGE.md).
This is not deployed or provider-bound. Current Version 6 and private table data
are unchanged; do not run the new source against old headers without the
coordinated migration gate. Automatic promise extraction is still required.
The integrated candidate passed 404 tests across 42 files, formatting, lint,
type checking, schema validation, bundle build and planning validation. The exact
verify subcommands ran directly against installed dependencies because pnpm
attempted an unnecessary shared-module reinstall. Independent review found no actionable material issues; required CI remains the merge gate.

## Remaining work and user action

- Resolve Workspace Studio custom-step availability. Admin is authenticated, but
  CapturedByCam root Custom steps access is OFF and enabling it awaits action-time
  confirmation. The historical custom-step absence is distinct from the current
  synthetic-only manual Ask Gemini run at 12:26:22 EDT; it has no source binding,
  custom step, or Google mutation. Its 12-field output passed strict schema validation;
  a pure synthetic unknown-contact staging call was review-only with no persistence or
  provider call. Stored synthetic output visibility for 40 days does not resolve input
  retention. Project evidence, retention meaning, starter binding, and usefulness remain open.
- Bind a privacy-compatible interpretation provider within an existing permitted
  entitlement. Prove real source IDs, strict validation, outbound-promise
  Commitments, draft eligibility and useful output. The create-only native draft
  provider is merged in PR #36 but unbound; compose authorization/live acceptance
  remain open. Replacement and deletion stay unsupported to preserve human edits.
- Finish the local [Shortcut installation](../shortcuts/SHORTCUT_INSTALLATION.md)
  using the now-accessible native editor. A safe setup-blocked export is saved
  locally, but no token, endpoint or live capture was configured. Prove the endpoint's
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

## Current release state

Bounded chronology PR #42 is merged at `4789030589d1f0168aff87de788f29dd80155e85`;
review, required CI and CodeQL passed. Local required checks passed, including
423 tests across 45 files. Live deployment remains Version 6. A fresh private
pre-migration backup is verified and its ID is in ignored
`.local/PILOT_RESOURCES.md`.

Live migration is waiting for authenticated Apps Script editor control. Scoped
`clasp` credentials identify the approved account, but `clasp run cccHealth`
returned storage `NOT_FOUND`, and no authenticated editor control path is
available in this environment.
No flags/triggers or full Commitments rows were verified, and no disable,
migration, source push or deployment occurred. Resume with read-only status and
flags/triggers check, then run `cccDisableAll`, verify the full table is empty,
run `cccMigrateEmptyCommitments`, verify the 17-column header/health, and deploy
a private version with the approved safe flags only. Stop for a populated table.
See [chronology](../docs/implementation/BOUNDED_GMAIL_CHRONOLOGY.md) and
[Commitment migration](../docs/implementation/COMMITMENT_STORAGE.md).
