import { describe, expect, it } from "vitest";
import { deriveWaitingOn } from "../../src/domain/state-machine.js";

describe("deriveWaitingOn", () => {
  it("marks a response-required inbound message as waiting on me", () => {
    expect(
      deriveWaitingOn({
        latestMessage: { direction: "inbound", requiresResponse: true },
      }),
    ).toBe("me");
  });

  it("marks an outbound question as waiting on them", () => {
    expect(
      deriveWaitingOn({
        latestMessage: { direction: "outbound", expectsResponse: true },
      }),
    ).toBe("them");
  });

  it("does not turn a simple acknowledgement into an unanswered task", () => {
    expect(
      deriveWaitingOn({
        latestMessage: { direction: "inbound", isAcknowledgement: true },
      }),
    ).toBe("none");
  });

  it("keeps an overdue unresolved promise open after an acknowledgement", () => {
    expect(
      deriveWaitingOn({
        hasOverdueUnresolvedPromise: true,
        latestMessage: { direction: "inbound", isAcknowledgement: true },
      }),
    ).toBe("me");
  });

  it("returns unknown for ambiguous chronology or meaning", () => {
    expect(
      deriveWaitingOn({
        latestMessage: { direction: "inbound", isAmbiguous: true },
      }),
    ).toBe("unknown");
  });

  it("preserves a manual override ahead of every derived rule", () => {
    expect(
      deriveWaitingOn({
        manualOverride: "them",
        hasOverdueUnresolvedPromise: true,
        latestMessage: {
          direction: "inbound",
          requiresResponse: true,
          isAmbiguous: true,
        },
      }),
    ).toBe("them");
  });
});
