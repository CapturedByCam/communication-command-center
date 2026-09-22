# Deployment and Operations Runbook — Communication Command Center

## Runbook metadata

- **Mode:** Generate / pilot deployment / operations
- **Primary operator:** Codex with Cam at approval gates
- **Behavior reviewer:** ChatGPT
- **Environment:** local development, Google Workspace pilot, then production
- **Scope:** repository, Apps Script backend, command-center Sheet, Workspace Studio flows, Apple Shortcut, briefing, monitoring, rollback
- **Completion signal:** the approved vertical-slice tests pass, one synthetic Gmail event and one synthetic Shortcut event appear exactly once, one routine draft is created but not sent, the briefing renders deterministically, and all kill switches work
- **Must remain unchanged:** unrelated repositories, unrelated Drive files, existing Gmail messages, existing Calendar events, Apple Messages database, and all account security settings not named in this runbook

## Safety classification

| Action | Class |
|---|---|
| Read repository/docs, run local tests | Read-only |
| Create private repo/branch/worktree | Reversible external change |
| Create pilot Sheet/Apps Script project | Reversible external change |
| Grant OAuth scopes / install Studio flow | Material external change; approval required |
| Deploy web app endpoint | Material external change; approval required |
| Store/rotate Shortcut token | Security-sensitive; approval required |
| Create Gmail drafts | Reversible external change; approval required for pilot |
| Send email, delete source content, scrape Messages DB | Prohibited in V1 |
| Replace/clear production Sheet rows | Destructive; separate explicit approval required |

## Global stop conditions

Stop immediately if:

- the repository, branch, Google account, Sheet, Apps Script project, or flow target is uncertain;
- the repository is public;
- a secret appears in Git, logs, fixtures, screenshots, or the Sheet;
- full message bodies are being persisted;
- a flow sends instead of drafts;
- a migration would overwrite non-empty production ranges;
- authorization asks for scopes broader than the documented Gmail/Sheets/Drive/Calendar needs;
- a smoke test touches a real external recipient;
- duplicate or reconciliation behavior cannot be explained;
- rollback depends on the failed component.

## Phase 0 — Verify targets

### Operator

Codex; Cam approves.

### Steps

1. Read `AGENTS.md`, the architecture spec, Wayfinder map, and implementation plan.
2. Confirm the selected local repository parent.
3. Confirm GitHub owner `CapturedByCam`, repository name `communication-command-center`, and private visibility.
4. Confirm the Google Workspace account to use.
5. Confirm whether PMC will create a new vault or connect an existing vault.
6. Confirm no suitable existing repository is being repurposed.

### Verification

Record:

- absolute local repository path;
- GitHub URL after creation;
- default branch;
- clean Git status;
- active Google account email without recording credentials;
- selected vault location in machine-local configuration only.

### Rollback

Delete the newly created empty/private repository and local folder only if no project work or user data has been added and Cam approves. Otherwise archive rather than delete.

## Phase 1 — Local build and tests

### Operator

Codex.

### Steps

1. Create an isolated worktree.
2. Install locked dependencies.
3. Run schema validation.
4. Run unit and contract tests.
5. Build the Apps Script bundle.
6. Run lint and typecheck.
7. Run `scripts/validate_planning_pack.py`.

### Verification

All commands exit zero. The build artifact contains no secret or fixture private content. Git status shows only intended files.

### Rollback

Remove the worktree or reset the branch to the last verified commit. Do not touch cloud resources.

## Phase 2 — Create pilot Sheet

### Approval gate

Cam explicitly approves creation in the verified Google account.

### Operator

Codex.

### Steps

1. Run the workbook bootstrap against a newly created Sheet named `Communication Command Center — Pilot`.
2. Create only the documented tabs and headers.
3. Apply protected ranges to schema/config headers where supported.
4. Set `Config.environment=pilot`.
5. Set all feature flags false.
6. Store the Sheet ID in Apps Script Properties or local ignored configuration, never in a public example if it exposes access.

### Verification

- tab names and header hashes match the repository manifest;
- all tabs are empty except headers/config;
- no existing file changed;
- feature flags are false.

### Rollback

Move the pilot Sheet to Trash after exporting a sanitized header-only copy if needed. No source content should exist yet.

## Phase 3 — Deploy Apps Script pilot

### Approval gate

Cam approves requested OAuth scopes and deployment.

### Operator

Codex.

### Steps

1. Create or attach the Apps Script project to the verified pilot resources.
2. Set V8 runtime.
3. Set Script Properties:
   - environment;
   - Sheet ID;
   - time zone;
   - feature flags;
   - generated Shortcut token only after the authentication decision closes.
4. Deploy a test version first.
5. Execute synthetic bootstrap and upsert functions.
6. Install the documented time-driven reconciliation trigger only after tests pass.
7. Deploy the web app only after Shortcut authentication is approved.

### Verification

- Apps Script execution log contains synthetic IDs only;
- no private content appears in logs;
- invalid payload is rejected;
- duplicate synthetic payload is idempotent;
- reconciliation trigger runs with feature flags off;
- endpoint performs no reads for the caller.

### Rollback

Disable triggers, set all feature flags false, disable the web-app deployment, rotate/delete the token, and retain the Sheet for inspection. Rollback must not require the endpoint.

## Phase 4 — Configure Workspace Studio pilot

### Approval gate

Cam reviews every step and approves access.

### Operator

