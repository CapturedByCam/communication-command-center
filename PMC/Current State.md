# Current State

Updated 2026-09-22.

## Verified position

- Milestones 1 and 2 are merged through PR16 and PR18.
- Gmail domain reconciliation PR22, Studio preparation PR24 and draft lifecycle
  PR28 are merged. Issues21 and 23 retain live acceptance work; issue32 tracks remaining runtime,
  device and elapsed-pilot acceptance.
- The public GitHub repository and its required checks/reviews remain protected.
- The authorized V1 release integrates runtime Sheets/Gmail adapters, guarded
  synchronous Shortcut intake, commitments/deadlines, deterministic briefing,
  privacy tests and operational tooling. Final release evidence is in Handoff.
- A private pilot workbook and bound Apps Script project exist. The real runtime
  uploaded and bootstrap executed successfully, creating ten manifest tabs with
  every feature disabled. The workbook uses America/New_York.
- A private pre-activation backup exists. Both Sheets have only the approved owner.
- Immutable owner-only version 2 is deployed and matches the tested build.
- Live health and a bounded Gmail metadata probe passed; zero mailbox mutations.
- Guarded owner-only Queue controls support Resolve, Reopen and explicit-offset
  Snooze with manual overrides, conflict checks and atomic audits. The independent
  `CCC_MANUAL_WRITES` flag defaults off; live menu acceptance remains open.
- No Gmail ingestion, draft, Google notification, trigger or installed Shortcut is
  claimed. The Mac relocked during a manual pilot flag save; its outcome is unknown.
  Inspect saved flags before live worker tests.

## Accepted decisions

- Cam's overnight standing authorization covers minimum Workspace/Cloud scopes,
  private resources, deployment, in-scope tests and reviewed merges. Older local-only
  restrictions are superseded for this task.
- Sole mailbox contact@elev8mediaky.com; initial 30-day lookback; America/New_York.
- All Google email/Chat messages remain unsent, including self notifications.
- Sheets holds bounded operational metadata, never bodies or credentials.
- Code owns schema, IDs, chronology, persistence, retries and manual overrides.
- Model output remains untrusted; drafts require ownership/freshness checks.
- Apps Script owns draft safety; unsafe native Studio draft actions stay disabled.
- The deployed metadata pilot uses only selected-message metadata and produces
  generic needs-review records. No full-thread classification is implied.
- Briefing generation writes the private Sheet only; no delivery transport.
- A private owner-only deployment is the initial posture. Phone access awaits
  token provisioning and live acceptance; no unauthenticated queue reads.
- No paid upgrade was authorized or performed; no real-world pilot threshold waived.

## Next action and blockers

See [V1 execution record](../docs/implementation/V1_EXECUTION.md) for exact access,
provider and elapsed-pilot gates, and [Handoff](Handoff.md) for continuation.
Computer Use attempted automatic unlock and reported that manual unlock is required. The available Cloud billing is a free-trial account;
a privacy-compatible model binding within existing entitlements is unverified.

## Decision and operating records

- [Wayfinder map](../docs/wayfinder/MAP.md)
- [Runtime operations](../docs/runbooks/RUNTIME_OPERATIONS.md)
- [Deployment runbook](../docs/runbooks/DEPLOYMENT_AND_OPERATIONS_RUNBOOK.md)
- [Synthetic evaluation](../docs/evaluation/SYNTHETIC_V1_REPORT.md)
