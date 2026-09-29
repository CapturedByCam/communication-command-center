# Morning handoff — Communication Command Center V1

Updated 2026-09-23 (15:36 EDT). V1 is not yet accepted for daily unattended use.

## Working now

The Mac **Add to Communication Command Center** Shortcut and its authenticated
write-only endpoint passed synthetic acceptance at about 13:40 EDT. The token is
stored only in Script Properties and the local Shortcut. Disabled,
invalid-token, fixed-UUID duplicate, oversized-body, rate-limit, and installed
device capture checks passed. Queue now has 147 data items, including three
synthetic `apple_share_sheet` acceptance rows; two came from the installed Mac
Shortcut. The final action chain is Share Sheet input, non-administrator `zsh`,
and status-only Show Result. Shortcut intake is false again. Do not export the
working token-bearing Shortcut. This does not establish an iPhone/iPad install.

The optional 30-day metadata backfill was stopped at Cam's direction after 135
of 193 unique threads. Its preserved checkpoint is `phase=processing`,
`nextThread=135`, across 12 shards, with no retry or error. Gmail intake is off.
Do not resume the checkpoint unless Cam asks.

A new private populated-data recovery workbook is verified. It copied no
collaborators or comments, remains Restricted to Cam as sole owner, uses Eastern
time, and matches the active workbook across all 11 normalized sheet
fingerprints. The active workbook was not overwritten or rebound. Its private
resource ID is recorded only in ignored `.local/PILOT_RESOURCES.md`.

The current populated Queue has fresh briefing acceptance. A 12:34 EDT
on-demand run generated eight sections for 144 unique items with delivery set to
none; its immediate replay returned `duplicate` with the same briefing ID.
Pre/post exports show one append only: 153 projection rows and one history row,
with every other sheet unchanged. Briefing delivery is off again, and the 12:36
health check passed all headers with no send capability and all automatic flags
false.

Before Shortcut acceptance, the private Queue had 144 metadata items after the
accepted Gmail pilot and partial optional backfill. The current total is 147 as
recorded above. The five-item manual-control evidence below is the earlier
acceptance baseline. The existing owner-only
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

- Workspace Studio custom-step availability and literal-source staging are
  resolved. The private CCC step passed a disabled run, one eligible literal
  Gmail-resource staging run, an identical replay, and a changed-immutable-input
  replay. Exactly one metadata-only `Studio_Inbox` row exists from these checks;
  duplicate and conflict runs added nothing, and `Audit_Log` stayed unchanged.
  `CCC_STUDIO_PROCESSING` is false again, the live resource ID was removed from
  the saved flow, and the final disabled run made no further write. A separate
  disabled draft flow now binds the Gmail starter's `Email ID` variable to the
  private step and retains that binding after reopen. It was not run or turned
  on. Live starter-variable resolution, useful real-message interpretation, the
  mid-invocation flag-off path, and exact resolved-input/source retention remain
  open. Do not feed real message content into Studio until retention is accepted.
- Bind a privacy-compatible interpretation provider within an existing permitted
  entitlement. Prove real source IDs, strict validation, outbound-promise
  Commitments, draft eligibility and useful output. A local selected-row runtime
  now binds the create-only provider to the exact Queue row, curated contact and
  bounded interpretation, with fresh source, recipient, kill-switch and pending
  reservation rechecks at the provider boundary. A successful create projects
  `generated` and the draft ID to the unchanged Queue row. It is not deployed and
  the manifest still has no compose scope. Minimum compose authorization and one
  live unsent-draft acceptance remain open. Replacement and deletion stay
  unsupported to preserve human edits.
  The remediated candidate passed 446 tests in 46 files and every required local
  verification check. Final independent review found no remaining merge blocker;
  hosted checks remain before merge.
- The local Mac [Shortcut installation](../shortcuts/SHORTCUT_INSTALLATION.md)
  is accepted. Keep its token private and `CCC_SHORTCUT_INTAKE` off outside
  deliberate captures. The working Shortcut must not be exported or shared.
  A future iPhone/iPad install needs its own synthetic acceptance.
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
  procedure and synthetic retired/current-token regression; the Mac device gate is closed.
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

Remaining blockers are Workspace Studio live starter resolution, useful
real-message interpretation and retention, compose authorization and draft
acceptance, then a real working-week pilot. The Mac Shortcut gate is closed. See
[Current State](Current%20State.md) and
[V1 execution](../docs/implementation/V1_EXECUTION.md).

Cam's Google Admin allowlist change for `script.googleusercontent.com` is locally
applied. Chrome's site details show Insecure content set to Allow; opening the
active Version 11 endpoint in Chrome now returns only the fixed
`method_not_allowed` response for a read-only GET. This clears the browser
reachability check. The later September 23 authenticated endpoint and Mac device
acceptance supersedes the earlier GET-only status. Keep intake and all other
automatic features disabled outside deliberate bounded use. See the latest dated
evidence in [V1 execution](../docs/implementation/V1_EXECUTION.md).

## 2026-09-22 live acceptance continuation

