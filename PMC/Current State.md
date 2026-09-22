# Current State

## Verified position

- Phase 0 is complete and its Wayfinder decision frontier is resolved.
- Milestone 1 local domain work is authorized; no Google service access is authorized.
- The planning pack and Phase 0 package/build/test skeleton are committed to private `main`.
- Foundation commit: `c2823de` (`chore: initialize communication command center`).
- The local repository root is also the approved Obsidian vault root.
- No Apps Script deployment, Workspace Studio flow, Gmail permission request, production communication access, or production data ingestion has occurred.
- No cloud application resources have been deployed.

## Accepted decisions

- Google Sheets is the V1 operational store.
- Code owns state; AI owns interpretation.
- V1 drafts but never sends automatically.
- Apple Messages capture is manual Share Sheet capture.
- Only operational metadata, previews, and source references are retained outside source systems.
- ChatGPT is the judgment and control layer.
- Workspace Studio reacts; Apps Script performs canonical normalization and reconciliation.
- Manual overrides win and schemas are versioned.
- The single-user Shortcut pilot uses one high-entropy shared secret with a kill switch and no routine manual rotation.
- Required Workspace Studio actions are visible; Skills are out of V1 and successful test runs remain a later account-policy gate.
- Gmail V1 is limited to the primary work mailbox and verified aliases; automated and bulk mail are excluded.
- The morning alert uses private Google Chat at 8:00 AM `America/New_York` and links the private `Briefing_View` Sheet; afternoon delivery starts disabled.
- Curated `Contacts` and `Projects` tabs are canonical. ChatGPT memories are suggestion-only during explicit review and require approval before persistence.
- Pilot evaluation uses at least 50 approved or sanitized examples with the thresholds in the architecture specification.

## Deferred implementation gates

- Record the exact verified work mailbox aliases and initial pilot lookback window before requesting Gmail permissions or accessing production data.
- Prove required Workspace Studio actions with successful test runs under the real account policy during the authorized Studio milestone.
- Verify Shortcut kill switch, redacted logging, rate limiting, and assisted rotation before deployment.

## Decision map

- [GitHub Wayfinder map](https://github.com/CapturedByCam/communication-command-center/issues/1)
- All 13 source tickets are attached to the map as GitHub sub-issues.
- All 13 decision tickets are closed with owner-approved resolutions.
- The reconciled map issue is closed as completed.
- [Milestone 1 implementation issue #15](https://github.com/CapturedByCam/communication-command-center/issues/15) is open for the local domain core.

## Next action

Implement issue #15 locally in a dedicated worktree and request review before merge. Stop before any Google permission request, cloud resource creation, deployment, or production communication access.
