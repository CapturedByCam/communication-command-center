# Shortcut intake implementation contract

## Scope and status

This document specifies the local V1 implementation of the write-only Apple
Shortcut intake. It is not deployment evidence. The Apps Script web app, Script
Properties, token generation, account authorization, and Shortcut installation
remain separate operator steps.

## Handler interface

`createShortcutHandler` in `src/adapters/http/shortcut-handler.ts` is a
synchronous pure boundary suitable for Apps Script `doPost(e)`. It accepts only:

```ts
{
  body: string;
  remoteAddress: string | null;
}
```

Its injected dependencies are a token reader, enabled flag, rate-limit check,
clock, SHA-256 function, byte-length function, atomic storage adapter, and an
optional redacted rejection sink.
The storage adapter must implement `createIfAbsent` atomically by the UUID and
must provide a read-only `findByIdempotencyKey` recovery lookup. It receives a
normalized `CommunicationItem`, UUID, and SHA-256 content hash; it must never
persist the request body or `shared_text`. The rejection sink accepts only the
controlled `invalid_payload` error code and is invoked only when a malformed
request proves knowledge of the configured token. It must never receive or
persist a body, token, contact hint, model field, address, or hash.

The only response shapes are:

```json
{"status":"needs_review","item_id":"cc_..."}
{"status":"duplicate","item_id":"cc_..."}
{"status":"rejected","error_code":"disabled|rate_limited|payload_too_large|invalid_payload|unauthorized|configuration_error|storage_unavailable"}
```

No response includes Queue rows, source text, model text, token values, stack
traces, or storage details.

## Required Apps Script wrapper behavior

The entrypoint owner must build the injected dependencies from Apps Script
services and return `ContentService.createTextOutput(JSON.stringify(response))`
with MIME type JSON. `doPost` must not return a Promise. Read the token and the
`shortcut_intake_enabled` flag from Script Properties. Use a transaction or
lock-protected ledger keyed by `idempotency_key` for the atomic storage contract.
Apply the rate limit using transport metadata where Apps Script makes it
available; if no trustworthy address exists, use a conservative single-user
bucket without recording request content. For the anonymous deployment, apply
a global pre-authentication cap of 10 requests per minute before parsing, then
apply the separate authenticated write cap of 30 requests per minute. Apps
Script does not supply a trustworthy caller address to this handler, so the
pre-authentication cap is intentionally global and bounds rather than
eliminates public request cost.

Apply the authenticated write quota before either a Queue create or an
authenticated malformed-request audit row. Recheck the current kill switch and
the token presented by the request while holding the same script lock used for
the corresponding Queue or Dead_Letter write. `cccDisableAll()` takes that lock
before changing feature flags, so a request that has not crossed the locked
authorization boundary cannot persist after shutdown completes. Keep the
disable-first rotation sequence; do not replace the token while intake remains
enabled.

Never log `e.postData.contents`, `shared_text`, `auth_token`, the full parsed
payload, or model output. Logs and audit records may contain only a content hash,
controlled result, correlation UUID, and timestamp.

## Normalization behavior

- Rate limiting, kill switch, and body-size checks happen before JSON parsing.
- The token comparison has no early return based on the first different
  character. Inputs are schema-bounded before comparison.
- `source_record_id` and `source_thread_id` derive from the stable UUID.
- `item_id` derives deterministically from a SHA-256 hash of the UUID.
- `shared_text` is hashed for deduplication/audit and immediately discarded.
- The handler deliberately ignores model category, urgency, waiting state,
  summary, and next action. It uses safe values and returns `needs_review`.
- A model-suggested date has no authoritative source-time anchor, so
  `deadline_at` remains null and `needs_date_review=true`. A generic review
  marker replaces the model date phrase to prevent echoed source text retention.
- An uncurated `contact_hint` is not persisted and cannot establish a contact
  association.
- After an uncertain storage failure, one lookup by UUID determines whether the
  write committed. The handler does not blind-retry the write.

## Pilot acceptance sequence

Follow the versioned [Shortcut action inventory](../../shortcuts/ADD_TO_COMMAND_CENTER.md)
after deployment is explicitly authorized. Verify one synthetic create, a retry
with the same UUID, a wrong-token rejection, the kill switch, rate limit, and an
oversized request. Confirm Queue and audit data have no selected text, token, or
model output before using private communications.

## Assisted rotation

Decision [101](../wayfinder/tickets/101-shortcut-authentication.md) requires assisted rotation after suspected exposure, device loss, scope expansion, or before production hardening; it is not routine maintenance. Follow [Shortcut token rotation](../runbooks/SHORTCUT_TOKEN_ROTATION.md). The procedure uses only private Script Properties and the private Shortcut configuration, keeps intake disabled during setup, and records no token or source content.

The handler reads its injected current token for each request. Replacing that private value immediately rejects the retired token; the replacement retains UUID idempotency. With the intake flag disabled, both tokens are rejected before parsing/persistence. `tests/integration/shortcut-runtime.test.ts` proves this locally with synthetic values. It does not provision a token, alter deployment access, or establish a working device Shortcut.

## Current acceptance boundary

Consult [V1 execution](V1_EXECUTION.md) and [PMC Current State](../../PMC/Current%20State.md) for the current private runtime and feature posture. The setup-blocked Shortcut template and action inventory are versioned in `shortcuts/`; no installed/exported token-bearing Shortcut, working endpoint/device capture, or live intake acceptance is implied here. Keep the endpoint/device authentication gate separate from local handler correctness, and keep no-send, no-raw-content, and review-only normalization behavior unchanged.
