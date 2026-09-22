import { describe, expect, it } from "vitest";
import {
  GmailMetadataReader,
  type GmailMetadataGateway,
} from "../../src/apps-script/gmail-reader.js";
import { GmailReadError } from "../../src/adapters/gmail/reconciliation.js";
import { ThreadSnapshotSchema } from "../../src/adapters/gmail/gmail-client.js";

const approvedMailbox = "contact@elev8mediaky.com";
const metadataHeaders = [
  "From",
  "To",
  "Cc",
  "Bcc",
  "Auto-Submitted",
  "Precedence",
  "List-Id",
  "X-Auto-Response-Suppress",
  "X-Receipt-Type",
];

class Gateway implements GmailMetadataGateway {
  profile = { emailAddress: approvedMailbox };
  listResult: unknown = {
    messages: [{ id: "message-1", threadId: "thread-1" }],
    nextPageToken: "page-2",
  };
  messageResult: unknown = {
    id: "message-1",
    threadId: "thread-1",
    internalDate: "1780000000000",
    labelIds: ["INBOX"],
    snippet: "PRIVATE SNIPPET MUST NOT ESCAPE",
    payload: {
      headers: [
        { name: "From", value: "Person <person@example.com>" },
        { name: "To", value: approvedMailbox },
      ],
      body: { data: "PRIVATE BODY" },
    },
  };
  threadResult: unknown = {
    id: "thread-1",
    messages: [this.messageResult],
  };
  calls: Array<{ method: string; id?: string; options?: unknown }> = [];

  getProfile(userId: string): unknown {
    this.calls.push({ method: `profile:${userId}` });
    return this.profile;
  }
  listMessages(userId: string, options: unknown): unknown {
    this.calls.push({ method: `list:${userId}`, options });
    return this.listResult;
  }
  getMessage(userId: string, id: string, options: unknown): unknown {
    this.calls.push({ method: `message:${userId}`, id, options });
    return this.messageResult;
  }
  getThread(userId: string, id: string, options: unknown): unknown {
    this.calls.push({ method: `thread:${userId}`, id, options });
    return this.threadResult;
  }
}

function setup(gateway = new Gateway()) {
  return { gateway, reader: new GmailMetadataReader(gateway) };
}

