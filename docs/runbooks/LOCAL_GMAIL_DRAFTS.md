# Local Gmail draft lifecycle

This implements the local orchestration portion of plan Task 11. It has no
Google service binding or deployment and exposes no send operation. Synthetic
tests exercise injected transports; they do not establish live Gmail behavior.

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

No production Gmail transport satisfying this conditional-write requirement is
provided or claimed. If provider capabilities cannot satisfy it, leave automatic
replacement/deletion unsupported and resolve the live behavior before enabling
those operations.

## Remaining integration work

- Connect the accepted Gmail reconciliation and curated registry contracts to
  the trusted context resolver. Maintain current source/risk state across writes.
- Implement and verify private Sheet transactions and the draft-only transport,
  including original-thread targeting and full-envelope edit protection.
- Project ledger state into the canonical Queue without allowing reconciliation
  to erase draft IDs, stale status, or human review. This slice deliberately
  does not modify the parallel Milestone 3 files or Queue upsert behavior.
- Implement reviewed uncertain-write recovery: inspect the exact mailbox,
  thread and operation, reconcile provider evidence with the ledger, and preserve
  user edits. There is no reset/retry endpoint in this slice. Never clear a
  pending reservation merely because it is old.
- Resolve the Studio/backend boundary and exercise account-level synthetic
  tests with zero sends and no body retention. Local test success does not
  accept Milestone 4.

## Verification

Run `pnpm verify`, `pnpm validate:planning`, and `git diff --check`. Focused
coverage is in `tests/integration/draft-writer.test.ts`: risk and source gates,
kill switches, durable reservation, concurrent callers, restart reuse, provider
uncertainty, metadata failure, stale state, full-draft conflicts, and scoped
synthetic cleanup. Fixtures use synthetic content and example.com identities.

Independent review must precede merge. Live runtime and longer-term pilot
acceptance belong to the integration workstream.

On 2026-09-22, full verification passed with 186 tests, including 71 draft
contract/repository/lifecycle tests. Planning validation and the diff check
passed. A neutral ESM bundle imported successfully and rejected invalid inputs
without invoking dependencies; its public API contains no send operation.
Independent review found no remaining actionable defects after full-draft
revision, stale-cancellation, and deleted-tombstone regressions were fixed.
The repository build check still reports no application entrypoint; it is not
evidence of a deployable runtime.
