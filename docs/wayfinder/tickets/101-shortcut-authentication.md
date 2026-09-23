# Select Shortcut endpoint authentication for the pilot

## Question

Should the pilot Apps Script endpoint use a rotating 256-bit shared secret in the POST body, or should the endpoint move immediately to Cloud Run/OAuth for stronger request authentication?

## Type

Grilling + research

## Status

Closed

## Resolution

Use one high-entropy shared secret stored in Script Properties and the Shortcut for the single-user pilot. The endpoint remains write-only, enforces strict payload limits, idempotency and rate limits, returns no queue data, and has an immediate kill switch. Do not require routine manual rotation. Rotate after suspected exposure, device loss, or scope expansion, or automate rotation before production hardening. Document an assisted rotation procedure. Move to signed or OAuth-based authentication before unattended or multi-user ingestion.

## Implementation evidence

The single-user Mac pilot passed live synthetic acceptance on 2026-09-23.
Disabled, invalid-token, fixed-UUID duplicate, oversized-body, and
pre-authentication rate-limit checks passed. The installed private macOS
Shortcut produced two review-only Queue items without retaining request text or
returning Queue data. The token remains confined to Script Properties and the
local Shortcut, and intake was returned to false. The installed shell allocates
one UUID before its two-attempt loop and reuses the same payload for its single
automatic transport retry. The assisted rotation runbook and reviewed server
guards remain in force.

This evidence accepts the Mac pilot implementation. A multi-user, unattended,
or iPhone/iPad expansion still requires its own device and authentication
review under the resolution above.
