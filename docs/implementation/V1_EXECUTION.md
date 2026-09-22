# V1 execution and activation record

## Authorization and architecture

Cam authorized implementation, reviewed merges, narrowly scoped private Google resources,
minimum OAuth grants, application-owned drafts, and one private self-only Chat briefing.
The sole Gmail identity is contact@elev8mediaky.com. Initial reconciliation is bounded
to 30 days and all dates use America/New_York. The public repository remains public;
resource identifiers, tokens, and source content stay in ignored local configuration.

Studio inspection confirmed starter Email ID/thread ID/date variables, but did not
establish arbitrary HTTP/code actions, API ID equivalence, returned draft revision,
or atomic draft replacement. Apps Script therefore owns validation, source refresh,
idempotency and draft ownership. Studio never writes a Gmail draft directly.
Replacement remains disabled when the provider cannot atomically compare a revision.

## Work and evidence

- Gmail reconciliation: PR22 merged at 0c9c497; 165 integrated baseline tests passed.
- Draft lifecycle: PR28 independently reviewed; current-main checks pending.
- Repository automation: PR29 merged at e87e74b; dependency policy separate from runtime.
- Shortcut synchronous intake: independent implementation ready; integration pending.
- Commitments, briefing, runtime adapters, privacy evaluation: in progress.
- Live state: verified approved account; Apps Script API already enabled.
- No new runtime resource, trigger, or draft has yet been activated.

## Access and rollback plan

Development deployment uses clasp authorization solely to create/update this project.
Runtime scopes are enumerated in appsscript.json. Gmail read access is necessary
for authoritative chronology; draft creation requires gmail.compose, whose provider
scope also technically permits sending. Code must expose no send action or transport.
Calendar access is read-only. Workbook access and Apps Script trigger management
are limited by configured resource IDs and owner checks. No arbitrary Drive scan.

Before activation, verify resource ownership/private sharing, deployed version,
synthetic acceptance and disabled flags. Every flag defaults false. Disable flags
and remove this project's managed triggers first for rollback; retain operational
rows and user drafts. Revoke the deployment or OAuth grant independently if needed.
Raw content and credentials must never enter public evidence.

## Acceptance remaining

1. Integrate and independently review all local modules.
2. Build a real Apps Script bundle and verify callable globals.
3. Provision private workbook/project and prove schema/identity/kill switches.
4. Connect trusted Gmail interpretation and verify live unsent-draft behavior.
5. Install and test Shortcut intake without unauthenticated reads.
6. Verify private Chat destination and enable 8 AM New York delivery.
7. Run at least 50 synthetic cases, backup/restore/rollback checks, then report
   synthetic results separately from real pilot ratings and working-week evidence.

Access or pilot-time blockers must be recorded precisely; local checks are not
evidence of live deployment or operational acceptance.
