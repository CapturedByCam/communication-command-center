# Synthetic V1 policy evaluation

## Result

The deterministic local policy suite contains **50 explicitly synthetic,
text-free examples**. On the current implementation, all 50 independently
labeled waiting-state outcomes and all 50 independently labeled draft-risk
outcomes match.

| Deterministic metric | Result | What it proves |
| --- | ---: | --- |
| Fixture count | 50 | Meets the minimum sample size using synthetic labels. |
| Waiting-state fixture agreement | 50/50 (100%) | `deriveWaitingOn` matches the chosen policy labels for modeled latest-message chronology. |
| Draft-risk fixture agreement | 50/50 (100%) | `classifyDraftRisk` suppresses or routes the modeled inputs as labeled. |
| No-draft suppression coverage | 17/17 | Receipts, newsletters, automated notices, spam, acknowledgements, informational messages, and no-response cases suppress drafting. |
| Review-only coverage | 19/19 | Unknown contacts, model uncertainty, and every high-consequence label route to review. |
| Routine coverage | 14/14 | Known, direct, low-consequence requests remain eligible for a reviewed draft. |

The test file is [synthetic-v1-evaluation.test.ts](../../tests/evaluation/synthetic-v1-evaluation.test.ts).
Each case has a synthetic ID, semantic category, scenario label, state-machine
input, and independently stated expected result. No message body, sender,
subject, token, or user record appears in the corpus.

## What the 50 fixtures cover

- All V1 communication categories: leads, active projects, aviation, business
  administration, and personal.
- Waiting states `me`, `them`, `none`, and `unknown`; inbound and outbound
  questions; acknowledgements; informational messages; missing/ambiguous
  chronology; manual overrides; and overdue unresolved promises.
- Routine, review-only, and no-draft decisions.
- The required suppression labels: receipt, newsletter, automated notice, spam,
  closed acknowledgement, and information-only.
- High-consequence labels: pricing, negotiation, complaint, scope dispute,
  contract, payment, refund, legal, aviation employment, external schedule
  commitment, and sensitive personal communication.

## Boundaries of this result

This is a regression suite for deterministic functions, not a measured pilot.
Its 100% agreement reflects that the policy implementation matches these
hand-labeled synthetic inputs; it does not establish production accuracy.

The integrated codebase has domain chronology/deadline services and deployable
runtime adapters. This evaluation exercises deterministic policy functions only;
it does not use a live model, full mailbox corpus or human draft ratings.
Therefore this report does **not** measure the following acceptance thresholds:

| Required pilot measure | Current status |
| --- | --- |
| Real or sanitized Gmail chronology correctness | Not measured; fixtures model only the resolved latest-message signal consumed by `deriveWaitingOn`. |
| Actionable-detection precision | Not measured; no actionability classifier API exists yet. |
| Duplicate suppression | Not measured in this evaluation; covered separately by repository contract tests. |
| Deadline normalization | Not measured here; chronology and deadline services have separate regression suites. |
| Raw-content retention violations | Not measured end-to-end; this corpus contains no raw content. |
| Auto-sent communications | Not measured end-to-end; no send path is implemented. |
| Routine-draft usefulness | Not measured; no model drafts or human ratings exist. |

Before a pilot is considered useful enough to harden, evaluate the approved
thresholds against 50 sanitized or expressly approved examples and collect human
ratings for eligible drafts. Any observed miss should become a new reviewed
fixture and rule or prompt change; it must not silently retrain the system.
