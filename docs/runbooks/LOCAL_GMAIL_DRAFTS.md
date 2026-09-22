# Local Gmail draft lifecycle

This document describes the versioned draft lifecycle and native create-only
provider boundary. The runtime has no send operation. The provider is implemented
locally but remains uninvoked in production: compose authorization, eligible
model context, deployment binding, and live create acceptance are separate gates.
Synthetic tests do not establish live Gmail behavior. See [Decision 108](../wayfinder/tickets/108-native-draft-create-only.md) and [V1 execution](../implementation/V1_EXECUTION.md).

## Entry points and prerequisites

`DraftWriter` in `src/adapters/gmail/draft-writer.ts` exposes:

- `createOrReplaceRoutineDraft(item, text)` for eligible routine replies.
- `markDraftStale(itemId)` for metadata-only invalidation.
- `deleteSyntheticDraft(draftId)` for uniquely identified, application-owned
  synthetic drafts only.

The writer requires an approved mailbox, a `DraftRepository`, a draft-only
transport, a trusted context resolver, separate drafting and external-write
flags, SHA-256 hashing, UUID generation, and an injected clock. There are no
default-enabled flags and no production bindings in this slice.

The context resolver must independently load the canonical item, authoritative
Gmail source identifiers/hash, curated-contact knowledge, and current risk
facts. Never pass a model response directly as trusted context. The schema is
strict, and deterministic risk rules can only make the model's eligibility more
restrictive. Manual overrides, review/sent states, uncertain classification,
non-routine consequences, mismatched sources, and a mailbox outside the
configured scope block creation. Source and flags are checked again after the
reservation commits.

## Persistence and contract version

`DraftRepository` stores only versioned operational metadata in existing
`Config` rows keyed by `gmail.draft.v1.<item_id>`. The value is strict JSON
validated by `DraftOperationSchema` version `1.0`. It contains source identifiers
and hashes, operation UUID, status, draft ID/revision, synthetic ownership,
timestamps, and fixed error codes. Draft text is transient; it is not retained
in the ledger or returned errors. The revision must be an opaque non-secret
version or fingerprint, never raw draft content.

This is the first version of the draft-operation contract. Existing Queue,
Staging, Audit, and workbook headers are unchanged. No existing rows need a
migration; unrelated Config keys are preserved. Unsupported versions, unknown
fields, duplicate keys, or malformed records fail closed. Future changes to
this persisted contract require a version bump, migration notes, fixtures, and
contract tests. Do not rewrite non-empty production rows to resolve a schema
error.

Evidence: `tests/fixtures/gmail-drafts/operation-v1.json`,
`tests/contract/draft-state.test.ts`, and
`tests/integration/draft-repository.test.ts`.

## Write and retry protocol

1. Under the workbook transaction, validate state and commit a `pending`
   reservation. `runTransaction` must serialize writers and durably commit
   before it resolves. A production adapter must prove this contract.
2. Recheck authoritative context, flags, and the reservation. Perform the
   external draft operation outside the workbook transaction.
3. Validate the transport result, including correct thread, stable draft ID on
   replacement, and full-draft revision. Finalize metadata in a new transaction.
4. If the provider result or final metadata write is uncertain, retain
   `pending`/`uncertain` and return `RECOVERY_REQUIRED`. All automatic retries
   for that item remain blocked. A crash after reservation is deliberately
   conservative even if no external draft was created.

An identical source/body request can return `existing` from the durable ledger.
That means the recorded operation is reused, not that a fresh Gmail read proved
the draft still exists. A newer source or loss of eligibility can mark the
existing draft stale. In-flight stale requests survive finalization, and a
cancelled replacement cannot restore an obsolete draft as current. A deleted
synthetic draft retains a tombstone: the same source cannot recreate it, while
a newer eligible source can create a new draft.

## Protecting human edits

`replaceIfUnchanged` and `deleteIfUnchanged` receive both `expectedBodyHash` and
`expectedRevision`. The revision must cover the complete draft, including
recipients, subject, and body. A matching body alone cannot establish ownership.

The transport must compare and mutate atomically relative to human edits, or
return `unsupported` without changing Gmail. A separate read followed by an
unconditional update does not satisfy this contract. `conflict` also guarantees
no mutation and makes the recorded draft stale. A transport exception or
malformed result is an unknown outcome, not proof that the operation failed.

The native provider is create-only. It deliberately does not provide conditional
replacement or deletion; those operations remain unsupported and make no Gmail
provider call. Do not enable them unless a provider-supported full-envelope
conditional-write contract is accepted and verified.

## Remaining integration work

- Bind the reviewed create-only provider only after private deployment, compose
  authorization, eligible model-context resolution, and live create acceptance
  are separately verified.
- Maintain the trusted resolver's current source/risk facts and preserve Queue
  draft IDs, stale status, and human review through reconciliation.
- Implement reviewed uncertain-write recovery against exact mailbox/thread/provider
  evidence before offering any operator retry. Never clear a pending reservation
  merely because it is old.
- Resolve the Studio/model boundary and collect account-level usefulness evidence
  with zero sends and no body retention. Local test success does not accept that gate.

## Verification

Run `pnpm verify`, `pnpm validate:planning`, and `git diff --check`. Focused
coverage is in `tests/integration/draft-writer.test.ts`: risk and source gates,
kill switches, durable reservation, concurrent callers, restart reuse, provider
uncertainty, metadata failure, stale state, full-draft conflicts, and scoped
synthetic cleanup. Fixtures use synthetic content and example.com identities.

Independent review must precede merge. Live runtime and longer-term pilot
acceptance belong to the integration workstream.

Run the focused lifecycle/provider tests, `pnpm verify`, `pnpm validate:planning`,
and `git diff --check` for a candidate. Current verification counts and live
posture belong in [V1 execution](../implementation/V1_EXECUTION.md), not this
contract. Local success remains implementation evidence; it does not create a
draft or prove the account/device/model gates.
