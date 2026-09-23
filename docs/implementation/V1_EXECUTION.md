# V1 execution and activation record

Updated 2026-09-22. This record distinguishes implementation from live acceptance.

## Standing authorization and boundaries

Cam authorized implementation through Milestone 7, independent review, protected
merges, minimum Google Workspace/Cloud permissions, private resources and scoped
pilot tests. Sole mailbox: contact@elev8mediaky.com; initial lookback: seven
days; time zone: America/New_York. On 2026-09-23 Cam set a separate 30-day
backfill to occur only after the pilot is accepted. No purchases, billing
upgrades, paid infrastructure, source deletion, automatic Calendar events, or
unrelated account changes.

The later instruction prohibits **all Google emails and messages**, including the
earlier self-only Chat notification. Codex coordination remains authorized.
No email or Chat send transport exists in this runtime. No draft is created by it.

## Implemented

- PR22 Gmail domain chronology, reconciliation, durable cursor/retry/dead letters,
  deduplication and manual preservation merged at 0c9c497.
- PR24 disabled Studio blueprint merged; issue23 remains open for real acceptance.
- PR28 draft lifecycle with ownership, stale detection and uncertain-write recovery
  merged at 4765c7c. These are domain services; a live draft provider is unbound.
- Release work integrates actual Advanced Sheets/Gmail bindings, atomic Sheet
  batches, synchronous write-only HTTP handling, guarded bootstrap and kill switch,
  conservative metadata reconciliation, commitments, date normalization,
  calendar candidates without event writes, and eight-section briefing persistence.
- Owner-only Queue menu controls implement Resolve, Reopen and explicit-offset
  Snooze and exact waiting-state updates through a shared lock, complete row snapshot checks and atomic audit writes.
  `CCC_MANUAL_WRITES` is independent and defaults off; no direct Sheet edit is needed.
- Build fails if its real entrypoint is absent and emits Apps Script global
  functions with an explicit V8 manifest. ES2019 avoids unsupported class fields.
- Independent reviews and regression fixes cover draft/manual override retention,
  invalid timestamps, briefing health/idempotency, unheaded data, authenticated
  quotas, and the bounded Gmail metadata path.
- Offline deployment drift comparison and backup/restore-to-new-resource procedures
  are in [Runtime operations](../runbooks/RUNTIME_OPERATIONS.md).

## Verified live state

- Narrow clasp OAuth succeeded for script.projects, script.deployments,
  script.webapp.deploy, drive.file and userinfo.email. Credentials are ignored.
- Created a new private bound pilot Sheet and Apps Script project. Drive metadata
  reports shared=false and only the approved account as owner.
- Uploaded the real two-file runtime. Apps Script `cccInitializePilot` completed
  at 02:55:16 EDT with ok=true, ten tabs and no enabled flags.
- Independent Sheets API inspection confirmed the ten manifest headers and empty
  second rows. Workbook time zone was set and verified as America/New_York.
- Created a pre-activation workbook backup; its permission metadata also confirms
  shared=false and only the approved owner. Resource links are in the durable
  ignored `.local/PILOT_RESOURCES.md`, not the public repository.
- Version 3 was deployed from `ccb5329`. Its runnable source
  and semantic manifest match the tested build. Unauthenticated requests redirect to
  Google sign-in and expose no Queue content. A 09:17 EDT deployment/manifest identity
  check passed; Version 3 `cccHealth` passed at 09:17:21 EDT.
- Version 1 `cccHealth` passed at 03:14:57 EDT: all ten headers valid and six flags false.
- Version 1 `cccGmailReadProbe` passed at 03:15:49 EDT: approved mailbox, 30-day window,
  one metadata message, no raw content stored and zero mutations.
- At 08:51–08:52 EDT, a fresh reload of Version 2 Apps Script Settings showed the
  original six feature properties false. `CCC_MANUAL_WRITES` was absent, which is
  the default-false state; the overnight attempted save therefore did not persist.
- Version 2 `cccDisableAll` completed at 08:52:54 EDT with
  `{ok:true,flags_enabled:[],managed_triggers_deleted:0,managed_triggers_remaining:0}`.
  That controlled result supports the all-disabled kill-switch state; it is not a
  full accessibility-log read.
- Version 2 `cccHealth` completed at 08:53:33 EDT with `ok:true` and all ten headers
  valid. Its accessibility log truncates after the beginning of the flags field, so
  no unobserved flag values are claimed.
- A bounded Sheets API read found headers only in Queue, Briefing_View,
  Briefing_History, Audit_Log and Config. No triggers are installed.
- Version 2 disabled `cccReconcileGmail` completed at 08:57:42 EDT and disabled
  `cccBuildBriefing` at 08:58:12 EDT, each returning `{ok:true,status:'disabled'}`.
  The following bounded Sheets API read found headers only in Queue, Briefing_View,
  Briefing_History, Audit_Log, Dead_Letter and Config. Those disabled calls created no
  worker, briefing, ingestion, or manual-control action.
- IAB Settings then confirmed all seven feature flags false after the 08:52 kill
  switch. A single enabled Gmail batch at 09:00:11 EDT returned `ok:true`, a `more`
  indicator, `processed:0`, `excluded:4`, and `failed:1`. It wrote one controlled
  `SNAPSHOT_INVALID` Dead_Letter row and a durable Config cursor; Queue and Audit_Log
  remained headers-only. `cccDisableAll` again completed at 09:00:46 EDT with an empty
  enabled-flag list and zero remaining managed triggers.
- A briefing-only run at 09:04:41 EDT returned eight generated sections with
  `deliveryChannel:'none'`. Bounded Sheet reads confirmed eight sections (11 projection
  rows, four health rows) and one history row with `none`/`generated`/count 0. It
  accurately reported the failed intake count as 1. No delivery transport ran.
- A duplicate briefing call at 09:05:45 EDT returned `duplicate` with the same
  briefing ID, eight sections and `deliveryChannel:'none'`. Bounded Sheet reads then
  confirmed unchanged projection and history cells (12 projection rows including the
  header and two history rows including the header).
