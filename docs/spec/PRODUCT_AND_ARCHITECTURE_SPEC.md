# Communication Command Center — Product and Architecture Specification

## 1. Product objective

Create one repeatable communication workflow that answers:

> Who is waiting on Cam, who is Cam waiting on, what has Cam promised, what is due, and which replies deserve attention first?

The command center must combine Gmail, selected Apple Messages or shared text, Calendar context, project/contact context, and manual overrides without turning an AI model into the database.

## 2. User outcomes

The system is successful when Cam can:

- open one queue and see unanswered or actionable communications;
- distinguish client leads, active projects, aviation, business administration, personal, and other items;
- review prepared Gmail drafts without auto-sending;
- see explicit deadlines, inferred follow-up dates, and promises Cam made;
- receive a concise morning briefing and an optional afternoon cleanup;
- share a text or message into an Apple Shortcut and have it appear once in the queue;
- ask ChatGPT to prioritize, explain, draft, snooze, or resolve an item using connected source context;
- recover safely from bad classification, duplicate ingestion, a leaked token, a broken flow, or a failed deployment.

## 3. Non-goals for V1

- unattended scraping of the Apple Messages SQLite database;
- automatic sending;
- a custom iOS/macOS app;
- a public multi-user SaaS product;
- migration to Supabase, Firestore, or another database;
- broad historical ingestion of the entire inbox;
- storing complete message bodies in Sheets;
- automatic calendar creation without a human approval field;
- autonomous pricing, contractual, legal, complaint, refund, or aviation-employment commitments.

## 4. Design principles

1. **Code owns truth.** IDs, chronology, state, dates, deduplication, persistence, retries, ordering, and permissions are deterministic.
2. **AI owns interpretation.** Models suggest category, actionability, summary, deadline, promise, and draft wording.
3. **Review before consequence.** V1 drafts but never sends.
4. **Source systems retain content.** Store links and operational metadata; fetch full context only when needed.
5. **One canonical contract.** Gmail, Workspace Studio, Apple Shortcuts, Apps Script, ChatGPT, and later adapters map into versioned schemas.
6. **Idempotency by default.** Every event can be safely retried.
7. **Incremental processing.** Never rescan the entire account as a normal operation.
8. **Manual override wins.** Human edits are protected from background model rewrites.
9. **Explainable queueing.** Priority derives from visible rules, not opaque model ranking.
10. **Kill switches are first-class.** Intake, drafting, briefing, and external writes can be disabled independently.

## 5. Target architecture

```text
Gmail ───────────────┐
                     │      quick reaction / Gemini extraction
                     ├──> Google Workspace Studio ──> Studio_Inbox
                     │                                      │
                     │                                      ▼
                     │                              Apps Script worker
                     │                              validate / resolve IDs
                     │                              dedupe / normalize
                     │                              reconcile thread state
                     │                                      │
                     │                                      ▼
                     └──────────────────────────────> Google Sheets
                                                        canonical state
Apple Share Sheet ──> Apple Shortcut ──HTTPS POST───────┘
       │                  │ fixed schema
       │                  │ model suggests fields;
       │                  │ Shortcut constructs payload
       │
Calendar / Drive / Contacts ───────────────> context registries

Google Sheets ──> deterministic briefing engine ──> Workspace Studio schedule
                                                └─> Google Chat / email / Doc

ChatGPT ──connected Gmail/Calendar/Drive/Sheet──> review, prioritization,
                                                 difficult drafts, updates

Codex ──repo / tests / deployment / GitHub / PMC──> implementation lifecycle
```

### Why this split

- Workspace Studio supports Gmail arrival starters, Gemini extraction/decision steps, Gmail draft steps, scheduled starters, and Sheet row operations.
- Apps Script provides versioned validation, Gmail/Sheets integration, scheduled reconciliation, web-app intake, and deterministic control.
- The Shortcut provides Apple-native Share Sheet and Siri-adjacent capture without making the phone the state engine.
- ChatGPT is the judgment and control surface, not the polling daemon.
- Codex maintains the implementation, tests, deployments, and project memory.

