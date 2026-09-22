# Communication Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a privacy-conscious single-user communication command center that turns Gmail and explicitly shared Apple text into a deterministic queue, review-only drafts, commitments, and daily briefings.

**Architecture:** Workspace Studio prepares bounded Gmail events only when verified. Apps Script owns safe draft lifecycle and deterministic validation. Apps Script validates, reconciles, deduplicates, persists to a private Google Sheet, and exposes a write-only Shortcut endpoint. ChatGPT provides judgment-heavy review and natural-language operation; Codex owns implementation and verification.

**Tech Stack:** TypeScript, Node.js LTS, pnpm, Zod, Vitest, ESLint, Prettier, esbuild, clasp, Apps Script V8, Gmail/Sheets/Calendar/Drive services, Workspace Studio, Apple Shortcuts.

**Spec:** `docs/spec/PRODUCT_AND_ARCHITECTURE_SPEC.md`

## Execution status — 2026-09-22

This original checklist is an implementation guide, not live acceptance evidence.
Follow [the V1 execution record](../../implementation/V1_EXECUTION.md) and
[PMC Handoff](../../../PMC/Handoff.md) for completed work and exact remaining gates.
The standing authorization covers in-scope Google resources and reviewed merges;
all Google messages, including the former self-alert, remain prohibited. No paid
upgrade is authorized. Native metadata reads remain generic/review-only pending a
verified interpretation provider. Do not activate Studio draft or Chat actions.

## Global Constraints

- Repository: `CapturedByCam/communication-command-center`, intentionally public with private runtime data, default branch `main`.
- Time zone: `America/New_York`.
- V1 never sends outbound communications.
- Full message bodies and attachments are not persisted in Sheets or logs.
- Manual override always wins over background classification.
- All inbound AI and Shortcut fields are untrusted until validated.
- All external writes and permission grants require an approval gate.
- Every schema change requires versioning, migration notes, fixtures, and contract tests.
- Apple Messages V1 is manual Share Sheet capture only.
- No secret or private fixture content may enter Git.

## Review Focus

- Duplicate delivery of the same Gmail or Shortcut event must produce one canonical item.
- A simple acknowledgement must not become an unanswered task unless an unresolved promise exists.
- Relative and ambiguous dates must not be silently converted to a false absolute deadline.
- Manual status/category/waiting-state edits must survive later reconciliation.
- High-consequence pricing, complaint, contract, schedule, and aviation-employment items must not receive an automatic low-risk draft.

---

## Planned file structure

```text
communication-command-center/
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── eslint.config.mjs
├── .prettierrc.json
├── .gitignore
├── appsscript.json
├── docs/
│   ├── spec/PRODUCT_AND_ARCHITECTURE_SPEC.md
│   ├── superpowers/plans/2026-09-21-communication-command-center.md
│   ├── runbooks/DEPLOYMENT_AND_OPERATIONS_RUNBOOK.md
│   ├── wayfinder/
│   └── pmc/BOOTSTRAP.md
├── schemas/
│   ├── communication-item.schema.json
│   ├── shortcut-intake.schema.json
│   └── studio-staging.schema.json
├── src/
│   ├── domain/
│   │   ├── schemas.ts
│   │   ├── types.ts
│   │   ├── state-machine.ts
│   │   ├── priority.ts
│   │   └── risk.ts
│   ├── adapters/
│   │   ├── sheets/
│   │   │   ├── workbook-manifest.ts
│   │   │   ├── queue-repository.ts
│   │   │   ├── staging-repository.ts
│   │   │   └── audit-repository.ts
│   │   ├── gmail/
│   │   │   ├── gmail-client.ts
│   │   │   ├── thread-state.ts
│   │   │   ├── reconciliation.ts
│   │   │   └── draft-writer.ts
│   │   ├── calendar/deadline-candidate.ts
│   │   └── http/
│   │       ├── auth.ts
│   │       ├── shortcut-handler.ts
│   │       └── response.ts
│   ├── services/
│   │   ├── normalize-staging-item.ts
│   │   ├── upsert-item.ts
│   │   ├── commitment-service.ts
│   │   ├── briefing-service.ts
│   │   └── feature-flags.ts
│   └── apps-script/
│       ├── entrypoints.ts
│       ├── triggers.ts
│       └── menu.ts
├── studio/
│   ├── GMAIL_INTAKE_FLOW.md
│   └── DAILY_BRIEFING_FLOW.md
├── shortcuts/
│   ├── ADD_TO_COMMAND_CENTER.md
│   └── example-payload.json
├── tests/
│   ├── fixtures/
│   ├── unit/
│   ├── contract/
│   └── integration/
└── scripts/
    ├── build.mjs
    ├── validate-schemas.mjs
    ├── smoke-test.mjs
    └── validate-planning-pack.py
```

