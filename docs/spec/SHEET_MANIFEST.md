# Sheet Manifest

`WORKBOOK_MANIFEST` in `src/adapters/sheets/workbook-manifest.ts` is the canonical V1 tab and header contract. The order of tabs and columns is versioned source, not a suggestion.

## Safety behavior

- Bootstrap creates a missing tab and writes its exact header row.
- Bootstrap initializes an existing tab only when its header row is empty.
- Bootstrap is idempotent after the manifest is present.
- Any non-empty header mismatch stops the entire bootstrap before mutation.
- Verification is read-only and reports missing tabs and exact header conflicts.
- Repository code resolves values by header name and rejects drift before reading or writing rows.
- Multi-row or multi-tab state changes require an adapter transaction with mutual exclusion and rollback. A real Sheets adapter must not be connected until it satisfies that contract.

## Tabs

| Tab | Persistence role |
| --- | --- |
| `Queue` | One canonical current item per source thread |
| `Studio_Inbox` | Retryable intake staging records |
| `Contacts` | Curated canonical contact context |
| `Projects` | Curated canonical project context |
| `Commitments` | Promises, deadlines, and fulfillment state |
| `Briefing_View` | Deterministic current briefing rows |
| `Briefing_History` | Content-minimized delivery history |
| `Audit_Log` | Append-only, content-free operational evidence |
| `Dead_Letter` | Content-minimized rejected-record metadata |
| `Config` | Non-secret versions, flags, thresholds, and cursors |

The complete column lists live beside the code that validates them so implementation and verification cannot silently diverge. Secrets, complete message bodies, attachments, and raw model prompts are forbidden in every tab.
