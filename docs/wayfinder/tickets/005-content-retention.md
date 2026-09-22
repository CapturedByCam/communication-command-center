# Retain operational metadata instead of full message bodies

## Question

What communication content may be stored outside the source system?

## Type

Grilling + domain modeling

## Status

Closed

## Resolution

Persist IDs, source links, short summaries, a 240-character preview, dates, state, actions, hashes, and model/version metadata. Do not persist complete message bodies or attachments in Sheets. Shortcut text is processed and discarded; logs remain content-free.
