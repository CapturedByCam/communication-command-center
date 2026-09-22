# Use a create-only native Gmail draft adapter in V1

## Status

Accepted conservative integration decision under Cam's 2026-09-22 standing V1
authorization. Implementation may proceed; live drafting stays disabled until
source interpretation, runtime binding and provider acceptance pass.

## Decision

Implement only Gmail draft creation. Native replacement and deletion return
`unsupported` without accessing or mutating Gmail. The existing abstract lifecycle
may retain conditional transports for fixtures, but a Gmail message ID, timestamp
or content hash is not an atomic compare-and-write capability.

Google documents replacement semantics for draft updates, without a conditional
revision argument. We therefore cannot establish the current transport contract
for preserving a simultaneous human edit. V1 must not emulate that guarantee with
a read followed by an unconditional update or delete.

The create adapter loads only the exact requested message's metadata, checks the
approved profile and requested/fetched message and thread identities, and rejects
sources outside the current 30-day window. The lower boundary is inclusive; the
current-time upper boundary is exclusive. The native context guard must perform
this validation before the lifecycle reserves a write, and the create transport
must repeat it immediately before the external create. No thread endpoint or
older history is read. This proves source age and identity, not complete thread
chronology or interpretation; those remain separate eligibility gates.

Reply metadata is transient: one exact recipient, matching Subject, Message-ID,
References and In-Reply-To. Reject ambiguous/multiple recipients, malformed
headers, injection and unsupported encodings rather than guessing. A Reply-To must
normalize to the same sender address, preserving the known-contact eligibility gate.
Message identifiers are visible ASCII; generated header lines stay within 998 octets.
The body is
plain text, bounded, UTF-8 MIME encoded and base64url wrapped for Gmail. No body,
raw MIME, subject or recipient is persisted in the operation ledger or logs.
Gmail remains the only store of the created unsent draft.

Creation requires the creation flag and validated owner/workbook authorization
before reads and again before the API write. Replacement stays independently
disabled. No new flag or stored schema is needed; the future runtime maps the
abstract creation gate to `CCC_DRAFT_CREATION`. The create-only revision value is
an opaque receipt, not a conditional Gmail revision; it never enables replacement.
Malformed or wrong-thread create responses and uncertain API outcomes must never
be retried automatically and remain recovery-required in the existing ledger.

This slice adds a tested provider and preflight context guard only. It does not
add compose scope, an invokable draft entrypoint, deployment permissions or an
eligible interpretation provider. These are explicit remaining binding steps,
not claims of a working drafting integration.

## Acceptance

Tests cover disabled/unauthorized zero-read paths; exact profile/message/thread
binding; lower/upper age boundaries and clock advancement; strict headers and
UTF-8 MIME; duplicate-header and CRLF injection rejection; independent checks
before reservation and create; controlled provider failures; no body/header log or
ledger retention; and no update, delete or send calls. Existing lifecycle tests
must still prove pending/uncertain reservations block duplicate creates.

## Sources and rollback

- [Gmail threading requirements](https://developers.google.com/workspace/gmail/api/guides/threads)
- [Draft creation](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/create)
- [Draft replacement](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/update)

Leave creation and replacement flags false. With the adapter unbound, removing
its source changes no Google state. Preserve any future app-owned draft and its
ledger when a write outcome is uncertain; do not delete or recreate it blindly.
