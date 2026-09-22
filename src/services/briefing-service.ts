import type { CommunicationItem } from "../domain/types.js";
import type { Commitment } from "./commitment-service.js";

export type BriefingSectionKey =
  | "handle_first"
  | "quick_wins"
  | "promises_due"
  | "needs_judgment"
  | "drafts_ready"
  | "waiting_on_others"
  | "upcoming_this_week"
  | "system_health";

export interface BriefingEntry {
  readonly itemId?: string;
  readonly commitmentId?: string;
  readonly summary: string;
  readonly nextAction: string | null;
  readonly priorityScore: number | null;
  readonly reason: string;
}

export interface BriefingSection {
  readonly key: BriefingSectionKey;
  readonly title: string;
  readonly entries: readonly BriefingEntry[];
}

export interface BriefingHealth {
  readonly failedIntakeCount?: number;
  readonly duplicateSuppressedCount?: number;
  readonly staleDraftCount?: number;
  readonly lastSuccessfulReconciliationAt?: string;
}

export interface BriefingOptions {
  /** Item IDs already designated review-only by a deterministic risk policy. */
  readonly needsJudgmentItemIds?: readonly string[];
  readonly estimatedMinutesByItemId?: Readonly<Record<string, number>>;
}

export interface Briefing {
  readonly generatedAt: string;
  readonly sections: readonly BriefingSection[];
  readonly handleFirstOverflowCount: number;
}

const SECTION_TITLES: Readonly<Record<BriefingSectionKey, string>> = {
  handle_first: "Handle first",
  quick_wins: "Quick wins",
  promises_due: "Promises due or overdue",
  needs_judgment: "Needs judgment",
  drafts_ready: "Drafts ready",
  waiting_on_others: "Waiting on others",
  upcoming_this_week: "Upcoming this week",
  system_health: "System health",
};

function sortItems(items: readonly CommunicationItem[]): CommunicationItem[] {
  return [...items].sort((left, right) => {
    const priority = right.priority_score - left.priority_score;
    if (priority !== 0) return priority;
    const deadline =
      deadlineTimestamp(left.deadline_at) -
      deadlineTimestamp(right.deadline_at);
    if (deadline !== 0) return deadline;
    return (
      left.updated_at.localeCompare(right.updated_at) ||
      left.item_id.localeCompare(right.item_id)
    );
  });
}

function deadlineTimestamp(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).valueOf();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function itemEntry(item: CommunicationItem, reason: string): BriefingEntry {
  return {
    itemId: item.item_id,
    summary: item.summary,
    nextAction: item.next_action,
    priorityScore: item.priority_score,
    reason,
  };
}

function isActive(item: CommunicationItem, now: Date): boolean {
  if (item.status === "resolved" || item.status === "archived") return false;
  if (!item.snooze_until) return item.status === "open";
  const snoozeUntil = new Date(item.snooze_until);
  return !Number.isNaN(snoozeUntil.valueOf()) && snoozeUntil <= now;
}

function newYorkDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isDueOnOrBeforeToday(deadlineAt: string | null, now: Date): boolean {
  if (!deadlineAt) return false;
  const deadline = new Date(deadlineAt);
  return (
    !Number.isNaN(deadline.valueOf()) &&
    newYorkDate(deadline) <= newYorkDate(now)
  );
}

function withinWeek(deadlineAt: string | null | undefined, now: Date): boolean {
  if (!deadlineAt) return false;
  const deadline = new Date(deadlineAt);
  return (
    !Number.isNaN(deadline.valueOf()) &&
    deadline >= now &&
    deadline <= new Date(now.valueOf() + 7 * 24 * 60 * 60 * 1000)
  );
}

function section(
  key: BriefingSectionKey,
  entries: readonly BriefingEntry[],
): BriefingSection {
  return { key, title: SECTION_TITLES[key], entries };
}

/**
 * Pure, deterministic sectioning. Queue entries are placed exactly once;
 * commitment and health entries are supplementary records and never compete
 * with a queue item's placement.
 */
