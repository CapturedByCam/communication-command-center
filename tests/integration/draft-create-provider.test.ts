import { describe, expect, it, vi } from "vitest";
import {
  NativeGmailCreateOnlyTransport,
  createNativeDraftContextGuard,
  type GmailDraftCreateGateway,
} from "../../src/apps-script/draft-create-provider.js";
import type { DraftContext } from "../../src/adapters/gmail/draft-writer.js";

const mailbox = "contact@elev8mediaky.com";
const now = "2026-09-22T15:00:00.000Z";
const sourceDate = Date.parse(now) - 60_000;

class Gateway implements GmailDraftCreateGateway {
  profile: unknown = { emailAddress: mailbox };
  message: unknown = {
    id: "message-1",
    threadId: "thread-1",
    internalDate: String(sourceDate),
    labelIds: ["INBOX"],
    payload: {
      headers: [
        { name: "From", value: "Sender <sender@example.com>" },
        { name: "To", value: mailbox },
        { name: "Subject", value: "Synthetic request" },
        { name: "Message-ID", value: "<message-1@example.com>" },
        { name: "References", value: "<earlier@example.com>" },
      ],
    },
  };
  createResponse: unknown = {
    id: "draft-1",
    message: { id: "created-message-1", threadId: "thread-1" },
  };
  calls: string[] = [];
  raw = "";

  getProfile(_userId: "me"): unknown {
    void _userId;
    this.calls.push("profile");
    return this.profile;
  }
  getMessage(_userId: "me", _id: string, _options: unknown): unknown {
    void _userId;
    void _id;
    void _options;
    this.calls.push("message");
    return this.message;
  }
  createDraft(
    _userId: "me",
    request: { message: { threadId: string; raw: string } },
  ): unknown {
    this.calls.push("create");
    this.raw = request.message.raw;
    return this.createResponse;
  }
}

function context(): DraftContext {
  return {
    mailbox,
    item: {
      schema_version: "1.0",
      item_id: "cc_synthetic001",
      source: "gmail",
      source_record_id: "message-1",
      source_thread_id: "thread-1",
      captured_at: now,
      updated_at: now,
      category: "active_project",
      status: "open",
      waiting_on: "me",
      urgency: "today",
      priority_score: 70,
      next_action_type: "reply",
      next_action: "Reply to synthetic request",
      summary: "Synthetic request",
      draft_status: "needed",
      confidence: 1,
      classifier_version: "fixture-v1",
      content_hash: "a".repeat(64),
      raw_content_stored: false,
    },
    sourceMessageId: "message-1",
    sourceThreadId: "thread-1",
    sourceContentHash: "a".repeat(64),
    knownContact: true,
    directResponseRequested: true,
    modelDraftRisk: "routine",
    messageKind: null,
    consequences: [],
    modelUncertain: false,
    synthetic: true,
  };
}

function setup() {
  const gateway = new Gateway();
  const authorizeCreate = vi.fn(() => true);
  let clock = now;
  const dependencies = {
    gateway,
    authorizeCreate,
    now: () => clock,
    encodeBase64UrlUtf8: (value: string) =>
      Buffer.from(value, "utf8").toString("base64url"),
  };
  return {
    gateway,
    authorizeCreate,
    setClock: (value: string) => {
      clock = value;
    },
    transport: new NativeGmailCreateOnlyTransport(dependencies),
    guard: (loadContext: (itemId: string) => Promise<unknown>) =>
      createNativeDraftContextGuard({ ...dependencies, loadContext }),
  };
}

const request = {
  mailbox,
  threadId: "thread-1",
  sourceMessageId: "message-1",
  body: "Synthetic response\nwith a second line.",
};

