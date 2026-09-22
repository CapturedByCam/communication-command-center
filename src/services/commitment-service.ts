const NEW_YORK = "America/New_York";
const MAX_DEADLINE_TEXT_LENGTH = 200;

export interface Commitment {
  readonly commitmentId: string;
  readonly itemId: string;
  readonly sourceThreadId: string;
  readonly promiseText: string;
  readonly sourceEvidenceId: string;
  readonly observedAt: string;
  readonly deadlineAt: string | null;
  readonly deadlineText: string | null;
  readonly status: "open" | "fulfilled";
  readonly fulfilledAt: string | null;
  readonly fulfillmentEvidenceId: string | null;
  readonly manualOverride: boolean;
  readonly resolvedBy: string | null;
  readonly updatedAt: string;
}

export interface CommitmentProposal {
  readonly commitmentId: string;
  readonly itemId: string;
  readonly sourceThreadId: string;
  readonly promiseText: string;
  readonly sourceEvidenceId: string;
  readonly observedAt: string;
  readonly deadlineAt: string | null;
  readonly deadlineText: string | null;
}

export interface CommitmentUpsertResult {
  readonly outcome:
    "created" | "duplicate_suppressed" | "manual_override_preserved";
  readonly commitments: readonly Commitment[];
}

export interface CommitmentResolution {
  readonly fulfillmentEvidenceId?: string;
  readonly actor?: string;
  readonly resolvedAt?: string;
}

export interface DeadlineSuggestion {
  readonly text: string | null | undefined;
  /** An ISO timestamp used only to resolve relative language. */
  readonly anchorAt?: string;
}

export interface NormalizedDeadline {
  readonly deadlineAt: string | null;
  readonly deadlineText: string | null;
  readonly needsDateReview: boolean;
}

function boundedText(text: string | null | undefined): string | null {
  const value = text?.trim();
  return value ? value.slice(0, MAX_DEADLINE_TEXT_LENGTH) : null;
}

function newCommitment(proposal: CommitmentProposal): Commitment {
  return {
    ...proposal,
    deadlineText: boundedText(proposal.deadlineText),
    status: "open",
    fulfilledAt: null,
    fulfillmentEvidenceId: null,
    manualOverride: false,
    resolvedBy: null,
    updatedAt: proposal.observedAt,
  };
}

/**
 * Upserts only on immutable source evidence. A retry cannot create a second
 * obligation, and background extraction cannot overwrite human edits.
 */
export function upsertCommitment(
  existing: readonly Commitment[],
  proposal: CommitmentProposal,
): CommitmentUpsertResult {
  const sameEvidence = existing.find(
    (commitment) => commitment.sourceEvidenceId === proposal.sourceEvidenceId,
  );
  if (sameEvidence) {
    return { outcome: "duplicate_suppressed", commitments: existing };
  }

  const sameCommitment = existing.find(
    (commitment) => commitment.commitmentId === proposal.commitmentId,
  );
  if (sameCommitment?.manualOverride) {
    return { outcome: "manual_override_preserved", commitments: existing };
  }

  return {
    outcome: "created",
    commitments: [...existing, newCommitment(proposal)],
  };
}

/** Resolving requires a source fulfillment record or an explicit human actor. */
export function resolveCommitment(
  commitment: Commitment,
  resolution: CommitmentResolution,
): Commitment {
  if (!resolution.fulfillmentEvidenceId && !resolution.actor) {
    throw new Error(
      "Commitment resolution requires explicit fulfillment evidence or actor",
    );
  }
  const resolvedAt = resolution.resolvedAt ?? commitment.updatedAt;
  return {
    ...commitment,
    status: "fulfilled",
    fulfilledAt: resolvedAt,
    fulfillmentEvidenceId: resolution.fulfillmentEvidenceId ?? null,
    manualOverride: resolution.actor ? true : commitment.manualOverride,
    resolvedBy: resolution.actor ?? commitment.resolvedBy,
    updatedAt: resolvedAt,
  };
}

interface LocalDateTime {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

function localParts(date: Date): LocalDateTime {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone: NEW_YORK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(values.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

function equalLocal(left: LocalDateTime, right: LocalDateTime): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

function isoOffset(date: Date): string {
  const utcMillis = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
  );
  const local = localParts(date);
  const localMillis = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  );
  const offsetMinutes = Math.round((localMillis - utcMillis) / 60_000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

/** Returns null for DST gaps and folds, whose wall-clock values are ambiguous. */
function fromNewYorkLocal(value: LocalDateTime): string | null {
  const naive = Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
  );
  const candidates = [-300, -240]
    .map((offset) => new Date(naive - offset * 60_000))
    .filter((candidate) => equalLocal(localParts(candidate), value));
  if (candidates.length !== 1) return null;
  const candidate = candidates[0]!;
  const datePart = `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
  const timePart = `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}:00`;
  return `${datePart}T${timePart}${isoOffset(candidate)}`;
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const match =
    /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?(?:m)\.?|p\.?(?:m)\.?)\b/i.exec(
      value,
    );
  if (!match) return null;
  const rawHour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  if (rawHour < 1 || rawHour > 12 || minute > 59) return null;
  const meridiem = match[3]!.toLowerCase().startsWith("p") ? "pm" : "am";
  return { hour: (rawHour % 12) + (meridiem === "pm" ? 12 : 0), minute };
}

function dateFromAnchor(anchorAt: string): LocalDateTime | null {
  const anchor = new Date(anchorAt);
  return Number.isNaN(anchor.valueOf()) ? null : localParts(anchor);
}

function addDays(date: LocalDateTime, days: number): LocalDateTime {
  const result = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
    hour: date.hour,
    minute: date.minute,
  };
}

function parseSuggestedLocal(
  text: string,
  anchor: LocalDateTime,
): LocalDateTime | null {
  const time = parseTime(text) ?? { hour: 17, minute: 0 };
  const absolute = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (absolute)
    return {
      year: Number(absolute[1]),
      month: Number(absolute[2]),
      day: Number(absolute[3]),
      ...time,
    };
  if (/\btomorrow\b/i.test(text)) return { ...addDays(anchor, 1), ...time };
  if (/\btoday\b/i.test(text)) return { ...anchor, ...time };
  const inDays = /\bin\s+(\d{1,3})\s+days?\b/i.exec(text);
  if (inDays) return { ...addDays(anchor, Number(inDays[1])), ...time };
  const nextWeekday =
    /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.exec(
      text,
    );
  if (!nextWeekday) return null;
  const target = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ].indexOf(nextWeekday[1]!.toLowerCase());
  const anchorDay = new Date(
    Date.UTC(anchor.year, anchor.month - 1, anchor.day),
  ).getUTCDay();
  const delta = (target - anchorDay + 7) % 7 || 7;
  return { ...addDays(anchor, delta), ...time };
}

/**
 * Deliberately small parser: unsupported language remains reviewable instead
 * of producing a plausible but wrong date. Date-only promises use 5 PM NY.
 */
export function normalizeDeadlineSuggestion(
  suggestion: DeadlineSuggestion,
): NormalizedDeadline {
  const deadlineText = boundedText(suggestion.text);
  if (!deadlineText || !suggestion.anchorAt) {
    return {
      deadlineAt: null,
      deadlineText,
      needsDateReview: Boolean(deadlineText),
    };
  }
  const anchor = dateFromAnchor(suggestion.anchorAt);
  const local = anchor ? parseSuggestedLocal(deadlineText, anchor) : null;
  const deadlineAt = local ? fromNewYorkLocal(local) : null;
  return { deadlineAt, deadlineText, needsDateReview: deadlineAt === null };
}
