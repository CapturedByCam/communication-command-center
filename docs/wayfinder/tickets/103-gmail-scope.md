# Select Gmail accounts and aliases in scope

## Question

Which mailbox, aliases, sent identities, labels, and excluded sender classes should V1 monitor?

## Type

Grilling

## Status

Closed

## Resolution

Monitor the primary work Gmail account and its verified aliases. Exclude newsletters, receipts, no-reply senders, automated alerts, bulk mail, spam, and threads older than the pilot window unless manually added. Start with a seven-day live pilot; only after the pilot is accepted, run a separate 30-day backfill. Add personal Gmail only as a later explicit scope change.

The exact verified aliases and lookback are deployment configuration and must be recorded before production access. `CCC_GMAIL_LOOKBACK_DAYS` accepts only `7` or `30`, defaults to `7`, and each scan pins its window. Changing the configured duration never silently replaces an incomplete checkpoint; an owner-run window start requires Gmail intake to be off and preserves existing Queue and Audit rows.
