# Communication Command Center — Implementation Roadmap

Planning date: September 21, 2026
Owner: Cam
Implementation lead: Codex
Product, architecture, and behavioral review: ChatGPT

## Executive decision

Build a hybrid system:

- Google Workspace Studio reacts to new Gmail and produces bounded AI extraction and routine review-only drafts.
- Apps Script validates, reconciles, deduplicates, persists, builds briefings, and accepts write-only Shortcut intake.
- Google Sheets is the V1 operational source of truth.
- Apple Shortcuts provides explicit Share Sheet capture, not unattended Messages access.
- ChatGPT is the judgment, prioritization, difficult-drafting, and natural-language control layer.
- Codex owns code, tests, deployment, GitHub, and project memory.
- Cam approves permissions, external writes, sample data, and release gates.

## Non-negotiable boundaries

- No automatic sending in V1.
- No complete message bodies in Sheets or logs.
- Code owns state; AI proposes interpretation.
- Manual overrides always win.
- No secrets in Git or Sheets.
- All components use versioned schemas.
- Every external deployment has verification and rollback.
- Existing unrelated repositories remain unchanged.

## Milestone roadmap

### 0. Foundation
Create a private repository, commit the planning pack, connect PMC, create the Wayfinder map and tickets, and verify the Google account. No cloud deployment yet.

### 1. Domain contracts
Implement schemas, state rules, priority, draft risk, fixtures, and contract tests.

### 2. Sheet and Apps Script backend
Create the workbook manifest, idempotent repositories, audit log, feature flags, and synthetic vertical slice.

### 3. Gmail ingestion and reconciliation
Resolve authoritative thread chronology, process Studio staging, detect missed events, update waiting state, and track promises.

### 4. Workspace Studio
Build the Gmail Intake flow using built-in Gmail, Gemini, and Sheets steps. Create drafts only for routine low-risk messages. Never use Send a reply.

### 5. Apple Share Sheet capture
Build the fixed-schema Shortcut, close the endpoint-authentication decision, test idempotency, and verify content minimization.

### 6. Daily briefing and ChatGPT operations
Generate deterministic briefing sections, deliver on the approved schedule, and support on-demand ChatGPT commands such as Run comms, snooze, resolve, and draft item.

### 7. Hardening and pilot
Verify kill switches, token rotation, backups, privacy, rollback, drift, and a 50-example evaluation before production approval.

### 8. Optional Phase 2
Consider a local Messages bridge, native App Intents, stronger Cloud Run authentication, a ChatGPT custom connector/MCP surface, or a database migration only after V1 usage data.

## ChatGPT responsibilities

- Resolve product and architecture decisions with Cam.
- Maintain behavioral rules, prompts, edge cases, and acceptance criteria.
- Review PRs and milestone behavior.
- Handle judgment-heavy client, pricing, complaint, scope, contract, schedule, personal, and aviation-employment drafts.
- Operate the queue on demand through connected Gmail, Calendar, Drive, and Sheets.
- Never become the background polling or state engine.

## Codex responsibilities

- Create and maintain the private repository.
- Implement schemas, Apps Script, Gmail/Sheets/Calendar adapters, Shortcut endpoint, tests, logs, and deployment tooling.
- Build Workspace Studio flows from checked-in specifications.
- Use TDD, worktrees, small commits, PR review, and verification-before-completion.
- Set up PMC after Cam chooses a vault.
- Convert the Wayfinder map to GitHub issues.
- Never deploy, widen permissions, or touch production data without approval.

## Cam's approval gates

- Local project path and private GitHub repository.
- New or existing PMC vault.
- Google Workspace account and OAuth permissions.
- Gmail accounts and aliases in scope.
- Shortcut authentication choice and token storage.
- Briefing channel and schedule.
- Sanitized/approved pilot examples.
- Pilot-to-production release.

## Core acceptance criteria

- The same event processed twice creates one item.
- Routine Gmail creates a draft but sends nothing.
- High-risk communication is queued for judgment.
- Replies update waiting state correctly.
- Outgoing promises create commitments.
- Invalid Shortcut input is rejected safely.
- No full body appears in Sheets or logs.
- Briefing order is deterministic and complete.
- Manual overrides survive reconciliation.
- Each kill switch works independently.

## Immediate next action

Codex should perform Phase 0 only using `START_HERE_CODEX.md`: verify targets, create the private repository, commit the pack, run validation, connect PMC, and create the GitHub Wayfinder issues. Cloud deployment waits until the open decision tickets are resolved.