- `cccDisableAll` passed again at 09:06:16 EDT with an empty enabled-flag list and
  zero remaining managed triggers. The bound workbook opened in IAB and displayed the
  Command Center Health, Disable all, Resolve, Reopen and Snooze menu actions.
  Disabled Reopen showed the fixed “Manual Queue controls are disabled.” toast; Queue
  and Audit_Log remained headers-only. No enabled Queue action ran.
- The initial controlled Gmail failure was a runtime compatibility issue rather than
  structural metadata failure. It was subsequently addressed before the Version 4
  recovery/replay acceptance described below.
- Version 3's 09:18:25 EDT five-record continuation excluded five records with zero
  failures. A 09:18:43 EDT retry excluded one and recorded one controlled failure from
  a valid RFC local-part address rejected by the prior source validator; its 09:19:24
  `cccDisableAll` returned all flags off and zero managed triggers. The accepted
  [Gmail source snapshot 1.1](GMAIL_SNAPSHOT_V1_1.md) corrects this transient source
  contract only; Queue and other stored schemas remain unchanged.
- Version 4 deployed at 09:36 EDT from `fe558fc`. Immutable source/manifest drift
  verification, owner-only deployment posture and the unauthenticated Google sign-in
  redirect all passed. At 09:37:42 EDT, selected replay of the original Dead_Letter
  succeeded: Queue has one item, Audit_Log has one new row, the same Dead_Letter is
  resolved as `manual_gmail_replay`, and Config is unchanged. Resolve at 09:38:33 set
  `resolved`/`manual_override:true`; a 09:39 replay preserved the entire one-row Queue
  exactly and added one Audit_Log row. Reopen at 09:40 restored `open`,
  `manual_override:true`, and `resolved_at:null`; Snooze at 09:41 stored explicit
  `12:00-04:00` today with `manual_override:true`. At 09:41:34 EDT, cursor resume
  processed four records with zero exclusions or failures; Queue reached five rows,
  Audit_Log nine rows, the original Dead_Letter remained resolved, and Config reported
  `pending:0`, `retry:null`, `blocked:false` with the bounded window active. At 09:45:58
  EDT, direct Reopen of the Snoozed row returned controlled `STALE_STATE`, leaving it
  unchanged. The supported Resolve then Reopen sequence restored the first row to `open`
  with `snooze_until:null` and `manual_override:true`; bounded proof then found five
  Queue rows and eleven Audit_Log rows. Final `cccDisableAll` at 09:50:20 EDT returned
  `{ok:true,flags_enabled:[],managed_triggers_deleted:0,managed_triggers_remaining:0}`.
- Version 5 deployed at 11:09 EDT from `ae5d2ef`. Its source SHA
  `9a0ba51a70ac6d2d728581a00c3f31d407c2230176d65e7553e7cf59b6abf2af` and semantic
  manifest SHA `6d2df263d5686e5b903c655da411ce96d4403c71d249321f220be50ce7f0689d` match the
  verified build. Drift passed with unchanged `MYSELF`/`USER_DEPLOYING` access and an
  unauthenticated Google sign-in redirect. At 11:14:40 EDT, Version 5 `cccHealth`
  returned `ok:true`: all ten headers valid, all seven flags false,
  `America/New_York`, and `send_capability:false`. PR #35 merged at
  `c0c959d00d3b7b4769ea25e8f673d83bce0a3c14` at 11:19:34 EDT and durable main
  fast-forwarded. Under standing authorization, only `CCC_MANUAL_WRITES` was enabled
  after the verified Version 4 guarded-control checks and Version 5 same-code health.
  Fresh `cccHealth` at 11:24:50 EDT returned `ok:true`: ten valid headers,
  `CCC_MANUAL_WRITES:true`, the other six flags false, `America/New_York`, and
  `send_capability:false`. No source or Queue mutation occurred during activation. A
  current trigger count was observed at about 11:32 EDT in the Apps Script Triggers
  page: `Showing 0 triggers` with no filters set.
- Workspace Studio test add-on installation is verified with no new scope or consent.
  The historical reloaded manual-flow inspection found no CCC/custom action. At that
  time CapturedByCam root Custom steps access was OFF. Cam later approved turning it
  ON with unpublished test steps allowed; the private action is now visible and its
  configuration card opens. The current app-owned flow is
  Start manually → Ask Gemini with Web search and Workspace sources off, no skills, Text
  output, and no custom/Google mutation step. A synthetic-only manual run succeeded at
  12:26:22 EDT. `StudioInterpretationSchema` accepted all 12 required fields with no
  extras; pure synthetic `prepareStudioStaging` with `knownContact:false` returned
  review-only and made no persistence/provider call. Details are in [Studio synthetic
  probe](../evaluation/STUDIO_SYNTHETIC_PROBE.md). It has no Gmail starter, message ID,
  or private source binding. The activity panel exposes stored synthetic output and says
  Data available for 40 days, but exact resolved-input/source retention remains unknown.
  Its proposal still lacks project evidence, so semantic review, starter binding,
  retention meaning, and model usefulness remain unaccepted.
- Version 2 adds guarded Queue controls and a seventh flag, `CCC_MANUAL_WRITES`,
  which defaults false. CLI deployment changed source only, preserving the private
  access posture and existing properties. Version 4 live Gmail recovery, guarded
  manual controls, briefing persistence and kill-switch checks have passed. Only
  `CCC_MANUAL_WRITES` is currently enabled; automatic intake, drafting, Shortcut
  capture, and briefing delivery remain disabled. Version 1 remains available for rollback.

## Version 6 waiting-state acceptance