describe("Apps Script Gmail metadata reader", () => {
  it("rejects any profile outside the exact approved mailbox before listing or fetching", async () => {
    const { gateway, reader } = setup();
    gateway.profile = { emailAddress: "other@example.com" };

    await expect(reader.getThreadSnapshot("message-1")).rejects.toThrow(
      "approved Gmail scope",
    );
    expect(gateway.calls).toEqual([{ method: "profile:me" }]);
  });

  it("lists a bounded half-open time window without reading message content", async () => {
    const { gateway, reader } = setup();
    const page = await reader.listRecentMessages({
      mailbox: approvedMailbox,
      from: "2026-05-28T00:00:00.000Z",
      to: "2026-05-29T00:00:00.000Z",
      pageToken: "page-1",
      limit: 7,
      excludeAutomated: true,
      excludeBulk: true,
    });

    expect(page).toEqual({
      messageIds: ["message-1"],
      nextPageToken: "page-2",
    });
    expect(gateway.calls).toEqual([
      { method: "profile:me" },
      {
        method: "list:me",
        options: {
          q: "after:1779926400 before:1780012800 -label:spam -label:trash -category:promotions -category:forums -from:(no-reply)",
          pageToken: "page-1",
          maxResults: 7,
        },
      },
    ]);
  });

  it("enumerates bounded message and thread references with the existing eligible query", async () => {
    const { gateway, reader } = setup();

    const page = await reader.listBoundedReferences({
      mailbox: approvedMailbox,
      from: "2026-05-28T00:00:00.000Z",
      to: "2026-05-29T00:00:00.000Z",
      pageToken: "page-1",
      limit: 7,
      excludeAutomated: true,
      excludeBulk: true,
    });

    expect(page).toEqual({
      references: [{ id: "message-1", threadId: "thread-1" }],
      nextPageToken: "page-2",
    });
    expect(gateway.calls).toEqual([
      { method: "profile:me" },
      {
        method: "list:me",
        options: {
          q: "after:1779926400 before:1780012800 -label:spam -label:trash -category:promotions -category:forums -from:(no-reply)",
          pageToken: "page-1",
          maxResults: 7,
        },
      },
    ]);
  });

  it("builds an exact bounded thread snapshot using only the listed message metadata", async () => {
    const { gateway, reader } = setup();
    gateway.messageResult = {
      ...(gateway.messageResult as Record<string, unknown>),
      internalDate: "1780000000000",
    };

    const snapshot = ThreadSnapshotSchema.parse(
      await reader.getBoundedThreadSnapshot(
        [{ id: "message-1", threadId: "thread-1" }],
        {
          from: "2026-05-28T00:00:00.000Z",
          to: "2026-05-29T00:00:00.000Z",
        },
      ),
    );

    expect(snapshot.threadId).toBe("thread-1");
    expect(snapshot.messages).toHaveLength(1);
    expect(gateway.calls.map((call) => call.method)).toEqual([
      "profile:me",
      "message:me",
    ]);
  });

  it("blocks oversized, conflicting, duplicate, and out-of-window bounded evidence", async () => {
    const { gateway, reader } = setup();
    const request = {
      mailbox: approvedMailbox as typeof approvedMailbox,
      from: "2026-05-28T00:00:00.000Z",
      to: "2026-05-29T00:00:00.000Z",
      pageToken: null,
      limit: 21,
      excludeAutomated: true as const,
      excludeBulk: true as const,
    };
    await expect(reader.listBoundedReferences(request)).rejects.toThrow(
      "exceeds 20",
    );
    expect(gateway.calls).toEqual([]);

    const window = {
      from: "2026-05-28T00:00:00.000Z",
      to: "2026-05-29T00:00:00.000Z",
    };
    await expect(
      reader.getBoundedThreadSnapshot(
        [
          { id: "message-1", threadId: "thread-1" },
          { id: "message-1", threadId: "thread-1" },
        ],
        window,
      ),
    ).rejects.toThrow("unique and in one thread");

    await expect(
      reader.getBoundedThreadSnapshot(
        [{ id: "message-1", threadId: "wrong-thread" }],
        window,
      ),
    ).rejects.toThrow("conflicts with the bounded window");

    gateway.messageResult = {
      ...(gateway.messageResult as Record<string, unknown>),
      internalDate: "1779926399999",
    };
    await expect(
      reader.getBoundedThreadSnapshot(
        [{ id: "message-1", threadId: "thread-1" }],
        window,
      ),
    ).rejects.toThrow("conflicts with the bounded window");
    expect(
      gateway.calls.some((call) => call.method.startsWith("thread:")),
    ).toBe(false);
  });

  it("fetches and verifies the requested message and its thread using metadata headers only", async () => {
    const { gateway, reader } = setup();
    const snapshot = ThreadSnapshotSchema.parse(
      await reader.getThreadSnapshot("message-1"),
    );

    expect(snapshot).toEqual({
      schema_version: "1.1",
      mailbox: approvedMailbox,
      threadId: "thread-1",
      messages: [
        {
          id: "message-1",
          internalDate: 1780000000000,
          sender: "person@example.com",
          recipients: [approvedMailbox],
          labels: ["INBOX"],
          automated: false,
          bulk: false,
          receipt: false,
          interpretation: {
            kind: "ambiguous",
            category: "other",
            risk: "review_only",
            summary: "Gmail metadata requires human review.",
            confidence: 0,
          },
        },
      ],
    });
    expect(gateway.calls).toEqual([
      { method: "profile:me" },
      {
        method: "message:me",
        id: "message-1",
        options: { format: "metadata", metadataHeaders },
      },
      {
        method: "thread:me",
        id: "thread-1",
        options: { format: "metadata", metadataHeaders },
      },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("PRIVATE");
  });

  it("can form a bounded requested-message-only snapshot without reading thread history", async () => {
    const gateway = new Gateway();
    gateway.getThread = () => {
      throw new Error("bounded mode must not read a Gmail thread");
    };
    const reader = new GmailMetadataReader(gateway, {
      mode: "requested_message_only",
    });

    const snapshot = ThreadSnapshotSchema.parse(
      await reader.getThreadSnapshot("message-1"),
    );

    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]).toMatchObject({
      id: "message-1",
      interpretation: {
        kind: "ambiguous",
        category: "other",
        risk: "review_only",
        confidence: 0,
      },
    });
    expect(gateway.calls.map((call) => call.method)).toEqual([
      "profile:me",
      "message:me",
    ]);
  });

  it("rejects an oversized response, an overlong window, mismatched thread messages, duplicate IDs, and RFC-invalid headers", async () => {
    const { gateway, reader } = setup();
    gateway.listResult = {
      messages: [
        { id: "message-1", threadId: "thread-1" },
        { id: "message-2", threadId: "thread-2" },
      ],
    };
    await expect(
      reader.listRecentMessages({
        mailbox: approvedMailbox,
        from: "2026-05-28T00:00:00.000Z",
        to: "2026-05-29T00:00:00.000Z",
        pageToken: null,
        limit: 1,
        excludeAutomated: true,
        excludeBulk: true,
      }),
    ).rejects.toThrow();
    await expect(
      reader.listRecentMessages({
        mailbox: approvedMailbox,
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-06-01T00:00:00.000Z",
        pageToken: null,
        limit: 1,
        excludeAutomated: true,
        excludeBulk: true,
      }),
    ).rejects.toThrow("Invalid Gmail time window.");

    gateway.threadResult = {
      id: "thread-1",
      messages: [
        {
          ...(gateway.messageResult as Record<string, unknown>),
          threadId: "wrong-thread",
        },
      ],
    };
    await expect(reader.getThreadSnapshot("message-1")).rejects.toThrow(
      "Gmail metadata read failed.",
    );

    gateway.threadResult = {
      id: "thread-1",
      messages: [gateway.messageResult, gateway.messageResult],
    };
    await expect(reader.getThreadSnapshot("message-1")).rejects.toThrow(
      "Gmail metadata read failed.",
    );

    gateway.threadResult = {
      id: "thread-1",
      messages: [
        {
          ...(gateway.messageResult as Record<string, unknown>),
          payload: {
            headers: [
              { name: "From", value: "person@example.com" },
              { name: "To", value: approvedMailbox },
              { name: "X-Test", value: "a".repeat(999) },
            ],
          },
        },
      ],
    };
    await expect(reader.getThreadSnapshot("message-1")).rejects.toThrow();
  });

  it("sets exclusion flags from metadata headers and labels without marking messages read", async () => {
    const { gateway, reader } = setup();
    gateway.threadResult = {
      id: "thread-1",
      messages: [
        {
          id: "message-1",
          threadId: "thread-1",
          internalDate: "1780000000000",
          labelIds: ["CATEGORY_PROMOTIONS", "CATEGORY_RECEIPTS"],
          payload: {
            headers: [
              { name: "From", value: "notices@example.com" },
              { name: "To", value: approvedMailbox },
              { name: "Auto-Submitted", value: "auto-generated" },
              { name: "Precedence", value: "bulk" },
            ],
          },
        },
      ],
    };
    const snapshot = ThreadSnapshotSchema.parse(
      await reader.getThreadSnapshot("message-1"),
    );
    expect(snapshot.messages[0]).toMatchObject({
      automated: true,
      bulk: true,
      receipt: true,
    });
    expect(gateway.calls.map((call) => call.method)).toEqual([
      "profile:me",
      "message:me",
      "thread:me",
    ]);
  });

  it("maps only exact provider not-found and invalid-cursor errors, redacting all other provider details", async () => {
    const { gateway, reader } = setup();
    gateway.getMessage = () => {
      throw { code: 404, message: "PRIVATE missing message" };
    };
    await expect(reader.getThreadSnapshot("message-1")).rejects.toEqual(
      new GmailReadError("NOT_FOUND"),
    );

    gateway.listMessages = () => {
      throw { status: 400, message: "Invalid page token" };
    };
    await expect(
      reader.listRecentMessages({
        mailbox: approvedMailbox,
        from: "2026-05-28T00:00:00.000Z",
        to: "2026-05-29T00:00:00.000Z",
        pageToken: "page-1",
        limit: 1,
        excludeAutomated: true,
        excludeBulk: true,
      }),
    ).rejects.toEqual(new GmailReadError("CURSOR_EXPIRED"));

    gateway.listMessages = () => {
      throw new Error("Expired page token");
    };
    await expect(
      reader.listRecentMessages({
        mailbox: approvedMailbox,
        from: "2026-05-28T00:00:00.000Z",
        to: "2026-05-29T00:00:00.000Z",
        pageToken: "page-1",
        limit: 1,
        excludeAutomated: true,
        excludeBulk: true,
      }),
    ).rejects.toEqual(new GmailReadError("CURSOR_EXPIRED"));

    gateway.listMessages = () => {
      throw { code: 500, message: "PRIVATE provider failure" };
    };
    await expect(
      reader.listRecentMessages({
        mailbox: approvedMailbox,
        from: "2026-05-28T00:00:00.000Z",
        to: "2026-05-29T00:00:00.000Z",
        pageToken: null,
        limit: 1,
        excludeAutomated: true,
        excludeBulk: true,
      }),
    ).rejects.toThrow("Gmail metadata read failed.");
  });
});

