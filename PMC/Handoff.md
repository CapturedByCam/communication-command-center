# Morning handoff — Communication Command Center V1

Updated 2026-09-22. V1 is not yet accepted for daily unattended use.

## What is usable

The private command-center workbook has all ten tabs, the correct New York time
zone and a private pre-activation backup. The Apps Script bootstrap ran
successfully. Owner-only version 1 is deployed and matches the tested build.
Live health and bounded Gmail metadata access passed. A later pilot flag save
was interrupted by screen lock; its outcome is unknown. Runtime implementation,
reviewed domain services and installation/operating instructions are saved in Git.

Private resource links and local deployment bindings are saved in
`.local/PILOT_RESOURCES.md` in the durable main project directory. OAuth files are
ignored and must never be shared or committed.

## Opening and operating

- Open the Queue link in the private resource note. It is initially empty; no
  mailbox backfill has been activated. Source links will open original Gmail items.
- Existing Gmail drafts remain untouched. No application-created draft is claimed.
- The Shortcut is not installed. Follow [the exact local action inventory](../shortcuts/ADD_TO_COMMAND_CENTER.md)
  after its token and endpoint tests are completed.
- For on-demand review, ask ChatGPT: “Run comms for contact@elev8mediaky.com using
  the private Command Center Queue and relevant source messages from the last 30
  days. Summarize priorities, draft replies for review, and leave everything unsent.”
  Read source messages for context; the current metadata pilot cannot supply summaries.

## Required continuation

1. Unlock the Mac and inspect the saved pilot flags. Live `cccHealth` and
   `cccGmailReadProbe` already passed against the correct account. No mailbox
   processing or briefing execution followed the interrupted flag save.
2. Run `cccDisableAll` to restore and verify all flags off. Prove disabled paths. Then enable only the single
   feature under test in Script Properties, run a bounded synthetic/live pilot,
   verify durable results and duplicate replay, and run `cccDisableAll`.
3. Resolve the model binding within an existing permitted entitlement. Studio's
   visible actions have not proved strict validation and draft ownership. The
   inspected Cloud project is on expired free-trial billing; no upgrade was made.
4. Finish Shortcut/device setup and live provider draft ownership tests. Install
   schedules only after their live prerequisites pass. Never enable Google Chat
   or email notification under the current no-send instruction.
5. Gather 50 eligible pilot observations and Cam's usefulness ratings over the
   required working week. Synthetic results do not replace this gate.

## Verification and release evidence

- Unit, contract, schema, integration and bundle tests cover atomic writes,
  duplicate/out-of-order inputs, overrides, stale/uncertain drafts, schema failures,
  date ambiguity, token failures and disabled paths.
- [Synthetic evaluation](../docs/evaluation/SYNTHETIC_V1_REPORT.md): 50 deterministic
  synthetic cases; 50/50 waiting-state and draft-risk agreement. No real model ratings.
- [Execution record](../docs/implementation/V1_EXECUTION.md): live evidence and limitations.
- [Runtime operations](../docs/runbooks/RUNTIME_OPERATIONS.md): deployment drift and recovery.
- Runtime release [PR #31](https://github.com/CapturedByCam/communication-command-center/pull/31)
  contains runtime commit `e13f333` and reviewed operating records. Local full
  verification: 325 tests in 32 files; planning checks pass. Hosted checks and
  protected merge status are recorded on the PR. The final main commit is also
  recorded in the private resource note after integration.
- [Issue #32](https://github.com/CapturedByCam/communication-command-center/issues/32)
  tracks runtime/device/pilot acceptance; Gmail #21 and Studio #23 remain open.

## Disable and recover

Run `cccDisableAll` from the authenticated Apps Script editor. It sets every flag
false and removes only this app's named managed triggers. Keep operational rows,
source messages and drafts. Archive the web deployment separately if needed;
restore only into a new workbook from the verified private backup. Do not clear
production ranges. Revoke OAuth separately if access itself must be removed.