## 6. Component responsibilities

### 6.1 Google Workspace Studio

V1 uses two versioned flows:

1. **Gmail Intake**
   - starts on new email;
   - performs deterministic source filters;
   - asks Gemini whether a response/action is needed;
   - extracts bounded fields;
   - appends one event to `Studio_Inbox`;
   - creates a Gmail draft only for routine, low-risk items;
   - never sends.

2. **Daily Briefing Delivery**
   - runs on a schedule;
   - reads the precomputed `Briefing_View`;
   - sends the deterministic queue to Cam through a selected channel;
   - does not reorder or silently omit items.

Studio is a fast reaction layer. It is not the canonical database.

### 6.2 Apps Script

Apps Script is the V1 backend and must:

- validate all inbound payloads;
- map staging records to canonical items;
- use Gmail IDs to obtain authoritative message/thread chronology;
- deduplicate retries;
- preserve manual overrides;
- write audit events without content;
- create and update Gmail drafts when explicitly eligible;
- maintain commitments and deadline candidates;
- build the daily briefing;
- expose a write-only Shortcut endpoint;
- provide feature flags and kill switches;
- run a reconciliation job so missed Studio events do not become silent data loss.

### 6.3 Google Sheets

The workbook is the V1 operational store, not an archive.

Required tabs:

| Tab | Purpose |
|---|---|
| `Queue` | One current actionable item per communication thread or obligation |
| `Studio_Inbox` | Append-only intake staging from Workspace Studio |
| `Contacts` | Known people, defaults, tone, priority, and identifiers |
| `Projects` | Project context, active status, Drive links, and relationship defaults |
| `Commitments` | Promises, deadlines, status, and fulfillment evidence |
| `Briefing_View` | Deterministic ready-to-deliver briefing rows |
| `Briefing_History` | Rendered briefings and generation metadata |
| `Audit_Log` | Content-free operational events |
| `Dead_Letter` | Invalid or ambiguous records requiring review |
| `Config` | Schema versions, thresholds, time zone, feature flags, and cursors |

### 6.4 Apple Shortcut

The V1 Shortcut is named **Add to Communication Command Center**.

It:

- accepts text from the Share Sheet or clipboard;
- optionally accepts a contact/app hint;
- uses Apple Intelligence to suggest category, urgency, waiting state, deadline, action, and summary;
- validates allowed enum text using fixed Shortcut logic;
- constructs the JSON dictionary itself;
- generates an idempotency UUID;
- posts to the Apps Script endpoint over HTTPS with a rotating shared secret;
- shows `Added`, `Already added`, or `Needs review`;
- never reads the Messages database automatically;
- never receives queue data back from the endpoint.

### 6.5 ChatGPT

ChatGPT is used for:

- “Run comms” daily prioritization;
- explanation of why an item is surfaced;
- difficult or relationship-sensitive drafting;
- pricing, scope, complaint, contract, schedule, and aviation-employment review;
- combining queue data with live Gmail, Calendar, and Drive context;
- resolving Wayfinder decisions;
- reviewing Codex plans, diffs, tests, and behavior;
- proposing—not silently applying—changes to classification rules.

ChatGPT does not maintain background state and does not auto-send.

### 6.6 Codex

Codex is used for:

- repository, branches, worktrees, GitHub issues, PRs, and CI;
- TypeScript domain implementation and tests;
- Apps Script build/deploy code;
- Studio and Shortcut configuration artifacts;
- local fixtures and contract tests;
- security, privacy, logs, kill switches, backup, and rollback tooling;
- PMC project setup and durable note updates;
- verification evidence before completion.

## 7. Canonical domain model

### 7.1 CommunicationItem

A `CommunicationItem` represents one actionable thread or obligation, not one individual message.

Key fields:

