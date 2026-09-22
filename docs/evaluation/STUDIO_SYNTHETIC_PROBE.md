# Studio synthetic interpretation probe

On 2026-09-22 at 12:26:22 EDT, the app-owned manual acceptance flow ran
`Start manually → Ask Gemini` successfully. This is one live model run over
synthetic text, not real-mail usefulness or V1 pilot acceptance.

## Reproduce the observed configuration

- Use only the approved Workspace account and a manual starter with no fields.
- Add Ask Gemini with the exact [synthetic prompt](../../studio/prompts/synthetic-interpretation-probe.txt).
- Set Web search OFF and Workspace OFF. Both were initially ON; this probe
  explicitly disabled them before execution.
- Select no skills and use Text response format.
- Keep the flow limited to these two steps: no Gmail starter, custom action,
  Sheets operation, draft action, or email/Chat sending action.
- Run manually once and inspect the completed result.

No private message or source ID was supplied. The run did not invoke Apps Script
or alter its feature flags or deployment. The synthetic response is preserved
[as JSON](studio-synthetic-probe-response.json), with numeric formatting normalized.

## Result and limits

The result passed the exact `StudioInterpretationSchema` from main `e2a2e52`,
with all twelve required fields and no extras. A pure `prepareStudioStaging`
check using synthetic source metadata and `knownContact:false` accepted the
proposal but downgraded its `routine` suggestion to `review_only`. It preserved
the raw deadline phrase. This check bundled the actual TypeScript adapter with
esbuild and executed assertions in Node 24; it made no provider or persistence
calls. No runtime code or contract changed.

The model chose `active_project` with confidence `1.0`, despite no named project
or relationship context, and returned `deadline_text: "No rush"`. The latter
is a timing preference, not a deadline. Review these semantic choices before
adapting the prompt to real source content; schema validity does not establish
usefulness or draft eligibility.

The installed CCC custom step remains absent while Admin's Custom steps access
is OFF. Enabling it, including unpublished test steps, awaits the pending
action-time confirmation. No Admin policy, OAuth grant, source binding, staging
write, or live Gmail draft was accepted by this probe.

## Retention observation

Studio Activity displayed this completed run and its full synthetic JSON output,
with the label `Data available for 40 days`. This proves that the output is
visible in stored activity; it does not prove the retention period for every
underlying input or service log. No private input was used to investigate it.

Google's [Workspace privacy hub](https://knowledge.workspace.google.com/admin/generative-ai/generative-ai-in-google-workspace-privacy-hub)
describes admin-controlled Gemini in Workspace prompt/response retention, while
its detailed discussion addresses app conversation histories. It does not
establish the exact retention of this Studio step's resolved prompt variables.
[Studio troubleshooting](https://support.google.com/workspace-studio/answer/16430806)
and the observed Activity surface do not establish that full source bodies are
excluded from every activity or error record. Do not claim transient-only
real-mail processing until this is resolved against the user's retention rule.

Next, after policy confirmation, verify the custom step's disabled path using
a manual invocation. Keep private email bodies out of Ask Gemini until the
retention boundary is accepted. Literal metadata validation, actual Gmail
starter-ID binding, and real model acceptance remain distinct checks.
