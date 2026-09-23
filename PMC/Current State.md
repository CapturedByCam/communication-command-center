# Current State

Updated 2026-09-23 (midday EDT). V1 is not accepted for unattended daily use.

## Verified position

- A new private populated-data recovery workbook was created without copying
  collaborators or comments. Direct UI readback showed Restricted access with
  Cam as the sole owner, United States locale, and Eastern time. Fresh XLSX
  exports of the active and recovery workbooks contained the same 11 sheets;
  normalized cell/formula data, merged ranges, freeze panes, and dimensions
  matched on every sheet. The active workbook was not overwritten or rebound.
  The private recovery resource ID is recorded only in ignored
  `.local/PILOT_RESOURCES.md`.
- Cam accepted stopping the optional 30-day metadata backfill at 135 of 193
  unique threads. Its version 2 checkpoint remains intentionally resumable at
  `phase=processing`, `nextThread=135`, across 12 shards, with
  `completedThrough=2026-09-23T04:55:06.000Z` and no retry or error. The last
  bounded batch recovered from one transient spreadsheet metadata-read failure
  and returned `status=more`, eight steps, six processed, two excluded, and zero
  failed. `CCC_GMAIL_INTAKE` is false. Do not resume unless Cam asks.

- The separate Shortcut deployment is now active as Version 11 with the reviewed
  pre-authentication rate guard; PR #55 merged at `7229003` after independent
  review and passing repository verification and CodeQL checks. Version 11 is
  `ANYONE` / `USER_DEPLOYING`; the original Version 9 owner-only deployment is
  still separate and unchanged. The global lock-protected cap rejects after
  ten requests per minute before parsing, including valid requests, which also
  limits one user's capture rate; Apps Script does not expose a trustworthy
  caller address, so this is not full denial-of-service protection.
  After Cam's Google Admin allowlist change for `script.googleusercontent.com`,
  Chrome's site details showed Insecure content set to Allow. Opening the
  Version 11 URL in Chrome reached the content host and returned only the fixed
  `method_not_allowed` JSON for GET. This confirms the browser route and safe
  GET rejection; it does not validate authenticated Shortcut POST or device
  acceptance. No write request was sent. A live `cccHealth` check passed all
  ten headers, New York time and no send capability; all six automatic flags
  were false, `MANUAL_WRITES` alone was true, and the unfiltered Triggers page
  showed zero triggers.
- Existing owner-only Apps Script deployment now points to immutable Version 9
  (2026-09-22, about 20:02 EDT), with PR #52's controlled Gmail diagnostic
  labels. The immutable code and manifest match reviewed commit `379474d`.
  Execution remains as the owner and access stays `MYSELF`; the deployment URL
  and access scope were unchanged. Earlier Version 7 and 8 releases remain in
  the execution history.
  Version 6 cannot directly run against the migrated 1.1 workbook; see the
  recovery gate below.
- At 15:07:25 EDT, editor `cccHealth` returned `ok:true`: ten valid headers,
  `America/New_York`, `MANUAL_WRITES:true`, the other six flags false, and
  `send_capability:false`. The unfiltered Triggers page showed zero triggers.
  Only previously accepted guarded manual Queue controls are enabled.
- Cam explicitly approved anonymous access for a separate Shortcut endpoint.
  Historical Version 10 was deployed as `ANYONE_ANONYMOUS` / `USER_DEPLOYING`;
  Version 11 now supersedes it, while the existing owner-only Version 9 remains
  unchanged. Unauthenticated GET returns only the
  fixed method-not-allowed rejection. At 20:39:47 EDT, editor health passed all
  ten headers, New York time, no send capability, Gmail/Studio/Shortcut/draft/
  briefing flags false and `MANUAL_WRITES` true. A synthetic unauthenticated
  POST returned the expected `disabled` response after following Google's
  content redirect, with intake off and no mutation. No token was configured
  and no Shortcut/device acceptance occurred. The
  endpoint deployment URL is in the ignored private `.local/PILOT_RESOURCES.md`.
- At 17:53:21 EDT, the Version 8 editor `cccHealth` again returned `ok:true`:
  all ten sheet headers valid, `America/New_York`, `send_capability:false`,
  and all automatic processing, intake, draft, replacement, and delivery flags
  false. `MANUAL_WRITES` remains the sole true flag. No trigger or message
  action was installed or invoked.
- The private workbook has ten manifest tabs and a verified private pre-activation
  backup. A new private restore copy passed all ten exact manifest headers and
  New York time checks. The owner-only deployment was switched from Version 6 to
  retained Version 5 and back with controls disabled; both immutable builds and
  access checks passed, and Queue/Audit snapshots were unchanged. This verifies
  deployment rollback and a headers-only recovery point, not populated-data
  recovery or application execution against the restored copy.
  The bounded Gmail recovery produced five generic metadata Queue items;
  one controlled Dead_Letter is resolved. Its 30-day cursor has no pending/blocked
  retry but the initial window is incomplete. No full-thread interpretation is
  claimed and no background worker is enabled.