Codex builds; ChatGPT reviews prompts; Cam turns on.

### Steps

1. Verify required built-in actions are available.
2. Create Gmail Intake flow from `studio/GMAIL_INTAKE_FLOW.md`.
3. Bind it to the pilot Sheet and selected mailbox scope.
4. Keep `Send a reply` absent.
5. Turn on with a narrow synthetic sender filter.
6. Trigger synthetic routine and review-only messages.
7. Expand sender scope only after verification.
8. Create Daily Briefing flow from `studio/DAILY_BRIEFING_FLOW.md` with delivery disabled until briefing tests pass.

### Verification

- routine synthetic email -> one staging row + one draft;
- review-only email -> one staging row + no automatic draft;
- newsletter -> no actionable queue item;
- no sent messages;
- no full body in Sheet;
- duplicate suppression works after Apps Script processing.

### Rollback

Turn off the flows. Delete synthetic drafts. Keep staging/audit rows for diagnosis, then clear them only with explicit approval.

## Phase 5 — Install Apple Shortcut pilot

### Approval gate

Shortcut authentication ticket is closed and Cam approves token storage.

### Operator

Codex constructs/specifies; Cam installs and tests.

### Steps

1. Generate a 256-bit random token outside Git.
2. Store it in Script Properties.
3. Put it into Cam's local Shortcut.
4. Build actions exactly from `shortcuts/ADD_TO_COMMAND_CENTER.md`.
5. Test with synthetic text.
6. Test retry using the same idempotency key.
7. Test invalid-token behavior with a temporary wrong token.
8. Restore the correct token.

### Verification

- one item created;
- duplicate retry creates none;
- invalid token returns no data and stores no content;
- original text absent from Queue and logs;
- kill switch blocks intake.

### Rollback

Disable shortcut intake flag, rotate/delete the token, disable the web deployment if needed, and delete the Shortcut from devices.

## Phase 6 — Enable briefing and ChatGPT operation

### Approval gate

Cam approves delivery channel and schedule.

### Steps

1. Generate deterministic `Briefing_View`.
2. Compare rendered order to expected fixture order.
3. Turn on one scheduled delivery.
4. Use ChatGPT connected apps to read the queue and relevant source context.
5. Test `Run comms`, draft review, snooze, waiting-state override, and resolution.
6. Confirm every state change creates an audit event.

### Verification

- scheduled and on-demand views agree;
- no omitted active items;
- no message body in the briefing;
- manual overrides persist after reconciliation;
- no send action is available.

### Rollback

Turn off briefing flow. Continue using the Sheet manually. ChatGPT remains on-demand only.

## Phase 7 — Pilot evaluation

### Steps

1. Use the approved sample set.
2. Label expected actionability, category, waiting state, deadline, risk, and draft usefulness.
3. Run the system.
4. Record mismatches as sanitized fixtures.
5. Fix rules or prompts through reviewed changes.
6. Re-run the full regression suite.
7. Produce the pilot report.

### Production gate

Production may be enabled only when:

- acceptance thresholds pass;
- zero privacy or auto-send violations exist;
- rollback and token rotation were exercised;
- all open security/blocking decisions are closed;
- Cam explicitly approves.

## Routine operations

### Daily

- inspect `System health`;
- review failed/dead-letter items;
- review drafts before sending;
- resolve or snooze completed items.

### Weekly

- review duplicate/error counts;
- review overdue commitments;
- sample classification quality;
- confirm feature flags;
- check Studio and Apps Script activity;
- update PMC Current State when behavior changed.

### Monthly

- rotate the Shortcut token during pilot or immediately after any suspected exposure;
- export a sanitized backup of configuration and operational rows;
- run drift checks against Sheet headers, Apps Script deployment, Studio flow spec, and schemas;
- review OAuth connections and remove unused access.

## Incident procedures

### Suspected token leak

1. Disable shortcut intake flag.
2. Disable endpoint deployment if abuse is active.
3. Rotate token in Script Properties.
4. Update only trusted Shortcuts.
5. Inspect content-free audit metadata.
6. Re-enable after a successful invalid/valid-token smoke test.

### Full content found in Sheet/logs

1. Disable all intake and drafting.
2. Preserve minimal evidence without copying the content elsewhere.
3. Identify the writer and affected ranges.
4. Remove content only after Cam approves and a backup/impact assessment is complete.
5. Add a regression test.
6. Rotate secrets if content included them.
7. Do not resume until verification proves minimization.

### Duplicate storm

1. Disable affected intake path.
2. Keep reconciliation off if it worsens duplication.
3. Inspect idempotency keys and source IDs.
4. Fix and test on a copied pilot Sheet.
5. Merge duplicate rows only through a reviewed migration.
6. Re-enable one source at a time.

### Wrong or harmful drafts

1. Turn off draft creation while leaving intake on.
2. Delete affected unsent drafts after review.
3. classify the missed risk category;
4. add fixtures and rules;
5. re-enable only after regression tests pass.

## Final evidence packet

Before declaring the project complete, provide:

- verified repository/branch/commit;
- test, lint, typecheck, schema, build, and smoke-test output;
- Sheet/tab/header manifest;
- Apps Script deployment version;
- enabled feature flags;
- Studio flow versions and screenshots with private content redacted;
- Shortcut version and token-rotation date without the token;
- rollback test evidence;
- unresolved assumptions;
- PMC Current State and Handoff links.
