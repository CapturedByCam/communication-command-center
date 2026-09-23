# Morning handoff — Communication Command Center V1

Updated 2026-09-22 (evening EDT). V1 is not yet accepted for daily unattended use.

## Working now

The private Queue has five metadata-pilot items. The existing owner-only
deployment now points to immutable Version 9, with the 1.1
Commitments workbook migration complete. At 15:07:25 EDT editor health passed
all ten headers, New York time and no send capability, with only
`CCC_MANUAL_WRITES` enabled. The unfiltered trigger check found zero.

Select one Queue row and use **Resolve**, **Reopen**, **Snooze**, or **Set waiting
state**. All use owner/flag checks, full-row conflict detection, the shared lock,
manual-override preservation and atomic audit. Waiting input accepts exactly
`me`, `them`, `none`, or `unknown` for open/snoozed items. Its live change/retry/
restoration passed at 11:56 EDT; five Queue and thirteen audit rows remain. The
first row is restored to open / unknown / manual override, with no snooze.

PR #47's reviewed Shortcut guards and PR #52's controlled Gmail diagnostics are
in the existing owner-only deployment as Version 9. Its immutable code and
manifest match reviewed commit `379474d`. The separate Shortcut deployment is
now Version 11, after PR #55 merged at `7229003` with repository verification
and CodeQL checks passing. Version 11 has `ANYONE` access and owner execution;
Version 9 remains owner-only. Its lock-protected pre-authentication cap limits
requests to ten per minute globally (including valid requests); Apps Script
does not expose a trustworthy caller address, so this does not eliminate
denial-of-service risk.

The disable-first deployment drill switched Version 6 to retained Version 5 and
back, verifying each immutable build and unchanged owner-only access. Queue/Audit
snapshots were exact afterward. A separate private copy of the pre-activation
backup passed all ten exact manifest headers and New York time checks. This
headers-only recovery point does not establish populated-data recovery; the
active workbook was never repointed or overwritten. The integrated hardening
candidate passed 393 tests plus all repository verification checks.

Use [Run comms](../docs/runbooks/RUN_COMMS.md) for private source review and unsent
reply text. A fresh eight-section `Briefing_View` was generated on 2026-09-22 for
the five current Queue items with `delivery_channel=none`; the briefing flag is
off again. A later bounded Gmail sweep advanced six enumeration pages, then
returned a generic failure before processing. Queue and Dead_Letter matched the
private pre-sweep backup at that point. Cam completed `clasp` login; the exact
reviewed bundle was synced and deployed. One bounded diagnostic invocation at
20:04 EDT returned `status:more`, with zero processed, excluded or failed rows.
It advanced the enumeration but did not reproduce or explain the earlier error.
At 20:05 EDT, Gmail intake was off, the checkpoint remained in enumeration, and
the initial 30-day window was incomplete. The unfiltered Triggers page showed
zero. The later bounded continuation is recorded below and in [V1 execution](../docs/implementation/V1_EXECUTION.md);
the original error cause remains unknown and the checkpoint must not be reset.

## Commitment storage release

Version 7 includes 1.1 persisted outbound provenance, a guarded observation
writer, bounded chronology and briefing validation. The empty-only migration
returned `migrated` once at 14:58 EDT. Direct Sheet reads verified the exact
17-column Commitment header and no populated rows. Queue and Audit_Log rows
matched the verified pre-migration backup. The immutable Version 7 bundle and
manifest matched the reviewed build; the existing deployment retained private
owner-only access. Automatic promise extraction and reconciliation remain
unbound. See [storage release](../docs/implementation/COMMITMENT_STORAGE.md).

## Remaining work and user action

- Workspace Studio custom-step availability is resolved. On 2026-09-22 Cam
  approved turning ON Custom steps access for the CapturedByCam root OU while
  retaining unpublished test steps. The private CCC step appeared in the picker.
  PR #45 removed an unused locale permission option; the same manifest field
  was removed in the authenticated script editor and saved. The configuration
  card now opens with Gmail ID and bounded JSON fields. The manual synthetic
  flow includes that unconfigured Step 3 but has not run it. CCC_STUDIO_PROCESSING
  is false. Real source binding, model usefulness, and exact resolved-input/source
  retention remain open; do not feed real private content until that gate is
  resolved. The existing owner-only web deployment is now Version 9; the
  Studio step remains unrun.
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
Do not repoint Version 6 or older at the migrated active workbook: their
legacy Commitment contract is incompatible. For an older-runtime recovery,
restore the private pre-migration backup into a **new** private workbook, verify
it, then coordinate the deployment and binding under the runbook. Editor health
runs current project code and does not prove older deployed-version execution. Preserve current rows,
source messages, drafts and audit evidence. Nothing in this procedure sends a
message or clears records.

## Current release state

Bounded chronology PR #42 and migration-order PR #43 are merged after review
and required CI. The fresh pre-migration backup is verified and retained
privately. On 2026-09-22, all controls and managed triggers were disabled;
the complete Commitment data range was empty. The reviewed source was pushed,
the guarded 1.1 migration succeeded once, and the exact header plus empty rows
were verified directly. Immutable Version 9 matches the reviewed source and
manifest, and the existing owner-only deployment points to it. Only previously
accepted manual Queue controls remain enabled. Final editor health passed, and
no trigger or send capability is active.

Remaining blockers are the privacy-compatible real interpretation provider and
Workspace Studio retention/source-binding decision, compose authorization and draft
acceptance, local Shortcut endpoint/device setup, then a real working-week
pilot. See [Current State](Current%20State.md) and
[V1 execution](../docs/implementation/V1_EXECUTION.md).

Cam's Google Admin allowlist change for `script.googleusercontent.com` is locally
applied. Chrome's site details show Insecure content set to Allow; opening the
active Version 11 endpoint in Chrome now returns only the fixed
`method_not_allowed` response for a read-only GET. This clears the browser
reachability check but does not test an authenticated Shortcut POST. No write
request was sent. The previous synthetic anonymous POST returned `disabled`
while Shortcut intake was off. No token is provisioned, no Shortcut endpoint or
device capture has been configured, and device acceptance remains open. Keep
intake and all other automatic features disabled. See the latest dated evidence
in [V1 execution](../docs/implementation/V1_EXECUTION.md).

## 2026-09-22 live acceptance continuation

Chrome reachability is now verified after the Admin allowlist change: the
Version 11 endpoint returns its fixed safe rejection for a browser GET. This
does not establish authenticated Shortcut acceptance. One bounded manual Gmail
reconciliation call processed one item; the durable version 2 checkpoint is
still in processing at `nextThread=8` across 12 reference shards, with no
retry or error. The Gmail feature flag is off again. The post-run health check
passed all ten workbook headers, New York time and no-send capability, and the
Apps Script Triggers page showed zero triggers. Only guarded manual Queue
controls are enabled. No Google email, message or draft was sent or created.

Continue the bounded Gmail window only one manual invocation at a time, checking
the checkpoint before each run and returning `CCC_GMAIL_INTAKE` to false after
each invocation. Leave the window open if a retry/error appears; do not reset
its cursor. Before daily-use acceptance, resolve the Studio source-binding and
retention question, bind and verify draft creation without enabling send, finish
Shortcut token/device acceptance, and collect the required real working-week
observations and human usefulness ratings. Synthetic results do not satisfy
those live gates. Keep automatic features off.
