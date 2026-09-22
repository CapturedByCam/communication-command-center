# Workspace Studio Flow — Daily Briefing Delivery v1

## Purpose

Deliver the deterministic queue produced by Apps Script. Studio may format the presentation but must not reorder, add, or remove items.

## Starter

**On a schedule**

Default proposal pending decision:

- Morning: 8:00 AM America/New_York
- Afternoon cleanup: 4:30 PM America/New_York

## Steps

1. **Get sheet contents**
   - source: `Briefing_View`;
   - read the bounded active range created by Apps Script.

2. **Optional Ask Gemini**
   - allowed only to improve wording;
   - prompt must say: preserve every row, order, identifier, deadline, and status exactly;
   - if the model output omits an item, use the deterministic text instead.

3. **Notify me in Chat** or the approved delivery channel.
   - include the generated timestamp;
   - include a link to the command-center Sheet;
   - do not include full message bodies.

## Briefing sections

- Handle first
- Quick wins
- Promises due or overdue
- Needs judgment
- Drafts ready
- Waiting on others
- Upcoming this week
- System health

## Verification

- resolved/snoozed items absent;
- all active deterministic rows present;
- order unchanged;
- no private body content;
- delivery failure recorded in `Audit_Log`;
- on-demand ChatGPT view remains available if scheduled delivery fails.
