/** A data-only representation. Calendar APIs are intentionally not imported. */
export interface CalendarCandidateInput {
  readonly itemId: string;
  readonly title: string;
  readonly deadlineAt: string;
  readonly calendarApproved: boolean;
  readonly calendarWritesEnabled: boolean;
}

export interface CalendarCandidate {
  readonly kind: "calendar_candidate";
  readonly itemId: string;
  readonly title: string;
  readonly startAt: string;
  readonly calendarApproved: boolean;
  readonly creationEligible: boolean;
  readonly writePerformed: false;
}

export function buildCalendarCandidate(
  input: CalendarCandidateInput,
): CalendarCandidate {
  return {
    kind: "calendar_candidate",
    itemId: input.itemId,
    title: input.title,
    startAt: input.deadlineAt,
    calendarApproved: input.calendarApproved,
    creationEligible: input.calendarApproved && input.calendarWritesEnabled,
    writePerformed: false,
  };
}