### Task 0: Verify target and create the private repository

**Files:**
- Preserve: every file in this planning pack
- Create: `.gitignore`
- Create: `README.md`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`

**Interfaces:**
- Consumes: approved local parent folder, GitHub owner, private visibility, and PMC vault choice
- Produces: verified repository root and a reproducible local toolchain

- [ ] **Step 1: Verify external targets**

Record the selected local path, authenticated GitHub owner, repository name, private visibility, Google Workspace account, and PMC vault choice. Stop on mismatch.

- [ ] **Step 2: Create an isolated repository and private GitHub remote**

Create the local repository on `main`; create `CapturedByCam/communication-command-center` as private; verify the remote URL before the first push.

- [ ] **Step 3: Add toolchain configuration**

Use package scripts:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "validate:schemas": "node scripts/validate-schemas.mjs",
    "build": "node scripts/build.mjs",
    "verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm validate:schemas && pnpm test && pnpm build"
  }
}
```

- [ ] **Step 4: Run the planning validator**

Run:

```bash
python3 scripts/validate-planning-pack.py .
```

Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: initialize communication command center"
```

### Task 1: Register PMC and publish the Wayfinder map

**Files:**
- Modify: `AGENTS.md`
- Preserve: `docs/pmc/BOOTSTRAP.md`
- Preserve: `docs/wayfinder/MAP.md`
- Preserve: `docs/wayfinder/tickets/*.md`

**Interfaces:**
- Consumes: verified repo and Cam's vault choice
- Produces: durable project context, GitHub map issue, and child decision issues

- [ ] **Step 1: Set up or connect the vault through PMC**

Create the project registration `communication-command-center` and the initial notes specified in `docs/pmc/BOOTSTRAP.md`.

- [ ] **Step 2: Ask for automatic orientation opt-in**

Only after opt-in, add the managed PMC block to `AGENTS.md`; preserve all existing instructions.

- [ ] **Step 3: Create the Wayfinder map issue**

Use the title `Map: Communication Command Center V1`. Apply `wayfinder:map`.

- [ ] **Step 4: Create one child issue per ticket**

Use each Markdown ticket title, body, and status. Apply labels `wayfinder:grilling`, `wayfinder:research`, `wayfinder:prototype`, or `wayfinder:task`. Closed local decisions become closed issues with a resolution comment.

- [ ] **Step 5: Commit PMC-safe repository changes**

```bash
git add AGENTS.md docs/pmc docs/wayfinder
git commit -m "docs: register project memory and decision map"
```

### Task 2: Implement versioned domain schemas

**Files:**
- Create: `src/domain/schemas.ts`
- Create: `src/domain/types.ts`
- Test: `tests/contract/schemas.test.ts`
- Use: `schemas/*.schema.json`

**Interfaces:**
- Produces:
  - `CommunicationItemSchema`
  - `ShortcutIntakeSchema`
  - `StudioStagingSchema`
  - inferred TypeScript types

- [ ] **Step 1: Write failing contract tests**

Test valid examples, unknown properties, invalid enum values, preview length, raw-content invariant, UUID format, and token minimum length.

- [ ] **Step 2: Run focused tests**

```bash
pnpm vitest run tests/contract/schemas.test.ts
```

Expected: FAIL because schemas are not implemented.

- [ ] **Step 3: Implement Zod schemas matching checked-in JSON**

Export parsers that use `.strict()` and normalize nullable optional fields without accepting unknown keys.

- [ ] **Step 4: Verify JSON and Zod contracts agree**

`validate-schemas.mjs` must parse example fixtures with both implementations and fail on a deliberately invalid fixture.

- [ ] **Step 5: Run and commit**

```bash
pnpm vitest run tests/contract/schemas.test.ts
git add schemas src/domain tests/contract scripts/validate-schemas.mjs
git commit -m "feat: add versioned communication contracts"
```

### Task 3: Implement state, risk, and priority rules

**Files:**
- Create: `src/domain/state-machine.ts`
- Create: `src/domain/priority.ts`
- Create: `src/domain/risk.ts`
- Test: `tests/unit/state-machine.test.ts`
- Test: `tests/unit/priority.test.ts`
- Test: `tests/unit/risk.test.ts`

**Interfaces:**
- Produces:
  - `deriveWaitingOn(input): WaitingOn`
  - `calculatePriority(input): number`
  - `classifyDraftRisk(input): DraftRisk`

- [ ] **Step 1: Write fixtures for inbound, outbound, acknowledgement, promise, ambiguity, and manual override**

Use synthetic text only.

- [ ] **Step 2: Write failing tests**

Pin the five Review Focus failure modes.

- [ ] **Step 3: Implement minimal pure functions**

Manual override returns first. Dates use injected `now` and explicit time zone. No Google service calls are allowed in domain modules.

- [ ] **Step 4: Run focused and full unit tests**

```bash
pnpm vitest run tests/unit
```

- [ ] **Step 5: Commit**

```bash
git add src/domain tests/unit
git commit -m "feat: add deterministic communication state rules"
```

### Task 4: Define and bootstrap the workbook

**Files:**
- Create: `src/adapters/sheets/workbook-manifest.ts`
- Create: `src/apps-script/menu.ts`
- Test: `tests/unit/workbook-manifest.test.ts`
- Document: `docs/spec/SHEET_MANIFEST.md`

**Interfaces:**
- Produces:
  - `WORKBOOK_MANIFEST`
  - `bootstrapWorkbook(spreadsheetId): BootstrapResult`
  - `verifyWorkbook(spreadsheetId): WorkbookVerification`

- [ ] **Step 1: Write the expected tab/header manifest test**

Assert exact tab order and header names.

- [ ] **Step 2: Implement the manifest**

Include `Queue`, `Studio_Inbox`, `Contacts`, `Projects`, `Commitments`, `Briefing_View`, `Briefing_History`, `Audit_Log`, `Dead_Letter`, and `Config`.

- [ ] **Step 3: Implement idempotent bootstrap**

Creating the workbook twice must not duplicate tabs or headers. Non-empty conflicting headers must cause a stop result, not overwrite.

- [ ] **Step 4: Verify against a fake Sheets adapter**

Run:

```bash
pnpm vitest run tests/unit/workbook-manifest.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/adapters/sheets src/apps-script/menu.ts tests/unit docs/spec/SHEET_MANIFEST.md
git commit -m "feat: add idempotent workbook bootstrap"
```

### Task 5: Implement repositories and idempotent upsert

**Files:**
- Create: `src/adapters/sheets/queue-repository.ts`
- Create: `src/adapters/sheets/staging-repository.ts`
- Create: `src/adapters/sheets/audit-repository.ts`
- Create: `src/services/upsert-item.ts`
- Test: `tests/integration/sheet-repositories.test.ts`

**Interfaces:**
- Produces:
  - `QueueRepository.getBySourceThread()`
  - `QueueRepository.upsert()`
  - `StagingRepository.claimBatch()`
  - `AuditRepository.append()`
  - `upsertCommunicationItem()`

- [ ] **Step 1: Write a duplicate-event failing test**

Process the same event twice and expect one row plus two audit outcomes: created, duplicate-suppressed.

- [ ] **Step 2: Write a manual-override preservation test**

Background upsert may update source timestamps and hashes but not manual category/status/waiting values.

- [ ] **Step 3: Implement row mapping and optimistic checks**

Use header names, not hard-coded column numbers. Reject header drift.

- [ ] **Step 4: Run integration tests**

```bash
pnpm vitest run tests/integration/sheet-repositories.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/adapters/sheets src/services/upsert-item.ts tests/integration
git commit -m "feat: add idempotent sheet persistence"
```

### Task 6: Implement the Shortcut write-only endpoint

**Files:**
- Create: `src/adapters/http/auth.ts`
- Create: `src/adapters/http/response.ts`
- Create: `src/adapters/http/shortcut-handler.ts`
- Create: `src/apps-script/entrypoints.ts`
- Test: `tests/contract/shortcut-handler.test.ts`

**Interfaces:**
- Consumes: `ShortcutIntake`
- Produces: `{status: created|duplicate|needs_review|rejected, item_id?: string}` with no queue data

- [ ] **Step 1: Resolve the Shortcut authentication ticket**

Do not implement until `Select Shortcut endpoint authentication for the pilot` is closed.

- [ ] **Step 2: Write failing tests**

Cover valid token, invalid token, oversized body, invalid schema, duplicate key, disabled feature flag, and no content in logs.

- [ ] **Step 3: Implement constant-time token comparison and limits**

Read the token from Script Properties. Never log it. Discard `shared_text` after normalization.

- [ ] **Step 4: Implement `doPost(e)`**

Return only JSON status and safe error code. Do not expose stack traces or Sheet data.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/http src/apps-script/entrypoints.ts tests/contract
git commit -m "feat: add authenticated shortcut intake endpoint"
```

### Task 7: Implement Gmail thread chronology

**Files:**
- Create: `src/adapters/gmail/gmail-client.ts`
- Create: `src/adapters/gmail/thread-state.ts`
- Test: `tests/unit/thread-state.test.ts`
- Fixtures: `tests/fixtures/gmail/*.json`

**Interfaces:**
- Produces:
  - `getThreadSnapshot(messageId): ThreadSnapshot`
  - `deriveThreadState(snapshot, commitments): ThreadState`

- [ ] **Step 1: Create sanitized fixture shapes**

Include direct question, acknowledgement, outbound promise, closed informational thread, newsletter, complaint, pricing request, and aviation opportunity.

- [ ] **Step 2: Write failing chronology tests**

Verify ordering by internal timestamp, sender identity/alias mapping, meaningful direction, and response expectation.

- [ ] **Step 3: Implement an adapter around Gmail services**

Keep Gmail service objects outside domain functions. Return a plain typed snapshot.

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run tests/unit/thread-state.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/adapters/gmail tests/fixtures/gmail tests/unit/thread-state.test.ts
git commit -m "feat: derive authoritative gmail thread state"
```

### Task 8: Implement Gmail reconciliation

**Files:**
- Create: `src/adapters/gmail/reconciliation.ts`
- Create: `src/apps-script/triggers.ts`
- Create: `src/services/normalize-staging-item.ts`
- Test: `tests/integration/reconciliation.test.ts`

**Interfaces:**
- Produces:
  - `processStudioInbox(batchSize)`
  - `reconcileRecentGmail(cursor)`
  - `installReconciliationTrigger()`
  - `removeReconciliationTrigger()`

- [ ] **Step 1: Write a missed-Studio-event test**

A Gmail fixture absent from staging must appear after reconciliation.

- [ ] **Step 2: Write an acknowledgement transition test**

After Cam replies, the canonical item changes from `me` to `them` or `none` based on response expectation.

- [ ] **Step 3: Implement bounded incremental sync**

Persist a cursor in `Config`; use a bounded lookback as recovery. Never scan the entire inbox during a normal run.

- [ ] **Step 4: Add retry and dead-letter behavior**

Failures update staging status and content-free error code.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/gmail src/apps-script/triggers.ts src/services/normalize-staging-item.ts tests/integration/reconciliation.test.ts
git commit -m "feat: reconcile gmail and studio intake"
```

### Task 9: Implement commitments and deadline normalization

**Files:**
- Create: `src/services/commitment-service.ts`
- Create: `src/adapters/calendar/deadline-candidate.ts`
- Test: `tests/unit/commitment-service.test.ts`
- Test: `tests/unit/deadline-candidate.test.ts`

**Interfaces:**
- Produces:
  - `upsertCommitment()`
  - `resolveCommitment()`
  - `normalizeDeadlineSuggestion()`
  - `buildCalendarCandidate()`

- [ ] **Step 1: Write absolute and ambiguous date tests**

Use explicit `America/New_York` dates around midnight, weekends, daylight saving boundaries, and phrases without a date anchor.

- [ ] **Step 2: Implement strict normalization**

Only unambiguous suggestions become `deadline_at`; preserve `deadline_text` otherwise.

- [ ] **Step 3: Implement promise lifecycle**

Outgoing promises create commitments; source evidence fulfillment resolves them; manual resolution records the actor.

- [ ] **Step 4: Keep Calendar write disabled**

`buildCalendarCandidate()` returns data only unless `calendar_approved=true` and the feature flag is enabled in a later approved task.

- [ ] **Step 5: Commit**

```bash
git add src/services/commitment-service.ts src/adapters/calendar tests/unit
git commit -m "feat: track promises and deadline candidates"
```

### Task 10: Configure and verify Workspace Studio Gmail Intake

**Files:**
- Use: `studio/GMAIL_INTAKE_FLOW.md`
- Create: `studio/flow-manifest.json`
- Test: `tests/contract/studio-flow-manifest.test.ts`

**Interfaces:**
- Produces: a versioned human-readable and machine-checkable flow manifest

- [ ] **Step 1: Close the Studio capability ticket**

Record which built-in actions are available and any approval behavior.

- [ ] **Step 2: Encode the flow manifest**

Include starter, step order, field mappings, prompt hashes, Sheet target placeholder resolved only at deployment, and `send_steps: []`.

- [ ] **Step 3: Write a contract test**

Fail if the manifest contains a send action, full-body Sheet mapping, or missing required staging field.

- [ ] **Step 4: Build the pilot flow manually from the checked-in spec**

Use a narrow synthetic sender filter.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/contract/studio-flow-manifest.test.ts
git add studio tests/contract/studio-flow-manifest.test.ts
git commit -m "feat: version workspace studio gmail intake"
```

### Task 11: Implement safe Gmail draft management

**Files:**
- Create: `src/adapters/gmail/draft-writer.ts`
- Test: `tests/integration/draft-writer.test.ts`

**Interfaces:**
- Produces:
  - `createOrReplaceRoutineDraft(item, text)`
  - `markDraftStale(itemId)`
  - `deleteSyntheticDraft(draftId)`

- [ ] **Step 1: Write failing risk tests**

Routine fixture permits a draft. Pricing, complaint, contract, schedule commitment, and aviation-employment fixtures reject automatic draft creation.

- [ ] **Step 2: Implement draft-only guard**

The adapter must not expose a send method.

- [ ] **Step 3: Implement stale-draft behavior**

A newer source message marks an existing draft stale instead of silently treating it as current.

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run tests/integration/draft-writer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/adapters/gmail/draft-writer.ts tests/integration/draft-writer.test.ts
git commit -m "feat: manage review-only gmail drafts"
```

### Task 12: Implement deterministic briefing generation

**Files:**
- Create: `src/services/briefing-service.ts`
- Test: `tests/unit/briefing-service.test.ts`
- Use: `studio/DAILY_BRIEFING_FLOW.md`

**Interfaces:**
- Produces:
  - `buildBriefing(items, commitments, health, now): Briefing`
  - `writeBriefingView(briefing)`
  - `renderBriefingMarkdown(briefing)`

- [ ] **Step 1: Write failing ordering and omission tests**

Resolved and snoozed items are excluded. All active items appear exactly once in deterministic order.

- [ ] **Step 2: Implement section assignment**

Use the sections defined in the product spec and include item IDs.

- [ ] **Step 3: Add system-health rows**

Surface failed intake, dead letters, stale drafts, and last successful reconciliation.

- [ ] **Step 4: Verify exact snapshots**

```bash
pnpm vitest run tests/unit/briefing-service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services/briefing-service.ts tests/unit/briefing-service.test.ts studio/DAILY_BRIEFING_FLOW.md
git commit -m "feat: generate deterministic communication briefings"
```

### Task 13: Build and contract-test the Apple Shortcut

**Files:**
- Use: `shortcuts/ADD_TO_COMMAND_CENTER.md`
- Use: `shortcuts/example-payload.json`
- Test: `tests/contract/shortcut-payload.test.ts`

**Interfaces:**
- Produces: Shortcut output conforming to `ShortcutIntake`

- [ ] **Step 1: Resolve authentication and endpoint deployment**

Do not put a real token in repository artifacts.

- [ ] **Step 2: Build the Shortcut from the exact action list**

Apple Intelligence suggests labeled fields; fixed Shortcut actions construct JSON.

- [ ] **Step 3: Export a redacted Shortcut action inventory**

Document action names and order without secret values.

- [ ] **Step 4: Run endpoint acceptance tests**

Test created, duplicate, needs_review, rejected, offline retry, and oversized input.

- [ ] **Step 5: Commit documentation and contract evidence**

```bash
git add shortcuts tests/contract/shortcut-payload.test.ts
git commit -m "feat: add apple share sheet intake contract"
```

### Task 14: Implement contact and project registries

**Files:**
- Create: `src/services/context-registry.ts`
- Test: `tests/unit/context-registry.test.ts`
- Document: `docs/spec/CONTEXT_REGISTRY.md`

**Interfaces:**
- Produces:
  - `resolveContact(identifiers)`
  - `resolveProject(hints, contact)`
  - `suggestRegistryUpdate()`

- [ ] **Step 1: Close the registry-source decision**

Use curated Sheet tabs for V1 unless Cam selects another source.

- [ ] **Step 2: Write exact-match and ambiguity tests**

No fuzzy suggestion becomes a persisted association without approval.

- [ ] **Step 3: Implement deterministic precedence**

Exact email/phone/handle -> approved alias -> unique project/contact mapping -> unpersisted suggestion.

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run tests/unit/context-registry.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services/context-registry.ts tests/unit/context-registry.test.ts docs/spec/CONTEXT_REGISTRY.md
git commit -m "feat: add curated communication context registry"
```

### Task 15: Add observability, privacy guards, and kill switches

**Files:**
- Create: `src/services/feature-flags.ts`
- Create: `src/services/redaction.ts`
- Test: `tests/unit/redaction.test.ts`
- Test: `tests/integration/feature-flags.test.ts`
- Document: `docs/spec/PRIVACY_AND_THREAT_MODEL.md`

**Interfaces:**
- Produces:
  - independent flags for Studio processing, Gmail reconciliation, draft creation, Shortcut intake, briefing delivery, and Calendar writes;
  - content-free audit logging;
  - redaction assertions.

- [ ] **Step 1: Write secret/content leakage tests**

Scan generated logs, fixtures, build output, and example payloads for configured forbidden patterns.

- [ ] **Step 2: Implement independent kill switches**

A disabled component returns a safe status and changes no source content.

- [ ] **Step 3: Implement audit schema**

Store IDs, actions, results, error codes, hashes, and timing only.

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run tests/unit/redaction.test.ts tests/integration/feature-flags.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/services tests docs/spec/PRIVACY_AND_THREAT_MODEL.md
git commit -m "feat: add privacy guards and component kill switches"
```

### Task 16: Build, deploy, smoke-test, and pilot

**Files:**
- Create: `scripts/build.mjs`
- Create: `scripts/smoke-test.mjs`
- Use: `docs/runbooks/DEPLOYMENT_AND_OPERATIONS_RUNBOOK.md`
- Create: `docs/reports/PILOT_REPORT.md`

**Interfaces:**
- Produces: deployable Apps Script bundle and a recorded pilot decision

- [ ] **Step 1: Build with no secret injection**

```bash
pnpm build
```

Inspect output for forbidden content.

- [ ] **Step 2: Run complete verification**

```bash
pnpm verify
python3 scripts/validate-planning-pack.py .
```

- [ ] **Step 3: Execute the runbook one gate at a time**

Do not combine approvals.

- [ ] **Step 4: Run the approved 50-example evaluation**

Record confusion categories and draft ratings, not raw private content.

- [ ] **Step 5: Request review**

Use Superpowers requesting-code-review and a final whole-branch review.

- [ ] **Step 6: Update PMC and commit the report**

```bash
git add docs/reports docs/pmc
git commit -m "docs: record communication command center pilot"
```

## Self-review result

- Spec coverage: represented across Tasks 0–16.
- Placeholder scan: no implementation placeholder is accepted as completion; unresolved product choices are explicit Wayfinder gates.
- Type consistency: canonical names match the schema files and task interfaces.
- Review Focus: each listed failure mode has a named test owner.
- Recommended execution: subagent-driven, because Gmail, Sheets, HTTP intake, Studio, Shortcut, privacy, and briefing can fail independently and expose private data if reviewed only at the end.