Version 6 deployed at 11:51 EDT from `e23ee3a` (integrated candidate `42fc635`).
The immutable source SHA is
`30ef121478437e554e485e91dcb32966a80592257a29998106f0e955c6f40853`; semantic manifest SHA
is unchanged at `6d2df263d5686e5b903c655da411ce96d4403c71d249321f220be50ce7f0689d`.
Both matched the verified build. Deployment remains `MYSELF` / `USER_DEPLOYING`,
with unauthenticated Google sign-in redirect. The first post-deploy listing still
showed Version 5; a subsequent read verified Version 6 without another deployment.

At 11:52:57 EDT health returned `ok:true`, ten valid headers, New York time,
`MANUAL_WRITES:true`, six other flags false and `send_capability:false`. The
unfiltered Triggers page at about 11:51 EDT showed zero triggers.

A bounded selected-row test changed waiting from `unknown` to `them`: only
`waiting_on` and `updated_at` changed, other Queue rows were exact, and Audit_Log
increased from eleven to twelve with the controlled manual actor. Repeating `them`
left both complete bounded table snapshots unchanged. Restoring `unknown` at
11:56:36 EDT left only `updated_at` different from the original tested row and
Audit_Log at thirteen. Queue remains five rows; no source, draft, scope, flag,
trigger or other data was changed. Version 5 remains the verified rollback target.
The initial 30-day Gmail window is incomplete. The prior briefing projection
predates these Queue items and must not be treated as current.

PR #36 merged at `8f97b6b43b260534a9ee10c2f77aa403f08d3d95` after independent review
and required CI. Its create-only native provider remains uninvoked and absent
from the emitted runtime. The integrated waiting candidate passed 392 tests in
39 files plus schema, formatting, lint, type, build and planning checks. Independent
review verified prompt cancellation, lost authorization, exact enum validation,
unchanged legacy audit hashes and atomic Queue/Audit batch coverage.

## M7 recovery and rotation hardening — 2026-09-22

PR #37 merged at `60beecf5f76a77edd99daf99fad3917462cdf4cf` at 12:02:48 EDT after
independent review and all required hosted checks; durable main fast-forwarded.
The integrated rotation/runbook candidate then passed `pnpm verify` at 12:03 EDT:
393 tests in 39 files, formatting, lint, types, JSON/Zod contracts and build.
`pnpm validate:planning` passed. The extra synthetic regression proves retired-token
rejection after replacement, same-UUID deduplication with the new token, and both
tokens rejected while disabled, with exactly one persisted item/commit. It does
not provision a token or establish live Shortcut/device acceptance. See the
[rotation runbook](../runbooks/SHORTCUT_TOKEN_ROTATION.md).

A new private workbook was copied from the verified pre-activation backup.
Drive metadata reported `shared:false` and exactly the approved owner; spreadsheet
metadata reported `America/New_York`. All ten manifest tables' exact header arrays
matched repository `WORKBOOK_MANIFEST`, and the bounded first data row was empty
in each. The inherited unused `Sheet1` was preserved. Private links are retained
only in ignored `.local/PILOT_RESOURCES.md`. This is a verified restore-to-new-copy
of a headers-only recovery point, not populated-data recovery. The active workbook,
its binding and all source data were preserved; no copy was deleted.

At 12:05:53 EDT, `cccDisableAll` completed with `ok:true`, no enabled flags,
zero managed triggers deleted and zero remaining. With controls off, the same
owner-only deployment was repointed to retained Version 5 and then back to retained
Version 6. Each deployment metadata read confirmed the expected immutable version,
`MYSELF` / `USER_DEPLOYING`, and unauthenticated HTTP 302 to Google sign-in. Both
immutable code hashes and the semantic manifest matched their previously verified
builds. No new source version, OAuth scope, token or access grant was introduced.

After restoring Version 6, editor `cccHealth` at 12:10:50 EDT passed all ten headers,
New York time, all seven flags false, and no send capability. Editor runs execute
current project code; these health results do not independently prove execution
of the older immutable deployment. The version metadata and retrieved immutable
source provide the deployment rollback evidence. Bounded post-drill snapshots
matched all five Queue rows and thirteen Audit_Log rows exactly.

Only `CCC_MANUAL_WRITES` was restored. At 12:12:37 EDT editor health again passed
all ten headers, New York time and no send capability, with manual writes true
and the other six flags false. No trigger was installed, and no Google email,
Chat message, Gmail draft, Calendar change, raw-content retention or phone capture
occurred. Account/provider/device and real working-week gates remain open; M7 and
V1 are not accepted for unattended operation. Independent review found no material
factual contradiction or completion overclaim in the final recovery records. The
runbook and regression changes also passed independent review.

## Runtime release verification

Runtime release PR #31 merged at `25e3518` after required hosted checks and
independent review (325 tests in 32 files). Queue-controls PR33 merged at `4d5f78b`
after independent review and required CI and CodeQL checks passed. The Queue-controls
candidate passed `pnpm verify` with 331 tests in 33 files; lint, typecheck, schemas,
formatting and build passed. Final source commit `6ae04e0` changes only controlled
uncertainty feedback; its 12 affected Queue/bundle tests and build passed. Immutable
Version 2 deployment exactly matched that source build; its manifest scopes and owner-only
access were unchanged. Version 4 later completed the live Gmail, manual-control and
kill-switch checks; model acceptance remains separate.
Gmail recovery PR #34 and Studio custom-step PR #35 merged after independent review and
required checks. The Studio branch passed full local verification: 370 tests in 37 files.

## Feature posture

