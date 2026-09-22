import { describe, expect, it } from "vitest";
import {
  buildBriefing,
  renderBriefingMarkdown,
} from "../../src/services/briefing-service.js";
import type { CommunicationItem } from "../../src/domain/types.js";

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
});
