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
- [Use a shared secret for the single-user Shortcut pilot](tickets/101-shortcut-authentication.md): Use a high-entropy write-only secret with a kill switch and incident-driven or automated rotation rather than routine manual maintenance.
- [Treat visible Workspace Studio actions as provisionally available](tickets/102-studio-capability-check.md): Required actions are visible; Skills remain out of V1, and successful test runs are the later account-policy gate.
- [Limit Gmail V1 to the primary work mailbox and verified aliases](tickets/103-gmail-scope.md): Exclude automated and bulk mail; exact identities and pilot lookback are deployment configuration.
- [Deliver the morning alert through private Google Chat](tickets/104-briefing-delivery.md): Send an 8:00 AM alert linking the private `Briefing_View` Sheet; keep afternoon delivery off until the first week demonstrates value.
- [Use curated Contacts and Projects as canonical context](tickets/105-context-registry-source.md): ChatGPT memories may suggest records during explicit review, but nothing memory-derived persists without approval and a deterministic identifier.
- [Use the approved pilot sample and thresholds](tickets/106-pilot-evaluation.md): Evaluate at least 50 approved or sanitized examples against the specified accuracy, privacy, and no-send thresholds.

## Open frontier

None. Implementation must still satisfy the account, data-access, and deployment gates recorded in the specification and runbook.

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
