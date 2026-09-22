import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ThreadSnapshotSchema,
  APPROVED_GMAIL_MAILBOX,
} from "../../src/adapters/gmail/gmail-client.js";
import {
  GmailCheckpointSchema,
  GmailStudioRetrySchema,
} from "../../src/adapters/gmail/reconciliation.js";

async function fixture(path: string) {
  return JSON.parse(
    await readFile(new URL(`../fixtures/${path}`, import.meta.url), "utf8"),
  ) as unknown;
}

describe("local Gmail v1 contracts", () => {
  it("validates all sanitized snapshots, which contain only synthetic participants and bounded summaries", async () => {
    const files = await readdir(new URL("../fixtures/gmail/", import.meta.url));
    expect(files).toHaveLength(9);
    for (const file of files) {
      const snapshot = ThreadSnapshotSchema.parse(
        await fixture(`gmail/${file}`),
      );
      for (const message of snapshot.messages) {
        for (const address of [message.sender, ...message.recipients]) {
          expect(
            address.toLowerCase() === APPROVED_GMAIL_MAILBOX ||
              /@(?:[a-z]+\.)?example\.test$/.test(address),
          ).toBe(true);
        }
      }
    }
  });

  it("rejects raw content and model-controlled chronology fields at each snapshot boundary", async () => {
    const snapshot = ThreadSnapshotSchema.parse(
      await fixture("gmail/direct-question.json"),
    );
    for (const candidate of [
      { ...snapshot, body: "synthetic forbidden body" },
      { ...snapshot, schema_version: "2.0" },
      {
        ...snapshot,
        messages: [
          { ...snapshot.messages[0], subject: "synthetic forbidden subject" },
        ],
      },
      {
        ...snapshot,
        messages: [
          {
            ...snapshot.messages[0],
            interpretation: {
              ...snapshot.messages[0].interpretation,
              waiting_on: "them",
            },
          },
        ],
      },
      {
        ...snapshot,
        messages: [
          {
            ...snapshot.messages[0],
            interpretation: {
              ...snapshot.messages[0].interpretation,
              direction: "outbound",
            },
          },
        ],
      },
    ])
      expect(ThreadSnapshotSchema.safeParse(candidate).success).toBe(false);
  });

  it("accepts the versioned persisted checkpoint and retry fixtures", async () => {
    const checkpoint = await fixture("gmail-reconciliation/checkpoint-v1.json");
    const retry = await fixture("gmail-reconciliation/studio-retry-v1.json");
    expect(GmailCheckpointSchema.parse(checkpoint)).toEqual(checkpoint);
    expect(GmailStudioRetrySchema.parse(retry)).toEqual(retry);
  });

  it("rejects checkpoint scope expansion, oversized pages, invalid window and unknown fields", async () => {
    const checkpoint = GmailCheckpointSchema.parse(
      await fixture("gmail-reconciliation/checkpoint-v1.json"),
    );
    for (const candidate of [
      { ...checkpoint, schema_version: "2.0" },
      { ...checkpoint, mailbox: "other@example.com" },
      { ...checkpoint, subject: "private" },
      { ...checkpoint, window: null },
      {
        ...checkpoint,
        window: { ...checkpoint.window, from: "2026-08-01T12:00:00Z" },
      },
      {
        ...checkpoint,
        pending: {
          ...checkpoint.pending,
          messageIds: Array.from({ length: 101 }, (_, i) => `id-${i}`),
        },
      },
    ])
      expect(GmailCheckpointSchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects unbounded retries, unknown versions and error text in retry state", async () => {
    const retry = GmailStudioRetrySchema.parse(
      await fixture("gmail-reconciliation/studio-retry-v1.json"),
    );
    for (const candidate of [
      { ...retry, schema_version: "2.0" },
      { ...retry, retry: { ...retry.retry, attempts: 3 } },
      {
        ...retry,
        retry: { ...retry.retry, error: "synthetic private error text" },
      },
    ])
      expect(GmailStudioRetrySchema.safeParse(candidate).success).toBe(false);
  });
});
