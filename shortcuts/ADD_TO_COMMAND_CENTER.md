# Apple Shortcut — Add to Communication Command Center

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