- `schema_version`
- `item_id`
- `source`
- `source_record_id`
- `source_thread_id`
- `source_link`
- `captured_at`
- `updated_at`
- contact identifiers
- `category`
- `project_id`
- `status`
- `waiting_on`
- `urgency`
- `priority_score`
- `next_action_type`
- `next_action`
- `summary`
- `preview` limited to 240 characters
- `deadline_at`
- `follow_up_at`
- `promised_follow_up`
- `draft_status`
- `gmail_draft_id`
- `confidence`
- `classifier_version`
- `content_hash`
- manual-override flags
- `raw_content_stored=false`

### 7.2 Controlled values

**Category**

- `client_lead`
- `active_project`
- `aviation`
- `business_admin`
- `personal`
- `other`

**Waiting on**

- `me`
- `them`
- `none`
- `unknown`

**Status**

- `open`
- `snoozed`
- `resolved`
- `archived`

**Urgency**

- `critical`
- `today`
- `this_week`
- `later`

**Next action**

- `reply`
- `send_file`
- `schedule`
- `call`
- `follow_up`
- `review`
- `none`

**Draft status**

- `not_needed`
- `needed`
- `generated`
- `reviewed`
- `sent`
- `stale`
- `failed`

## 8. State and priority rules

### 8.1 Waiting state

1. If the latest meaningful inbound message requires a response, `waiting_on=me`.
2. If Cam's latest meaningful outbound message expects a response, `waiting_on=them`.
3. If a conversation is informational or closed, `waiting_on=none`.
4. If chronology or meaning is ambiguous, `waiting_on=unknown`.
5. An overdue unresolved promise made by Cam forces an open obligation even when the latest message is an acknowledgement.
6. Manual override remains until explicitly cleared.

### 8.2 Unanswered is not unread

Unread status may be displayed but never determines actionability by itself.

### 8.3 Priority buckets

Deterministic base score:

- `critical`: 100
- `today`: 70
- `this_week`: 40
- `later`: 10

Adjustments:

- overdue deadline: +20
- due within 24 hours: +15
- new client lead or aviation opportunity: +10
- active project: +5
- manually pinned: score becomes 100
- snoozed or resolved: excluded

Cap score at 100. Sort by score, then deadline, then oldest unanswered timestamp.

### 8.4 Draft eligibility

**Routine draft allowed**

- known contact;
- direct response requested;
- no price, scope, contract, payment, refund, complaint, hard schedule commitment, sensitive personal issue, or aviation-employment implication.

**Review-only draft**

- pricing or negotiation;
- complaint or dissatisfaction;
- scope or revision dispute;
- contract, payment, refund, or legal language;
- aviation application, interview, employment, compensation, or relocation;
- date/time commitment with external consequence;
- model uncertainty or unknown contact.

**No draft**

- receipt, newsletter, automated notice, spam, closed acknowledgement, or information-only message.

All drafts require Cam's review. V1 has no send action.

## 9. Deadline and promise handling

- Normalize absolute times to ISO 8601 with `America/New_York`.
- Preserve the sender's original deadline text.
- If a relative date cannot be resolved confidently, leave `deadline_at=null` and set `needs_date_review=true`.
- A commitment made in Cam's outbound message creates a `Commitment` even if the other person never follows up.
- Hard deadlines remain queue items until fulfilled.
- Calendar candidates require `calendar_approved=true`; creation is not automatic in V1.

## 10. Data minimization and privacy

### Persist

- IDs and links;
- contact identifiers needed for routing;
- short summary and 240-character preview;
- category, state, action, dates, hashes, model/version metadata;
- draft ID, not full draft body;
- audit result, not private payload.

### Do not persist in Sheets

- full email bodies;
- full Apple Messages text after processing;
- attachments;
- OAuth material;
- Shortcut shared secret;
- complete model prompts containing private content;
- raw debug payloads.

### Logs

Logs may include:

- item ID;
- source type;
- action;
- result;
- error code;
- timing;
- payload hash.

Logs must not include message content, subject, sender body, token, or draft body.

## 11. Repository and technical stack

Recommended stack:

- TypeScript
- Node.js current LTS for local tooling
- `clasp` for Apps Script synchronization
- `esbuild` for bundling Apps Script-compatible JavaScript
- `zod` for runtime validation and typed contracts
- Vitest for unit and contract tests
- ESLint and Prettier
- GitHub Actions for validation
- Apps Script V8 runtime
- Google Sheets, Gmail, Calendar, Drive
- Workspace Studio built-in Gmail, Gemini, Sheets, schedule, Chat, and draft steps

