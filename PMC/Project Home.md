# Communication Command Center

Communication Command Center is a privacy-conscious, human-reviewed system for turning communication signals into deterministic operational state, priorities, briefings, and drafts.

## Current milestone

Milestone 2 — implement and verify the Sheet/backend vertical slice entirely against synthetic in-memory adapters. No cloud resources or production integrations are part of this milestone.

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

Implement [Milestone 2 issue #17](https://github.com/CapturedByCam/communication-command-center/issues/17) in a dedicated worktree, open a PR, and stop for review before merge or any Google integration.
