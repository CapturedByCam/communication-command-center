# Queue operator controls (V1 decision)

**Decision date:** 2026-09-22  
**Status:** accepted for local implementation; disabled pending separate live review.

The bound workbook's owner may use explicit menu actions on exactly one selected
`Queue` data row: **Resolve**, **Reopen**, and **Snooze**. Each action requires
the independently disabled `CCC_MANUAL_WRITES` flag. The controls do not run in
the background and do not accept bulk selections.

The prompt occurs before a Script Lock is acquired. Before the atomic write, the
runtime re-reads and compares the complete selected row snapshot. Header drift,
workbook or tab mismatch, a missing row, a changed row, an archived item, and an
operation invalid for the item's current state fail closed. No selected-cell
content appears in prompts, logs, return values, or errors.

Resolve is available only for open or snoozed items and records `resolved_at`.
Reopen is available only for resolved items. Snooze is available only for open
items and requires a future ISO 8601 timestamp with an explicit numeric offset
(for example `2026-09-25T14:30:00-04:00`); it never derives a deadline from
natural language. Each accepted operation sets `manual_override` to `true` and
only changes status-control fields plus `updated_at`. Draft identifiers, draft
status, summaries, contacts, source data, hashes, and other context remain
unchanged.

Queue and Audit_Log changes use the existing `RuntimeSheetAdapter` transaction
and a single provider batch commit. The canonical audit schema has no manual
action enum, so an accepted control is represented by its existing
`upsert_item`/`updated` action and a controlled `manual_queue_control` actor;
the operation-specific audit payload is hashed. This reuses the established
audit contract without a schema change.

`cccDisableAll` disables this flag along with every other feature flag. The
menu may be visible while controls are disabled, but every manual command checks
the owner and flag before any Queue read.
