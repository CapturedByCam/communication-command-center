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
  /** Invalid or locally ambiguous date text requires human review. */
  readonly needsDateReview: boolean;
  readonly writePerformed: false;
}

function isCanonicalOffsetTimestamp(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) return false;
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [
    1, 2, 3, 4, 5, 6, 7, 8,
  ].map((index) => Number(match[index] ?? "0"));
  const calendar = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59 &&
    !Number.isNaN(calendar.valueOf()) &&
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() + 1 === month &&
    calendar.getUTCDate() === day &&
    !Number.isNaN(new Date(value).valueOf())
  );
}

export function buildCalendarCandidate(
  input: CalendarCandidateInput,
): CalendarCandidate {
  const validDeadline = isCanonicalOffsetTimestamp(input.deadlineAt);
  return {
    kind: "calendar_candidate",
    itemId: input.itemId,
    title: input.title,
    startAt: input.deadlineAt,
    calendarApproved: input.calendarApproved,
    creationEligible:
      validDeadline && input.calendarApproved && input.calendarWritesEnabled,
    needsDateReview: !validDeadline,
    writePerformed: false,
  };
}
