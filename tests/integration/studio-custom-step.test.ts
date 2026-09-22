import { describe, expect, it, vi } from "vitest";
import { createStudioStep } from "../../src/apps-script/studio-step.js";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
import type { SheetTable } from "../../src/adapters/sheets/sheet-table.js";
import type {
  TableChange,
  TableGateway,
} from "../../src/apps-script/sheet-adapter.js";

const now = "2026-09-22T16:00:00.000Z";
const messageId = "gmail-message-1";
const interpretation = {
  requires_response: true,
  direct_response_requested: true,
  draft_risk: "routine",
  category_hint: "client_lead",
  project_hint: null,
  deadline_text: null,
  next_action_hint: "Reply with availability.",
  summary_hint: "A short request.",
  confidence_hint: 0.8,
  message_kind: null,
  consequences: [],
  model_uncertain: false,
};

function event(model: unknown = interpretation, id = messageId) {
  return {
    workflow: {
      actionInvocation: {
        inputs: {
          gmail_message_id: { stringValues: [id] },
          model_json: { stringValues: [JSON.stringify(model)] },
        },
      },
    },
  };
}

function metadata(
  id = messageId,
  subject = "Status request",
  receivedAt = "2026-09-21T16:00:00.000Z",
  labels = ["INBOX"],
) {
  return {
    id,
    threadId: "thread-1",
    internalDate: String(Date.parse(receivedAt)),
    labelIds: labels,
    payload: {
      headers: [
        { name: "From", value: "Known Person <known@example.com>" },
        { name: "Subject", value: subject },
      ],
    },
  };
}

function table(name: string): SheetTable {
  const definition = WORKBOOK_MANIFEST.find((item) => item.name === name)!;
  return { headers: [...definition.headers], rows: [] };
}

function runtime(
  options: {
    enabled?: boolean;
    rows?: unknown[][];
    metadata?: unknown;
    profile?: unknown;
    bound?: string;
    ownerThrows?: boolean;
    acquireThrows?: boolean;
    readThrows?: boolean;
    commitThrows?: boolean;
    releaseThrows?: boolean;
    disableOnAcquire?: boolean;
  } = {},
) {
  const studio = table("Studio_Inbox");
  const tables = new Map<string, SheetTable>([
    [
      "Studio_Inbox",
      {
        headers: studio.headers,
        rows: (options.rows ?? []).map((row) => [...row]) as SheetTable["rows"],
      },
    ],
  ]);
  let enabled = options.enabled ?? true;
  const commits: TableChange[][] = [];
  const gateway: TableGateway = {
    acquire: vi.fn(() => {
      if (options.acquireThrows) throw new Error("lock");
      if (options.disableOnAcquire) enabled = false;
    }),
    release: vi.fn(() => {
      if (options.releaseThrows) throw new Error("release");
    }),
    read: vi.fn((_id, name) => {
      if (options.readThrows) throw new Error("read");
      const source = tables.get(name)!;
      return {
        headers: [...source.headers],
        rows: source.rows.map((row) => [...row]),
      };
    }),
    commit: vi.fn((_id, changes) => {
      if (options.commitThrows) throw new Error("commit");
      commits.push(changes);
      for (const change of changes) tables.set(change.sheetName, change.after);
    }),
  };
  const getProfile = vi.fn(
    () => options.profile ?? { emailAddress: "contact@elev8mediaky.com" },
  );
  const getMessage = vi.fn(() => options.metadata ?? metadata());
  const getCuratedContacts = vi.fn(() => [
    {
      contactId: "contact-1",
      name: "Known Person",
      emails: ["known@example.com"],
      approvedAliases: [],
      active: true,
    },
  ]);
  const assertOwner = vi.fn(() => {
    if (options.ownerThrows) throw new Error("owner");
  });
  const assertBinding = vi.fn(() => options.bound ?? "book_abcdefghijklmnop");
  const step = createStudioStep({
    gateway,
    spreadsheetId: "book_abcdefghijklmnop",
    assertOwner,
    assertBinding,
    isEnabled: () => enabled,
    now: () => now,
    byteLength: (value) => new TextEncoder().encode(value).length,
    gmail: { getProfile, getMessage },
    getCuratedContacts,
  });
  return {
    step,
    tables,
    commits,
    getProfile,
    getMessage,
    getCuratedContacts,
    assertOwner,
    assertBinding,
    gateway,
  };
}

