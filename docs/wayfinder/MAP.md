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
- [Keep briefing delivery disabled under the current no-send instruction](tickets/104-briefing-delivery.md): Generate the private Sheet view on demand; no Google Chat or email transport.
- [Use curated Contacts and Projects as canonical context](tickets/105-context-registry-source.md): ChatGPT memories may suggest records during explicit review, but nothing memory-derived persists without approval and a deterministic identifier.
- [Use the approved pilot sample and thresholds](tickets/106-pilot-evaluation.md): Evaluate at least 50 approved or sanitized examples against the specified accuracy, privacy, and no-send thresholds.
- [Validate Studio interpretation through a private Apps Script custom step](tickets/107-studio-custom-step.md): Keep a bounded metadata-only staging action private, flag-gated, and separately prove installation, starter binding, and model usefulness.

Repository operations decision, 2026-09-22: Cam made the repository public and
authorized Actions and branch protections. Require PRs and verified CI through
one default-branch ruleset, with zero required approvals for the sole-maintainer
repository. See [GitHub Repository Automation](../runbooks/GITHUB_REPOSITORY_AUTOMATION.md)
for the security settings and reproducible ruleset. This does not change the
product's private-data or deployment approval boundaries.

- [Use a create-only native Gmail draft adapter in V1](tickets/108-native-draft-create-only.md): Preserve human edits by declining unsupported conditional updates and deletes; require fresh bounded source checks before create.

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

## Accepted V1 execution decisions — 2026-09-22

Cam authorized minimum Workspace/Cloud connection, private resources and reviewed
V1 release work. All Google messages, including the earlier self-alert exception,
remain unsent. Apps Script owns deterministic validation, source IDs and draft
ownership; visible Studio steps alone do not prove those capabilities. The native
metadata pilot reads selected messages only within its bounded query and always
requires review. Full interpretation and drafts need a verified provider binding.
The private Studio-step design is documented, while account installation and
starter-variable acceptance remain separate gates; see [Studio custom Apps Script
step](../implementation/STUDIO_CUSTOM_STEP.md). See [execution record](../implementation/V1_EXECUTION.md) for evidence and gates.

Queue operator decision, 2026-09-22: owner-only Resolve, Reopen, explicit-offset
Snooze and exact waiting-state menu actions use a separate default-off flag and the shared transaction
lock. Recheck authorization and the complete selected row after the prompt;
commit Queue and Audit_Log together. See [Queue operator controls](../implementation/QUEUE_OPERATOR_CONTROLS.md).

Manual waiting-state decision, 2026-09-22: complete the documented waiting command through the guarded selected-row transaction. See [decision 109](tickets/109-manual-waiting-state.md).
