# Add to Communication Command Center — native setup status

Observed on September 22, 2026 at approximately 11:10 EDT in the macOS
Shortcuts app. This is a record of the current native Shortcut state, not an
installation or capture acceptance result.

## Actual template

The existing Shortcut is named **Add to Communication Command Center**. Its
Share Sheet is enabled. The native type picker showed these selected inputs:

- Text
- Rich Text
- URLs

The visible action sequence is deliberately setup-blocked:

1. Receive Share Sheet input.
2. Show Result with this literal text: `Setup required: add the private endpoint, local token, and complete device acceptance before capture is enabled.`
3. Stop This Shortcut.

It has no endpoint, token, network action, request dictionary, clipboard
fallback, input conversion, UUID generation, or capture action. It was not run
with any input. No private text, source content, token, or endpoint was
entered, retained, or exported.

## Export status

An export was started from the native File menu, but the Mac locked before the
save dialog could be completed. No `.shortcut` file was saved. The durable
artifact is therefore still this checked-in installation record plus the
versioned target inventory in [ADD_TO_COMMAND_CENTER.md](ADD_TO_COMMAND_CENTER.md).

## Remaining local completion steps

Complete these only after the private endpoint and device authentication path
have been accepted and verified:

1. Unlock the Mac, reopen the named Shortcut, and export its current
   setup-blocked form to `shortcuts/` before adding any sensitive setup.
2. Replace the temporary Show Result and Stop guard with the complete action
   inventory in `ADD_TO_COMMAND_CENTER.md`: plain-text conversion, trimming,
   empty and 12,000-character guards, ISO capture time, one generated
   idempotency key, the fixed review-only request dictionary, status-only local
   feedback, and safe retry handling.
3. Enter the exact private HTTPS endpoint and local token only after a
   phone-compatible endpoint/device-auth acceptance has passed. The current
   owner-only `MYSELF` endpoint does not establish that a device Shortcut can
   authenticate.
4. Keep the token only in the local Shortcut and Script Properties. Do not put
   it in an exported file, repository artifact, screenshot, log, Shortcut
   title, or comment.
5. For a network failure, retry the same request with the same idempotency key;
   do not generate a new key for that retry.
6. Test only synthetic text after the full inventory and endpoint are ready.
   Confirm duplicate handling, rejected authentication, the kill switch, and
   that no Queue contents or request text are returned to the device.

The current source of truth is the observed native Shortcut state above. It is
a safe setup template, not a working capture Shortcut and not evidence of a
successful export or device acceptance.
