# Milestone 4 — Workspace Studio progress and next steps

## Historical position on 2026-09-22

**The local preparation below is historical evidence. The accepted private custom-step implementation still requires account-level acceptance.**
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
  Cam subsequently authorized cleanup, merge, and continued implementation.
  Google/account operations remain separate approval gates.

Subsequent accepted decisions supersede the proposed path in this historical snapshot. [Decision 107](../wayfinder/tickets/107-studio-custom-step.md) uses a private custom Apps Script step for strict, bounded metadata staging only: it creates no Gmail draft, adds no scope, and cannot send. [Decision 108](../wayfinder/tickets/108-native-draft-create-only.md) keeps native create-only Gmail drafting separate and gated on a trusted context, compose authorization, runtime binding, and provider acceptance.

## Delivered locally

- Historical [versioned flow blueprint](../../studio/flow-manifest.json): starter,
  ordered built-in actions, complete staging mappings, SHA-256 prompt hashes,
  unresolved deployment bindings, disabled drafting, and no send steps. It is
  planning evidence, not the current accepted Studio implementation.
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

1. Keep `CCC_STUDIO_PROCESSING` disabled while actual starter-variable binding, model acceptance, and exact resolved-input/source retention remain unproven.
2. Literal-source acceptance is complete: one eligible Gmail resource ID staged exactly one metadata-only record, identical replay and changed-immutable-input replay made no further write, and the final disabled run left the workbook unchanged.
3. Bind the actual Gmail starter message-ID variable and separately bind the bounded interpretation string. Prove useful real-message interpretation only after retention is accepted.
4. Complete the separately gated native create-only draft acceptance only after a trusted interpreted context, compose authorization, runtime binding, and provider evidence exist. It must not replace or delete drafts.
5. Milestone 4 completes after starter binding, model usefulness, retention, and the remaining live flag-transition path pass. Native draft behavior is a separate provider gate.

## Implementation rulings

- Preserve existing staging schema 1.0. Introduce only a local extraction
  contract and validator; the existing Sheets/backend contract remains stable
  while Milestone 3 proceeds. Cost: live wiring remains follow-up work.
- Keep `CCC_STUDIO_PROCESSING` disabled while account UI availability,
  starter-variable binding, and model acceptance are unproven. The custom Apps
  Script step is accepted by decision 107 and strictly stages metadata; it
  cannot draft or send. Cost: full milestone acceptance awaits integration.
- Keep Task 11 draft persistence in a separate implementation slice from this
  Task 10 preparation. The manifest records its prerequisite. Local draft
  lifecycle work can proceed through injected interfaces while live Studio
  binding and Gmail service access remain gated.

No accepted product invariant changed. Proposed integration changes belong in
the PMC Promotion Inbox until reviewed.
