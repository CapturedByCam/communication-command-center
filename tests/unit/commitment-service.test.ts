import { describe, expect, it } from "vitest";
import {
  resolveCommitment,
  upsertCommitment,
} from "../../src/services/commitment-service.js";

const proposal = {
  commitmentId: "com_promise_001",
  itemId: "cc_abcdefghijkl",
  sourceThreadId: "thread-1",
  promiseText: "I will send the estimate tomorrow.",
  sourceEvidenceId: "gmail-message-outbound-1",
  observedAt: "2026-09-22T14:00:00-04:00",
  deadlineAt: "2026-09-23T17:00:00-04:00",
  deadlineText: "tomorrow",
};

describe("commitments", () => {
  it("creates one outgoing promise and suppresses a retry by source evidence", () => {
    const created = upsertCommitment([], proposal);
    expect(created.outcome).toBe("created");
    expect(created.commitments).toHaveLength(1);

    const duplicate = upsertCommitment(created.commitments, proposal);
    expect(duplicate.outcome).toBe("duplicate_suppressed");
    expect(duplicate.commitments).toEqual(created.commitments);
  });

  it("preserves a manually overridden commitment", () => {
    const existing = upsertCommitment([], proposal).commitments[0]!;
    const manual = { ...existing, manualOverride: true, deadlineAt: null };
    expect(upsertCommitment([manual], proposal).commitments).toEqual([manual]);
  });

  it("only resolves with explicit source fulfillment evidence or manual action", () => {
    const commitment = upsertCommitment([], proposal).commitments[0]!;
    expect(() => resolveCommitment(commitment, {})).toThrow(
      "explicit fulfillment",
    );
    expect(
      resolveCommitment(commitment, {
        fulfillmentEvidenceId: "gmail-message-inbound-2",
        resolvedAt: "2026-09-23T16:00:00-04:00",
      }),
    ).toMatchObject({
      status: "fulfilled",
      fulfillmentEvidenceId: "gmail-message-inbound-2",
    });
    expect(
      resolveCommitment(commitment, {
        actor: "cam",
        resolvedAt: "2026-09-23T16:00:00-04:00",
      }),
    ).toMatchObject({
      status: "fulfilled",
      manualOverride: true,
      resolvedBy: "cam",
    });
  });
});
