# Current State

Updated 2026-09-22. V1 is not accepted for unattended daily use.

## Verified position

- Immutable owner-only Apps Script Version 6 deployed at 11:51 EDT from source
  `e23ee3a` (integrated candidate `42fc635`). Source SHA
  `30ef121478437e554e485e91dcb32966a80592257a29998106f0e955c6f40853` and semantic
  manifest SHA `6d2df263d5686e5b903c655da411ce96d4403c71d249321f220be50ce7f0689d`
  match the verified build. Access remains `MYSELF` / `USER_DEPLOYING`;
  unauthenticated requests redirect to Google sign-in. Version 5 is the prior
  verified rollback target. No OAuth scope changed.
- At 12:12:37 EDT, editor `cccHealth` returned `ok:true`: ten valid headers,
  `America/New_York`, `MANUAL_WRITES:true`, the other six flags false, and
  `send_capability:false`. At about 11:51 EDT the unfiltered Triggers page showed
  zero triggers; `cccDisableAll` at 12:05:53 confirmed zero managed triggers.
  Only guarded manual Queue controls are enabled.
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
- The prior briefing test persisted eight sections and one history record without
  delivery; its replay changed nothing. That projection predates the five Queue
  items and must not be presented as a current briefing. Review Queue directly
  until a fresh accepted projection exists.
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

## Commitment source update awaiting deployment

The repository now includes a strict 1.1 Commitment storage contract, immutable
outbound provenance, a guarded observation writer, and an explicit empty-only
header migration. Briefing consumes actual persisted provenance and accepts a
named manual resolver. See [storage and migration](../docs/implementation/COMMITMENT_STORAGE.md).
This source update is not deployed: Version 6 and the live eleven-column
Commitments table remain unchanged. Provider binding, automatic outbound
extraction and complete chronology remain open; no promise was captured live.

## Accepted decisions

Standing authorization covers private deployment, in-scope tests and independently
reviewed protected merges. Sole mailbox: `contact@elev8mediaky.com`; initial
lookback: 30 days; relative dates: America/New_York. Code owns state and validates
model suggestions. Manual overrides win. Sheets hold metadata, not message bodies.
All Google messages remain unsent; Codex coordination is authorized.

## Remaining gates

1. Studio test add-on installation is verified without new consent. The historical
   manual-flow inspection found the custom step absent. Admin is now authenticated, but
   CapturedByCam root Custom steps access is OFF; enabling it awaits action-time
   confirmation and no Admin/OAuth/policy change occurred. The flow now has a
   synthetic-only manual Ask Gemini run at 12:26:22 EDT with sources off, no skills,
   Text output, and no custom/Google mutation step. The strict schema accepted its 12
   fields; a pure synthetic `knownContact:false` staging call returned review-only with
   no persistence/provider call. Stored synthetic output is visible for a reported 40
   days, but resolved-input/source retention is unknown. Project evidence, starter
   binding, retention meaning, and model usefulness remain open. No paid upgrade or
   free-tier private-message workaround is authorized.
2. Draft creation needs compose authorization, a trusted eligible context resolver
   and bounded live acceptance. Native replacement/deletion return unsupported to
   protect human edits. Outbound promise extraction and the new Commitment storage writer
   still need migration, deployment and a verified interpretation/runtime binding;
   local integration tests alone do not establish that product behavior.
3. The native Shortcut is a setup-blocked two-action template, with no export,
   endpoint/token configuration, network request or device acceptance. Complete
   device setup and prove the write-only authentication path without exposing Queue
   reads. Owner-only web access is not proof of phone compatibility.
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