it("accepts RFC email local-parts from requested metadata without exposing message bodies", async () => {
  const gateway = new Gateway();
  gateway.messageResult = {
    id: "message-1",
    threadId: "thread-1",
    internalDate: "1780000000000",
    labelIds: ["INBOX"],
    payload: {
      headers: [
        { name: "From", value: "Sender <sender@example.test>" },
        { name: "To", value: "forwarded=recipient@example.test" },
      ],
      body: { data: "SANITIZED-FORBIDDEN-BODY" },
    },
  };
  const snapshot = ThreadSnapshotSchema.parse(
    await new GmailMetadataReader(gateway, {
      mode: "requested_message_only",
    }).getThreadSnapshot("message-1"),
  );
  expect(snapshot.schema_version).toBe("1.1");
  expect(snapshot.messages[0]!.recipients).toEqual([
    "forwarded=recipient@example.test",
  ]);
  expect(JSON.stringify(snapshot)).not.toContain("SANITIZED-FORBIDDEN-BODY");
  expect(gateway.calls.some((call) => call.method === "thread:me")).toBe(false);
});

it.each([
  [
    '"Recipient, One" <one@example.test>, two@example.test',
    ["one@example.test", "two@example.test"],
  ],
  [
    '"comma,local"@example.test, other@example.test',
    ['"comma,local"@example.test', "other@example.test"],
  ],
])(
  "parses quoted recipient commas without splitting an address: %s",
  async (header, recipients) => {
    const gateway = new Gateway();
    gateway.messageResult = {
      id: "message-1",
      threadId: "thread-1",
      internalDate: "1780000000000",
      labelIds: ["INBOX"],
      payload: {
        headers: [
          { name: "From", value: "sender@example.test" },
          { name: "To", value: header },
        ],
      },
    };
    const snapshot = ThreadSnapshotSchema.parse(
      await new GmailMetadataReader(gateway, {
        mode: "requested_message_only",
      }).getThreadSnapshot("message-1"),
    );
    expect(snapshot.messages[0]!.recipients).toEqual(recipients);
  },
);

it.each([
  '"Unclosed, Name <one@example.test>',
  "Name <one@example.test",
  "Name one@example.test>",
  "one@example.test,,two@example.test",
])(
  "rejects malformed recipient lists without returning partial addresses: %s",
  async (header) => {
    const gateway = new Gateway();
    gateway.messageResult = {
      id: "message-1",
      threadId: "thread-1",
      internalDate: "1780000000000",
      labelIds: ["INBOX"],
      payload: {
        headers: [
          { name: "From", value: "sender@example.test" },
          { name: "To", value: header },
        ],
      },
    };
    await expect(
      new GmailMetadataReader(gateway, {
        mode: "requested_message_only",
      }).getThreadSnapshot("message-1"),
    ).rejects.toThrow("Gmail metadata read failed.");
  },
);