Production Apps Script code must be dependency-light and bundled into a single deployable output.

## 12. Operational commands

### User-facing commands for ChatGPT

- `Run comms`
- `Show only aviation`
- `Show promises due this week`
- `Draft item <item_id>`
- `Why is <item_id> prioritized?`
- `Snooze <item_id> until <date>`
- `Mark <item_id> waiting on them`
- `Resolve <item_id>`
- `Show drafts that need judgment`
- `What did I promise people this week?`

### System actions

Every state-changing command must update the canonical Sheet row and append an audit event.

## 13. Daily briefing format

The deterministic briefing contains:

1. **Handle first** — up to five highest-priority items.
2. **Quick wins** — open replies estimated under five minutes.
3. **Promises due or overdue.**
4. **Needs judgment** — review-only items.
5. **Drafts ready.**
6. **Waiting on others.**
7. **Upcoming this week.**
8. **System health** — failed intake, duplicate suppression, stale drafts.

AI may improve wording but may not reorder, remove, or add items.

## 14. Acceptance criteria

### Core vertical slice

- A new actionable Gmail message appears in the canonical queue within the configured reconciliation window.
- Processing the same event twice produces one queue item.
- A routine message produces one Gmail draft and never sends it.
- A high-risk message is queued for judgment and does not create an automatic draft.
- Replying from Gmail updates `waiting_on` correctly on reconciliation.
- A promise in an outbound message becomes a commitment even without a new inbound message.
- An invalid Shortcut payload is rejected into `Dead_Letter` without exposing content in logs.
- A valid Shortcut payload appears once and returns a safe confirmation.
- The morning briefing excludes snoozed/resolved items and follows deterministic order.
- Disabling each feature flag stops only that feature.

### Pilot-quality thresholds

Evaluate at least 50 sanitized or user-approved communication examples:

- `waiting_on` correctness: at least 90%;
- actionable detection precision: at least 90%;
- duplicate suppression: 100% in contract tests and no known pilot duplicates;
- deadline normalization: 100% on unambiguous fixture dates;
- raw-content retention violations: zero;
- auto-sent communications: zero;
- routine drafts rated usable with minor or no edits on at least 80% of eligible pilot examples.

A miss does not trigger silent retraining. It creates a fixture and a reviewed rule or prompt change.

## 15. Milestones and release gates

### Milestone 0 — Foundation

Exit when:

- private repository exists;
- planning pack is committed;
- tests run;
- PMC is connected;
- Wayfinder map and tickets exist;
- no cloud resources were changed without approval.

### Milestone 1 — Local domain core

Exit when schemas, state machine, priority rules, and fixtures pass locally.

### Milestone 2 — Sheet/backend vertical slice

Exit when a synthetic event creates, updates, resolves, snoozes, and audits one queue item idempotently.

### Milestone 3 — Gmail pilot

Exit when selected Gmail threads ingest and reconcile correctly with no sending.

### Milestone 4 — Workspace Studio

Exit when built-in flow actions create staging records and routine drafts under review.

### Milestone 5 — Apple Shortcut

Exit when Share Sheet input posts safely and retries idempotently.

### Milestone 6 — Briefing and ChatGPT usage

Exit when daily briefing and natural-language review workflow are useful for one working week of pilot usage.

### Milestone 7 — Production hardening

Exit when rollback, token rotation, kill switches, backups, drift checks, and incident runbooks are verified.

## 16. Phase 2 options

Only after V1 proves value:

- read-only local Messages bridge;
- native macOS/iOS companion app with App Intents;
- Cloud Run endpoint with stronger request authentication;
- ChatGPT custom app/connector or MCP surface;
- database migration;
- multi-account or multi-user support;
- automated calendar candidate approval;
- richer CRM/project integration.

Each option requires a new Wayfinder map or a clearly scoped child map.
