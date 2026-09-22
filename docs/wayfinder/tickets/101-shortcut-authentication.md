# Select Shortcut endpoint authentication for the pilot

## Question

Should the pilot Apps Script endpoint use a rotating 256-bit shared secret in the POST body, or should the endpoint move immediately to Cloud Run/OAuth for stronger request authentication?

## Type

Grilling + research

## Status

Closed

## Resolution

Use one high-entropy shared secret stored in Script Properties and the Shortcut for the single-user pilot. The endpoint remains write-only, enforces strict payload limits, idempotency and rate limits, returns no queue data, and has an immediate kill switch. Do not require routine manual rotation. Rotate after suspected exposure, device loss, or scope expansion, or automate rotation before production hardening. Document an assisted rotation procedure. Move to signed or OAuth-based authentication before unattended or multi-user ingestion.

## Remaining implementation gate

Verify the kill switch, redacted logging, rate limiting, and assisted rotation procedure before deployment.
