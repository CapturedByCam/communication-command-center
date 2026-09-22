# Separate deterministic state from AI interpretation

## Question

Which responsibilities belong to code and which belong to models?

## Type

Grilling + domain modeling

## Status

Closed

## Resolution

Code owns IDs, dates, chronology, state transitions, deduplication, validation, ordering, persistence, retries, permissions, and manual overrides. Models suggest actionability, category, summary, deadlines, promises, and draft wording. Every model output is validated and can be overridden.