| Component | Implementation | Live posture |
| --- | --- | --- |
| Queue/Sheets | Actual adapter and atomic bounded commits | Ten tabs initialized; live health passed; five metadata-pilot Queue rows persisted with no raw content |
| Queue controls | Owner-only menu, manual override, row-conflict detection and atomic audit | Version 4 selected replay, Resolve, unchanged-row replay, Reopen and explicit-offset Snooze passed with manual overrides and atomic audit; direct Snoozed Reopen correctly returned `STALE_STATE`. `CCC_MANUAL_WRITES` alone was enabled at 11:24:50 after health passed, without a source or Queue mutation |
| Gmail | Native read-only metadata worker with a configurable seven-day initial pilot and deferred 30-day backfill | Version 1 probe passed; Version 2 produced a controlled dead letter/cursor; Version 3 exposed the RFC local-part fix; Version 4 recovered it and processed four further records with zero failures. Pilot remains metadata-only and no trigger is installed |
| Drafts | Domain lifecycle, operation ledger and reviewed create-only provider merged in PR #36 | Uninvoked and absent from the emitted runtime; no compose scope or live create acceptance; replacement/deletion unsupported |
| Studio | Versioned disabled configuration and staging validation | Test add-on installed; root Custom steps access is ON with unpublished steps allowed and the private action is configurable. It remains unrun and unbound; source binding, strict semantic acceptance, resolved-input retention meaning, and model usefulness remain unverified; processing disabled |
| Shortcut | Synchronous token-authenticated endpoint, size/schema limits, deduplication, redacted errors | Private macOS Shortcut and token are installed; authenticated write-only capture, duplicate, invalid-token, size, rate-limit, and kill-switch checks passed with synthetic input; intake is disabled again. iPhone/iPad installation is not accepted |
| Briefing | Deterministic eight-section append-only view/history | One Version 2 generation persisted eight sections/history with no delivery; same-ID duplicate left both views unchanged |
| Calendar | Reviewable candidates only | No Calendar mutation or runtime scope |

The native Gmail pilot reads only the selected message metadata, without bodies,
subjects or older thread history. It records generic needs-review state. It cannot
claim full thread interpretation, actionability, useful summaries, or draft readiness.
Studio processing remains disabled until a provider can prove bounded authoritative
source IDs and strict pre-persistence validation.

## Remaining access and capability gates

1. Keep automatic intake, drafting, Shortcut capture, and briefing delivery disabled.
   `CCC_MANUAL_WRITES` alone is enabled for guarded Queue controls. Do not install a
   trigger; retain bounded controlled-code logging.
2. Connect a supported interpretation provider with the required privacy behavior
   within an existing paid entitlement. The Studio test add-on is installed without
   new consent. Cam approved and Admin enabled root Custom steps access while retaining
   unpublished test steps. The private action is visible and configurable, but has not
   run. Starter binding, strict semantic acceptance, retention meaning, and model
   usefulness remain pending.
   Draft ownership/revision data remains unbound. The inspected
   Cloud project showed an expired free trial and a free-trial billing account;
   Vertex requires enabled billing. No billing upgrade was made. Free Gemini API
   terms are unsuitable for private-message processing here. An eligible existing
   billed project or a verified Workspace binding is needed before implementation
   can be completed and tested against that provider.
3. The Mac Shortcut gate is accepted. Keep its token private and intake off
   outside deliberate captures. A future iPhone/iPad installation remains a
   separate device-specific acceptance task; it is not required for the current
   Mac pilot.
4. Bind outbound-promise extraction and live Commitment persistence; the native
   metadata runtime does not supply interpreted commitments. Then collect actual model/pilot observations and human draft-usefulness ratings,
   including the required working week. [50 synthetic policy cases](../evaluation/SYNTHETIC_V1_REPORT.md)
   pass but do not satisfy those real-world thresholds.

## Completion status

V1 is **not accepted or ready for unattended daily use**. Local implementation and
resource bootstrap are meaningful progress; the remaining live binding and pilot
criteria stay open. See [Handoff](../../PMC/Handoff.md) for the release evidence.

## Native draft provider preparation — 2026-09-22

Decision [108](../wayfinder/tickets/108-native-draft-create-only.md) and implementation
`9dc1cc6` add a native create-only transport plus an unbound owner/workbook/flag factory.
No new OAuth scope or runtime entrypoint was added. Gmail reads are exact-message
metadata only, with approved-profile/thread identity, inbound recipient, source age,
strict reply-header and bulk exclusions. A differing Reply-To is rejected so sender
eligibility cannot address an uncurated recipient. MIME uses UTF-8 Base64 body encoding
with 76-character lines; padded Apps Script base64url is accepted and normalized.

Independent review findings for Reply-To and native encoding were fixed. Additional
regression tests reproduced and fixed non-ASCII/control Message-ID and synchronous
authorization-error leakage. Full `pnpm verify` passed at 11:36 EDT: 386 tests in 39
files, lint, typecheck, three JSON/Zod contracts and a callable Apps Script build;
`pnpm validate:planning` also passed. Existing lifecycle tests retain reservation,
uncertain-write, duplicate and manual-edit protections. These are synthetic/local
results, not a live Gmail create. Native replacement/deletion make no provider calls.

## Bounded chronology source merged — 2026-09-22

Decision [111](../wayfinder/tickets/111-bounded-gmail-chronology.md) adds fixed-window
reference enumeration, per-thread metadata reconciliation and older commitment
preservation. Studio and replay reuse the bounded evidence; unavailable coverage
defers processing, transient reads retry, and historical recovery retains its
original window. Independent review findings were resolved. Local verification
covers 423 tests in 45 files, formatting, lint, types, schema, build and planning
checks; the updated bundle suite passed after correcting two old flow expectations.
See [implementation and migration boundaries](BOUNDED_GMAIL_CHRONOLOGY.md).
PR #42 merged at `4789030589d1f0168aff87de788f29dd80155e85`; local verification,
required CI, CodeQL and independent review passed. At that point, Version 6
remained deployed. A fresh private backup is recorded in ignored `.local/PILOT_RESOURCES.md`.
Migration preflight was then blocked because `clasp run cccHealth` returned storage
`NOT_FOUND`, and no authenticated editor control path was available. Flags,
triggers and full Commitments-table emptiness were unverified at that point.
No disable, migration, source push or deployment had been performed.

## 2026-09-22 private Commitment 1.1 release

