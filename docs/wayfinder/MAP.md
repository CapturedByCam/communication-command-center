# Wayfinder Map — Communication Command Center

## Destination

Reach an implementation-ready, privacy-reviewed specification and a verified delivery path for a V1 communication command center. The map is complete when no unresolved product or architecture decision blocks the implementation plan.

## Notes

- Product owner: Cam.
- ChatGPT resolves product/behavior decisions with Cam.
- Codex implements only after the relevant decision is closed.
- Use the local Markdown tracker until the private GitHub repository exists, then create one map issue and child issues with the same titles.
- V1 means Gmail + Sheets + Apps Script + Workspace Studio + manual Apple Share Sheet capture + ChatGPT review.
- No auto-send.
- Every decision that changes a durable invariant must be added to PMC after approval.

## Decisions so far

- [Use Google Sheets as the V1 operational store](tickets/001-use-google-sheets.md): A transparent Sheet is sufficient for a single-user pilot and keeps migration optional.
- [Separate deterministic state from AI interpretation](tickets/002-code-ai-boundary.md): Code owns truth; models propose meaning and language.
- [Draft but never send automatically in V1](tickets/003-human-review.md): Every outbound communication remains human-reviewed.
- [Use manual Share Sheet capture for Apple Messages in V1](tickets/004-apple-capture.md): Avoid unattended Messages database access until the core system proves value.
- [Retain operational metadata instead of full message bodies](tickets/005-content-retention.md): Source systems remain the content store.
- [Use ChatGPT as the judgment and control layer](tickets/006-chatgpt-role.md): ChatGPT reviews and operates the queue but does not poll or own state.
- [Use Workspace Studio for fast orchestration and Apps Script for canonical normalization](tickets/007-orchestration-boundary.md): Studio reacts; Apps Script validates, reconciles, and persists.

## Open frontier

- [Select Shortcut endpoint authentication for the pilot](tickets/101-shortcut-authentication.md)
- [Verify Workspace Studio capabilities and account policy](tickets/102-studio-capability-check.md)
- [Select Gmail accounts and aliases in scope](tickets/103-gmail-scope.md)
- [Select briefing delivery channel and cadence](tickets/104-briefing-delivery.md)
- [Select the source of project/contact context](tickets/105-context-registry-source.md)
- [Approve pilot accuracy thresholds and review sample](tickets/106-pilot-evaluation.md)

## Not yet specified

- Whether a native App Intent companion is worth building after Shortcut usage is measured.
- Whether a local Messages bridge is needed after manual capture friction is measured.
- Whether ChatGPT needs a custom app/MCP surface after connected Gmail/Drive/Calendar use is measured.
- Whether Sheets should migrate after row volume, concurrency, query, or security data exists.
- Whether multiple Gmail accounts or users should be supported.

## Out of scope

- Public SaaS or team deployment in V1.
- Automatic outbound sending.
- Whole-inbox historical ingestion.
- Full-content archival in Sheets.
- Unattended Apple Messages database scraping.
- Automatic contractual, pricing, refund, complaint, or aviation-employment commitments.
