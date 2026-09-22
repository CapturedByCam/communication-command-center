import { afterEach, describe, expect, it, vi } from "vitest";
import { createNativeDraftBinding } from "../../src/apps-script/draft-create-native.js";

const owner = "contact@elev8mediaky.com";
const book = "book_abcdefghijklmnopqrstuv";
const target = {
  mailbox: owner,
  threadId: "thread-one",
  sourceMessageId: "message-one",
  body: "Thanks for the update. Café.",
};

function services(enabled: boolean, email = owner) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-22T15:30:00Z"));
  const properties: Record<string, string> = {
    CCC_WORKBOOK_ID: book,
    CCC_DRAFT_CREATION: String(enabled),
    CCC_DRAFT_REPLACEMENT: "false",
  };
  const getProfile = vi.fn(() => ({ emailAddress: owner }));
  const getMessage = vi.fn(() => ({
    id: target.sourceMessageId,
    threadId: target.threadId,
    internalDate: String(Date.parse("2026-09-22T14:30:00Z")),
    labelIds: ["INBOX"],
    payload: {
      headers: [
        { name: "From", value: "Known Person <known@example.com>" },
        { name: "To", value: owner },
        { name: "Subject", value: "Status update" },
        { name: "Message-ID", value: "<request-1@example.com>" },
        { name: "References", value: "<earlier@example.com>" },
      ],
    },
  }));
  const create = vi.fn(() => ({
    id: "draft-one",
    message: { id: "draft-message-one", threadId: target.threadId },
  }));
  const update = vi.fn(),
    remove = vi.fn(),
    send = vi.fn();
  vi.stubGlobal("Session", {
    getEffectiveUser: () => ({ getEmail: () => email }),
  });
  vi.stubGlobal("PropertiesService", {
    getScriptProperties: () => ({
      getProperty: (key: string) => properties[key] ?? null,
    }),
  });
  vi.stubGlobal("Gmail", {
    Users: {
      getProfile,
      Messages: { get: getMessage, send },
      Drafts: { create, update, remove, send },
    },
  });
  vi.stubGlobal("Utilities", {
    Charset: { UTF_8: "UTF_8" },
    base64EncodeWebSafe: (value: string, charset: string) => {
      expect(charset).toBe("UTF_8");
      return Buffer.from(value, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
    },
  });
  return { properties, getProfile, getMessage, create, update, remove, send };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("unbound native draft creation binding", () => {
  it.each([false, true])(
    "blocks unauthorized or disabled creation before reads (%s)",
    async (enabled) => {
      const fake = services(enabled, enabled ? "other@example.com" : owner);
      const load = vi.fn(async () => null);
      const binding = createNativeDraftBinding(book, load);
      expect(await binding.readFlags()).toEqual({
        draftingEnabled: false,
        externalWritesEnabled: false,
      });
      expect(await binding.loadContext("cc_abcdefghijkl")).toBeNull();
      expect(await binding.transport.create(target)).toEqual({
        outcome: "unsupported",
      });
      expect(load).not.toHaveBeenCalled();
      expect(fake.getProfile).not.toHaveBeenCalled();
      expect(fake.getMessage).not.toHaveBeenCalled();
      expect(fake.create).not.toHaveBeenCalled();
    },
  );

  it("binds metadata-only reads and creates one UTF-8 unsent draft", async () => {
    const fake = services(true);
    const binding = createNativeDraftBinding(book, async () => null);
    expect(await binding.readFlags()).toEqual({
      draftingEnabled: true,
      externalWritesEnabled: true,
    });
    expect(await binding.transport.create(target)).toMatchObject({
      outcome: "written",
      draftId: "draft-one",
      threadId: target.threadId,
    });
    expect(fake.getMessage).toHaveBeenCalledWith(
      "me",
      target.sourceMessageId,
      expect.objectContaining({
        format: "metadata",
        fields: "id,threadId,internalDate,labelIds,payload/headers",
      }),
    );
    const [request, user] = fake.create.mock.calls[0] as unknown as [
      { message: { raw: string; threadId: string } },
      string,
    ];
    expect(user).toBe("me");
    expect(request.message.threadId).toBe(target.threadId);
    expect(request.message.raw).toMatch(/^[A-Za-z0-9_-]+={0,2}$/);
    const mime = Buffer.from(request.message.raw, "base64url").toString("utf8");
    expect(mime).toContain("In-Reply-To: <request-1@example.com>");
    expect(mime).toContain("To: known@example.com");
    expect(mime).toContain("Content-Transfer-Encoding: base64");
    const encodedBody = mime.split("\r\n\r\n")[1];
    expect(
      Buffer.from(encodedBody.replace(/\r\n/g, ""), "base64").toString("utf8"),
    ).toBe(target.body);
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.remove).not.toHaveBeenCalled();
    expect(fake.send).not.toHaveBeenCalled();
  });

  it("rejects a changed workbook binding before any source read", async () => {
    const fake = services(true);
    const binding = createNativeDraftBinding(book, async () => null);
    fake.properties.CCC_WORKBOOK_ID = "book_changedabcdefghijklmnop";
    expect(await binding.transport.create(target)).toEqual({
      outcome: "unsupported",
    });
    expect(fake.getProfile).not.toHaveBeenCalled();
    expect(fake.create).not.toHaveBeenCalled();
  });

  it("rechecks workbook binding after metadata and never updates or deletes", async () => {
    const fake = services(true);
    const source = fake.getMessage.getMockImplementation()!;
    fake.getMessage.mockImplementation(() => {
      const value = source();
      fake.properties.CCC_WORKBOOK_ID = "book_changedabcdefghijklmnop";
      return value;
    });
    const binding = createNativeDraftBinding(book, async () => null);
    expect(await binding.transport.create(target)).toEqual({
      outcome: "unsupported",
    });
    expect(
      await binding.transport.replaceIfUnchanged({
        ...target,
        draftId: "d",
        expectedBodyHash: "a".repeat(64),
        expectedRevision: "r",
      }),
    ).toEqual({ outcome: "unsupported" });
    expect(
      await binding.transport.deleteIfUnchanged({
        ...target,
        draftId: "d",
        expectedBodyHash: "a".repeat(64),
        expectedRevision: "r",
      }),
    ).toEqual({ outcome: "unsupported" });
    expect(fake.create).not.toHaveBeenCalled();
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.remove).not.toHaveBeenCalled();
    expect(fake.send).not.toHaveBeenCalled();
  });
});