- Resolve, Reopen, explicit-offset Snooze and selected Gmail replay passed on
  Version 4. A Snoozed-to-Reopen attempt correctly rejected without mutation.
  Version 6 **Set waiting state** passed: `unknown` to `them` added one audit,
  identical `them` changed neither table, then restoration to `unknown` completed
  at 11:56:36 EDT. Five Queue rows and thirteen Audit_Log rows remain. The tested
  row retains `open`, `manual_override:true`, and `snooze_until:null`; only its
  update timestamp differs from the pre-test row. All other Queue rows are exact.
- On 2026-09-22 at 18:43 EDT, an on-demand run generated a fresh eight-section
  `Briefing_View` for the five current Queue items. `Briefing_History` records
  delivery channel `none`; no Google message was sent. The briefing flag was
  restored to false after the single run. See the latest live evidence in
  [V1 execution](../docs/implementation/V1_EXECUTION.md).
- A bounded Gmail metadata sweep on 2026-09-22 advanced six enumeration pages
  with zero processed, excluded, or failed rows, then returned only the generic
  `RECONCILIATION_FAILED` result. Queue and Dead_Letter matched the private
  pre-sweep backup at that point. After Cam authorized and completed `clasp`
  login, the reviewed bundle was synced and deployed as Version 9. One further
  bounded manual invocation at 20:04 EDT returned `status:more` with zero
  processed, excluded, or failed rows; it did not reproduce the error or identify
  its cause. At that time the checkpoint remained in enumeration and the
  initial window was incomplete. Gmail intake was immediately restored to
  false. At 20:05:02 EDT,
  editor health passed all ten headers, New York time, no send capability, all
  six automatic flags false and `MANUAL_WRITES` as the sole true flag. The
  unfiltered Triggers page showed zero. Do not reset the checkpoint or claim
  the earlier failure's cause is known. A later bounded continuation advanced
  the checkpoint and is recorded at the end of this file and in [V1 execution](../docs/implementation/V1_EXECUTION.md).
- PR #34, #35 and #37 are merged. PR #37 merged at
  `60beecf5f76a77edd99daf99fad3917462cdf4cf` after required CI and review. The create-only draft provider PR #36 merged at
  `8f97b6b43b260534a9ee10c2f77aa403f08d3d95`; its factory remains uninvoked and is
  absent from the emitted runtime. It adds no compose scope or live drafting.
- Integrated hardening validation passed 393 tests in 39 files, schema,
  formatting, lint, types, build and planning checks. The tested
  [Shortcut token rotation procedure](../docs/runbooks/SHORTCUT_TOKEN_ROTATION.md)
  remains separate from live token/device acceptance. Release review and merge
  evidence are recorded in [V1 execution](../docs/implementation/V1_EXECUTION.md).
- No Google email or Chat send, Gmail draft, trigger installation, phone capture,
  Calendar mutation, billing upgrade, or private-content retention occurred.

## Commitment storage released; provider integration pending

The repository and private owner-only Version 9 deployment include strict 1.1 Commitment
storage, bounded outbound chronology, a guarded observation writer, and
briefing provenance validation. After a verified empty-table preflight and private
backup, `cccMigrateEmptyCommitments` returned `migrated` with schema 1.1 at
14:58 EDT. A direct bounded Sheet read confirmed the exact 17-column header
and no populated Commitment rows. The migration code touches only six trailing
header cells; a direct comparison with the backup confirmed all five Queue
rows and thirteen Audit_Log rows unchanged. Post-migration health passed all
other manifest headers. See [storage and migration](../docs/implementation/COMMITMENT_STORAGE.md).
No promise was captured live. Provider binding, automatic extraction,
reconciliation and real working-week acceptance remain open.

## Accepted decisions

Standing authorization covers private deployment, in-scope tests and independently
reviewed protected merges. Sole mailbox: `contact@elev8mediaky.com`; initial
pilot lookback: 7 days; a separate 30-day backfill is deferred until the pilot
is accepted. Relative dates: America/New_York. Code owns state and validates
model suggestions. Manual overrides win. Sheets hold metadata, not message bodies.
All Google messages remain unsent; Codex coordination is authorized.

## Remaining gates