describe("native Gmail create-only draft provider", () => {
  it("performs zero source reads when creation authorization is absent", async () => {
    const s = setup();
    s.authorizeCreate.mockReturnValue(false);
    const loadContext = vi.fn(async () => context());

    await expect(s.guard(loadContext)("cc_synthetic001")).resolves.toBeNull();
    await expect(s.transport.create(request)).resolves.toEqual({
      outcome: "unsupported",
    });
    expect(loadContext).not.toHaveBeenCalled();
    expect(s.gateway.calls).toEqual([]);
  });

  it("guards an authoritative context only after exact profile, source, thread, inbound owner and age validation", async () => {
    const s = setup();
    const loadContext = vi.fn(async () => context());

    await expect(s.guard(loadContext)("cc_synthetic001")).resolves.toEqual(
      context(),
    );
    expect(s.gateway.calls).toEqual(["profile", "message"]);

    s.gateway.message = {
      ...(s.gateway.message as Record<string, unknown>),
      payload: {
        headers: [
          { name: "From", value: "sender@example.com" },
          { name: "To", value: "other@example.com" },
          { name: "Subject", value: "x" },
          { name: "Message-ID", value: "<x@example.com>" },
        ],
      },
    };
    await expect(s.guard(loadContext)("cc_synthetic001")).resolves.toBeNull();
  });

  it("accepts the inclusive 30-day lower bound and rejects the exclusive current-time bound", async () => {
    const s = setup();
    s.gateway.message = {
      ...(s.gateway.message as Record<string, unknown>),
      internalDate: String(Date.parse(now) - 30 * 24 * 60 * 60 * 1000),
    };
    await expect(s.transport.create(request)).resolves.toMatchObject({
      outcome: "written",
    });

    const upper = setup();
    upper.gateway.message = {
      ...(upper.gateway.message as Record<string, unknown>),
      internalDate: String(Date.parse(now)),
    };
    await expect(upper.transport.create(request)).resolves.toEqual({
      outcome: "unsupported",
    });
    expect(upper.gateway.calls).toEqual(["profile", "message"]);
  });

  it("rechecks authorization and source age immediately before the only provider write", async () => {
    const s = setup();
    s.gateway.getMessage = () => {
      s.setClock("2026-10-23T15:00:00.000Z");
      s.gateway.calls.push("message");
      return s.gateway.message;
    };
    await expect(s.transport.create(request)).resolves.toEqual({
      outcome: "unsupported",
    });
    expect(s.gateway.calls).toEqual(["profile", "message"]);

    const disabledAfterRead = setup();
    disabledAfterRead.gateway.getMessage = () => {
      disabledAfterRead.authorizeCreate.mockReturnValue(false);
      disabledAfterRead.gateway.calls.push("message");
      return disabledAfterRead.gateway.message;
    };
    await expect(disabledAfterRead.transport.create(request)).resolves.toEqual({
      outcome: "unsupported",
    });
    expect(disabledAfterRead.gateway.calls).toEqual(["profile", "message"]);
  });

  it("creates one transient UTF-8 MIME response with safe reply headers and an opaque receipt", async () => {
    const s = setup();
    await expect(s.transport.create(request)).resolves.toEqual({
      outcome: "written",
      draftId: "draft-1",
      threadId: "thread-1",
      draftRevision: "created-message-1",
    });
    expect(s.gateway.calls).toEqual(["profile", "message", "create"]);
    const mime = Buffer.from(s.gateway.raw, "base64url").toString("utf8");
    expect(mime).toContain("To: sender@example.com\r\n");
    expect(mime).toContain("Subject: Synthetic request\r\n");
    expect(mime).toContain("In-Reply-To: <message-1@example.com>\r\n");
    expect(mime).toContain(
      "References: <earlier@example.com> <message-1@example.com>\r\n",
    );
    expect(mime).toContain("Content-Transfer-Encoding: base64");
    const encodedBody = mime.split("\r\n\r\n")[1].replaceAll("\r\n", "");
    expect(Buffer.from(encodedBody, "base64").toString("utf8")).toBe(
      "Synthetic response\r\nwith a second line.",
    );
    expect(
      mime.split("\r\n").every((line) => Buffer.byteLength(line) <= 998),
    ).toBe(true);
    expect(
      JSON.stringify(await s.transport.create({ ...request, body: "second" })),
    ).not.toContain("Synthetic request");
  });

  it("wraps a long UTF-8 body into RFC-safe base64 MIME lines", async () => {
    const s = setup();
    const body = "Café ".repeat(1_500);
    await expect(
      s.transport.create({ ...request, body }),
    ).resolves.toMatchObject({
      outcome: "written",
    });
    const mime = Buffer.from(s.gateway.raw, "base64url").toString("utf8");
    expect(
      mime.split("\r\n").every((line) => Buffer.byteLength(line) <= 998),
    ).toBe(true);
    const encodedBody = mime.split("\r\n\r\n")[1].replaceAll("\r\n", "");
    expect(Buffer.from(encodedBody, "base64").toString("utf8")).toBe(body);
  });

  it("normalizes valid padded base64url encoder output and rejects malformed padding", async () => {
    const s = setup();
    const padded = (value: string) => {
      const encoded = Buffer.from(value, "utf8").toString("base64url");
      return encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
    };
    const transport = new NativeGmailCreateOnlyTransport({
      gateway: s.gateway,
      authorizeCreate: s.authorizeCreate,
      now: () => now,
      encodeBase64UrlUtf8: padded,
    });
    await expect(transport.create(request)).resolves.toMatchObject({
      outcome: "written",
    });
    expect(s.gateway.raw).toMatch(/^[A-Za-z0-9_-]+$/);

    const malformed = setup();
    const malformedTransport = new NativeGmailCreateOnlyTransport({
      gateway: malformed.gateway,
      authorizeCreate: malformed.authorizeCreate,
      now: () => now,
      encodeBase64UrlUtf8: () => "not=valid=",
    });
    await expect(malformedTransport.create(request)).resolves.toEqual({
      outcome: "unsupported",
    });
    expect(malformed.gateway.calls).toEqual(["profile", "message"]);
  });

  it("rejects unsafe labels, automated/bulk headers, malformed addresses and header injection before create", async () => {
    const cases: Array<(gateway: Gateway) => void> = [
      (g) => {
        (g.message as { labelIds: string[] }).labelIds = ["SENT"];
      },
      (g) => {
        (g.message as { payload: { headers: unknown[] } }).payload.headers.push(
          { name: "Auto-Submitted", value: "auto-generated" },
        );
      },
      (g) => {
        (g.message as { payload: { headers: unknown[] } }).payload.headers.push(
          { name: "From", value: "other@example.com" },
        );
      },
      (g) => {
        (
          g.message as {
            payload: { headers: { name: string; value: string }[] };
          }
        ).payload.headers.find((h) => h.name === "Subject")!.value =
          "ok\r\nBcc: injected@example.com";
      },
      (g) => {
        (g.message as { payload: { headers: unknown[] } }).payload.headers.push(
          {
            name: "Reply-To",
            value: "different@example.com",
          },
        );
      },
    ];
    for (const mutate of cases) {
      const s = setup();
      mutate(s.gateway);
      await expect(s.transport.create(request)).resolves.toEqual({
        outcome: "unsupported",
      });
      expect(s.gateway.calls).toEqual(["profile", "message"]);
    }
  });

  it("rejects non-ASCII or control bytes in reply message identifiers", async () => {
    for (const value of ["<é@example.com>", "<bad\u0001@example.com>"]) {
      const s = setup();
      const source = s.gateway.message as {
        payload: { headers: { name: string; value: string }[] };
      };
      source.payload.headers.find(
        (header) => header.name === "Message-ID",
      )!.value = value;
      await expect(s.transport.create(request)).resolves.toEqual({
        outcome: "unsupported",
      });
      expect(s.gateway.calls).toEqual(["profile", "message"]);
    }
  });

  it("fails closed when the authorization callback throws", async () => {
    const s = setup();
    s.authorizeCreate.mockImplementation(() => {
      throw new Error("private authorization detail");
    });
    const loader = vi.fn(async () => context());
    await expect(s.guard(loader)("cc_synthetic001")).resolves.toBeNull();
    await expect(s.transport.create(request)).resolves.toEqual({
      outcome: "unsupported",
    });
    expect(loader).not.toHaveBeenCalled();
    expect(s.gateway.calls).toEqual([]);
  });

  it("treats provider errors or a malformed create response as uncertain and never supports replace/delete", async () => {
    const s = setup();
    s.gateway.createResponse = {
      id: "draft-1",
      message: { id: "created-message-1", threadId: "wrong" },
    };
    await expect(s.transport.create(request)).rejects.toThrow(
      "GMAIL_DRAFT_CREATE_UNCERTAIN",
    );

    const providerFailure = setup();
    providerFailure.gateway.createDraft = () => {
      throw new Error("private provider detail");
    };
    await expect(providerFailure.transport.create(request)).rejects.toThrow(
      "GMAIL_DRAFT_CREATE_UNCERTAIN",
    );

    const noMutation = setup();
    await expect(
      noMutation.transport.replaceIfUnchanged({
        ...request,
        draftId: "draft-1",
        expectedBodyHash: "a".repeat(64),
        expectedRevision: "receipt",
        body: "x",
      }),
    ).resolves.toEqual({ outcome: "unsupported" });
    await expect(
      noMutation.transport.deleteIfUnchanged({
        ...request,
        draftId: "draft-1",
        expectedBodyHash: "a".repeat(64),
        expectedRevision: "receipt",
      }),
    ).resolves.toEqual({ outcome: "unsupported" });
    expect(noMutation.gateway.calls).toEqual([]);
  });
});
