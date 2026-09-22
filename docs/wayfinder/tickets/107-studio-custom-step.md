# Validate Studio interpretation through a private Apps Script custom step

## Status

Resolved for implementation; account installation and live acceptance remain gated.

## Decision

Use the supported Workspace Studio custom Apps Script step as the minimal V1 binding when the account exposes and permits it. The step receives the starter Gmail resource ID and a single bounded JSON string containing only the existing StudioInterpretationSchema fields. Google documents STRING inputs, not a JSON-specific contract; our code owns a 12,000 UTF-8 byte limit, exact single-value input validation, strict parsing, and rejection without truncation.

The step independently verifies the owner and Gmail profile, fetches only requested-message metadata, enforces the 30-day window, derives the source identity from Gmail, and invokes prepareStudioStaging before an atomic literal Sheet append. Sender and a subject of at most 500 characters are already permitted by the unchanged Studio staging 1.0 contract; no body, snippet, attachment, raw model JSON, or private prompt is persisted. The Gmail reconciliation reader remains unchanged and does not start collecting subjects. Source metadata failing the existing staging contract is rejected with a controlled code.

Known-contact context is obtained from the existing Contacts table and only makes risk stricter; unknown contacts remain review-only. Draft creation and replacement remain disabled and unbound. No sending action is added. Repeated identical staging intake is suppressed by ingest ID; conflicting duplicate payloads are rejected rather than replacing an accepted row. Outputs expose only controlled status and ingest ID.

The handler rechecks STUDIO_PROCESSING and owner/workbook authorization inside the existing transaction. It never automatically retries an uncertain write. No additional OAuth scope is proposed. Installation requires inspecting actual consent and account availability. The private owner-only web deployment remains unchanged.

## Acceptance

Unit/integration tests cover malformed and oversized events, disabled/wrong-owner paths before reads, source identity and freshness, risk restrictions, literal atomic staging, duplicate/conflict handling, no body/log persistence, and controlled uncertain-write results. The built URL-less Apps Script runtime must expose the configuration and execution handlers. A literal existing in-window message can verify metadata identity and staging; only an actual Gmail starter run can establish starter-variable identity. These are separate evidence gates. No synthetic email will be sent.

## Sources

- [Google custom-step quickstart](https://developers.google.com/workspace/add-ons/studio/quickstart-calculator)
- [Studio event objects](https://developers.google.com/workspace/add-ons/studio/event-objects)
- [Input variables](https://developers.google.com/workspace/add-ons/studio/input-variables)
- [Output variables](https://developers.google.com/workspace/add-ons/studio/output-variables)

## Rollback

Leave STUDIO_PROCESSING false, keep any new flow off, and uninstall only this project test add-on if required. Retain private data and original records. Prior immutable runtime version 4 remains available.