1. Studio Custom steps access is ON for the approved CapturedByCam root
   organizational unit, with unpublished test steps allowed. The installed
   private CCC action is visible, and its configuration card now renders the
   Gmail ID and bounded JSON fields after PR #45 removed an unused locale
   permission option. The corresponding exact manifest edit is saved in the
   authenticated Apps Script project. The manual synthetic flow now includes
   the unconfigured, unrun private action as Step 3; CCC_STUDIO_PROCESSING
   remains false. The earlier Ask Gemini synthetic-only run had sources off and
   its 12-field result passed strict schema validation, but project evidence,
   starter binding, real-model usefulness, and resolved-input/source retention
   remain open. Studio reports stored synthetic output available for 40 days.
   No real private content or Google mutation was used. The existing owner-only
   deployment was later updated to Version 9 for the controlled Gmail diagnostic;
   Shortcut gate fix; the Studio flow remains unrun.
2. Draft creation needs compose authorization, a trusted eligible context resolver
   and bounded live acceptance. Native replacement/deletion return unsupported to
   protect human edits. The new Commitment storage schema is migrated and deployed; outbound
   promise extraction and the guarded writer still need a verified
   interpretation/runtime binding and live acceptance; local integration tests alone do not establish
   that product behavior.
3. The native Shortcut remains a setup-blocked two-action template. Version 11
   is a separately deployed anonymous endpoint; Chrome can now reach its host
   after Cam's Admin allowlist change, and GET returns the fixed rejection.
   A synthetic POST previously returned `disabled` with intake off. No token is
   provisioned, no Shortcut endpoint/token configuration or device acceptance
   exists. Complete device setup and prove the authenticated write-only path
   without exposing Queue reads.
4. Collect real model observations, usefulness ratings and the required working
   week after accepted bindings. Fifty synthetic policy fixtures are implementation
   evidence, not real model accuracy or pilot completion.

Keep automatic intake, Studio processing, drafting, Shortcut capture and briefing
delivery disabled. Use the [Run comms guide](../docs/runbooks/RUN_COMMS.md) for
private Queue review and the accepted guarded controls.

## Operating records

- [Handoff](Handoff.md)
- [V1 execution](../docs/implementation/V1_EXECUTION.md)
- [Runtime operations](../docs/runbooks/RUNTIME_OPERATIONS.md)
- [Synthetic evaluation](../docs/evaluation/SYNTHETIC_V1_REPORT.md)
- Private resource links and bindings: ignored `.local/PILOT_RESOURCES.md`.

## Bounded chronology release evidence

PR #42 merged as `4789030589d1f0168aff87de788f29dd80155e85` after independent
review, repository verification and CodeQL. Local required checks passed,
including 423 tests across 45 files. The fresh private backup was verified
before the migration, and its resource ID remains in ignored
`.local/PILOT_RESOURCES.md`.

With all seven flags off and zero managed triggers, a full
`Commitments!A2:Q6000` `userEnteredValue` scan found no populated cells,
including formulas that render blank. The reviewed source was pushed to the
approved Apps Script project. The authenticated editor ran
`cccMigrateEmptyCommitments` once and reported
`{"ok":true,"status":"migrated","schema_version":"1.1"}`.
Direct Sheet reads confirmed the exact 17-column header and an empty data
range. The 15:00:42 editor health check passed all ten manifest headers,
New York time, all seven flags off and no send capability.

Immutable Version 7 exactly matched the reviewed build and private manifest.
The existing owner-only deployment was later updated to Version 9 after PR #52;
the 17:53:21 health check verified all ten headers, no send capability, all
automatic flags false, and the accepted manual-control flag as the sole true
flag. Queue and Audit_Log populated rows matched the private backup exactly.
Automatic provider features remain disabled pending the gates above.

## 2026-09-22 live acceptance continuation

The Google Admin insecure-content allowlist for `script.googleusercontent.com`
is locally applied for the CapturedByCam OU. Chrome reaches the active Version 11
content endpoint and receives only the fixed `method_not_allowed` GET response.
This verifies browser reachability, not an authenticated Shortcut write or
device capture.

One manually invoked bounded Gmail reconciliation step processed one item with
zero exclusions or failures. The version 2 checkpoint advanced to `nextThread=8`
across 12 reference shards and remains in processing without retry or error;
the 30-day window is incomplete. Gmail intake was restored to false. Post-run
health passed all ten workbook headers, New York time, and no-send capability;
all automated flags were false and only `MANUAL_WRITES` remained true. The
unfiltered trigger list is empty. No Google message or Gmail draft was sent or
created. See [V1 execution](../docs/implementation/V1_EXECUTION.md).

Later that evening, another single bounded Gmail invocation processed one item
with zero exclusions or failures. The version 2 checkpoint is now at
`nextThread=9` across 12 reference shards, still processing without retry or
error; the 30-day window remains incomplete. Gmail intake was immediately
restored to false, and a fresh health run again confirmed all automatic flags
off and no send capability. A fresh Admin page readback is waiting on Google's
passkey step-up; the earlier Chrome site-details and safe GET checks passed.

