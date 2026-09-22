import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { observeOutboundCommitment } from "../../src/apps-script/commitment-runtime.js";
import type { GmailMetadataGateway } from "../../src/apps-script/gmail-reader.js";
import type { TableGateway } from "../../src/apps-script/sheet-adapter.js";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
import {
  recordToRow,
  rowToRecord,
  type SheetTable,
} from "../../src/adapters/sheets/sheet-table.js";

const mailbox = "contact@elev8mediaky.com";
const now = "2026-09-22T18:00:00Z";
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function setup() {
  const tables = new Map<string, SheetTable>(
    WORKBOOK_MANIFEST.map((sheet) => [
      sheet.name,
      { headers: [...sheet.headers], rows: [] },
    ]),
  );
  let reads = 0;
  let commits = 0;
  const gateway: TableGateway = {
    acquire() {},
    release() {},
    read(_workbookId, sheetName) {
      reads++;
      return structuredClone(tables.get(sheetName)!);
    },
    commit(_workbookId, changes) {
      commits++;
      for (const change of changes)
        tables.set(change.sheetName, structuredClone(change.after));
    },
  };
  const message = {
    id: "outbound-message-1",
    threadId: "outbound-thread-1",
    internalDate: String(Date.parse("2026-09-21T14:00:00Z")),
    labelIds: ["SENT"],
    snippet: "PRIVATE OUTBOUND TEXT",
    payload: {
      headers: [
        { name: "From", value: mailbox },
        { name: "To", value: "Client <client@example.com>" },
      ],
      body: { data: "PRIVATE OUTBOUND BODY" },
    },
  };
  const gmail: GmailMetadataGateway = {
    getProfile: vi.fn(() => ({ emailAddress: mailbox })),
    getMessage: vi.fn(() => message),
    getThread: vi.fn(() => {
      throw new Error("requested-message-only must not read thread history");
    }),
    listMessages: vi.fn(() => ({ messages: [] })),
  };
  return {
    gateway,
    gmail,
    message,
    tables,
    reads: () => reads,
    commits: () => commits,
  };
}

const proposal = {
  promise_text: "Send the approved estimate.",
  deadline_text: "tomorrow at 5pm",
};

