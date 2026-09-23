# Add to Communication Command Center — native installation status

Observed and accepted on September 23, 2026 at approximately 13:40 EDT in the
macOS Shortcuts app.

## Installed pilot Shortcut

The local Shortcut is named **Add to Communication Command Center**. Its Share
Sheet accepts Text, Rich Text, and URLs. It is a private macOS pilot
implementation with this action sequence:

1. Receive Share Sheet input and continue when no input is supplied.
2. Run Shell Script in `zsh`, with Shortcut Input passed as arguments and
   **Run as Administrator** off.
3. Show only the Shell Script result.

The shell action is the macOS implementation of the versioned behavior in
`ADD_TO_COMMAND_CENTER.md`. It trims the supplied text, falls back to the
clipboard only when no argument is available, rejects an empty value or more
than 12,000 characters, creates an ISO 8601 timestamp and UUID, constructs the
fixed review-only schema 1.0 request, and performs the HTTPS POST. A transport
failure gets one automatic retry with the same in-memory payload and UUID. It
shows only
`Added for review`, `Already added`, `Could not add`, `Nothing to add`, or
`Select a smaller excerpt`.

The request text exists only in memory for the request. The action does not
write it to a file, Note, log, Sheet field, or repository artifact. The private
token exists only in Script Properties and this local Shortcut. The endpoint is
also recorded in ignored `.local/PILOT_RESOURCES.md` for recovery. Neither value
appears in tracked artifacts, and the working Shortcut was not exported.

## Live acceptance

The write-only endpoint and installed Shortcut passed the required synthetic
checks on September 23, 2026:

- correct token with intake off returned `rejected/disabled`;
- a temporary wrong token returned `rejected/unauthorized`;
- one fixed UUID returned `needs_review`, then `duplicate` with the same item ID;
- an oversized request returned `rejected/payload_too_large`;
- an 11-request pre-authentication burst returned seven unauthorized and four
  rate-limited responses;
- the installed macOS Shortcut completed the authenticated request path with
  synthetic text; two device-generated Queue items were observed with source
  `apple_share_sheet`, status `open`, category `other`, urgency `later`, and
  waiting state `unknown`;
- the Queue schema still contains no request-text or token columns;
- final installed-script readback confirmed that its UUID is allocated before
  the two-attempt loop and the same payload is reused for the retry; and
- `CCC_SHORTCUT_INTAKE` was returned to `false` after testing.

The two device rows were created while isolating the native Show Result
behavior. In the editor, Show Result intentionally keeps the run active until
its result is dismissed; removing that display action for one synthetic run
proved the shell and request completed, after which the display action was
restored. The final installed structure was read back with Share Sheet input,
argument passing, administrator mode off, status-only output, and intake off.

No Google email, message, or draft was sent or created. No private source text
was used.

## Export status

The earlier setup-blocked native export remains preserved locally as
`shortcuts/Add to Communication Command Center - Setup Required.shortcut`
(21,763 bytes; SHA-256
`580d2b6afab291766849ca1b473ad335ab739b5c27a92aeb4e6bb264497a3ce4`).
It contains no endpoint, token, or network action. It is intentionally not the
installed working Shortcut.

Do not export or share the working token-bearing Shortcut. Rotate the token
immediately if it is exported, shared, or appears outside Script Properties and
the local Shortcut.

## Scope and remaining limitation

This closes the Mac device and write-only endpoint acceptance gate. The
installed implementation uses **Run Shell Script** and is therefore macOS-only.
It does not establish an iPhone or iPad installation. A mobile implementation
must use the native action inventory in `ADD_TO_COMMAND_CENTER.md`, provision
the token locally, and repeat synthetic device acceptance before use.

Keep Shortcut intake off except for deliberate captures or bounded acceptance
tests. The anonymous endpoint remains write-only and returns no Queue contents.
