import { expect, it } from "vitest";
import {
  BoundedGmailCheckpointSchema,
  BoundedReferenceShardSchema,
} from "../../src/domain/bounded-gmail-checkpoint.js";
const fixture = {
  schema_version: "2.0",
  mailbox: "contact@elev8mediaky.com",
  window: { from: "2026-08-23T12:00:00Z", to: "2026-09-22T12:00:00Z" },
  phase: "enumerating",
  pageToken: null,
  seenPageTokenHashes: [],
  shardCount: 0,
  nextThread: 0,
  completedThrough: null,
  retry: null,
  error_code: null,
};
it("accepts the versioned synthetic checkpoint and rejects unbounded or false completion claims", () => {
  expect(BoundedGmailCheckpointSchema.parse(fixture)).toEqual(fixture);
  for (const changes of [
    { schema_version: "1.0" },
    { shardCount: 101 },
    { nextThread: 2001 },
    { phase: "complete" },
    { phase: "blocked" },
    { phase: "processing" },
    { nextThread: 1 },
    { error_code: "READ_FAILED" },
    { seenPageTokenHashes: ["a".repeat(64), "a".repeat(64)] },
    { body: "unapproved" },
    { window: { ...fixture.window, from: "2026-08-22T12:00:00Z" } },
    { pageToken: "a".repeat(2049) },
  ])
    expect(
      BoundedGmailCheckpointSchema.safeParse({ ...fixture, ...changes })
        .success,
    ).toBe(false);
});
it("keeps reference shards bounded and free of source content", () => {
  const shard = {
    schema_version: "1.0",
    window_from: fixture.window.from,
    window_to: fixture.window.to,
    references: [{ id: "synthetic-message", threadId: "synthetic-thread" }],
  };
  expect(BoundedReferenceShardSchema.parse(shard)).toEqual(shard);
  expect(
    BoundedReferenceShardSchema.safeParse({
      ...shard,
      references: Array(21).fill(shard.references[0]),
    }).success,
  ).toBe(false);
  expect(
    BoundedReferenceShardSchema.safeParse({ ...shard, snippet: "private" })
      .success,
  ).toBe(false);
});
