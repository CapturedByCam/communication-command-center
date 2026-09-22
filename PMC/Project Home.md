# Communication Command Center

Communication Command Center is a privacy-conscious, human-reviewed system for turning communication signals into deterministic operational state, priorities, briefings, and drafts.

## Current milestone

Milestone 3 — implement and verify Gmail chronology and reconciliation first with synthetic or sanitized fixtures. No Gmail permission request, mailbox access, trigger installation, or deployment is authorized yet.

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

Implement the local-only portion of [Milestone 3 issue #21](https://github.com/CapturedByCam/communication-command-center/issues/21) in a dedicated worktree. Stop and present the exact Google authorization plan before requesting permissions or accessing Gmail.
