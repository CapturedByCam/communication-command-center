# Select Gmail accounts and aliases in scope

## Question

Which mailbox, aliases, sent identities, labels, and excluded sender classes should V1 monitor?

## Type

Grilling

## Status

Closed

## Resolution

Monitor the primary work Gmail account and its verified aliases. Exclude newsletters, receipts, no-reply senders, automated alerts, bulk mail, spam, and threads older than the pilot window unless manually added. Add personal Gmail only as a later explicit scope change.

The exact verified aliases and initial pilot lookback window are deployment configuration and must be recorded before any Gmail permission request or production access.