describe("Workspace Studio custom staging step", () => {
  it("returns a synchronous result and atomically stages one literal record", () => {
    const r = runtime();
    const result = r.step.execute({
      ...event(),
      userLocale: "en",
      hostApp: "flows",
    });
    expect(result).not.toHaveProperty("then");
    expect(result).toEqual({
      status: "staged",
      ingest_id: "studio:gmail:gmail-message-1",
    });
    expect(r.getMessage).toHaveBeenCalledWith("me", messageId, {
      format: "metadata",
      metadataHeaders: ["From", "Subject"],
    });
    expect(r.commits).toHaveLength(1);
    expect(r.commits[0]).toHaveLength(1);
    expect(JSON.stringify(r.tables.get("Studio_Inbox")!.rows[0])).not.toContain(
      "model_json",
    );
    expect(r.assertOwner).toHaveBeenCalledTimes(2);
    expect(r.assertBinding).toHaveBeenCalledTimes(2);
    expect(r.gateway.release).toHaveBeenCalledTimes(1);
  });

  it("fails before Gmail reads for wrong owner or workbook, and verifies profile before reading a message", () => {
    const owner = runtime({ ownerThrows: true });
    expect(owner.step.execute(event())).toEqual({ status: "rejected" });
    expect(owner.getProfile).not.toHaveBeenCalled();
    expect(owner.getMessage).not.toHaveBeenCalled();

    const workbook = runtime({ bound: "other-book" });
    expect(workbook.step.execute(event())).toEqual({ status: "rejected" });
    expect(workbook.getProfile).not.toHaveBeenCalled();
    expect(workbook.getMessage).not.toHaveBeenCalled();

    const profile = runtime({ profile: { emailAddress: "other@example.com" } });
    expect(profile.step.execute(event())).toEqual({ status: "rejected" });
    expect(profile.getProfile).toHaveBeenCalledOnce();
    expect(profile.getMessage).not.toHaveBeenCalled();
  });

  it("rechecks authorization under the lock before Contacts, table reads, or writes", () => {
    const r = runtime({ disableOnAcquire: true });
    expect(r.step.execute(event())).toEqual({ status: "disabled" });
    expect(r.getMessage).toHaveBeenCalledOnce();
    expect(r.getCuratedContacts).not.toHaveBeenCalled();
    expect(r.gateway.read).not.toHaveBeenCalled();
    expect(r.gateway.commit).not.toHaveBeenCalled();
    expect(r.gateway.release).toHaveBeenCalledOnce();
  });

  it("rejects malformed, multibyte oversized, injected raw fields, and future or invalid source dates", () => {
    const malformed = runtime();
    expect(
      malformed.step.execute({
        workflow: { actionInvocation: { inputs: {} } },
      }),
    ).toEqual({ status: "rejected" });
    expect(malformed.getMessage).not.toHaveBeenCalled();

    const oversized = runtime();
    expect(
      oversized.step.execute(
        event({ ...interpretation, ignored: "😀".repeat(3_001) }),
      ),
    ).toEqual({ status: "rejected" });
    expect(oversized.getMessage).not.toHaveBeenCalled();

    const raw = runtime({
      metadata: {
        ...metadata(),
        payload: {
          headers: metadata().payload.headers,
          body: { data: "private" },
        },
      },
    });
    expect(raw.step.execute(event())).toEqual({ status: "rejected" });
    expect(raw.gateway.commit).not.toHaveBeenCalled();

    const future = runtime({
      metadata: metadata(
        messageId,
        "Status request",
        "2026-09-22T16:00:00.001Z",
      ),
    });
    expect(future.step.execute(event())).toEqual({ status: "rejected" });
    const invalid = runtime({
      metadata: { ...metadata(), internalDate: "999999999999999999999999999" },
    });
    expect(invalid.step.execute(event())).toEqual({ status: "rejected" });
  });

  it("excludes draft, sent, spam, trash, and bulk label metadata", () => {
    for (const label of [
      "DRAFT",
      "SENT",
      "SPAM",
      "TRASH",
      "CATEGORY_PROMOTIONS",
      "CATEGORY_FORUMS",
    ]) {
      const r = runtime({
        metadata: metadata(messageId, "Status request", undefined, [label]),
      });
      expect(r.step.execute(event())).toEqual({ status: "rejected" });
      expect(r.gateway.commit).not.toHaveBeenCalled();
    }
  });

  it("accepts a quoted display comma but rejects multiple or malformed angle-address senders", () => {
    const quoted = runtime({
      metadata: {
        ...metadata(),
        payload: {
          headers: [
            { name: "From", value: '"Known, Person" <known@example.com>' },
            { name: "Subject", value: "Status request" },
          ],
        },
      },
    });
    expect(quoted.step.execute(event())).toMatchObject({ status: "staged" });
    for (const sender of [
      "Attacker <other@example.com>, Known <known@example.com>",
      "Known <known@example.com> <other@example.com>",
    ]) {
      const r = runtime({
        metadata: {
          ...metadata(),
          payload: {
            headers: [
              { name: "From", value: sender },
              { name: "Subject", value: "Status request" },
            ],
          },
        },
      });
      expect(r.step.execute(event())).toEqual({ status: "rejected" });
      expect(r.gateway.commit).not.toHaveBeenCalled();
    }
  });

  it("makes an unknown sender review-only through the curated registry", () => {
    const r = runtime();
    const unknown = createStudioStep({
      gateway: r.gateway,
      spreadsheetId: "book_abcdefghijklmnop",
      assertOwner: () => undefined,
      assertBinding: () => "book_abcdefghijklmnop",
      isEnabled: () => true,
      now: () => now,
      byteLength: (value) => new TextEncoder().encode(value).length,
      gmail: {
        getProfile: () => ({ emailAddress: "contact@elev8mediaky.com" }),
        getMessage: () => metadata(),
      },
      getCuratedContacts: () => [],
    });
    expect(unknown.execute(event())).toEqual({
      status: "staged",
      ingest_id: "studio:gmail:gmail-message-1",
    });
    expect(r.tables.get("Studio_Inbox")!.rows[0]).toContain("review_only");
  });

  it("preserves mutable reconciliation fields for an exact duplicate and rejects conflicts or multiple IDs", () => {
    const first = runtime();
    expect(first.step.execute(event())).toMatchObject({ status: "staged" });
    const stored = first.tables
      .get("Studio_Inbox")!
      .rows.map((row) => [...row]);
    const headers = first.tables.get("Studio_Inbox")!.headers;
    stored[0]![headers.indexOf("processing_status")] = "processed";
    stored[0]![headers.indexOf("processed_at")] = now;
    stored[0]![headers.indexOf("error_code")] = "RECONCILED";

    const duplicate = runtime({ rows: stored });
    expect(duplicate.step.execute(event())).toEqual({
      status: "duplicate",
      ingest_id: "studio:gmail:gmail-message-1",
    });
    expect(duplicate.gateway.commit).not.toHaveBeenCalled();
    expect(duplicate.tables.get("Studio_Inbox")!.rows[0]).toEqual(stored[0]);

    const conflict = runtime({ rows: stored });
    expect(
      conflict.step.execute(
        event({
          ...interpretation,
          summary_hint: "Different bounded summary.",
        }),
      ),
    ).toEqual({
      status: "conflict",
      ingest_id: "studio:gmail:gmail-message-1",
    });

    const multiple = runtime({ rows: [stored[0]!, stored[0]!] });
    expect(multiple.step.execute(event())).toEqual({
      status: "conflict",
      ingest_id: "studio:gmail:gmail-message-1",
    });
  });

  it("releases the lock on lock or read failure and never retries an uncertain commit", () => {
    const lock = runtime({ acquireThrows: true });
    expect(lock.step.execute(event())).toEqual({ status: "rejected" });
    expect(lock.gateway.release).not.toHaveBeenCalled();

    const read = runtime({ readThrows: true });
    expect(read.step.execute(event())).toEqual({ status: "rejected" });
    expect(read.gateway.release).toHaveBeenCalledOnce();

    const uncertain = runtime({ commitThrows: true });
    expect(uncertain.step.execute(event())).toEqual({ status: "uncertain" });
    expect(uncertain.gateway.commit).toHaveBeenCalledOnce();
    expect(uncertain.getMessage).toHaveBeenCalledOnce();

    const cleanupFailure = runtime({ releaseThrows: true });
    expect(cleanupFailure.step.execute(event())).toEqual({
      status: "uncertain",
    });
    expect(cleanupFailure.gateway.commit).toHaveBeenCalledOnce();
  });

  it("rejects header drift without committing", () => {
    const r = runtime();
    r.tables.get("Studio_Inbox")!.headers[0] = "unexpected";
    expect(r.step.execute(event())).toEqual({ status: "rejected" });
    expect(r.gateway.commit).not.toHaveBeenCalled();
  });
});