export function buildBriefing(
  items: readonly CommunicationItem[],
  commitments: readonly Commitment[],
  health: BriefingHealth,
  generatedAt: string,
  options: BriefingOptions = {},
): Briefing {
  const now = new Date(generatedAt);
  if (Number.isNaN(now.valueOf()))
    throw new Error("generatedAt must be an ISO timestamp");
  const unassigned = new Map(
    sortItems(items.filter((item) => isActive(item, now))).map((item) => [
      item.item_id,
      item,
    ]),
  );
  const take = (
    predicate: (item: CommunicationItem) => boolean,
    reason: string,
  ): BriefingEntry[] => {
    const selected = sortItems([...unassigned.values()].filter(predicate));
    for (const item of selected) unassigned.delete(item.item_id);
    return selected.map((item) => itemEntry(item, reason));
  };

  const topFive = sortItems([...unassigned.values()]).slice(0, 5);
  for (const item of topFive) unassigned.delete(item.item_id);
  const handleFirst = topFive.map((item) =>
    itemEntry(item, "highest priority"),
  );
  const handleFirstOverflowCount = unassigned.size;

  const quickWins = take(
    (item) =>
      item.next_action_type === "reply" &&
      (options.estimatedMinutesByItemId?.[item.item_id] ?? Infinity) < 5,
    "reply estimated under five minutes",
  );
  const duePromises = commitments
    .filter(
      (commitment) =>
        commitment.status === "open" &&
        isDueOnOrBeforeToday(commitment.deadlineAt, now),
    )
    .sort(
      (left, right) =>
        left.deadlineAt!.localeCompare(right.deadlineAt!) ||
        left.commitmentId.localeCompare(right.commitmentId),
    )
    .map((commitment) => ({
      commitmentId: commitment.commitmentId,
      summary: commitment.promiseText,
      nextAction: "Fulfill or resolve with evidence",
      priorityScore: null,
      reason: "due or overdue promise",
    }));
  const needsJudgmentIds = new Set(options.needsJudgmentItemIds ?? []);
  const needsJudgment = take(
    (item) => needsJudgmentIds.has(item.item_id),
    "review-only item",
  );
  const draftsReady = take(
    (item) =>
      item.draft_status === "generated" || item.draft_status === "reviewed",
    "draft ready for review",
  );
  const waiting = take(
    (item) => item.waiting_on === "them",
    "waiting on another person",
  );
  const upcoming = take(
    (item) => withinWeek(item.deadline_at, now),
    "deadline within seven days",
  );
  // The final deterministic bucket makes overflow actionable without silently omitting it.
  const remaining = take(() => true, "active item awaiting triage");
  const needsJudgmentWithOverflow = [...needsJudgment, ...remaining];

  const healthEntries: BriefingEntry[] = [
    {
      summary: `Failed intake: ${health.failedIntakeCount ?? 0}`,
      nextAction: null,
      priorityScore: null,
      reason: "operational health",
    },
    {
      summary: `Duplicate suppression: ${health.duplicateSuppressedCount ?? 0}`,
      nextAction: null,
      priorityScore: null,
      reason: "operational health",
    },
    {
      summary: `Stale drafts: ${health.staleDraftCount ?? 0}`,
      nextAction: null,
      priorityScore: null,
      reason: "operational health",
    },
    {
      summary: `Last successful reconciliation: ${health.lastSuccessfulReconciliationAt ?? "none recorded"}`,
      nextAction: null,
      priorityScore: null,
      reason: "operational health",
    },
  ];

  return {
    generatedAt,
    handleFirstOverflowCount,
    sections: [
      section("handle_first", handleFirst),
      section("quick_wins", quickWins),
      section("promises_due", duePromises),
      section("needs_judgment", needsJudgmentWithOverflow),
      section("drafts_ready", draftsReady),
      section("waiting_on_others", waiting),
      section("upcoming_this_week", upcoming),
      section("system_health", healthEntries),
    ],
  };
}

/** Adapter-neutral rows for Briefing_View; persistence is owned by a Sheet adapter. */
export function writeBriefingView(
  briefing: Briefing,
): readonly BriefingSection[] {
  return briefing.sections;
}

export function renderBriefingMarkdown(briefing: Briefing): string {
  const lines = [
    "# Communication briefing",
    "",
    `Generated: ${briefing.generatedAt}`,
  ];
  if (briefing.handleFirstOverflowCount > 0) {
    lines.push(
      `Handle first is limited to five; ${briefing.handleFirstOverflowCount} remaining active item(s) are placed in their next applicable section.`,
    );
  }
  for (const current of briefing.sections) {
    lines.push("", `## ${current.title}`);
    if (current.entries.length === 0) lines.push("- None");
    for (const entry of current.entries) {
      const identifier = entry.itemId ?? entry.commitmentId;
      lines.push(
        `- ${identifier ? `[${identifier}] ` : ""}${entry.summary}${entry.nextAction ? ` — ${entry.nextAction}` : ""}`,
      );
    }
  }
  return lines.join("\n");
}
