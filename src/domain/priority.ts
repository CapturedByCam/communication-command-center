import type { Status, Urgency } from "./types.js";

const urgencyBase: Record<Urgency, number> = {
  critical: 100,
  today: 70,
  this_week: 40,
  later: 10,
};

const excludedStatuses = new Set<Status>(["snoozed", "resolved", "archived"]);
const oneDayMilliseconds = 24 * 60 * 60 * 1_000;

export interface CalculatePriorityInput {
  urgency: Urgency;
  status: Status;
  now: Date;
  deadlineAt?: Date | null;
  needsDateReview?: boolean;
  isNewClientLead?: boolean;
  isAviationOpportunity?: boolean;
  isActiveProject?: boolean;
  manuallyPinned?: boolean;
}

export function calculatePriority(input: CalculatePriorityInput): number {
  if (excludedStatuses.has(input.status)) {
    return 0;
  }

  if (input.manuallyPinned) {
    return 100;
  }

  let score = urgencyBase[input.urgency];

  if (
    !input.needsDateReview &&
    input.deadlineAt &&
    !Number.isNaN(input.deadlineAt.getTime())
  ) {
    const untilDeadline = input.deadlineAt.getTime() - input.now.getTime();
    if (untilDeadline < 0) {
      score += 20;
    } else if (untilDeadline <= oneDayMilliseconds) {
      score += 15;
    }
  }

  if (input.isNewClientLead || input.isAviationOpportunity) {
    score += 10;
  }

  if (input.isActiveProject) {
    score += 5;
  }

  return Math.min(score, 100);
}
