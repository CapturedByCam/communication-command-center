# Project Memory Core Bootstrap

PMC gives Codex lasting project context in an Obsidian-compatible vault controlled by Cam.

## When to run

Run after:

- the private repository exists;
- the repository root is verified;
- Cam has selected either a new PMC vault or an existing Obsidian vault.

Do not invent a vault path. The first PMC interaction must ask only:

> Create a new project-memory vault, or connect an existing Obsidian vault?

## Proposed project registration

- Readable name: `Communication Command Center`
- Stable project ID: `communication-command-center`
- Primary repository: the verified local Git repository
- Vault folder: selected by Cam
- Repository paths stored in durable notes: repository-relative only
- Absolute machine paths stored only in local configuration

## Initial notes to create

### Project Home.md

Include:

- one-sentence purpose;
- current milestone;
- links to Product/Architecture Spec, Wayfinder Map, Current State, Handoff, and Coverage;
- non-negotiable product invariants;
- next safe action.

### Project.md

Compact compatibility index:

- project ID and repository;
- architecture summary;
- tech stack;
- key commands;
- active workstreams;
- links to decisions and procedures.

### Current State.md

Initial state:

- planning pack complete;
- no repository until Phase 0 approval;
- no cloud resources deployed;
- no production data ingested;
- open Wayfinder frontier listed;
- next action is repository and vault setup.

### Inbox/Promotion Inbox.md

Use for unapproved discoveries or proposed changes. Do not treat them as durable truth.

### Handoff.md

Keep one-page in spirit:

- objective;
- current position;
- accepted decisions;
- recent work;
- blockers;
- next actions;
- relevant links.

### Coverage.md

Track durable knowledge coverage for:

- product behavior;
- domain model;
- privacy/security;
- Gmail ingestion;
- Workspace Studio;
- Apple Shortcut;
- briefing;
- deployment;
- operations;
- incident response.

## Durable decisions to promote immediately after setup

- no auto-send in V1;
- code owns state and AI owns interpretation;
- Google Sheets is the V1 operational store;
- full message bodies are not stored in Sheets;
- Apple capture is manual Share Sheet in V1;
- Workspace Studio reacts while Apps Script validates/reconciles;
- ChatGPT is the judgment/control layer;
- manual overrides win;
- all components use versioned canonical schemas.

## Automatic orientation

After Cam explicitly opts in, add the PMC managed orientation block to this repository's `AGENTS.md`. Future tasks should load `Project.md` and `Current State.md`, then only the relevant linked notes.

## Wrap-up requirement

At the end of each accepted milestone:

1. update `Current State.md`;
2. update `Handoff.md`;
3. propose durable changes separately;
4. do not archive a raw transcript;
5. record branch/commit evidence for implementation claims.
