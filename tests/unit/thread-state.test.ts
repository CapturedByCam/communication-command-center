import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GmailClient,
  type ThreadSnapshot,
} from "../../src/adapters/gmail/gmail-client.js";
import {
  deriveThreadState,
  type ThreadCommitment,
} from "../../src/adapters/gmail/thread-state.js";

const fixture = async (name: string): Promise<ThreadSnapshot> =>
  JSON.parse(
    await readFile(
      fileURLToPath(new URL(`../fixtures/gmail/${name}.json`, import.meta.url)),
      "utf8",
    ),
  ) as ThreadSnapshot;

const now = "2026-10-10T00:00:00.000Z";

describe("deriveThreadState", () => {
  it("treats equally recent routine and high-risk questions as ambiguous", async () => {
    const snapshot = await fixture("direct-question");
    const routine = { ...snapshot.messages[0], id: "a" };
    snapshot.messages = [
      routine,
      {
        ...routine,
        id: "b",
        interpretation: { ...routine.interpretation, risk: "review_only" },
      },
    ];
    expect(deriveThreadState(snapshot, [], now)).toMatchObject({
      waitingOn: "unknown",
      draftRisk: "no_draft",
      latestMessageId: null,
    });
  });
  it("orders a direct question by timestamp and waits on Cam", async () => {
    const state = deriveThreadState(await fixture("direct-question"), [], now);
    expect(state).toMatchObject({
      excluded: false,
      waitingOn: "me",
      latestMessageId: "message-question",
      latestMessageAt: "2025-10-09T08:53:22.000Z",
      category: "active_project",
      draftRisk: "routine",
    });
  });

  it.each([
    ["acknowledgement", "none", "no_draft"],
    ["closed-informational", "none", "no_draft"],
    ["complaint", "me", "review_only"],
    ["pricing-request", "me", "review_only"],
    ["aviation-opportunity", "me", "review_only"],
  ] as const)("derives %s safely", async (name, waitingOn, draftRisk) => {
    const state = deriveThreadState(await fixture(name), [], now);
    expect(state).toMatchObject({ excluded: false, waitingOn, draftRisk });
  });

  it("excludes automated bulk newsletters", async () => {
    expect(
      deriveThreadState(await fixture("newsletter"), [], now),
    ).toMatchObject({
      excluded: true,
      waitingOn: "none",
      latestMessageId: null,
    });
  });

  it("excludes deterministic receipts", async () => {
    expect(deriveThreadState(await fixture("receipt"), [], now)).toMatchObject({
      excluded: true,
      waitingOn: "none",
      latestMessageId: null,
    });
  });

  it("keeps an overdue unfulfilled outbound promise open", async () => {
    const commitments: ThreadCommitment[] = [
      {
        messageId: "message-promise",
        status: "open",
        deadlineAt: "2026-10-01T00:00:00.000Z",
      },
    ];
    expect(
      deriveThreadState(await fixture("outbound-promise"), commitments, now),
    ).toMatchObject({
      waitingOn: "me",
      hasOpenPromise: true,
      hasOverdueUnresolvedPromise: true,
    });
  });

  it("rejects a snapshot outside the sole approved mailbox", async () => {
    const snapshot = await fixture("direct-question");
    snapshot.mailbox = "other@example.test";
    await expect(
      new GmailClient({
        getThreadSnapshot: async () => snapshot,
      }).getThreadSnapshot("message-question"),
    ).rejects.toThrow(/mailbox/i);
  });

  it("rejects a response whose snapshot does not contain the requested message", async () => {
    await expect(
      new GmailClient({
        getThreadSnapshot: async () => fixture("direct-question"),
      }).getThreadSnapshot("missing-message"),
    ).rejects.toThrow(/requested/i);
  });

  it("treats aliases as inbound and rejects malformed model interpretation", async () => {
    const alias = await fixture("direct-question");
    alias.messages[0] = {
      ...alias.messages[0],
      sender: "alias@elev8mediaky.com",
    };
    expect(deriveThreadState(alias, [], now).waitingOn).toBe("me");

    const malformed = await fixture("direct-question");
    (
      malformed.messages[0].interpretation as unknown as Record<string, unknown>
    ).kind = "unbounded";
    expect(() => deriveThreadState(malformed, [], now)).toThrow();
  });

  it.each([
    [
      "automated",
      (snapshot: ThreadSnapshot) => (snapshot.messages[0].automated = true),
    ],
    ["bulk", (snapshot: ThreadSnapshot) => (snapshot.messages[0].bulk = true)],
    [
      "no-reply",
      (snapshot: ThreadSnapshot) =>
        (snapshot.messages[0].sender = "no-reply@example.test"),
    ],
    [
      "spam",
      (snapshot: ThreadSnapshot) => snapshot.messages[0].labels.push("SPAM"),
    ],
    [
      "draft",
      (snapshot: ThreadSnapshot) => snapshot.messages[0].labels.push("DRAFT"),
    ],
    [
      "receipt",
      (snapshot: ThreadSnapshot) => (snapshot.messages[0].receipt = true),
    ],
  ])("excludes a %s message", async (_name, exclude) => {
    const snapshot = await fixture("direct-question");
    exclude(snapshot);
    snapshot.messages = [snapshot.messages[0]];
    expect(deriveThreadState(snapshot, [], now).excluded).toBe(true);
  });

  it("fails safely on duplicate IDs with conflicting snapshots and tied conflicting latest signals", async () => {
    const duplicate = await fixture("direct-question");
    duplicate.messages.push({
      ...duplicate.messages[0],
      sender: "different@example.test",
    });
    expect(() => deriveThreadState(duplicate, [], now)).toThrow(/duplicate/i);

    const tie = await fixture("direct-question");
    tie.messages[1] = {
      ...tie.messages[1],
      internalDate: tie.messages[0].internalDate,
      interpretation: {
        ...tie.messages[1].interpretation,
        kind: "acknowledgement",
      },
    };
    expect(deriveThreadState(tie, [], now).waitingOn).toBe("unknown");
  });

  it("uses instant comparisons for offsets and keeps overdue promises through ambiguous ties", async () => {
    const snapshot = await fixture("direct-question");
    snapshot.messages[1] = {
      ...snapshot.messages[1],
      internalDate: snapshot.messages[0].internalDate,
      interpretation: {
        ...snapshot.messages[1].interpretation,
        kind: "acknowledgement",
      },
    };
    const commitments: ThreadCommitment[] = [
      {
        messageId: "message-earlier",
        status: "open",
        deadlineAt: "2026-10-10T00:30:00.000+01:00",
      },
    ];
    expect(deriveThreadState(snapshot, commitments, now)).toMatchObject({
      waitingOn: "me",
      hasOpenPromise: true,
      hasOverdueUnresolvedPromise: true,
    });
  });

  it("does not infer direction from sender alone and rejects future timestamps", async () => {
    const unaddressed = await fixture("direct-question");
    unaddressed.messages = [
      { ...unaddressed.messages[0], recipients: ["other@example.test"] },
    ];
    expect(deriveThreadState(unaddressed, [], now).waitingOn).toBe("unknown");

    const ownToOwn = await fixture("direct-question");
    ownToOwn.messages = [
      { ...ownToOwn.messages[0], sender: "contact@elev8mediaky.com" },
    ];
    expect(deriveThreadState(ownToOwn, [], now).waitingOn).toBe("unknown");

    const future = await fixture("direct-question");
    future.messages[0].internalDate = Date.parse("2026-10-10T00:00:01.000Z");
    expect(() => deriveThreadState(future, [], now)).toThrow(/future/i);
  });

  it("rejects unsafe and out-of-range internal dates", async () => {
    const unsafe = await fixture("direct-question");
    unsafe.messages[0].internalDate = Number.MAX_SAFE_INTEGER + 1;
    expect(() => deriveThreadState(unsafe, [], now)).toThrow();

    const invalidDate = await fixture("direct-question");
    invalidDate.messages[0].internalDate = 8_640_000_000_000_001;
    expect(() => deriveThreadState(invalidDate, [], now)).toThrow();
  });
});
