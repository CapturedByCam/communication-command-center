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
clock, SHA-256 function, byte-length function, and an atomic storage adapter.
The storage adapter must implement `createIfAbsent` atomically by the UUID and
must provide a read-only `findByIdempotencyKey` recovery lookup. It receives a
normalized `CommunicationItem`, UUID, and SHA-256 content hash; it must never
persist the request body or `shared_text`.

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
bucket without recording request content.

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
- A schema-valid offset date is converted to UTC ISO 8601 but remains flagged
  `needs_date_review=true`; relative or missing dates remain null.
- After an uncertain storage failure, one lookup by UUID determines whether the
  write committed. The handler does not blind-retry the write.

## Pilot acceptance sequence

Follow the versioned [Shortcut action inventory](../../shortcuts/ADD_TO_COMMAND_CENTER.md)
after deployment is explicitly authorized. Verify one synthetic create, a retry
with the same UUID, a wrong-token rejection, the kill switch, rate limit, and an
oversized request. Confirm Queue and audit data have no selected text, token, or
model output before using private communications.
