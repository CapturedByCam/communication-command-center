# Start Here — Codex Handoff

## First-session objective

Perform **Phase 0 only**: create the isolated project foundation, register durable project memory, and convert the local decision map into the project's issue tracker. Do not deploy Apps Script, create Workspace Studio flows, create a production Google Sheet, inspect private Gmail content, or install a Shortcut in the first session.

## Exact first prompt for Codex

> Initialize a new private project named `communication-command-center` from this planning pack. Read `AGENTS.md`, `docs/spec/PRODUCT_AND_ARCHITECTURE_SPEC.md`, `docs/wayfinder/MAP.md`, and `docs/superpowers/plans/2026-09-21-communication-command-center.md` before making changes. Use Superpowers' git-worktree and TDD workflows.
>
> Complete only Task 0 and the repository/PMC portions of Task 1. First verify the selected local repository path, GitHub owner, repository visibility, active Google account, and whether Cam wants a new or existing PMC vault. Treat any mismatch as a stop condition.
>
> Create the repository as private, preserve this planning pack under the documented paths, set up the package/build/test skeleton, run the planning-pack validator, and create the Wayfinder map plus decision tickets in GitHub after the repository exists. Do not resolve open decision tickets on Cam's behalf. Do not create cloud resources or request broad permissions.
>
> End with: repository identity, branch, clean/dirty status, files created, test output, PMC paths created or awaiting selection, GitHub issue links, unresolved approval gates, and the safest next ticket.

## GitHub target

Recommended repository:

- Owner: `CapturedByCam`
- Name: `communication-command-center`
- Visibility: **private**
- Default branch: `main`

No currently connected repository is an appropriate target. Do not place this work in PropertyCut, home-automation, bolt-ops-wrapper, or another unrelated repository.

## Phase ownership

| Phase | ChatGPT | Codex | Cam |
|---|---|---|---|
| 0. Foundation | Review scope and decision map | Create repo, worktree, issues, tests, PMC setup | Approve path, private repo, vault choice |
| 1. Domain contracts | Resolve semantics and review schemas | Implement schemas/state machine/tests | Approve category and priority behavior |
| 2. Sheet/backend | Review UX and privacy | Build Apps Script storage/API | Authorize Google account and test Sheet |
| 3. Gmail | Review fixtures and errors | Implement sync/reconciliation/draft adapter | Approve sanitized test threads |
| 4. Studio | Define prompts and policies | Build/version flows from spec | Approve Workspace permissions |
| 5. Apple capture | Review capture UX | Build endpoint and Shortcut | Install/test Shortcut and token |
| 6. Briefing/ChatGPT | Define briefing format and review behavior | Implement deterministic briefing | Use and rate daily output |
| 7. Hardening | Review failure modes | Add logs, kill switches, backups, runbooks | Approve pilot-to-production gate |
| 8. Phase 2 | Resolve new decisions | Implement optional bridge/app/connector | Approve expanded permissions |

## Handoff rhythm

For each implementation ticket:

1. ChatGPT and Cam resolve the corresponding Wayfinder decision when one exists.
2. Codex claims the issue and creates an isolated worktree.
3. Codex writes a failing test.
4. Codex implements the smallest passing behavior.
5. Codex runs focused and full verification.
6. ChatGPT reviews behavior, privacy, UX, prompts, and edge cases.
7. Codex addresses review findings and opens or updates the PR.
8. Cam accepts the milestone.
9. Codex updates PMC `Current State.md` and `Handoff.md`.

## Recommended execution mode

Use **subagent-driven development** for the domain, Sheets, Gmail, Shortcut, and briefing components because they have distinct interfaces and privacy failure modes. Use a fresh reviewer for each task and a whole-branch review before the pilot.
