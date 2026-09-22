# Runtime Operations

This runbook covers the private Apps Script pilot. Standing authorization covers
the private owner-only deployment and bounded checks. It does not enable a feature
flag or trigger, provision a Shortcut token, create a draft, deliver a notification,
or send a Google message.

## Private deployment posture

The checked-in manifest configures the web app with
`webapp.access: "MYSELF"` and `webapp.executeAs: "USER_DEPLOYING"`. That is a
private operator deployment: only the deploying operator can access it and it
runs as that operator. Immutable version 1 is deployed with this configuration.
Its `SERVER_JS` source exactly matches `dist/Code.js` after LF normalization and
its manifest semantically matches `dist/appsscript.json`.

Keep all feature flags false and do not create time-driven triggers until the
controlled live checks and feature-specific acceptance evidence pass. `cccHealth`
and `cccGmailReadProbe` passed. A later save enabling Gmail/briefing for manual
pilot tests was interrupted by screen lock; its outcome is unknown. Inspect
properties before further tests. No triggers exist. The manifest's Gmail scope
is read-only; V1 has no send path.

## Offline deployment-drift check

Build the exact candidate first, then obtain a `projects.getContent` JSON
response through an approved read-only mechanism and save it under `.local/`.
That response may contain deployed source, so it must remain untracked and
private. This checker makes no network calls:

```sh
node scripts/check-deployment-drift.mjs \
  --content .local/apps-script-project-content.json \
  --dist dist
```

It compares `dist/Code.js` with the sole deployed `SERVER_JS` file after LF
normalization, compares `appsscript.json` semantically, and rejects missing or
additional runnable `SERVER_JS` or `HTML` files. Its output contains statuses
and SHA-256 values only; it never prints deployed source. `STATUS=drift` or
`STATUS=invalid` stops deployment investigation until the mismatch is resolved.

## Workbook backup and restore

Before any pilot operation that could change Sheet metadata, create a private
backup copy in the verified account. Verify the source workbook ID, the new
backup resource ID, access restrictions, and that the original remains
unchanged. Record only approved operational identifiers in private records.

Restore by creating a **new** private workbook resource from the approved
backup. Validate its manifest headers and empty/sanitized state before binding
any new pilot deployment. Never overwrite, clear, replace, or import into an
existing workbook as a restore procedure.

## Rollback

If a private deployment behaves unexpectedly, first run `cccDisableAll()` on
the current private deployment to turn off flags and remove managed triggers.
Then repoint the private deployment to the previously verified Apps Script
version. Run `cccDisableAll()` again after rollback when available, and verify
all flags are false and managed trigger count is zero.

Rollback does not notify Google contacts, send messages, delete Gmail drafts,
delete source messages, or delete workbook records. Preserve logs and the
private backup for diagnosis. Re-enabling any flag, trigger, or changing deployment access requires the
applicable live-test evidence. Preserve owner-only access.
