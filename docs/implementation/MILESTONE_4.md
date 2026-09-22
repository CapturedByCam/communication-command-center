# Milestone 4 — Workspace Studio progress and next steps

## Position on 2026-09-22

**Local preparation is implemented; live milestone acceptance remains pending.**
This work runs independently of the Milestone 3 Gmail pilot.

- Milestones 1 and 2 are accepted on `main` at `c37f9f3` and `4708371`.
- Milestone 3 remains tracked by [issue #21](https://github.com/CapturedByCam/communication-command-center/issues/21).
  Its approved scope is the sole mailbox `contact@elev8mediaky.com`, with a
  30-day initial lookback. That authorization does not grant Google access.
  A read-only snapshot of its separate worktree on 2026-09-22 found local
  chronology commits `8b01ebd` and `453f41a`, plus bounded reconciliation at
  `7f61d9e`. Those commits are not on `main`; this snapshot does not establish
  Milestone 3 acceptance or verification of its latest work.
  Its local implementation is now proposed in [PR #22](https://github.com/CapturedByCam/communication-command-center/pull/22).
- This branch is `codex/milestone-4-workspace-studio`, based on `6bf1875`.
- Implementation commit: `26924cf` (`feat: prepare Workspace Studio intake contracts`).
- Main, the Milestone 3 worktree, Gmail adapter files, and persisted schemas were
  left unchanged. Reconcile shared PMC notes when integrating the branches;
  preserve both workstreams' latest evidence.
- No Google access, real messages, Sheet writes, drafts, deployments, or flow
  test runs were performed.
- Cam approved GitHub publication on 2026-09-22. The branch is pushed;
  [issue #23](https://github.com/CapturedByCam/communication-command-center/issues/23)
  tracks the complete milestone, and
  [draft PR #24](https://github.com/CapturedByCam/communication-command-center/pull/24)
  contains this local preparation. The PR does not close the milestone issue.
  Merge and Google/account operations remain separate approval gates.

## Delivered locally

- [Versioned flow blueprint](../../studio/flow-manifest.json): starter, ordered
  built-in actions, complete staging mappings, SHA-256 prompt hashes, unresolved
  deployment bindings, disabled drafting, and no send steps.
- [Intake configuration and activation guide](../../studio/GMAIL_INTAKE_FLOW.md):
  current official capability evidence, concrete limitations, pilot case matrix,
  integration requirements, and rollback.
- [Pure staging preparation](../../src/adapters/studio/prepare-staging.ts):
  strict model/source/context validation, bounded metadata, stable message key,
  conservative risk reconciliation, formula-like value rejection, and safe
  error codes. It is not yet a live Studio binding or a draft authorization.
- Synthetic [fixture](../../tests/fixtures/studio/routine.json),
  [unit tests](../../tests/unit/studio-prepare-staging.test.ts),
  [manifest contracts](../../tests/contract/studio-flow-manifest.test.ts), and
  [repository integration test](../../tests/integration/studio-staging.test.ts).
- [Briefing configuration](../../studio/DAILY_BRIEFING_FLOW.md) now matches the
  accepted private 8:00 AM Google Chat decision; afternoon delivery remains off.

## Verification evidence

- Baseline: 63 tests passed before changes.
- Test-first pass: 51 new tests failed before implementation and then passed.
- Full verification: **115 tests passed**, plus formatting, lint, TypeScript,
  JSON/Zod schema cross-validation, and the repository build check.
- `pnpm validate:planning` and `git diff --check` passed.
- A neutral ESM bundle smoke test passed for routine staging, conservative
  risk handling, and rejection of an unexpected message-body field.
- The repository build check reports that no application entrypoint exists;
  it does **not** establish a deployable Apps Script integration.
- Independent review of `6bf1875..26924cf`: no actionable defects; acceptable as
  local preparation only. Live canonical deduplication, promise reconciliation,
  manual overrides, date normalization, and draft idempotency remain outside
  this change and explicitly unverified integration gates. Real-message
  classification accuracy is not established by synthetic risk tests.

## Remaining gates and next actions

1. Review draft PR #24 against the local scope and keep issue #23 open for
   the remaining milestone acceptance work. No merge is authorized here.
2. Integrate the accepted Milestone 3 contracts, keeping authoritative Gmail
   chronology, canonical deduplication, manual overrides, and missed-event
   recovery in the backend. A stable staging key is not itself deduplication.
3. Inspect the real Studio variables and permissions at the documented approval
   gate. Verify Email ID, timestamp/run metadata, private Sheet behavior, and
   original-thread draft targeting using a specific approved synthetic message.
4. Resolve the missing deterministic binding before any flow writes metadata or
   creates drafts. Built-in availability does not prove schema validation,
   registry/freshness checks, or atomic draft idempotency. Bring any proposed
   custom step/webhook or change in draft ownership back for a focused decision.
5. Implement the selected binding and draft lifecycle/operation ledger (plan
   Task 11), prove independent kill switches and safe uncertain-write recovery,
   and present exact account, resources, scopes, test actions, and rollback.
6. After approval, manually build the flow from the pinned artifacts and run
   the synthetic case matrix. Test runs perform real actions. Record one
   canonical item and one correct-thread routine draft; high-risk cases must
   produce no automatic draft, with zero sends and no raw body retention.
7. Claim Milestone 4 complete only after those account-level results pass.
   Briefing generation and delivery remain Milestone 6; Shortcut remains
   Milestone 5.

## Implementation rulings

- Preserve existing staging schema 1.0. Introduce only a local extraction
  contract and validator; the existing Sheets/backend contract remains stable
  while Milestone 3 proceeds. Cost: live wiring remains follow-up work.
- Keep the blueprint disabled because required deterministic bindings are
  unproven. A custom action or changed architecture is a proposal, not an
  accepted decision. Cost: full milestone acceptance awaits integration.
- Keep Task 11 draft persistence separate from this independent Task 10 work.
  The manifest records its prerequisite instead of implementing an uncoordinated
  Gmail writer. Cost: draft lifecycle work remains before the live pilot.

No accepted product invariant changed. Proposed integration changes belong in
the PMC Promotion Inbox until reviewed.
