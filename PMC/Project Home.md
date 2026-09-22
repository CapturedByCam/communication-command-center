# Communication Command Center

Communication Command Center is a privacy-conscious, human-reviewed system for turning communication signals into deterministic operational state, priorities, briefings, and drafts.

## Current milestone

Phase 0 — establish the private repository, durable project memory, and GitHub decision map. No cloud resources or production integrations are part of this milestone.

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

Resolve an open Wayfinder decision before implementing the behavior it controls. Do not begin Phase 1 without a separate approval.
