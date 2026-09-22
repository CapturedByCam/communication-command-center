# V1 execution and activation record

Updated 2026-09-22. This record distinguishes implementation from live acceptance.

## Standing authorization and boundaries

Cam authorized implementation through Milestone 7, independent review, protected
merges, minimum Google Workspace/Cloud permissions, private resources and scoped
pilot tests. Sole mailbox: contact@elev8mediaky.com; initial lookback: 30 days;
time zone: America/New_York. No purchases, billing upgrades, paid infrastructure,
source deletion, automatic Calendar events, or unrelated account changes.

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
  The historical reloaded manual-flow inspection found no CCC/custom action. Admin is
  now authenticated, but CapturedByCam root Custom steps access is OFF; Allow unpublished
  test steps is checked but disabled, and action-time confirmation to enable access is
  pending. No Admin/OAuth/policy/runtime change occurred. The current app-owned flow is
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
| Gmail | Native read-only metadata worker, five messages per invocation, 30-day cursor | Version 1 probe passed; Version 2 produced a controlled dead letter/cursor; Version 3 exposed the RFC local-part fix; Version 4 recovered it and processed four further records with zero failures. Pilot remains metadata-only and no trigger is installed |
| Drafts | Domain lifecycle, operation ledger and reviewed create-only provider merged in PR #36 | Uninvoked and absent from the emitted runtime; no compose scope or live create acceptance; replacement/deletion unsupported |
| Studio | Versioned disabled configuration and staging validation | Test add-on installation verified; historical custom-step absence is distinct from current Admin-authenticated availability. Root Custom steps access is OFF pending action-time confirmation. A synthetic-only manual Ask Gemini run succeeded, but source binding, strict semantic acceptance, resolved-input retention meaning, and model usefulness remain unverified; disabled |
| Shortcut | Synchronous token-authenticated endpoint, size/schema limits, deduplication, redacted errors | Safe setup-blocked template exists in [Shortcut installation](../../shortcuts/SHORTCUT_INSTALLATION.md); no export, network request, token, or phone Shortcut installation; disabled |
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
   new consent. Its historical custom-step absence does not decide current availability:
   Admin is authenticated but root Custom steps access is OFF pending action-time
   confirmation. Starter binding, strict semantic acceptance, retention meaning, and
   model usefulness remain pending.
   Draft ownership/revision data remains unbound. The inspected
   Cloud project showed an expired free trial and a free-trial billing account;
   Vertex requires enabled billing. No billing upgrade was made. Free Gemini API
   terms are unsuitable for private-message processing here. An eligible existing
   billed project or a verified Workspace binding is needed before implementation
   can be completed and tested against that provider.
3. Complete the private local Shortcut token and device installation using
   [the action inventory](../../shortcuts/ADD_TO_COMMAND_CENTER.md). The owner-only
   pilot endpoint must not be mistaken for an anonymous phone-ready endpoint.
   Live invalid-token, replay, redaction and kill-switch tests precede access changes.
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
required CI, CodeQL and independent review passed. Version 6 remains deployed.
A fresh private backup is recorded in ignored `.local/PILOT_RESOURCES.md`.
Migration preflight is blocked because `clasp run cccHealth` returned storage
`NOT_FOUND`, and no authenticated editor control path was available. Flags,
triggers and full Commitments-table emptiness are unverified. No disable,
migration, source push or deployment was performed.