## 2026-09-23 seven-day Gmail pilot

Cam confirmed the initial pilot is limited to seven days; the separate 30-day
backfill remains deferred until the pilot is working and accepted. The runtime
lookback defaults to seven days. Several manually invoked bounded reconciliation
batches returned `status=more`, then a later batch stopped with the sanitized
`google_api_failure`. The underlying Google API response is not known, so the
seven-day run is incomplete. The cursor was not reset after the failure.

`CCC_GMAIL_INTAKE` is off again. A read-only Gmail probe verified one sampled
message's metadata within the seven-day bound, with no raw content stored and
zero mutations. A subsequent health check passed all ten workbook headers,
`America/New_York`, and `send_capability=false`; all automatic flags were off
and only `MANUAL_WRITES` was on. No Google email, message, or draft was sent or
created. Diagnose the Google API failure before resuming; keep the seven-day
pilot bound and do not start the 30-day backfill yet.

At 07:00 EDT read-only triage found that the Apps Script execution log retains
only the sanitized failure result. Source tracing shows Gmail API errors are
converted to controlled read errors and Sheets batch errors to
`sheet_commit_uncertain`; the escaped Google API exception is most consistent
with a Sheets values or spreadsheet metadata read. The exact provider response
remains unknown. A separate diagnostic source branch distinguishes those two
paths but is not deployed. Two read-only CLI health attempts failed before
script execution with Apps Script storage `NOT_FOUND`; they changed no state.
The 01:35 editor health check remains the latest confirmed live posture.

## 2026-09-23 Phase 1 Gmail pilot acceptance

The seven-day Gmail pilot is complete. PRs #60 and #61 added fixed, content-free
Sheets failure labels and the failing table/read target; live execution identified
the original failure as a Sheets values read rather than a Gmail message read.
PR #62 removed the redundant all-table header preflight from every one-thread
invocation while retaining per-table header checks at each actual repository
read. All three PRs passed required CI, were merged into the pilot branch, and
were pushed to the approved Apps Script project with an exact code readback.
The owner-only manifest posture remained `MYSELF` / `USER_DEPLOYING`.

The fixed window from `2026-09-16T04:55:06.000Z` through
`2026-09-23T04:55:06.000Z` enumerated four immutable reference shards containing
65 message references and 53 unique threads. Bounded manual invocations resumed
the existing cursor without a reset. Rapid bursts produced two controlled,
sanitized Sheets values-read failures; after pacing the calls, processing
continued from the same checkpoint. The final call returned `status=complete`,
`failed=0`. The durable checkpoint now has `phase=complete`, `nextThread=53`,
`completedThrough=2026-09-23T04:55:06.000Z`, and no retry or error.

`CCC_GMAIL_INTAKE` was returned to false. The 10:11 EDT `cccHealth` run passed all
ten workbook headers, `America/New_York`, and `send_capability=false`; every
automatic flag is false and only the previously accepted `MANUAL_WRITES` control
is true. No Google email, Chat message, or Gmail draft was sent or created. This
accepts the bounded Gmail pilot for Milestone 3 / Phase 1. It does not accept V1
for unattended daily use: Studio source/model binding, create-only draft
acceptance, Shortcut device authentication, and the working-week usefulness
evaluation remain open. The optional 30-day backfill is intentionally partial at
`nextThread=135` by owner decision; populated-data recovery is verified.

## 2026-09-23 optional backfill stop and populated recovery

PRs #65 through #67 added the bounded batch runner, six-second pacing, and
transient Sheets read retries used for the optional 30-day metadata backfill.
After 12 reference shards identified 193 unique threads, manual bounded batches
advanced the durable cursor to `nextThread=135`. The last batch returned
`status=more`, with eight steps, six processed, two excluded, and zero failed
after recovering one transient spreadsheet metadata-read failure. Cam then
accepted stopping there. The checkpoint remains in processing without a retry
or error, and Gmail intake is false. No message, draft, or trigger was created.

The populated-data recovery gate is verified independently. A new private copy
was made without collaborators or comments; its sharing remained Restricted to
Cam as sole owner and its locale/time zone remained United States/Eastern. Fresh
exports of the active and recovery workbooks had the same 11 sheet names and
identical normalized fingerprints for cell/formula values, merged ranges,
freeze panes, and dimensions. The recovery copy includes 145 Queue rows, 171
Audit_Log rows, the current Briefing projection and Config checkpoint, and the
17-column Commitments table. The active workbook was untouched. This closes the
populated-data copy-and-verify gate without changing any runtime binding.
