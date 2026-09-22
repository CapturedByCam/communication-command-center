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
  Snooze through a shared lock, complete row snapshot checks and atomic audit writes.
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
- Version 2 adds guarded Queue controls and a seventh flag, `CCC_MANUAL_WRITES`,
  which defaults false. CLI deployment changed source only, preserving the private
  access posture and existing properties. Version 4 live Gmail recovery, guarded
  manual controls, briefing persistence and kill-switch checks have passed. All seven
  feature flags are currently off; Version 1 remains available for rollback.

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

## Feature posture

| Component | Implementation | Live posture |
| --- | --- | --- |
| Queue/Sheets | Actual adapter and atomic bounded commits | Ten tabs initialized; live health passed; five metadata-pilot Queue rows persisted with no raw content |
| Queue controls | Owner-only menu, manual override, row-conflict detection and atomic audit | Version 4 selected replay, Resolve, unchanged-row replay, Reopen and explicit-offset Snooze passed with manual overrides and atomic audit; direct Snoozed Reopen correctly returned `STALE_STATE`; final all-off kill switch passed |
| Gmail | Native read-only metadata worker, five messages per invocation, 30-day cursor | Version 1 probe passed; Version 2 produced a controlled dead letter/cursor; Version 3 exposed the RFC local-part fix; Version 4 recovered it and processed four further records with zero failures. Pilot remains metadata-only and no trigger is installed |
| Drafts | Domain lifecycle and operation ledger | No bound provider, no compose scope, disabled |
| Studio | Versioned disabled configuration and staging validation | ID equivalence and safe binding unverified; disabled |
| Shortcut | Synchronous token-authenticated endpoint, size/schema limits, deduplication, redacted errors | No token installed, no phone Shortcut installed; disabled |
| Briefing | Deterministic eight-section append-only view/history | One Version 2 generation persisted eight sections/history with no delivery; same-ID duplicate left both views unchanged |
| Calendar | Reviewable candidates only | No Calendar mutation or runtime scope |

The native Gmail pilot reads only the selected message metadata, without bodies,
subjects or older thread history. It records generic needs-review state. It cannot
claim full thread interpretation, actionability, useful summaries, or draft readiness.
Studio processing remains disabled until a provider can prove bounded authoritative
source IDs and strict pre-persistence validation.

## Remaining access and capability gates

1. Keep all seven feature flags off while the next integration is prepared. Do not install
   a trigger or enable drafting from this pilot; retain bounded controlled-code logging.
2. Connect a supported interpretation provider with the required privacy behavior
   within an existing paid entitlement. The inspected Studio UI did not expose a
   custom step or HTTP binding. Newly published official custom-step documentation
   provides an implementation route; account availability and Admin settings still
   require verification after passkey authentication. Draft ownership/revision data
   remains unbound. The inspected
   Cloud project showed an expired free trial and a free-trial billing account;
   Vertex requires enabled billing. No billing upgrade was made. Free Gemini API
   terms are unsuitable for private-message processing here. An eligible existing
   billed project or a verified Workspace binding is needed before implementation
   can be completed and tested against that provider.
3. Complete the private local Shortcut token and device installation using
   [the action inventory](../../shortcuts/ADD_TO_COMMAND_CENTER.md). The owner-only
   pilot endpoint must not be mistaken for an anonymous phone-ready endpoint.
   Live invalid-token, replay, redaction and kill-switch tests precede access changes.
4. Collect actual model/pilot observations and human draft-usefulness ratings,
   including the required working week. [50 synthetic policy cases](../evaluation/SYNTHETIC_V1_REPORT.md)
   pass but do not satisfy those real-world thresholds.

## Completion status

V1 is **not accepted or ready for unattended daily use**. Local implementation and
resource bootstrap are meaningful progress; the remaining live binding and pilot
criteria stay open. See [Handoff](../../PMC/Handoff.md) for the release evidence.
