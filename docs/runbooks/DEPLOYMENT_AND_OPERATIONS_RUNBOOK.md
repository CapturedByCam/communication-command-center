# Deployment and Operations Runbook — Communication Command Center

## Operating posture

This runbook describes the private V1 pilot without treating a historical deployment version or a previous feature snapshot as current. The authoritative verified state, deployment hashes, controlled live checks, and open gates are maintained in [V1 execution](../implementation/V1_EXECUTION.md) and [PMC Current State](../../PMC/Current%20State.md). Consult both before any live operation.

The system never sends Google email or Chat. Sheets retain bounded operational metadata, not bodies or credentials. The native Gmail pilot remains metadata-only and generic needs-review; it cannot establish full-thread interpretation, model usefulness, or draft readiness. Native draft replacement and deletion remain refused. The private Shortcut remains a separate token/device acceptance gate.

## Safety classification

| Action | Treatment |
| --- | --- |
| Local tests, build, planning validation, and offline drift comparison | Safe local work |
| Health, disable, and one-feature controlled checks | Private, bounded live operation with content-free evidence |
| Token replacement and private Shortcut configuration | Assisted private operation; no token in repository or evidence |
| Sending, automatic outbound delivery, source deletion, or clearing workbook data | Prohibited |

## Global stop conditions

Stop and leave automatic features disabled if the owner, workbook, project, or deployment is not the verified target; a token or source content would enter an artifact; a test would send, draft, install a trigger, widen access, or mutate an unbounded range; or a provider response is indeterminate. Preserve only minimal content-free evidence.

## Phase 0 — Verify targets

Open the existing private bound project and workbook. Confirm the approved owner, workbook binding, owner-only deployment posture, current feature flags, and required feature gate in the execution/current-state records. Do not create or repoint a workbook as a routine check.

## Before a bounded live operation

1. Confirm the approved owner, bound workbook, and intended private Apps Script project. Stop on any mismatch.
2. Run the checked-in verification appropriate to the candidate and compare the private deployment against `dist` with `scripts/check-deployment-drift.mjs`. Keep retrieved project content under ignored `.local/`.
3. Run `cccHealth()` and record only controlled status/counts. Confirm the workbook headers, time zone, flags, and no-send posture.
4. Verify a private workbook backup before a bounded test series that can mutate Sheet metadata; create one if the relevant recovery point is missing. Restore only by creating and validating a new private workbook; never clear, overwrite, import into, or replace the current workbook.
5. Enable at most the one explicitly tested feature. Recheck its flag, owner, and workbook binding at the point of write. Do not create a trigger unless that operation is separately part of the verified test.
6. Inspect bounded, content-free results and then run `cccDisableAll()`. Require no enabled flags and no managed triggers remaining unless the current state record explicitly authorizes a guarded manual-control posture.

## Feature boundaries

| Capability | Required boundary |
| --- | --- |
| Queue controls | Owner-only, flag-gated, selected single row, complete snapshot recheck, shared lock, atomic Queue/Audit commit. Direct grid edits can still race the final provider write. |
| Gmail reconciliation | Approved mailbox only; seven-day initial pilot, with a separate 30-day backfill deferred until acceptance; selected-message metadata only, no bodies, subjects, older thread history, or automatic trigger. |
| Briefing | Private Sheet projection/history only; no delivery transport. |
| Drafts | Create-only provider preparation requires fresh approved source/context and separate acceptance. No send, replacement, or deletion call. |
| Studio | Keep disabled until account availability, starter binding, strict source validation, and model usefulness are separately proven. |
| Shortcut | Keep disabled until endpoint/device acceptance is complete. Use [token rotation](SHORTCUT_TOKEN_ROTATION.md) after exposure or before hardening; never expose a token in evidence. |

## Rollback and incidents

For unexpected behavior, suspected token exposure, source/secret retention, target mismatch, or indeterminate write:

1. Run `cccDisableAll()` from the authenticated private project when it is safe to do so.
2. Preserve only minimal content-free evidence; do not copy source text, tokens, payloads, cookies, or OAuth material into logs, Sheets, fixtures, or notes.
3. Preserve the private workbook and backup. Do not delete source messages, drafts, records, or ranges as diagnosis.
4. If code rollback is required, first verify workbook/schema compatibility. Version 6 or older cannot run against the migrated Commitment 1.1 workbook; restore the pre-migration backup to a new private workbook and coordinate its binding before repointing the owner-only deployment. Then run the kill switch again and recheck health.

Rollback never sends a message, deletes source data, or proves recovery by itself. Re-enablement requires the relevant controlled acceptance evidence.

## Evidence record

A valid operational record contains the tested commit/version, local check result, deployment-drift status, header/time-zone/flag result, controlled fixed statuses and counts, and remaining gates. It excludes resource IDs, tokens, selected text, source bodies, model output, OAuth material, and raw provider errors. See [V1 execution](../implementation/V1_EXECUTION.md) for chronological live evidence rather than appending conflicting version snapshots here.

## Routine operations

Use only the guarded capability that the current state explicitly permits. Before and after a controlled test, verify health and use `cccDisableAll()` unless an accepted manual-control posture remains active. Keep automatic intake, drafting, Shortcut capture, Studio processing, and briefing delivery disabled until their individual gates are satisfied.

## Incident procedures

For token exposure, follow [Shortcut token rotation](SHORTCUT_TOKEN_ROTATION.md). For other unexpected behavior, use the rollback and incidents procedure above. Do not delete source data, clear records, export private material, or create a workaround deployment while investigating.

## Final evidence packet

Before accepting a pilot capability, record only the candidate version/commit, local validation, drift status, target/health result, feature flag result, bounded controlled statuses/counts, and unresolved gates. Link the chronology in [V1 execution](../implementation/V1_EXECUTION.md); never duplicate secrets or source content.
