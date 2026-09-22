import { describe, expect, it } from "vitest";
import type { ThreadSnapshot } from "../../src/adapters/gmail/gmail-client.js";
import { deriveBoundedThreadState } from "../../src/adapters/gmail/bounded-thread-state.js";
import type { CommitmentStorageRecord } from "../../src/domain/commitment-schema.js";

const now = "2026-09-22T16:00:00.000Z";
const window = {
  from: "2026-08-23T16:00:00.000Z",
  to: "2026-09-22T16:00:00.000Z",
};

const at = (value: string): number => Date.parse(value);

const snapshot = (overrides: Partial<ThreadSnapshot> = {}): ThreadSnapshot => ({
  schema_version: "1.1",
  mailbox: "contact@elev8mediaky.com",
  threadId: "thread-1",
  messages: [
    {
      id: "outbound-1",
      internalDate: at("2026-09-20T12:00:00.000Z"),
      sender: "contact@elev8mediaky.com",
      recipients: ["client@example.test"],
      labels: ["SENT"],
      automated: false,
      bulk: false,
      receipt: false,
      interpretation: {
        kind: "promise",
        category: "active_project",
        risk: "routine",
        summary: "Cam promised a follow-up.",
        confidence: 0.8,
      },
    },
  ],
  ...overrides,
});

const record = (
  overrides: Partial<CommitmentStorageRecord> = {},
): CommitmentStorageRecord => ({
  commitment_id: "com_outbound_001",
  item_id: "cc_abcdefghijkl",
  source_thread_id: "thread-1",
  promise_text: "Send the approved estimate.",
  deadline_at: "2026-09-21T12:00:00.000Z",
  deadline_text: "tomorrow",
  status: "open",
  fulfilled_at: null,
  fulfillment_evidence_id: null,
  manual_override: false,
  updated_at: "2026-09-20T12:00:00.000Z",
  schema_version: "1.1",
  source_message_id: "outbound-1",
  source_evidence_id: "gmail:contact@elev8mediaky.com:outbound-1",
  observed_at: "2026-09-20T12:00:00.000Z",
  resolved_by: null,
  needs_date_review: false,
  ...overrides,
});

describe("deriveBoundedThreadState", () => {
  it("keeps an older overdue commitment visible without fabricating its source message", () => {
    const state = deriveBoundedThreadState(
      snapshot(),
      [
        record({
          source_message_id: "outbound-before-window",
          source_evidence_id:
            "gmail:contact@elev8mediaky.com:outbound-before-window",
          observed_at: "2026-08-22T12:00:00.000Z",
          updated_at: "2026-08-22T12:00:00.000Z",
        }),
      ],
      window,
      now,
    );

    expect(state).toMatchObject({
      latestMessageId: "outbound-1",
      waitingOn: "me",
      hasOpenPromise: true,
      hasOverdueUnresolvedPromise: true,
    });
  });

  it("requires exact in-window outbound message provenance", () => {
    expect(() =>
      deriveBoundedThreadState(
        snapshot(),
        [record({ source_message_id: "missing" })],
        window,
        now,
      ),
    ).toThrow(/source message/i);

    expect(() =>
      deriveBoundedThreadState(
        snapshot({
          messages: [
            {
              ...snapshot().messages[0],
              sender: "client@example.test",
              recipients: ["contact@elev8mediaky.com"],
            },
          ],
        }),
        [record()],
        window,
        now,
      ),
    ).toThrow(/outbound/i);

    expect(() =>
      deriveBoundedThreadState(
        snapshot(),
        [
          record({
            observed_at: "2026-09-20T12:01:00.000Z",
            updated_at: "2026-09-20T12:01:00.000Z",
          }),
        ],
        window,
        now,
      ),
    ).toThrow(/observed_at/i);
  });

  it("preserves fulfilled records and makes excluded threads with an open obligation review-only", () => {
    const fulfilled = record({
      status: "fulfilled",
      fulfilled_at: "2026-09-20T13:00:00.000Z",
      fulfillment_evidence_id: "outbound-fulfillment-1",
      updated_at: "2026-09-20T13:00:00.000Z",
    });
    expect(
      deriveBoundedThreadState(snapshot(), [fulfilled], window, now),
    ).toMatchObject({
      hasOpenPromise: false,
      hasOverdueUnresolvedPromise: false,
    });

    const excluded = snapshot({
      messages: [{ ...snapshot().messages[0], automated: true }],
    });
    expect(
      deriveBoundedThreadState(excluded, [record()], window, now),
    ).toMatchObject({
      excluded: false,
      waitingOn: "me",
      draftRisk: "no_draft",
      confidence: 0,
      hasOpenPromise: true,
      hasOverdueUnresolvedPromise: true,
    });
  });

  it("rejects invalid bounds, out-of-window Gmail messages, and conflicting record identities", () => {
    expect(() =>
      deriveBoundedThreadState(
        snapshot(),
        [],
        { ...window, to: window.from },
        now,
      ),
    ).toThrow(/window/i);
    expect(() =>
      deriveBoundedThreadState(
        snapshot(),
        [
          record({
            observed_at: window.to,
            updated_at: window.to,
          }),
        ],
        window,
        now,
      ),
    ).toThrow(/after the bounded Gmail window/i);
    expect(() =>
      deriveBoundedThreadState(
        snapshot({
          messages: [
            {
              ...snapshot().messages[0],
              internalDate: at("2026-08-23T15:59:59.999Z"),
            },
          ],
        }),
        [],
        window,
        now,
      ),
    ).toThrow(/window/i);
    expect(() =>
      deriveBoundedThreadState(
        snapshot(),
        [record(), record({ promise_text: "Conflicting duplicate." })],
        window,
        now,
      ),
    ).toThrow(/duplicate commitment/i);
  });
});
