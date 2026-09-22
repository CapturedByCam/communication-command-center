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
- Immutable owner-only web-app version 1 is deployed. Its runnable source and
  semantic manifest match the tested build. Unauthenticated requests redirect to
  Google sign-in and expose no Queue content.
- `cccHealth` passed at 03:14:57 EDT: all ten headers valid and six flags false.
- `cccGmailReadProbe` passed at 03:15:49 EDT: approved mailbox, 30-day window,
  one metadata message, no raw content stored and zero mutations.
- The Mac locked again while saving Gmail/briefing flags for manual pilot tests.
  Save outcome is unknown; no worker or briefing execution followed. No triggers
  have been installed. Verify properties before continuing.

## Runtime release verification

Commit e13f333 binds the guarded runtime. `pnpm verify` passed all 325 tests in 32
files, including unit, contract, integration, schema and callable-bundle checks;
lint, typecheck, formatting and build passed. `pnpm validate:planning` passed.
Independent final review reported no merge blockers. This is local verification;
live worker and model acceptance remain separate.

## Feature posture

| Component | Implementation | Live posture |
| --- | --- | --- |
| Queue/Sheets | Actual adapter and atomic bounded commits | Ten tabs initialized; live health passed; no mailbox ingestion |
| Gmail | Native read-only metadata worker, five messages per invocation, 30-day cursor | Read probe passed; flag-save outcome unknown; worker/replay acceptance remains |
| Drafts | Domain lifecycle and operation ledger | No bound provider, no compose scope, disabled |
| Studio | Versioned disabled configuration and staging validation | ID equivalence and safe binding unverified; disabled |
| Shortcut | Synchronous token-authenticated endpoint, size/schema limits, deduplication, redacted errors | No token installed, no phone Shortcut installed; disabled |
| Briefing | Deterministic eight-section append-only view/history | Flag-save outcome unknown; live generation pending; no message transport |
| Calendar | Reviewable candidates only | No Calendar mutation or runtime scope |

The native Gmail pilot reads only the selected message metadata, without bodies,
subjects or older thread history. It records generic needs-review state. It cannot
claim full thread interpretation, actionability, useful summaries, or draft readiness.
Studio processing remains disabled until a provider can prove bounded authoritative
source IDs and strict pre-persistence validation.

## Remaining access and capability gates

1. Unlock the Mac and inspect the saved flags in the pilot Apps Script project.
   Health and Gmail access already passed. Test bounded metadata processing,
   duplicate replay, live briefing persistence and `cccDisableAll` before
   installing any trigger; logs must contain controlled codes/counts only.
2. Connect a supported interpretation provider with the required privacy behavior
   within an existing paid entitlement. Actual Studio UI did not expose arbitrary
   code/HTTP binding or reliable draft ownership/revision data. The inspected
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
