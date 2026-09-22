# Communication Command Center — Planning Pack

**Planning date:** 2026-09-21
**Project owner:** Cam
**Implementation lead:** Codex
**Product/architecture/review lead:** ChatGPT
**Status:** Planning complete; no repository, cloud deployment, Google flow, Shortcut, or production data has been created by this pack.

## Destination

Build a privacy-conscious communication command center that:

1. Detects actionable and unanswered communications.
2. Separates client leads, active projects, aviation, business administration, and personal items.
3. Creates context-aware draft replies without sending automatically.
4. Extracts deadlines, promises, and follow-up obligations.
5. Produces a concise daily communication queue.
6. Accepts selected Apple Messages or other text through a Share Sheet Shortcut.
7. Uses ChatGPT for prioritization, review, difficult drafts, and natural-language control.
8. Uses deterministic code—not model memory—as the source of truth for state.

## Recommended reading order

1. `START_HERE_CODEX.md`
2. `docs/spec/PRODUCT_AND_ARCHITECTURE_SPEC.md`
3. `docs/wayfinder/MAP.md`
4. `docs/superpowers/plans/2026-09-21-communication-command-center.md`
5. `docs/runbooks/DEPLOYMENT_AND_OPERATIONS_RUNBOOK.md`
6. `docs/pmc/BOOTSTRAP.md`

## Pack contents

- `AGENTS.md` — operating contract for Codex and future agents.
- `START_HERE_CODEX.md` — exact first-session handoff and phase boundaries.
- `docs/spec/PRODUCT_AND_ARCHITECTURE_SPEC.md` — product behavior, architecture, data model, safety, and acceptance criteria.
- `docs/wayfinder/` — local decision map and individual decision tickets. Convert these to GitHub issues after the project repository exists.
- `docs/superpowers/plans/` — task-by-task TDD implementation plan.
- `docs/runbooks/` — deployment, rollback, incident, and operations runbook.
- `docs/pmc/` — Project Memory Core setup and durable-knowledge plan.
- `schemas/` — initial JSON contracts for the canonical item, Studio staging record, and Shortcut intake.
- `studio/` — exact Workspace Studio flow specifications.
- `shortcuts/` — Apple Shortcut build specification and example payload.
- `scripts/validate_planning_pack.py` — structural validation for this planning pack.

## Non-negotiable boundaries

- No automatic sending in V1.
- No full email or message bodies stored in Google Sheets.
- No secrets committed to Git.
- No model-generated object is trusted until code validates and normalizes it.
- No destructive or external deployment action without Cam's explicit approval.
- No unrelated existing GitHub repository may be repurposed for this project.
- The initial GitHub repository should be private.
- The initial Apple Messages path is manual Share Sheet capture, not unattended database scraping.