After PR #42 (`4789030589d1f0168aff87de788f29dd80155e85`) and
migration-order PR #43 (`1f8bc3ea4fdc8f41a6ad8f2a811726caa724d868`)
merged, the approved account and exact private pilot workbook were reverified.
The pushed bundle was built from clean `main` at
`1f8bc3ea4fdc8f41a6ad8f2a811726caa724d868`; `pnpm build` passed before
the push. PR #42 required CI and CodeQL passed, and PR #43 required CI passed. A fresh private backup passed the
owner-only and workbook-metadata checks; its ID is only in ignored
`.local/PILOT_RESOURCES.md`. At about 14:46 EDT, `cccDisableAll` returned all
seven flags off and zero managed triggers. The unfiltered Triggers page showed
zero. A direct `userEnteredValue` scan of `Commitments!A2:Q6000` found no
populated cells, including blank-rendering formulas. The legacy header had
exactly eleven columns.

`clasp push` updated the reviewed bundle and manifest in the existing Apps Script
project. The authenticated editor ran `cccMigrateEmptyCommitments` once at
14:58 EDT and logged `ok:true`, `status:migrated`, `schema_version:1.1`.
Direct bounded Sheet reads confirmed the exact seventeen headers and no
populated Commitment rows. The 15:00:42 editor health check returned ten
valid manifest headers, all seven flags false, New York time and
`send_capability:false`. A direct comparison to the fresh backup found all
five Queue and thirteen Audit_Log rows unchanged. The migration implementation
only writes the six new Commitment header cells; no other table headers drifted.

The existing project created immutable Version 7. Cloning that version matched
`dist/Code.js` byte-for-byte after LF normalization (SHA-256
`40e8a3afe7595104d7ba05fc87088360d0f92c569abe430bdd8ecfb246739383`)
and the semantic `appsscript.json` manifest. Its web app access remains
`MYSELF` / `USER_DEPLOYING` with no new OAuth scope. The existing private
deployment was updated to Version 7, not replaced with a new public endpoint.
Deployment inventory reported Version 7, and an anonymous request returned
HTTP 302 to `accounts.google.com`.

Only the previously accepted `CCC_MANUAL_WRITES` property was restored. At
15:07:25 EDT, editor health returned ten valid headers, New York time, manual
writes true, the other six flags false and no send capability. The unfiltered
Triggers page showed zero. No Google message, Gmail draft, trigger, provider
activation, Shortcut capture or Calendar mutation occurred. Automatic
outbound promise extraction, reconciliation and the real working-week pilot
remain unaccepted. Version 6 cannot be repointed directly at the migrated
active workbook; older-runtime recovery requires the verified legacy backup
restored to a new private workbook and coordinated binding.

## 2026-09-22 Studio custom-step availability and locale fix

Cam explicitly approved enabling Workspace Studio Custom steps access for the
CapturedByCam root organizational unit while retaining unpublished test-step
access. Admin saved ON with the checkbox checked. The installed private CCC
action appeared in the Studio add-step picker and was added to the existing
manual synthetic flow as Step 3. Its first configuration attempt reported
missing script.locale permission. Source inspection showed the add-on did not
read locale, so PR #45 removed useLocaleFromApp instead of widening OAuth
scope. The focused contract test was red before the change and green after;
build, required CI, CodeQL and independent review passed. PR #45 merged at
8883ce187a27a0cbeba7ea9e1f5cd9ffa63fb6e9.

The local clasp CLI lacked credentials, so the exact manifest field removal
was applied in the authenticated Apps Script editor. It reported Saved to
Drive. Reopening the Studio Step 3 card showed the intended Gmail ID and
bounded JSON input fields with no permission error. The flow was not run,
no real source ID or private content was bound, and CCC_STUDIO_PROCESSING
remains disabled. The existing owner-only deployment was later updated to
Version 8 for the separately reviewed Shortcut authorization/kill-switch fix;
this Studio flow remains unrun and unbound. Studio model usefulness,
starter-variable binding, and exact resolved-input/source retention remain
unverified.

## 2026-09-22 Shortcut gate hardening deployment

PR #47 merged after independent review, required CI and CodeQL. It moves the
authenticated malformed-request quota check ahead of the rejection sink and
rechecks authorization and the global disable state while holding the shared
Sheet transaction lock. `cccDisableAll` takes that same lock before disabling
flags/removing managed triggers, so an admitted persistence write cannot race
past shutdown. Token rotation remains disable-first.

The merged build was saved to the authenticated Apps Script editor and the
existing owner-only deployment was updated to Version 8 at 17:52 EDT. Execute-as
owner and `MYSELF` access were preserved; no public endpoint was created. The
17:53:21 EDT editor health execution returned `ok:true`, all ten expected sheet
headers valid, timezone `America/New_York`, no send capability, and flags
`GMAIL_INTAKE`, `STUDIO_PROCESSING`, `SHORTCUT_INTAKE`, `DRAFT_CREATION`,
`DRAFT_REPLACEMENT`, and `BRIEFING_DELIVERY` false. The accepted
`MANUAL_WRITES` flag is the only true flag. No flow, message, draft, trigger, or
Shortcut request was run. Phone/device acceptance and an endpoint accessible to
Shortcuts remain open.

## 2026-09-22 briefing and Studio configuration check

An authenticated, one-time `cccBuildBriefing` run generated an eight-section
projection for the five current Queue items. The latest `Briefing_History` row
records `delivery_channel=none` and `delivery_status=generated`; no Google
message was sent. `CCC_BRIEFING_DELIVERY` was restored to false immediately
after the run. A subsequent `cccHealth` execution returned `ok:true`, all ten
expected headers valid, `America/New_York`, no send capability, and all automated
intake, Studio, Shortcut, drafting, and briefing flags false; `MANUAL_WRITES`
remained the only true flag.

Workspace Admin's approved Custom steps setting is enabled for the CapturedByCam
root organizational unit, with unpublished (test) custom steps still allowed.
The private CCC custom step is now visible in Studio. The live-source Studio
flow remains unrun: its source binding/model behavior and exact input/source
retention are still unresolved. Do not process actual messages through that flow
until those acceptance gates are resolved.

