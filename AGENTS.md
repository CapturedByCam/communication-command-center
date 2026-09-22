# AGENTS.md — Communication Command Center

## Orientation order

At the beginning of every task, read:

1. `docs/spec/PRODUCT_AND_ARCHITECTURE_SPEC.md`
2. `docs/wayfinder/MAP.md`
3. the specific open decision ticket or implementation task being worked
4. `docs/pmc/BOOTSTRAP.md`
5. Project Memory Core's `Project.md` and `Current State.md` once the vault is connected

Do not load the entire project-memory vault by default.

## Product invariants

- The system may create drafts, but it must never send a client, aviation, business, or personal message automatically in V1.
- Google Sheets stores operational metadata, short summaries, hashes, IDs, timestamps, and source links—not full message bodies.
- Source content remains in Gmail, Messages, Calendar, and Drive.
- Code owns IDs, validation, state transitions, deduplication, dates, ordering, retries, and persistence.
- Models own interpretation, summarization, category suggestions, deadline suggestions, and draft language.
- Every model output is untrusted input and must pass schema and enum validation.
- Manual overrides always beat model output.
- A schema change requires a version bump, migration notes, fixtures, and contract tests.
- Relative dates must be normalized against `America/New_York`; ambiguous dates remain unresolved and are flagged for review.
- External writes, OAuth grants, deployments, secret rotation, Google Workspace changes, and GitHub repository creation require an approval gate.
- Never commit tokens, IDs that function as secrets, private message text, OAuth material, cookies, or user exports.

## Engineering workflow

- Use a dedicated Git worktree for each implementation ticket.
- Use test-driven development: failing test, minimal implementation, passing test, refactor, full verification.
- Make small commits with one coherent behavior each.
- Do not mix architecture decisions with implementation work. Resolve the relevant Wayfinder ticket first.
- Run unit, contract, schema, and smoke tests before claiming completion.
- Request review before merging a milestone.
- Update `Current State.md`, `Handoff.md`, and the decision log when accepted behavior changes.
- Treat Google Workspace Studio configuration and Apple Shortcut configuration as versioned source artifacts documented in this repository.
- Keep production deployments reproducible from repository state and documented manual approvals.

## ChatGPT / Codex division

### ChatGPT owns

- product semantics and workflow behavior;
- decision-ticket resolution with Cam;
- classification and drafting policies;
- edge-case review;
- acceptance criteria;
- difficult or relationship-sensitive drafts;
- final behavioral review of milestone output;
- daily operational use once connected data is available.

### Codex owns

- repository setup;
- schemas and typed domain code;
- Apps Script, Gmail, Sheets, Calendar, HTTP, and Shortcut integration implementation;
- tests, fixtures, build, deployment tooling, logs, and documentation;
- Google Workspace Studio flow construction from the checked-in specification;
- GitHub issues, branches, worktrees, commits, pull requests, and verification evidence;
- Project Memory Core setup after Cam selects or creates a vault.

## Stop conditions

Stop without changing external state when:

- the repository target or branch is uncertain;
- the intended Google account is uncertain;
- a requested permission is broader than documented;
- raw message content would be persisted unexpectedly;
- the deployment would allow unauthenticated reads;
- a schema migration could overwrite existing rows;
- a secret appears in logs, fixtures, screenshots, or Git;
- a flow begins sending instead of drafting;
- a test fixture uses real private content that was not explicitly approved and sanitized.
