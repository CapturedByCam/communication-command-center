import { describe, expect, it } from "vitest";
import {
  buildBriefing,
  renderBriefingMarkdown,
} from "../../src/services/briefing-service.js";
import type { CommunicationItem } from "../../src/domain/types.js";
import type { Commitment } from "../../src/services/commitment-service.js";

function item(
  id: string,
  overrides: Partial<CommunicationItem> = {},
): CommunicationItem {
  return {
    schema_version: "1.0",
    item_id: id,
    source: "gmail",
    source_record_id: id,
    source_thread_id: `thread-${id}`,
    captured_at: "2026-09-22T08:00:00-04:00",
    updated_at: "2026-09-22T08:00:00-04:00",
    category: "active_project",
    status: "open",
    waiting_on: "me",
    urgency: "today",
    priority_score: 70,
    next_action_type: "reply",
    next_action: "Reply",
    summary: `Summary ${id}`,
    deadline_at: null,
    deadline_text: null,
    draft_status: "not_needed",
    confidence: 1,
    classifier_version: "test",
    content_hash: "a".repeat(64),
    raw_content_stored: false,
    ...overrides,
  };
}

describe("buildBriefing", () => {
  it("has all eight sections, excludes inactive items, and assigns each active item once", () => {
    const active = [
      ...Array.from({ length: 6 }, (_, index) =>
        item(`cc_active${String(index).padStart(6, "0")}`, {
          priority_score: 100 - index,
        }),
      ),
      item("cc_waiting0001", { waiting_on: "them", urgency: "later" }),
      item("cc_draft000001", { draft_status: "generated", urgency: "later" }),
    ];
    const briefing = buildBriefing(
      active.concat([
        item("cc_resolved000", { status: "resolved" }),
        item("cc_snoozed0000", { status: "snoozed" }),
      ]),
      [],
      { failedIntakeCount: 1, duplicateSuppressedCount: 2, staleDraftCount: 3 },
      "2026-09-22T09:00:00-04:00",
    );

    expect(briefing.sections).toHaveLength(8);
    expect(briefing.sections.map((section) => section.title)).toEqual([
      "Handle first",
      "Quick wins",
      "Promises due or overdue",
      "Needs judgment",
      "Drafts ready",
      "Waiting on others",
      "Upcoming this week",
      "System health",
    ]);
    const ids = briefing.sections.flatMap((section) =>
      section.entries.map((entry) => entry.itemId).filter(Boolean),
    );
    expect(ids.sort()).toEqual(active.map((entry) => entry.item_id).sort());
    expect(briefing.handleFirstOverflowCount).toBe(3);
  });

  it("renders deterministic markdown with practical overflow guidance", () => {
    const briefing = buildBriefing(
      [item("cc_active000001")],
      [],
      {},
      "2026-09-22T09:00:00-04:00",
    );
    expect(renderBriefingMarkdown(briefing)).toContain(
      "# Communication briefing",
    );
    expect(renderBriefingMarkdown(briefing)).toContain("## Handle first");
  });

  it("restores expired snoozes and orders same-priority items with no deadline last", () => {
    const now = "2026-09-22T12:00:00-04:00";
    const briefing = buildBriefing(
      [
        item("cc_no_deadline01", { priority_score: 50 }),
        item("cc_later_deadline", {
          priority_score: 50,
          deadline_at: "2026-09-24T09:00:00-04:00",
        }),
        item("cc_early_deadline", {
          priority_score: 50,
          deadline_at: "2026-09-23T09:00:00-04:00",
        }),
        item("cc_expired_snooze", {
          status: "snoozed",
          snooze_until: "2026-09-22T11:59:00-04:00",
        }),
        item("cc_active_snooze", {
          status: "snoozed",
          snooze_until: "2026-09-22T12:01:00-04:00",
        }),
      ],
      [],
      {},
      now,
    );
    expect(briefing.sections[0]!.entries.map((entry) => entry.itemId)).toEqual([
      "cc_expired_snooze",
      "cc_early_deadline",
      "cc_later_deadline",
      "cc_no_deadline01",
    ]);
  });

  it("includes promises due later today in New York", () => {
    const commitment: Commitment = {
      commitmentId: "com_due_today",
      itemId: "cc_abcdefghijkl",
      sourceThreadId: "thread",
      promiseText: "Send it today",
      sourceEvidenceId: "source",
      observedAt: "2026-09-22T09:00:00-04:00",
      deadlineAt: "2026-09-22T17:00:00-04:00",
      deadlineText: "today",
      status: "open",
      fulfilledAt: null,
      fulfillmentEvidenceId: null,
      manualOverride: false,
      resolvedBy: null,
      updatedAt: "2026-09-22T09:00:00-04:00",
    };
    const briefing = buildBriefing(
      [],
      [commitment],
      {},
      "2026-09-22T09:00:00-04:00",
    );
    expect(briefing.sections[2]!.entries).toHaveLength(1);
  });

  it("uses New York calendar dates for the seven-day window across DST changes", () => {
    for (const [now, deadline] of [
      ["2026-03-08T00:30:00-05:00", "2026-03-15T23:30:00-04:00"],
      ["2026-11-01T00:30:00-04:00", "2026-11-08T23:30:00-05:00"],
    ]) {
      const briefing = buildBriefing(
        [
          ...Array.from({ length: 5 }, (_, index) =>
            item(`cc_dst_filler${index}`, {
              priority_score: 100 - index,
              urgency: "later",
            }),
          ),
          item("cc_dst_week", {
            priority_score: 1,
            deadline_at: deadline,
            urgency: "later",
          }),
        ],
        [],
        {},
        now,
      );
      expect(
        briefing.sections[6]!.entries.map((entry) => entry.itemId),
      ).toContain("cc_dst_week");
    }
  });
});