The bounded Gmail metadata sweep was then enabled for a single manual session.
Six consecutive calls returned `status=more` with zero processed, excluded, or
failed records. The next call returned `RECONCILIATION_FAILED`; the Apps Script
execution log contains only that generic result, so the underlying cause is not
known. The v2 checkpoint remains in `enumerating`, with six reference shards and
no processed thread. Queue (five data rows) and Dead_Letter (one data row)
exactly match the private pre-sweep backup. `CCC_GMAIL_INTAKE` was restored to
false and verified; all other automatic flags remain false and
`MANUAL_WRITES` remains enabled. No messages or drafts were sent or created.
Do not retry or reset the checkpoint until the failure is diagnosed.

This stop instruction records the state before the reviewed bundle was synced
to the authenticated project. It was superseded by the later Version 9
diagnostic and bounded Gmail continuation below; the original failure cause is
still unknown, and the current checkpoint remains incomplete.

The live cause remains unresolved. PR #52 merged the reviewed change that adds
only fixed failure stage and category values to the controlled error result; it
never exposes provider messages or stack traces. The exact bundle was built and
passed required local and CI checks, but at the time of this record it was not
synchronized to Apps Script: local `clasp` had no saved credentials, and the
authenticated editor contained a large bundled file that could not be safely
patched by hand. Workspace Admin had
enabled root Custom steps access with unpublished test steps still allowed; this
does not change the Gmail runtime. Keep intake disabled and the checkpoint
untouched until the exact merged bundle is synced and a single bounded diagnostic
invocation confirms a safe continuation point.

## 2026-09-22 authenticated source sync and Version 9 diagnostic

