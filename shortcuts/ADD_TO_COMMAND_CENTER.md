# Apple Shortcut — Add to Communication Command Center

Action inventory version: `1.0`

## V1 behavior

The Shortcut accepts selected text from the Share Sheet or clipboard, asks Apple Intelligence for bounded suggestions, constructs a fixed JSON dictionary, and sends it to the write-only Apps Script endpoint.

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
7. Run **Use Model** with On-Device first; fall back to Private Cloud Compute only when enabled by Cam.
8. Prompt the model to return exactly these labeled lines:

```text
CATEGORY=<client_lead|active_project|aviation|business_admin|personal|other>
URGENCY=<critical|today|this_week|later>
WAITING_ON=<me|them|none|unknown>
DEADLINE=<ISO-8601 date-time or NONE>
DEADLINE_TEXT=<exact phrase or NONE>
NEXT_ACTION=<verb-first action, max 160 characters>
SUMMARY=<max 240 characters>
```

9. Extract each label using fixed Shortcut text matching.
10. Validate enums with `Choose from List`/conditional branches.
11. If any required field fails parsing:
    - set `classification_status=needs_server_review`;
    - use safe defaults: category other, urgency later, waiting_on unknown;
    - include the original selected text for backend processing.
12. Build the JSON dictionary defined in `schemas/shortcut-intake.schema.json`.
13. POST to the endpoint using `Get Contents of URL`.
14. Interpret only these response statuses:
    - `created`
    - `duplicate`
    - `needs_review`
    - `rejected`
15. Show a local confirmation. Do not return queue contents or private server data.

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
| 9 | Use Model | Use the bounded prompt below. Prefer On-Device; allow Private Cloud Compute only if Cam enables it. |
| 10 | Match Text / Get Group from Matched Text | Extract each required `LABEL=value` line from the model output. |
| 11 | Choose from List / If | Validate `CATEGORY`, `URGENCY`, and `WAITING_ON` against the exact enums. On any failed parse, set `classification_status=needs_server_review`, category `other`, urgency `later`, and waiting_on `unknown`. |
| 12 | Dictionary | Construct the exact `ShortcutIntake` JSON object. Include `shared_text` only in this request dictionary; never save it to a file, Note, or log. |
| 13 | Get Contents of URL | POST JSON to the deployed HTTPS endpoint. Add `auth_token` from a local Text action; do not export or share this action. |
| 14 | If | Read only `status` and optional `item_id` from the JSON response. Map `created`, `duplicate`, `needs_review`, and `rejected` to a local result. |
| 15 | Show Result | Show `Added`, `Already added`, `Needs review`, or `Could not add; retry with the same ID`. Never display response bodies beyond those status messages. |

### Bounded Use Model prompt

```text
Return only these labeled lines. Do not quote or repeat the supplied text.
CATEGORY=<client_lead|active_project|aviation|business_admin|personal|other>
URGENCY=<critical|today|this_week|later>
WAITING_ON=<me|them|none|unknown>
DEADLINE=<ISO-8601 date-time with offset or NONE>
DEADLINE_TEXT=<exact phrase or NONE>
NEXT_ACTION=<verb-first action, max 160 characters>
SUMMARY=<max 240 characters>
```

The server treats every model field as untrusted and creates a needs-review
record. It never retains `shared_text`, model summary, or model next action.

### Local token and endpoint configuration

1. After the Apps Script web app exists, paste its exact HTTPS URL into action 13.
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
- network failure -> user can retry with the same idempotency key during that run;
- shared pricing/complaint text -> item marked for human judgment;
- no queue data returned to the phone.
