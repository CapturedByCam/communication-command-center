import { describe, expect, it } from "vitest";
import { calculatePriority } from "../../src/domain/priority.js";

const now = new Date("2026-09-22T12:00:00Z");

describe("calculatePriority", () => {
  it.each([
    ["critical", 100],
    ["today", 70],
    ["this_week", 40],
    ["later", 10],
  ] as const)("assigns the %s urgency base", (urgency, expected) => {
    expect(calculatePriority({ urgency, status: "open", now })).toBe(expected);
  });

  it("adds deadline, opportunity, and active-project adjustments", () => {
    expect(
      calculatePriority({
        urgency: "this_week",
        status: "open",
        now,
        deadlineAt: new Date("2026-09-22T11:59:59Z"),
        isNewClientLead: true,
      }),
    ).toBe(70);
    expect(
      calculatePriority({
        urgency: "this_week",
        status: "open",
        now,
        deadlineAt: new Date("2026-09-23T11:59:59Z"),
        isAviationOpportunity: true,
        isActiveProject: true,
      }),
    ).toBe(70);
  });

  it("does not invent a deadline adjustment for an unresolved date", () => {
    expect(
      calculatePriority({
        urgency: "this_week",
        status: "open",
        now,
        deadlineAt: null,
        needsDateReview: true,
      }),
    ).toBe(40);
  });

  it("pins at 100 and caps all scores at 100", () => {
    expect(
      calculatePriority({
        urgency: "later",
        status: "open",
        now,
        manuallyPinned: true,
      }),
    ).toBe(100);
    expect(
      calculatePriority({
        urgency: "today",
        status: "open",
        now,
        deadlineAt: new Date("2026-09-21T12:00:00Z"),
        isNewClientLead: true,
        isActiveProject: true,
      }),
    ).toBe(100);
  });

  it.each(["snoozed", "resolved", "archived"] as const)(
    "excludes %s items",
    (status) => {
      expect(
        calculatePriority({
          urgency: "critical",
          status,
          now,
          manuallyPinned: true,
        }),
      ).toBe(0);
    },
  );
});
