# Communication Command Center

Communication Command Center is a privacy-conscious, human-reviewed system for turning communication signals into deterministic operational state, priorities, briefings, and drafts.

## Current milestone

Milestone 7 private pilot preparation is underway. Immutable owner-only Apps
Script Version 8 and the empty Commitment 1.1 migration are verified. Only
guarded manual Queue controls are enabled; automatic intake, Studio processing,
drafting, Shortcut capture and briefing delivery remain disabled. V1 is not
accepted for unattended daily use. See [Current State](Current%20State.md) for
the exact live posture and remaining provider, device and pilot gates.

## Start here

- [Product and Architecture Spec](../docs/spec/PRODUCT_AND_ARCHITECTURE_SPEC.md)
- [Wayfinder Map](../docs/wayfinder/MAP.md)
- [Current State](Current%20State.md)
- [Handoff](Handoff.md)
- [Coverage](Coverage.md)

## Non-negotiable invariants

- V1 may draft but never send automatically.
- Code owns deterministic state; AI owns interpretation and draft language.
- Google Sheets is the V1 operational store, but never stores complete message bodies or attachments.
- Manual overrides win over model output.
- All model output is untrusted and schema-validated.
- Apple Messages capture is manual and user-selected in V1.
- Workspace Studio reacts; Apps Script validates, reconciles, and persists.
- All components use versioned canonical schemas.

## Next safe action

Resolve the privacy-compatible interpretation provider and Workspace Studio
access/retention gate, then bind and test real bounded source interpretation
without enabling an unverified worker. Complete the local Shortcut setup and
working-week pilot only after their individual acceptance gates. Preserve the
owner-only deployment and no-send boundary.
