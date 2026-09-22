# Workspace Studio — Daily Briefing configuration v1

Current posture: **disabled; no Google message delivery**.

Cam's 2026-09-22 clarification supersedes the earlier private Chat alert. Do not
add or activate Notify me in Chat, Send email, or any other message action.
The deterministic Apps Script `cccBuildBriefing` writes `Briefing_View` and
`Briefing_History` with deliveryChannel=none. It has no delivery transport.

## Sections

1. Handle first
2. Quick wins
3. Promises due or overdue
4. Needs judgment
5. Drafts ready
6. Waiting on others
7. Upcoming this week
8. System health

## Verification before generation is enabled

Verify resolved/snoozed records are excluded, ordering is deterministic, all eight
sections appear, health is derived from validated records and checkpoint state,
duplicate content is not appended, and no private content enters logs. A changed
same-day view appends a new group; the latest group starts at sort_order 0.
No Google delivery or scheduled trigger is active. On-demand ChatGPT reads the
private Sheet and follows source links for context.
