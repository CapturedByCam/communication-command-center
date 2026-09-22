import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ThreadSnapshotSchema } from "../../src/adapters/gmail/gmail-client.js";
const fixture = JSON.parse(
  readFileSync(
    new URL("../fixtures/gmail-source/rfc-address-v1.1.json", import.meta.url),
    "utf8",
  ),
);
describe("Gmail source snapshot 1.1 compatibility", () => {
  it("accepts RFC source addresses only in the explicitly versioned contract", () => {
    expect(ThreadSnapshotSchema.parse(fixture)).toEqual(fixture);
    expect(
      ThreadSnapshotSchema.safeParse({ ...fixture, schema_version: "1.0" })
        .success,
    ).toBe(false);
  });
  it.each([
    "missing-at",
    "a@",
    "a b@example.test",
    "a@example.test\r\nBcc:other@example.test",
  ])("rejects malformed or injected addresses: %s", (address) => {
    const candidate = {
      ...fixture,
      messages: fixture.messages.map((message: Record<string, unknown>) => ({
        ...message,
        recipients: [address],
      })),
    };
    expect(ThreadSnapshotSchema.safeParse(candidate).success).toBe(false);
  });
  it("retains strict source fields in 1.1", () => {
    expect(
      ThreadSnapshotSchema.safeParse({ ...fixture, body: "forbidden" }).success,
    ).toBe(false);
    expect(
      ThreadSnapshotSchema.safeParse({
        ...fixture,
        messages: fixture.messages.map((message: Record<string, unknown>) => ({
          ...message,
          body: "forbidden",
        })),
      }).success,
    ).toBe(false);
  });
});
