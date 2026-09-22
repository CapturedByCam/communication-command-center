# Workspace Studio Flow — Gmail Intake v1

## Purpose

React to new Gmail messages quickly, perform bounded AI interpretation, append a staging event, and optionally create a routine draft. Apps Script remains authoritative.

## Starter

**When I get an email**

Initial filter:

- target mailbox/alias approved in Wayfinder ticket `Select Gmail accounts and aliases in scope`;
- exclude spam and trash;
- exclude obvious automated senders and bulk mail using available starter filters;
- do not include messages created by flows unless a tested requirement needs them.

## Steps

1. **Decide — Requires response or action?**

   Prompt:

   > Determine whether this email creates a real action for Cam. Return true only when Cam should reply, send something, schedule something, call, review, or follow up. Return false for newsletters, receipts, automated alerts, spam, FYI-only messages, simple acknowledgements, and closed conversations. Do not decide based on unread status.

2. **Extract — Operational fields**

   Extract:

   - `category_hint`: one of client_lead, active_project, aviation, business_admin, personal, other;
   - `project_hint`: short known project/client name or blank;
   - `deadline_text`: exact deadline phrase or blank;
   - `next_action_hint`: concise verb-first action;
   - `summary_hint`: maximum 280 characters;
   - `draft_risk`: routine, review_only, or no_draft;
   - `confidence_hint`: decimal 0 through 1.

   Extraction rules:

   - routine excludes pricing, negotiation, complaint, scope, contract, payment, refund, hard schedule commitment, sensitive personal matters, and aviation employment;
   - review_only includes those high-consequence categories;
   - no_draft covers automated/informational/closed content;
   - never invent a date, price, promise, file, or project.

3. **Add a row — `Studio_Inbox`**

   Map:

   - schema_version = `1.0`
   - ingest_id = stable flow/email variable if available; otherwise flow run ID plus Gmail message ID
   - flow_run_id
   - gmail_message_id
   - received_at
   - sender_email
   - subject
   - requires_response
   - draft_risk
   - category_hint
   - project_hint
   - deadline_text
   - next_action_hint
   - summary_hint
   - confidence_hint
   - processing_status = `new`

   Do not add the full email body.

4. **Check if — Routine draft**

   Continue only when:

   - requires_response is true;
   - draft_risk equals routine.

5. **Ask Gemini — Draft reply**

   Prompt:

   > Draft a concise reply for Cam to review. Use only facts in the email and approved Workspace context. Do not commit to a price, deadline, meeting time, scope, deliverable, refund, contract term, job decision, relocation, or legal position. When information is missing, ask a focused question. Do not mention AI or this flow.

6. **Draft an email**

   Create a Gmail draft in the original thread. Never use Send a reply.

## Verification

Use synthetic or sanitized messages for:

- direct routine question;
- newsletter;
- acknowledgement;
- pricing request;
- complaint;
- aviation opportunity;
- relative deadline;
- sender with an active-project registry match.

Verify one staging row per event and no sent mail.
