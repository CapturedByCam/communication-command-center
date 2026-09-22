# Current State

## Verified position

- Phase 0 is active; Phase 1 has not begun.
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

## Open Wayfinder frontier

- [Shortcut endpoint authentication](https://github.com/CapturedByCam/communication-command-center/issues/7)
- [Workspace Studio capability and account-policy verification](https://github.com/CapturedByCam/communication-command-center/issues/8)
- [Gmail accounts, aliases, and exclusions](https://github.com/CapturedByCam/communication-command-center/issues/9)
- [Briefing delivery channel and cadence](https://github.com/CapturedByCam/communication-command-center/issues/10)
- [Project/contact context source](https://github.com/CapturedByCam/communication-command-center/issues/11)
- [Pilot evaluation sample and thresholds](https://github.com/CapturedByCam/communication-command-center/issues/12)

## Decision map

- [GitHub Wayfinder map](https://github.com/CapturedByCam/communication-command-center/issues/1)
- All 13 source tickets are attached to the map as GitHub sub-issues.
- Seven accepted decisions are closed with their planning-pack resolutions.
- Six unresolved decision tickets remain open.

## Next action

Verify and commit the PMC registration, then stop. A separate approval is required before Phase 1.
