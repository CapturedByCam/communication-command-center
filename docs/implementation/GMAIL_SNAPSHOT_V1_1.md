# Gmail source snapshot 1.1

Accepted runtime compatibility correction, 2026-09-22.

The metadata reader previously rejected valid recipient addresses containing an
`=` in the local part because the default Zod email pattern accepts only common
Gmail-style characters. That rejection appeared as a retriable read failure.

The transient source snapshot contract is now version 1.1. Its sender and recipient
address tokens use Zod's RFC 5322 email pattern with the existing 320-character bound and
an explicit CR/LF rejection. The exact approved mailbox check, metadata-only reads,
strict fields, chronology and interpretation validation remain unchanged. Native
metadata reads emit 1.1. Existing 1.0 snapshots retain their prior validator and
remain accepted; unsupported versions remain rejected.

No stored schema changes: Queue/CommunicationItem, Studio staging, checkpoints,
Dead_Letter and drafts keep their existing versions and fields. Source snapshots
are transient, so migration requires no Sheet row rewrite. Rollback to the prior
bundle leaves stored data compatible but restores rejection of these source
addresses. Keep intake disabled during rollback.

The synthetic `tests/fixtures/gmail-source/rfc-address-v1.1.json` and its contract
tests cover the new version, legacy validation, malformed addresses, header
injection and forbidden fields. The metadata integration regression confirms that
an RFC recipient survives a requested-message-only read without returning bodies.

Reference: [Zod email pattern documentation](https://zod.dev/api#emails).

Recipient lists preserve commas in quoted display names and quoted local parts.
Malformed/unbalanced quoting or angle brackets is rejected without partial output.
This is bounded address-token validation, not a complete RFC header grammar;
unsupported group or comment syntax remains a controlled read failure for review.
