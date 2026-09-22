# Run comms (V1 operator guide)

Use this guide to review the private communication queue with ChatGPT. It does
not enable a feature, install a trigger, create a draft, or send a Google
message. The authoritative current posture is [PMC Current State](../../PMC/Current%20State.md):
`CCC_MANUAL_WRITES` alone is enabled for guarded Queue controls; automatic intake,
drafting, Shortcut capture, and briefing delivery remain disabled. At about 11:32 EDT,
the Apps Script Triggers page showed `Showing 0 triggers` with no filters set.

## Start a review

1. Open the private workbook URL from the ignored local file
   `.local/PILOT_RESOURCES.md`. Keep the resource link private; do not post it in public
   Git, a pull request, or another public record.
2. Use the authorized connected Sheet and Gmail sources with exact Queue source
   IDs. Gmail source review is limited to the approved mailbox and the fixed
   30-day window. Do not request a whole inbox, an account history scan, Apple
   Messages database access, or thread context older than 30 days.
3. Ask ChatGPT:

   > Run comms. Read the current private Queue and the latest matching
   > Briefing_View projection in its stored order. Use the exact source IDs for
   > any Gmail context within the 30-day window. Explain priorities, then draft
   > only unsent reply text for items I select. For a selected Queue item, use only
   > the supported guarded Resolve, Reopen, or Snooze action I explicitly request.
   > Do not send, create a Gmail draft, infer missing source context, or directly
   > edit a row.

`Briefing_View` is precomputed deterministic output. Read its current projection
in the stored order; do not augment, reorder, omit, or assign an item to another
section during review. Its eight sections are the briefing, including explicit
`No items` markers.

## Check freshness before using the briefing

Confirm the latest contiguous dated projection and its `Briefing_History` entry
match the current New York date and agree on the stored generation/count metadata.
If it is stale, incomplete, or its counts disagree with the currently visible
Queue/Commitments state, say so plainly and review the Queue in source order.
Do not silently reconstruct a briefing, append rows, or treat a prior projection
as current.

Briefing generation remains disabled and should not be run as part of this review.
Use only the documented runtime path after a separately accepted activation; see
[Runtime operations](RUNTIME_OPERATIONS.md) and
[V1 execution](../implementation/V1_EXECUTION.md). The briefing runtime has no delivery
transport.

## Source and drafting boundary

Queue and briefing rows contain bounded metadata and source links, not message
bodies. The native Gmail metadata pilot emits generic needs-review records; it is
not an actionable classification or full-thread interpretation. Fetch only the
selected source identified by the Queue row, within the 30-day limit. If the
needed context is older, unavailable, or ambiguous, leave the item for review
and state that limitation.

ChatGPT may write proposed reply text in the conversation. Leave it unsent. Do
not claim that a native Gmail draft adapter is ready, create a Gmail draft, or
send through Gmail, Studio, Chat, or any other channel.

## Supported Queue changes

`CCC_MANUAL_WRITES` is currently enabled, so the owner may select exactly one Queue data
row and use the Command Center menu's guarded **Resolve**, **Reopen**, or **Snooze**
action. Snooze needs a future ISO 8601
instant with an explicit numeric offset, such as `2026-09-25T14:30:00-04:00`.
The controls recheck the owner, workbook, flag, and full selected-row snapshot,
then atomically update Queue and Audit_Log. They have live acceptance evidence.

Never update Queue cells directly to skip the lock or audit trail. If a prompt is
cancelled, the row changed, the control is disabled, or the result is uncertain,
make no retry from the grid. Re-read the selected row and follow the controlled
result. For an uncertain result, check the row before deciding whether another
operator action is appropriate.

`Mark <item_id> waiting on them` is a product command but has no supported guarded
V1 Queue control. Do not edit `waiting_on` directly or represent it as completed.
ChatGPT may explain the source chronology and record that the requested state
change is unsupported; keep the canonical row unchanged until a reviewed,
audited control exists.

## Safety and recovery

Use [Runtime operations](RUNTIME_OPERATIONS.md) for flags, guarded controls,
drift checks, and recovery. Run `cccDisableAll` from the authenticated Apps
Script editor if an already-enabled pilot action must stop; it disables all flags
and removes this app's managed triggers. It does not send a message or clear
operational records.

The native Shortcut is only a setup-blocked template. See
[Shortcut installation](../../shortcuts/SHORTCUT_INSTALLATION.md): no export,
network request, endpoint, token, or capture acceptance exists. Do not use it to
capture communications.
