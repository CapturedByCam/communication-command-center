import { describe, expect, it } from "vitest";
import { classifyDraftRisk } from "../../src/domain/risk.js";

describe("classifyDraftRisk", () => {
  it("allows only a known-contact direct response with no elevated risk", () => {
    expect(
      classifyDraftRisk({
        knownContact: true,
        directResponseRequested: true,
      }),
    ).toBe("routine");
  });

  it.each([
    "receipt",
    "newsletter",
    "automated_notice",
    "spam",
    "closed_acknowledgement",
    "information_only",
  ] as const)("does not draft a %s", (messageKind) => {
    expect(
      classifyDraftRisk({
        knownContact: true,
        directResponseRequested: false,
        messageKind,
      }),
    ).toBe("no_draft");
  });

  it.each([
    "pricing",
    "negotiation",
    "complaint",
    "scope_dispute",
    "contract",
    "payment",
    "refund",
    "legal",
    "aviation_employment",
    "external_schedule_commitment",
    "sensitive_personal",
  ] as const)("requires review for %s", (consequence) => {
    expect(
      classifyDraftRisk({
        knownContact: true,
        directResponseRequested: true,
        consequences: [consequence],
      }),
    ).toBe("review_only");
  });

  it("requires review for uncertainty or an unknown contact", () => {
    expect(
      classifyDraftRisk({
        knownContact: false,
        directResponseRequested: true,
      }),
    ).toBe("review_only");
    expect(
      classifyDraftRisk({
        knownContact: true,
        directResponseRequested: true,
        modelUncertain: true,
      }),
    ).toBe("review_only");
  });

  it("does not draft when no response is requested", () => {
    expect(
      classifyDraftRisk({
        knownContact: true,
        directResponseRequested: false,
      }),
    ).toBe("no_draft");
  });
});
