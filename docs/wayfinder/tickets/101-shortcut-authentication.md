# Select Shortcut endpoint authentication for the pilot

## Question

Should the pilot Apps Script endpoint use a rotating 256-bit shared secret in the POST body, or should the endpoint move immediately to Cloud Run/OAuth for stronger request authentication?

## Type

Grilling + research

## Status

Open

## Blocks

- Apple Shortcut implementation
- production deployment runbook approval

## Recommendation to evaluate

Use a rotating high-entropy shared secret stored in Script Properties and the local Shortcut for the single-user pilot, with a write-only endpoint, strict payload limits, idempotency, rate limiting, no response data, and an immediate kill switch. Move to Cloud Run or another signed/OAuth path before unattended or multi-user ingestion.
