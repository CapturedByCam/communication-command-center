# Apple Shortcut — Add to Communication Command Center

Action inventory version: `1.1`

## V1 behavior

The Shortcut accepts selected text from the Share Sheet or clipboard, constructs
a fixed review-only JSON dictionary, and sends it to the write-only Apps Script
endpoint. It does not read Messages, mail, or any conversation database. It
does not use an on-device or cloud model in V1.

## Share Sheet configuration

Accept:

- Text
- Rich text converted to plain text
- URLs converted to text only when the user explicitly shares them

Do not accept files, images, attachments, or entire conversation databases in V1.

## Actions

1. Receive Share Sheet input; if absent, get clipboard.
2. Trim whitespace.
3. If length is 0, stop with `Nothing to add`.
4. If length exceeds 12,000 characters, ask the user to select a smaller excerpt.
5. Get current date in ISO 8601.
6. Generate a UUID for `idempotency_key`.
7. Build the JSON dictionary defined in `schemas/shortcut-intake.schema.json`.
   Set `model_fields` to fixed safe values: `classification_status`
   `needs_server_review`, category `other`, urgency `later`, waiting_on
   `unknown`, `deadline_at` and `deadline_text` `null`, next action `Review in
   source app.`, and summary `Manual Shortcut capture.`.
8. POST to the endpoint using `Get Contents of URL`.
9. Interpret only `needs_review`, `duplicate`, and `rejected`. A successful
   new capture returns `needs_review`; `created` is not an endpoint response.
10. Show a local confirmation. Do not return queue contents or private server
    data.

## Build and install (manual, local only)

This repository does not contain an imported `.shortcut` file because its token
must exist only in the local Shortcut. Build it in the Shortcuts app using the
following versioned action inventory. The action names can vary slightly by
macOS/iOS release; preserve the inputs, validation, and order below.

| Order | Shortcut action | Required configuration |
| --- | --- | --- |
| 1 | Receive Any Input from Share Sheet | Limit accepted types to Text, Rich Text, and URLs. Convert rich text and an explicitly shared URL to plain text. |
| 2 | If | If Shortcut Input has no value, use Get Clipboard; otherwise use Shortcut Input. |
| 3 | Get Text from Input | Convert the chosen input to plain text. |
| 4 | Trim Whitespace | Save as `Shared Text`. |
| 5 | If | If `Shared Text` is empty, Show Result `Nothing to add` and Stop This Shortcut. |
| 6 | Get Details of Text | Get character count. If greater than 12,000, Show Result `Select a smaller excerpt` and Stop This Shortcut. |
| 7 | Current Date | Format ISO 8601 with time-zone offset as `Captured At`. |
| 8 | Generate UUID | Save as `Idempotency Key`; keep it unchanged for any retry during this run. |
| 9 | Dictionary | Construct the exact `ShortcutIntake` JSON object. Include `shared_text` only in this request dictionary; never save it to a file, Note, or log. Set `contact_hint` to `null`, `app_hint` to `Manual Share`, and the fixed `model_fields` safe values below. |
| 10 | Get Contents of URL | POST JSON to the deployed HTTPS endpoint. Add `auth_token` from a local Text action; do not export or share this action. |
| 11 | If | Read only `status` and optional `item_id` from the JSON response. Map `needs_review` to `Added for review`, `duplicate` to `Already added`, and `rejected` to `Could not add; retry with the same ID`. |
| 12 | Show Result | Show only that local result. Never display response bodies beyond those status messages. |

### Fixed review-only model fields

The schema requires `model_fields`, but the V1 server treats them as untrusted
and discards their suggested category, urgency, waiting state, summary, next
action, and dates. Use these literal values rather than a model:

```text
classification_status=needs_server_review
category=other
urgency=later
waiting_on=unknown
deadline_at=null
deadline_text=null
next_action=Review in source app.
summary=Manual Shortcut capture.
```

The server never retains `shared_text` or these model-field values.

### Local token and endpoint configuration

1. After the Apps Script web app exists, paste its exact HTTPS URL into action 10.
2. Generate a 256-bit token outside Git and place it in a local Text action
   immediately before the Dictionary action. Do not put it in the Shortcut name,
   comment, screenshots, exports, logs, or this repository.
3. Add it to the Share Sheet, enable only the accepted types above, and keep the
   Shortcut private to Cam's devices.
4. Test synthetic text once, then repeat the POST with the same `Idempotency Key`.
5. Test a temporary wrong token, restore the correct token, and then test the
   server kill switch. Do not test with private message content during setup.

This artifact is an installation specification, not proof that the Shortcut or
endpoint has been installed, granted access, or activated.

## Installed macOS pilot variant

The accepted local Mac Shortcut uses a compact shell implementation because the
installed Shortcuts action library did not expose Generate UUID. Its final
actions are Receive Share Sheet input, Run Shell Script, and Show Result. The
shell receives Shortcut Input as arguments, runs without administrator access,
and implements the same trimming, 12,000-character limit, timestamp, UUID,
fixed review-only payload, HTTPS POST, and status mapping described above. It
falls back to the clipboard only when no argument exists and never writes the
shared text to disk. It allocates the UUID before a two-attempt request loop, so
one automatic transport retry reuses the exact same payload and idempotency key.

This variant is macOS-only. The portable native action inventory above remains
the source for a future iPhone or iPad installation. Current live evidence is
recorded in [Shortcut installation](SHORTCUT_INSTALLATION.md).

### Signed-file handling

The official macOS `shortcuts` command can sign an existing Shortcut file with
`shortcuts sign --input INPUT --output OUTPUT`; it has no command to create or
export a Shortcut. Do not handcraft a workflow file. The preserved signed export
is the earlier setup-blocked template only. The working Shortcut contains a
private token and must not be exported, committed, or shared.

## Secret handling

- Store the pilot token only in Script Properties and the local Shortcut.
- Never paste the token into this repository, screenshots, logs, or the Sheet.
- Rotate immediately if the Shortcut is shared, exported, or the token appears outside those two stores.
- The endpoint must have a kill switch.

## Example payload

See `shortcuts/example-payload.json`. Its token and text are non-secret synthetic values.

## Acceptance tests

- same UUID posted twice -> one item and `duplicate` on retry;
- invalid token -> `rejected`, no content logged;
- invalid enum -> safe fallback or dead letter;
- oversized text -> Shortcut stops locally;
- network failure -> one automatic retry uses the same idempotency key during that run;
- shared pricing/complaint text -> item marked for human judgment;
- no queue data returned to the phone.
