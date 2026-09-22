# Project Index

- Project ID: `communication-command-center`
- Repository: `CapturedByCam/communication-command-center` (public)
- Default branch: `main`

## Architecture summary

Workspace Studio handles bounded Gmail event orchestration. Apps Script owns deterministic validation, reconciliation, deduplication, persistence, and briefing generation. Google Sheets stores operational metadata. A manual Apple Shortcut submits explicitly selected text. ChatGPT is the judgment and control layer. Human approval is required for every outbound action.

## Technology

- TypeScript on Node.js 24+
- pnpm
- Vitest, ESLint, Prettier, Ajv, esbuild
- Google Sheets, Apps Script, Workspace Studio, Gmail, Calendar, Drive
- Apple Shortcuts and Obsidian-compatible Markdown

## Key commands

- `pnpm verify`
- `pnpm validate:planning`
- `python3 scripts/validate_planning_pack.py .`

## Active workstreams

- Milestone 3 Gmail chronology and reconciliation using synthetic or sanitized fixtures
- Milestone 4 local Studio configuration and validation in parallel; see [progress and next steps](../docs/implementation/MILESTONE_4.md)
- Repository CI and public-repository protection through issue #19 and PR #20
- Deferred implementation gates listed in [Current State](Current%20State.md)

## Decisions and procedures

- [Project Home](Project%20Home.md)
- [Wayfinder Map](../docs/wayfinder/MAP.md)
- [Deployment and Operations Runbook](../docs/runbooks/DEPLOYMENT_AND_OPERATIONS_RUNBOOK.md)
- [GitHub Repository Automation](../docs/runbooks/GITHUB_REPOSITORY_AUTOMATION.md)
- [Coverage](Coverage.md)
- [Handoff](Handoff.md)
