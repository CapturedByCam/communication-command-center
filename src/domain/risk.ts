import type { DraftRisk } from "./types.js";

export type NoDraftMessageKind =
  | "receipt"
  | "newsletter"
  | "automated_notice"
  | "spam"
  | "closed_acknowledgement"
  | "information_only";

export type HighConsequence =
  | "pricing"
  | "negotiation"
  | "complaint"
  | "scope_dispute"
  | "contract"
  | "payment"
  | "refund"
  | "legal"
  | "aviation_employment"
  | "external_schedule_commitment"
  | "sensitive_personal";

export interface ClassifyDraftRiskInput {
  knownContact: boolean;
  directResponseRequested: boolean;
  messageKind?: NoDraftMessageKind | null;
  consequences?: readonly HighConsequence[];
  modelUncertain?: boolean;
}

export function classifyDraftRisk(input: ClassifyDraftRiskInput): DraftRisk {
  if (input.messageKind || !input.directResponseRequested) {
    return "no_draft";
  }

  if (
    !input.knownContact ||
    input.modelUncertain ||
    (input.consequences?.length ?? 0) > 0
  ) {
    return "review_only";
  }

  return "routine";
}
