# Use Workspace Studio for fast orchestration and Apps Script for canonical normalization

## Question

Where should Gmail workflow orchestration end and deterministic backend processing begin?

## Type

Research + domain modeling

## Status

Closed

## Resolution

Workspace Studio starts on email arrival, runs bounded Gemini extraction/decision steps, appends to `Studio_Inbox`, and may create low-risk drafts. Apps Script validates, resolves authoritative Gmail thread state, deduplicates, normalizes, persists, reconciles, and builds the briefing. A scheduled Gmail reconciliation path protects against missed Studio events.
