import { describe, expect, it } from "vitest";
import { buildCalendarCandidate } from "../../src/adapters/calendar/deadline-candidate.js";
import { normalizeDeadlineSuggestion } from "../../src/services/commitment-service.js";

describe("normalizeDeadlineSuggestion", () => {
  const anchorAt = "2026-03-06T15:00:00-05:00";

  it("normalizes explicit New York absolute and relative deadlines", () => {
    expect(
      normalizeDeadlineSuggestion({
        text: "2026-03-09 at 3:30 PM",
        anchorAt,
      }),
    ).toMatchObject({
      deadlineAt: "2026-03-09T15:30:00-04:00",
      needsDateReview: false,
    });
    expect(
      normalizeDeadlineSuggestion({ text: "2026-03-09 at 3:30 PM" }),
    ).toMatchObject({
      deadlineAt: "2026-03-09T15:30:00-04:00",
      needsDateReview: false,
    });
    expect(
      normalizeDeadlineSuggestion({ text: "2026-03-09T19:30:00Z" }),
    ).toMatchObject({
      deadlineAt: "2026-03-09T15:30:00-04:00",
      needsDateReview: false,
    });
    expect(
      normalizeDeadlineSuggestion({ text: "tomorrow at 9am", anchorAt }),
    ).toMatchObject({
      deadlineAt: "2026-03-07T09:00:00-05:00",
      needsDateReview: false,
    });
  });

  it("does not guess an anchor, a DST gap, or a DST fold", () => {
    expect(normalizeDeadlineSuggestion({ text: "next Friday" })).toMatchObject({
      deadlineAt: null,
      needsDateReview: true,
    });
    expect(
      normalizeDeadlineSuggestion({
        text: "2026-03-08 at 2:30 AM",
        anchorAt,
      }),
    ).toMatchObject({ deadlineAt: null, needsDateReview: true });
    expect(
      normalizeDeadlineSuggestion({
        text: "2026-11-01 at 1:30 AM",
        anchorAt,
      }),
    ).toMatchObject({ deadlineAt: null, needsDateReview: true });
  });

  it("rejects date-only, invalid, and ambiguous time language instead of assigning a default hour", () => {
    for (const text of [
      "2026-03-09",
      "tomorrow",
      "tomorrow at 25:00",
      "tomorrow at 9:30",
      "next Friday at 9 AM",
    ]) {
      expect(normalizeDeadlineSuggestion({ text, anchorAt })).toMatchObject({
        deadlineAt: null,
        needsDateReview: true,
      });
    }
  });

  it("rejects impossible absolute ISO calendar dates instead of normalizing them", () => {
    expect(
      normalizeDeadlineSuggestion({ text: "2026-02-30T19:30:00Z" }),
    ).toMatchObject({ deadlineAt: null, needsDateReview: true });
  });
});

describe("buildCalendarCandidate", () => {
  it("returns a data-only candidate and never writes a calendar event", () => {
    expect(
      buildCalendarCandidate({
        itemId: "cc_abcdefghijkl",
        title: "Call client",
        deadlineAt: "2026-09-23T09:00:00-04:00",
        calendarApproved: true,
        calendarWritesEnabled: true,
      }),
    ).toEqual({
      kind: "calendar_candidate",
      itemId: "cc_abcdefghijkl",
      title: "Call client",
      startAt: "2026-09-23T09:00:00-04:00",
      calendarApproved: true,
      creationEligible: true,
      needsDateReview: false,
      writePerformed: false,
    });
  });

  it("requires a canonical validated offset timestamp before a candidate is eligible", () => {
    for (const deadlineAt of [
      "tomorrow at 9",
      "2026-11-01T01:30:00",
      "2026-02-30T09:00:00-05:00",
    ]) {
      expect(
        buildCalendarCandidate({
          itemId: "cc_abcdefghijkl",
          title: "Call client",
          deadlineAt,
          calendarApproved: true,
          calendarWritesEnabled: true,
        }),
      ).toMatchObject({ creationEligible: false, needsDateReview: true });
    }
  });
});
