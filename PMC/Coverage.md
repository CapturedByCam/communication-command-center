# Durable Knowledge Coverage

Updated 2026-09-22. The private Version 8 deployment is live, but V1 is not
accepted for unattended use. [Current State](Current%20State.md) is the live
posture record.

| Area | Status | Source |
| --- | --- | --- |
| Product behavior | Specified; real provider usefulness and working-week acceptance remain open | `docs/spec/PRODUCT_AND_ARCHITECTURE_SPEC.md`; `PMC/Current State.md` |
| Domain model | Implemented; required local and hosted checks passed for the merged source | `schemas/`; `src/domain/`; `docs/implementation/V1_EXECUTION.md` |
| Sheet persistence | Private workbook and adapter live; Commitment 1.1 header migrated with no Commitment rows | `docs/implementation/COMMITMENT_STORAGE.md`; `docs/implementation/V1_EXECUTION.md` |
| Privacy and security | Owner-only deployment, no send capability, six automatic flags off and zero triggers verified | `docs/runbooks/RUNTIME_OPERATIONS.md`; Wayfinder decisions |
| Gmail ingestion | Bounded metadata pilot created five review-only Queue rows; initial cursor incomplete; automatic intake disabled | Issue #21; `docs/implementation/BOUNDED_GMAIL_CHRONOLOGY.md` |
| Workspace Studio | Test add-on installed and synthetic-only model run verified; root Custom steps access ON with unpublished steps allowed; source binding and retention unresolved | `studio/`; Wayfinder 102 and 107; `PMC/Current State.md` |
| Apple Shortcut | Private macOS pilot accepted with authenticated write-only capture and intake returned off; iPhone/iPad acceptance remains separate | `shortcuts/SHORTCUT_INSTALLATION.md`; Wayfinder 101 |
| Briefing | Eight-section generation and replay suppression verified without delivery; current projection is stale | `docs/implementation/V1_EXECUTION.md`; Wayfinder 104 |
| Deployment | Main Apps Script deployment remains owner-only; the separate Version 11 Shortcut endpoint is anonymously reachable, token-authenticated, write-only, and disabled outside deliberate captures | `docs/implementation/V1_EXECUTION.md`; `docs/runbooks/RUNTIME_OPERATIONS.md` |
| Operations | Kill switch, health, private backup, deployment rollback drill and manual Queue controls verified; older-version recovery now requires a new legacy workbook copy | `docs/runbooks/RUNTIME_OPERATIONS.md`; `PMC/Handoff.md` |
| Incident response | Runbooks and synthetic Shortcut-token rotation verified; no live incident response claimed | `docs/runbooks/SHORTCUT_TOKEN_ROTATION.md`; `docs/runbooks/DEPLOYMENT_AND_OPERATIONS_RUNBOOK.md` |