Cam completed the `clasp` OAuth login in Terminal. The authorized user matched
the approved owner. The exact bundle from reviewed commit `379474d` (including
PR #52's controlled failure stage/kind labels and PR #53's documentation) was
built and synced to the existing private Apps Script project at 19:55 EDT.
An independent readback matched the built code after line-ending normalization
and matched the manifest semantically. No new OAuth scope or deployment endpoint
was created.

The existing owner-only deployment was updated from Version 8 to immutable
Version 9. A Version 9 clone matched the reviewed code and manifest, including
`MYSELF` access and `USER_DEPLOYING` execution. Editor `cccHealth` at 20:02:38
EDT passed all ten headers, New York time and no send capability; the six
automatic flags were false and only accepted `MANUAL_WRITES` was true.

After confirming the previously verified private backup remained recorded,
`CCC_GMAIL_INTAKE` alone was
enabled for one manual diagnostic invocation. At 20:04:06 EDT,
`cccReconcileGmail` returned `{"ok":true,"status":"more","processed":0,"excluded":0,"failed":0}`.
It advanced enumeration by one bounded page without reproducing the previous
generic failure; the underlying cause remains unknown. No checkpoint reset or
second sweep was performed. Intake was restored to false immediately. The
20:05:02 editor health run passed all ten headers, New York time and no send
capability with all six automatic flags false and `MANUAL_WRITES` alone true.
The unfiltered Triggers page showed zero. No Google message or draft was sent
or created; the 30-day window remains incomplete.

## 2026-09-22 approved public Shortcut endpoint

Cam explicitly approved a separate endpoint with anonymous access after the
specific access question was surfaced. The reviewed change leaves Version 9's
owner-only deployment intact and adds Version 10 as a separate
`ANYONE_ANONYMOUS` / `USER_DEPLOYING` deployment. Its GET handler returns only
`{"status":"rejected","error_code":"method_not_allowed"}`. Shortcut intake,
Gmail intake, Studio processing, draft creation/replacement, and briefing
delivery remain false; manual Queue controls remain the sole enabled flag.
No token was created or entered, no Shortcut was configured, and no source
content was submitted.

The minimum manifest and bundle checks passed (18 tests across two files),
`pnpm build` passed, and the approved bundle was pushed. `clasp deployments`
confirmed the separate Version 10 deployment while Version 9 remains listed as
owner-only. An unauthenticated GET followed to the fixed rejection JSON. A
synthetic unauthenticated POST with all intake disabled returned the expected
`{"status":"rejected","error_code":"disabled"}` after following Google's
one-time content redirect; no Queue or audit mutation occurred. At 20:39:47 EDT editor health
passed all ten headers, New York time, no send capability, and the expected
flags. The trigger count was not rechecked in this step. No Google email,
message, or Gmail draft was sent or created.

## 2026-09-22 evening EDT anonymous Shortcut guard and Chrome reachability

Independent review found that Version 10 wired only the authenticated request
quota. The Apps Script wrapper now adds a lock-protected global cap of 10
requests per minute before parsing an anonymous POST, separate from the
30-per-minute authenticated quota. The global bucket also counts valid requests,
so it sets the effective single-user capture ceiling at 10 per minute. Apps
Script does not expose a trustworthy caller address to this handler, so the
global cap limits request cost but does not eliminate denial-of-service risk.
The focused deployed-bundle regression passed (17 tests). PR #55 merged at
`7229003`; repository verification and CodeQL checks passed. The active separate
Shortcut deployment is Version 11, with `ANYONE` access and owner execution;
the Version 9 owner-only deployment remains unchanged.

Cam applied the Google Admin `script.googleusercontent.com` insecure-content
allowlist for the CapturedByCam organizational unit. Chrome's site details then
showed Insecure content set to Allow. Opening the active Version 11 URL in
Chrome reached Google's content host and returned only the fixed
`{"status":"rejected","error_code":"method_not_allowed"}` response to a
browser GET. This verifies the browser route and safe GET rejection, not the
authenticated Shortcut POST path or a device capture. No write request was
sent. Shortcut intake and every other automatic feature remain disabled;
`MANUAL_WRITES` is the only true flag, `cccHealth` passed the ten-header and
New York time checks with no send capability, and the unfiltered trigger check
showed zero triggers. No Google message or draft was sent or created.

## 2026-09-22 Gmail checkpoint continuation

After the browser reachability check, a single manually invoked
`cccReconcileGmail` call returned `status=more`, with one item processed and
zero excluded or failed. The durable version 2 checkpoint advanced to
`nextThread=8` across 12 reference shards; it remains in `processing` with no
retry or error. This is one bounded step, not completion of the 30-day sweep.
`CCC_GMAIL_INTAKE` was restored to false immediately after the invocation.

The following editor health run passed all ten sheet headers, New York time,
and no-send capability. Gmail, Studio, Shortcut, drafting and briefing flags
were false; only the accepted manual Queue controls remained enabled. The
unfiltered Apps Script Triggers page showed zero triggers. A fresh clone of the
active project matched the repository bundle and manifest after normalizing
build-root comments; no deployment or configuration change was made during
that readback. No Google email, message or Gmail draft was sent or created.

Later that evening, one additional bounded `cccReconcileGmail` invocation
returned `status=more`, with one item processed and zero excluded or failed.
The version 2 checkpoint advanced from `nextThread=8` to `nextThread=9` across
12 reference shards, still in `processing` with no retry or error. Intake was
restored to false immediately afterward. The following `cccHealth` run again
passed all ten workbook headers, New York time, and no-send capability; every
automatic feature flag was false and only guarded manual Queue controls were
enabled. No message or draft was sent or created.

A fresh Google Admin page readback is waiting at the account's required passkey
step-up. The earlier Chrome site-details read showed Insecure content set to
Allow, and the Version 11 browser GET reached the content host and returned its
fixed safe rejection. No Shortcut write or device capture has been tested.

## 2026-09-23 seven-day Gmail pilot attempt

Cam confirmed the initial pilot is limited to seven days; defer the separate
30-day backfill until the pilot is working and accepted. The configured default
lookback is seven days. Several bounded `cccReconcileGmail` invocations returned
`status=more`; a later invocation stopped with sanitized
`failure_kind=google_api_failure`. The underlying Google API response is unknown,
so this run is incomplete. The cursor was not reset after the failure.

`CCC_GMAIL_INTAKE` was restored to false. Read-only `cccGmailReadProbe` passed with
`bounded_days=7`, one sampled message, verified metadata, no raw content stored
and zero mutations. `cccHealth` then passed all ten workbook headers,
`America/New_York` and `send_capability=false`; every automatic flag was false
and only `MANUAL_WRITES` was true. No Google email, message, or draft was sent
or created. Do not resume reconciliation until the Google API failure is
understood; do not start the 30-day backfill.

## 2026-09-23 07:00 EDT read-only failure triage

The 01:33:19 editor execution's Cloud log contains only the controlled
`failure_stage=reconciliation` and `failure_kind=google_api_failure` result.
Source tracing narrows that label: Gmail profile, list and message exceptions
are converted to `GmailReadError` inside `GmailMetadataReader`, and Sheets batch
exceptions become `sheet_commit_uncertain`. A direct `GoogleJsonResponseException`
reaching the outer handler can arise from a Sheets values read or spreadsheet
metadata lookup. Thus the earlier per-message Gmail API attribution was
unsupported; the Sheets read path is the stronger diagnosis. The precise
provider response and whether the failure was transient remain unknown.

A separate source branch adds fixed, content-free labels for Sheets values and
metadata read failures, with bundle tests covering both paths and redaction.
It has not been synced to Apps Script or used to resume reconciliation. Two
07:02 read-only `clasp run cccHealth` attempts failed before script execution
with Apps Script storage `NOT_FOUND`; the Executions page shows zero-second
failed Execution API entries. No cursor, Queue, flags, trigger or deployment was
changed. The last confirmed live flag posture remains the 01:35:56 editor
health check. Keep intake off and preserve the cursor.

## 2026-09-23 Phase 1 Gmail pilot completion

PR #60 merged at `34ca466a0631c052f78c8f6b895b499a23ebef86`, PR #61
merged at `e98e043cd9ee0f1d4199f21d3b498e1b5e2f6af6`, and PR #62
merged at `1517f5579ab408753cda8857e3dc2ddd2580f1ae`. The first two
changes preserve sanitized outer errors while distinguishing Sheets values and
metadata reads and naming only the fixed table/read target. The live diagnostic
identified `Studio_Inbox:headers`, showing the original generic error was a
Sheets read failure. Source review then found the bounded Gmail entrypoint was
reading every workbook header before each one-thread transaction even though
the repositories already validate the tables they use. PR #62 removed only that
redundant preflight and added a regression assertion that a Gmail run does not
read `Studio_Inbox`.

Focused integration verification passed before each merge. The final code
change passed the 19-test Apps Script bundle suite, `pnpm typecheck`,
`pnpm build`, and required CI. The reviewed bundle was pushed to the approved
Apps Script project. A fresh source pull matched `dist/Code.js`; the manifest
remained owner-only with `access=MYSELF` and `executeAs=USER_DEPLOYING`.

The existing version 2 checkpoint was preserved throughout diagnosis and
resumption. The fixed seven-day window was
`2026-09-16T04:55:06.000Z` through `2026-09-23T04:55:06.000Z`.
Its four reference shards contain 65 message references covering 53 unique
threads. Rapid repeated manual calls later produced controlled
`sheet_values_read_failure` results at `Audit_Log:rows`; those calls made no
cursor advance and processing resumed from the same checkpoint after pacing.
No retry record or blocked state was introduced.

At 10:09:23 EDT, the last bounded call returned
`{"ok":true,"status":"complete","processed":0,"excluded":1,"failed":0}`.
Direct Config readback then showed `phase=complete`, `nextThread=53`,
`completedThrough=2026-09-23T04:55:06.000Z`, `retry=null`, and
`error_code=null`. `CCC_GMAIL_INTAKE` was saved as false. At 10:11:12 EDT,
`cccHealth` returned `ok=true`, all ten exact headers valid,
`America/New_York`, all six automatic flags false, `MANUAL_WRITES=true`, and
`send_capability=false`.

No Google email, Chat message, Gmail draft, trigger, Shortcut capture, Calendar
change, or raw-content persistence was performed. The bounded Gmail pilot meets
the Milestone 3 exit condition and closes Phase 1. The separate 30-day backfill
remains deferred. This does not complete V1 or authorize unattended daily use;
the remaining provider, device, recovery, draft, and working-week gates remain
tracked in issue #32.

## 2026-09-23 optional 30-day backfill stop

PRs #65, #66, and #67 added the bounded batch runner, six-second inter-step
pacing, and transient Sheets read retries. Their focused tests and required CI
passed, and the reviewed source was deployed to the approved Apps Script
project. The fixed 30-day window enumerated 12 immutable reference shards with
193 unique threads. Manually invoked bounded batches advanced the version 2
checkpoint to `nextThread=135`.

The last invocation recovered from one transient spreadsheet metadata-read
failure and returned
`{"ok":true,"status":"more","steps":8,"processed":6,"excluded":2,"failed":0}`.
Cam then accepted stopping the optional backfill there. Config readback showed
`phase=processing`, `nextThread=135`, 12 shards,
`completedThrough=2026-09-23T04:55:06.000Z`, `retry=null`, and
`error_code=null`. `CCC_GMAIL_INTAKE` was saved as false. No Google message,
Gmail draft, or trigger was created. The checkpoint is retained only for an
explicit future resume request.

## 2026-09-23 populated-data recovery verification

A new private workbook copy was created from the populated active workbook
without copying collaborators or comments. Direct settings and sharing readback
showed Restricted access with Cam as sole owner, United States locale, and
Eastern time. Fresh XLSX exports of the active and recovery workbooks contained
the same 11 sheets. Normalized cell/formula data, merged ranges, freeze panes,
and dimensions produced identical per-sheet fingerprints.

The recovery export includes 145 Queue rows, 171 Audit_Log rows, the current
Briefing projection and Config checkpoint, and the 17-column Commitments table.
The active workbook was not overwritten or rebound. The private resource ID and
evidence location are recorded only in ignored `.local/PILOT_RESOURCES.md`.
This closes the populated-data copy-and-verify gate; the older-runtime recovery
path remains an incident-only procedure that requires coordinated binding.

## 2026-09-23 current briefing acceptance

Fresh XLSX exports bracketed two controlled `cccBuildBriefing` calls against the
current populated workbook. The first call at 12:34:41 EDT returned
`{"ok":true,"status":"generated","briefingId":"brief_1cfcefad02fa4311f4b47d53","sections":8,"deliveryChannel":"none"}`.
The immediate replay at 12:34:59 EDT returned `status=duplicate` with the same
briefing ID, eight sections, and no delivery channel.

The post-run export differs from the pre-run export only in `Briefing_View` and
`Briefing_History`. The generator appended 153 projection rows once across all
eight required sections and one history row for 144 unique items. The history
row records `delivery_status=generated`, `delivery_channel=none`, and no error.
All other sheets were unchanged, which confirms that the duplicate call did not
append a second projection or history record.

`CCC_BRIEFING_DELIVERY` was restored to false immediately after the calls. At
12:36:42 EDT, `cccHealth` returned `ok=true`, all ten exact workbook headers
valid, `America/New_York`, all six automatic flags false,
`MANUAL_WRITES=true`, and `send_capability=false`. No Google message, Gmail
draft, trigger, or other delivery action was created. This closes the current
briefing generation and same-input duplicate gate without enabling unattended
delivery.

## 2026-09-23 Mac Shortcut and write-only endpoint acceptance

Cam authorized the private Shortcut credential and the required local Shortcut
configuration. A new 256-bit token was stored only in Apps Script Script
Properties and the local **Add to Communication Command Center** Shortcut. The
anonymous Version 11 URL remains only in the ignored private resource record and
the local Shortcut. Neither value was added to GitHub, Sheets, screenshots, or
tracked files.

The live endpoint passed bounded synthetic checks. With intake off, a correct
token returned `rejected/disabled`. During the controlled enabled window, a
wrong token returned `rejected/unauthorized`; one fixed UUID returned
`needs_review`, then `duplicate` with the same item ID; an oversized body
returned `rejected/payload_too_large`; and eleven concurrent wrong-token
requests produced seven unauthorized and four rate-limited responses. The flag
was returned to false after each test window.

The native Mac Shortcut was changed from the setup guard to Receive Share Sheet
input, a non-administrator `zsh` action, and status-only Show Result. The shell
performs the documented trim, empty/size checks, ISO timestamp, UUID, fixed
review-only schema 1.0 payload, authenticated POST, and bounded status mapping.
It accepts Share Sheet input as arguments to avoid a blocking stdin conversion
and uses the clipboard only when no argument exists. No request text is written
to disk.

The final installed shell allocates one UUID before a two-attempt request loop;
one automatic transport retry therefore reuses the exact same in-memory payload
and idempotency key. A sanitized copy passed `zsh -n`, and final action readback
confirmed the UUID-before-loop and same-payload structure.

Two installed-Shortcut synthetic captures were observed in Queue in addition to
the fixed-UUID endpoint acceptance row. All three `apple_share_sheet` rows are
`open` / `other` / `later` / `unknown`; the fixed UUID replay produced only one
item. The Queue schema contains no `shared_text`, `auth_token`, `contact_hint`,
`app_hint`, or `model_fields` headers. The final native configuration was read
back with Share Sheet input, argument passing, administrator mode off, Show
Result attached to Shell Script Result, and `CCC_SHORTCUT_INTAKE=false`.

This closes the Mac device and authenticated write-only Shortcut gate. The
installed shell implementation is macOS-only; no iPhone/iPad installation is
claimed. No Google email, Chat message, Gmail draft, trigger, Calendar change,
or private source-content capture occurred.
