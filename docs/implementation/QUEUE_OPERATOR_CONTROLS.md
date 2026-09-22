# Queue operator controls (V1 decision)

**Decision date:** 2026-09-22  
**Status:** live accepted. `CCC_MANUAL_WRITES` alone was enabled at 11:24:50 EDT on
2026-09-22 after Version 4 control acceptance and Version 5 health. The other six feature
flags remain false; this activation made no Queue or source mutation.

The bound workbook's owner may use explicit menu actions on exactly one selected
`Queue` data row: **Resolve**, **Reopen**, **Snooze**, and **Set waiting state**. Each action requires
the independently disabled `CCC_MANUAL_WRITES` flag. The controls do not run in
the background and do not accept bulk selections.

The prompt occurs before a Script Lock is acquired. Before the atomic write, the
runtime rechecks the owner, current `CCC_MANUAL_WRITES` value, and bound workbook
identity under that lock, then re-reads and compares the complete selected row
snapshot. Disabling controls or losing trusted authorization while a prompt is
open prevents any Queue read, audit append, or commit. Header drift,
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

Set waiting state accepts exactly `me`, `them`, `none`, or `unknown` for an open
or snoozed item. It preserves status and snooze, sets `manual_override:true`, and
changes only `waiting_on` plus `updated_at`. An identical waiting value returns
`unchanged` without a timestamp or audit change. Resolved items must first be
reopened; archived items are rejected. No Gmail call is made. See
[decision 109](../wayfinder/tickets/109-manual-waiting-state.md).

Queue and Audit_Log changes use the existing `RuntimeSheetAdapter` transaction
and a single provider batch commit. The canonical audit schema has no manual
action enum, so an accepted control is represented by its existing
`upsert_item`/`updated` action and a controlled `manual_queue_control` actor;
the operation-specific audit payload is hashed. This reuses the established
audit contract without a schema change.

`cccDisableAll` disables this flag along with every other feature flag. The menu may be
visible while controls are disabled, but every manual command checks the owner and flag
before any Queue read. At about 11:32 EDT, the Apps Script Triggers page showed
`Showing 0 triggers` with no filters set.

After each menu action the bound spreadsheet shows a short controlled toast for
success, disabled, cancelled, changed-row conflict, or a generic failure. The
toast never includes Queue cells, identifiers, or provider error details.