At the September 22 checkpoint, Chrome reachability was verified after the Admin allowlist change: the
Version 11 endpoint returns its fixed safe rejection for a browser GET. This
did not yet establish authenticated Shortcut acceptance; the September 23
acceptance recorded above supersedes it. One bounded manual Gmail
reconciliation call processed one item; the durable version 2 checkpoint is
still in processing at `nextThread=9` across 12 reference shards, with no
retry or error. A later single call processed one item with zero exclusions or
failures; the Gmail feature flag is off again. The post-run health check passed
all ten workbook headers, New York time and no-send capability, and the Apps
Script Triggers page showed zero triggers. Only guarded manual Queue controls
are enabled. No Google email, message or draft was sent or created. The fresh
Admin UI readback is paused at Google's passkey step-up; earlier Chrome site
details showed Insecure content allowed, and the safe browser GET passed.

This paragraph records the September 22 state and is superseded by the later
Gmail and Shortcut acceptance sections. Before daily-use acceptance, resolve
the Studio source-binding and retention question, bind and verify draft creation
without enabling send, and collect the required real working-week observations
and human usefulness ratings. Synthetic results do not satisfy those live
gates. Keep automatic features off.

## 2026-09-23 Gmail pilot handoff

Cam confirmed the initial pilot window is seven days. Defer the separate
30-day backfill until this pilot is working and accepted. Multiple bounded
manual batches returned `status=more`; a later batch stopped with sanitized
`google_api_failure`. The precise failing Google API response is unknown, and
the seven-day run is incomplete. A read-only one-message metadata probe passed
within the seven-day bound, stored no raw content, and made zero mutations.
Post-run `cccHealth` passed all ten headers, New York time and no-send checks;
all automatic flags are off and only `MANUAL_WRITES` is on. No message or draft
was sent or created.

Next: diagnose the Google API failure from safe metadata/logging,
without resuming writes until the cause is understood. Do not reset the cursor
or start a 30-day backfill. Preserve the all-automatic-flags-off state.

07:00 EDT triage corrected the likely origin: the outer `google_api_failure`
cannot be attributed to the per-message Gmail read from this label. The reader
converts Gmail provider exceptions; Sheets values and spreadsheet metadata reads
can escape with that label. The 01:33:19 execution log has no raw error. A
content-free source diagnostic is prepared separately and passes focused bundle
tests, but is not deployed. `clasp run cccHealth` currently fails before script
execution with storage `NOT_FOUND`; browser editor health at 01:35 remains the
last confirmed live check. Preserve the seven-day cursor and all automatic
features off. Resolve the execution access issue, verify exact deployed source
and current flags, then use read-only Sheets probes or the reviewed fixed
diagnostic before considering another reconciliation invocation.

## 2026-09-23 Phase 1 final handoff

The seven-day Gmail pilot is complete and its cursor was never reset. PRs #60,
#61, and #62 diagnosed the failure as a sanitized Sheets values read, exposed
only the affected table/read target, and removed redundant all-table preflight
reads from each bounded invocation. The reviewed source was deployed to the
approved project with exact code readback; owner-only access was preserved.

The fixed window contains four reference shards, 65 message references, and 53
unique threads. The final checkpoint is `phase=complete`, `nextThread=53`,
`completedThrough=2026-09-23T04:55:06.000Z`, with no retry or error. The final
invocation returned `status=complete` and `failed=0`. Gmail intake is off again.
The 10:11 EDT health run passed all ten headers, New York time, all automatic
flags off, and no send capability; `MANUAL_WRITES` is the only enabled control.
No Google message or Gmail draft was sent or created.

Phase 1 / Milestone 3 is closed. The later optional 30-day backfill is preserved
at `nextThread=135` and intentionally stopped. Populated-data recovery is
verified. The Mac Shortcut token/device gate is now also closed. The remaining
issue #32 gates are Studio starter/model acceptance, create-only draft
authorization and acceptance, and the real working-week evaluation. The current
briefing and its same-input duplicate behavior are accepted. Do not enable
automatic processing or any send path for those phases.

## 2026-09-23 selected-row draft release

PR #74 merged at `a95e914`. The reviewed selected-row draft runtime and
`gmail.compose` manifest scope are deployed as Version 14 on the existing
owner-only Gmail deployment. Live Script Properties readback shows
`CCC_DRAFT_CREATION=true`, `CCC_GMAIL_LOOKBACK_DAYS=7`, and
`CCC_GMAIL_INTAKE=false`; automatic Studio processing, draft replacement,
Shortcut intake, and briefing delivery remain off. The unfiltered Apps Script
Triggers page shows zero triggers. The separate Version 11 public Shortcut
deployment was not changed.

The Version 14 deployment was confirmed as `Execute as Me` / `Only myself`.
During redeployment, Apps Script briefly applied the manifest's `Anyone`
setting; it was immediately restored and the final live readback confirmed
`Only myself`. No action in this workflow called the endpoint or performed an
outbound communication. At the Google OAuth layer, `gmail.compose` permits
sending as well as draft management, but the reviewed runtime has no send
operation. No Gmail draft, email, or message has been created or sent. Cam must
review and grant the Google consent prompt if it appears at first invocation.

Next for the first live draft: in the pilot spreadsheet, select exactly one
eligible row on `Queue`, choose **Communication Command Center → Create unsent
draft for selected Queue row**, paste the strict bounded interpretation JSON,
then paste the reviewed plain-text draft. The final OK creates only one unsent
draft if the runtime's eligibility and kill-switch checks still pass. Keep the
30-day backfill paused and leave Gmail intake, Studio processing, triggers, and
all send paths off. Studio/model acceptance and the real working-week usefulness
evaluation remain open; V1 is not accepted for unattended daily use.