describe("outbound commitment observation runtime", () => {
  it("persists a bounded, exact outbound metadata observation and content-free audit atomically", async () => {
    const t = setup();
    const result = await observeOutboundCommitment({
      gateway: t.gateway,
      gmail: t.gmail,
      workbookId: "synthetic-sheet",
      requestedMessageId: t.message.id,
      proposal,
      now,
      sha256,
      authorize: () => true,
    });

    expect(result).toMatchObject({ status: "created" });
    expect(t.gmail.getThread).not.toHaveBeenCalled();
    expect(t.commits()).toBe(1);
    const commitments = t.tables.get("Commitments")!;
    expect(commitments.rows).toHaveLength(1);
    expect(
      rowToRecord(commitments.headers, commitments.rows[0]!),
    ).toMatchObject({
      schema_version: "1.1",
      source_message_id: t.message.id,
      source_thread_id: t.message.threadId,
      item_id: `cc_${sha256(`gmail:${mailbox}:${t.message.threadId}`)}`,
      observed_at: "2026-09-21T14:00:00.000Z",
      deadline_at: "2026-09-22T17:00:00-04:00",
      needs_date_review: false,
      status: "open",
    });
    expect(t.tables.get("Audit_Log")!.rows).toHaveLength(1);
    expect(JSON.stringify([...t.tables])).not.toContain("PRIVATE");
  });

  it("rejects malformed proposals before Gmail or workbook reads", async () => {
    const t = setup();
    await expect(
      observeOutboundCommitment({
        gateway: t.gateway,
        gmail: t.gmail,
        workbookId: "synthetic-sheet",
        requestedMessageId: t.message.id,
        proposal: { ...proposal, extra: "not allowed" },
        now,
        sha256,
        authorize: () => true,
      }),
    ).rejects.toThrow();
    expect(t.gmail.getProfile).not.toHaveBeenCalled();
    expect(t.reads()).toBe(0);
    expect(t.commits()).toBe(0);
  });

  it("rejects inbound, excluded, and stale metadata with zero sheet mutation", async () => {
    for (const mutate of [
      (message: ReturnType<typeof setup>["message"]) => {
        message.payload.headers[0] = {
          name: "From",
          value: "client@example.com",
        };
        message.payload.headers[1] = { name: "To", value: mailbox };
      },
      (message: ReturnType<typeof setup>["message"]) => {
        message.payload.headers[1] = {
          name: "To",
          value: `${mailbox}, client@example.com`,
        };
      },
      (message: ReturnType<typeof setup>["message"]) => {
        message.labelIds = ["SENT", "DRAFT"];
      },
      (message: ReturnType<typeof setup>["message"]) => {
        message.internalDate = String(Date.parse("2026-08-23T17:59:59Z"));
      },
    ]) {
      const t = setup();
      mutate(t.message);
      await expect(
        observeOutboundCommitment({
          gateway: t.gateway,
          gmail: t.gmail,
          workbookId: "synthetic-sheet",
          requestedMessageId: t.message.id,
          proposal,
          now,
          sha256,
          authorize: () => true,
        }),
      ).rejects.toThrow();
      expect(t.commits()).toBe(0);
      expect(t.tables.get("Commitments")!.rows).toHaveLength(0);
    }
  });

  it("rechecks authorization under the workbook lock before any workbook read or write", async () => {
    const t = setup();
    const authorize = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    await expect(
      observeOutboundCommitment({
        gateway: t.gateway,
        gmail: t.gmail,
        workbookId: "synthetic-sheet",
        requestedMessageId: t.message.id,
        proposal,
        now,
        sha256,
        authorize,
      }),
    ).resolves.toEqual({ status: "disabled" });
    expect(t.reads()).toBe(0);
    expect(t.commits()).toBe(0);

    const disabledAfterAudit = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    await expect(
      observeOutboundCommitment({
        gateway: t.gateway,
        gmail: t.gmail,
        workbookId: "synthetic-sheet",
        requestedMessageId: t.message.id,
        proposal,
        now,
        sha256,
        authorize: disabledAfterAudit,
      }),
    ).resolves.toEqual({ status: "disabled" });
    expect(t.commits()).toBe(0);
    expect(t.tables.get("Commitments")!.rows).toHaveLength(0);
  });

  it("suppresses an exact replay and preserves a repository-owned manual override", async () => {
    const t = setup();
    const request = {
      gateway: t.gateway,
      gmail: t.gmail,
      workbookId: "synthetic-sheet",
      requestedMessageId: t.message.id,
      proposal,
      now,
      sha256,
      authorize: () => true,
    } as const;
    await expect(observeOutboundCommitment(request)).resolves.toMatchObject({
      status: "created",
    });
    await expect(observeOutboundCommitment(request)).resolves.toEqual({
      status: "duplicate_suppressed",
    });
    const commitments = t.tables.get("Commitments")!;
    const original = rowToRecord(commitments.headers, commitments.rows[0]!);
    await expect(
      observeOutboundCommitment({
        ...request,
        proposal: {
          ...proposal,
          promise_text: "A later model changed its mind.",
        },
      }),
    ).resolves.toEqual({ status: "duplicate_suppressed" });
    expect(
      rowToRecord(commitments.headers, commitments.rows[0]!).promise_text,
    ).toBe(proposal.promise_text);
    commitments.rows[0] = recordToRow(commitments.headers, {
      ...original,
      manual_override: true,
      promise_text: "Human-owned promise.",
    });
    await expect(observeOutboundCommitment(request)).resolves.toEqual({
      status: "manual_override_preserved",
    });
    expect(
      rowToRecord(commitments.headers, commitments.rows[0]!).promise_text,
    ).toBe("Human-owned promise.");
    commitments.rows[0] = recordToRow(commitments.headers, {
      ...rowToRecord(commitments.headers, commitments.rows[0]!),
      status: "fulfilled",
      fulfilled_at: now,
      fulfillment_evidence_id: "manual-fulfillment-evidence",
      manual_override: false,
      resolved_by: null,
    });
    await expect(observeOutboundCommitment(request)).resolves.toEqual({
      status: "fulfilled_preserved",
    });
  });
});
