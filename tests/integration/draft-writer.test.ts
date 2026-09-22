import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  DraftWriter,
  type DraftContext,
} from "../../src/adapters/gmail/draft-writer.js";
import type { DraftOperation } from "../../src/adapters/gmail/draft-state.js";
import { DraftRepository } from "../../src/adapters/sheets/draft-repository.js";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
import type {
  CellValue,
  SheetTable,
  SheetTableAdapter,
} from "../../src/adapters/sheets/sheet-table.js";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const now = "2026-09-22T15:00:00Z";
const mailbox = "pilot@example.com";

// The production transaction contract must commit the reservation before Gmail.
class Tables implements SheetTableAdapter {
  table: SheetTable = {
    headers: [...WORKBOOK_MANIFEST.find((s) => s.name === "Config")!.headers],
    rows: [],
  };
  private tail = Promise.resolve();
  inTransaction = false;
  failWrites = false;
  async runTransaction<T>(
    _id: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const before = this.tail;
    let release = () => {};
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await before;
    this.inTransaction = true;
    const snapshot = structuredClone(this.table);
    try {
      return await operation();
    } catch (error) {
      this.table = snapshot;
      throw error;
    } finally {
      this.inTransaction = false;
      release();
    }
  }
  async readTable() {
    return structuredClone(this.table);
  }
  async appendRow(_id: string, _name: string, row: readonly CellValue[]) {
    if (this.failWrites) throw new Error("private provider content");
    this.table.rows.push([...row]);
  }
  async updateRow(
    _id: string,
    _name: string,
    index: number,
    row: readonly CellValue[],
    expected: readonly CellValue[],
  ) {
    if (this.failWrites) throw new Error("private provider content");
    if (JSON.stringify(this.table.rows[index]) !== JSON.stringify(expected))
      throw new Error("concurrent");
    this.table.rows[index] = [...row];
  }
}

function setup() {
  const tables = new Tables();
  const repository = new DraftRepository(tables, "synthetic-sheet");
  const context: DraftContext = {
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
      content_hash: hash("source-1"),
      raw_content_stored: false,
    },
    sourceMessageId: "message-1",
    sourceThreadId: "thread-1",
    sourceContentHash: hash("source-1"),
    knownContact: true,
    directResponseRequested: true,
    modelDraftRisk: "routine",
    messageKind: null,
    consequences: [],
    modelUncertain: false,
    synthetic: true,
  };
  const flags = { draftingEnabled: true, externalWritesEnabled: true };
  const transport = {
    create: vi.fn(async () => {
      expect(tables.inTransaction).toBe(false);
      expect((await repository.get(context.item.item_id))?.status).toBe(
        "pending",
      );
      return {
        outcome: "written",
        draftId: "draft-1",
        threadId: "thread-1",
        draftRevision: "revision-1",
      };
    }),
    replaceIfUnchanged: vi.fn(async () => ({
      outcome: "written",
      draftId: "draft-1",
      threadId: "thread-1",
      draftRevision: "revision-1",
    })),
    deleteIfUnchanged: vi.fn(async () => ({ outcome: "deleted" })),
  };
  const loadContext = vi.fn(async () => structuredClone(context));
  const dependencies = {
    repository,
    transport,
    approvedMailbox: mailbox,
    loadContext,
    readFlags: async () => ({ ...flags }),
    hash,
    newOperationId: randomUUID,
    now: () => now,
  };
  const writer = new DraftWriter(dependencies);
  return {
    writer,
    context,
    flags,
    transport,
    repository,
    tables,
    loadContext,
    dependencies,
  };
}

describe("local Gmail draft lifecycle", () => {
  it("reserves durably before one draft-only write, then reuses it across restart", async () => {
    const s = setup();
    const item = structuredClone(s.context.item);
    expect(
      await s.writer.createOrReplaceRoutineDraft(item, "Synthetic response"),
    ).toEqual({ outcome: "created", draftId: "draft-1" });
    expect(
      await new DraftWriter(s.dependencies).createOrReplaceRoutineDraft(
        item,
        "Synthetic response",
      ),
    ).toEqual({ outcome: "existing", draftId: "draft-1" });
    expect(s.transport.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(s.tables.table)).not.toContain("Synthetic response");
    expect("send" in s.writer).toBe(false);
    expect("send" in s.transport).toBe(false);
  });

  it.each([
    "pricing",
    "negotiation",
    "complaint",
    "scope_dispute",
    "contract",
    "payment",
    "refund",
    "legal",
    "aviation_employment",
    "external_schedule_commitment",
    "sensitive_personal",
  ] as const)("refuses %s", async (risk) => {
    const s = setup();
    s.context.consequences = [risk];
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Synthetic text",
        )
      ).outcome,
    ).toBe("blocked");
    expect(s.transport.create).not.toHaveBeenCalled();
    expect(await s.repository.list()).toEqual([]);
  });

  it.each([
    (s: ReturnType<typeof setup>) => {
      s.context.knownContact = false;
    },
    (s: ReturnType<typeof setup>) => {
      s.context.directResponseRequested = false;
    },
    (s: ReturnType<typeof setup>) => {
      s.context.modelUncertain = true;
    },
    (s: ReturnType<typeof setup>) => {
      s.context.modelDraftRisk = "review_only";
    },
    (s: ReturnType<typeof setup>) => {
      s.context.messageKind = "receipt";
    },
    (s: ReturnType<typeof setup>) => {
      s.context.item.manual_override = true;
    },
    (s: ReturnType<typeof setup>) => {
      s.context.item.status = "resolved";
    },
    (s: ReturnType<typeof setup>) => {
      s.context.item.waiting_on = "them";
    },
    (s: ReturnType<typeof setup>) => {
      s.context.item.draft_status = "reviewed";
    },
    (s: ReturnType<typeof setup>) => {
      s.context.item.source = "manual";
    },
    (s: ReturnType<typeof setup>) => {
      s.context.mailbox = "different@example.com";
    },
    (s: ReturnType<typeof setup>) => {
      s.context.sourceMessageId = "newer-message";
    },
    (s: ReturnType<typeof setup>) => {
      s.context.sourceThreadId = "wrong-thread";
    },
    (s: ReturnType<typeof setup>) => {
      s.context.sourceContentHash = hash("changed");
    },
    (s: ReturnType<typeof setup>) => {
      s.context.item.gmail_draft_id = "unowned-draft";
    },
  ])(
    "fails closed for ineligible or conflicting current context %#",
    async (change) => {
      const s = setup();
      change(s);
      expect(
        (
          await s.writer.createOrReplaceRoutineDraft(
            s.context.item,
            "Synthetic text",
          )
        ).outcome,
      ).toBe("blocked");
      expect(s.transport.create).not.toHaveBeenCalled();
    },
  );

  it.each(["draftingEnabled", "externalWritesEnabled"] as const)(
    "honors the %s switch independently",
    async (flag) => {
      const s = setup();
      s.flags[flag] = false;
      expect(
        (
          await s.writer.createOrReplaceRoutineDraft(
            s.context.item,
            "Synthetic text",
          )
        ).outcome,
      ).toBe("blocked");
      expect(s.loadContext).not.toHaveBeenCalled();
      expect(s.transport.create).not.toHaveBeenCalled();
    },
  );

  it("rechecks source and switches after reservation", async () => {
    const s = setup();
    s.loadContext.mockImplementation(async () => {
      if (s.loadContext.mock.calls.length === 2)
        s.flags.draftingEnabled = false;
      return structuredClone(s.context);
    });
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Synthetic text",
        )
      ).outcome,
    ).toBe("blocked");
    expect(s.transport.create).not.toHaveBeenCalled();
    expect((await s.repository.get(s.context.item.item_id))?.status).toBe(
      "cancelled",
    );
  });

  it("serializes concurrent attempts into one external write", async () => {
    const s = setup();
    await Promise.all([
      s.writer.createOrReplaceRoutineDraft(s.context.item, "Synthetic text"),
      s.writer.createOrReplaceRoutineDraft(s.context.item, "Synthetic text"),
    ]);
    expect(s.transport.create).toHaveBeenCalledTimes(1);
  });

  it("does not write when reservation persistence fails", async () => {
    const s = setup();
    s.tables.failWrites = true;
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Synthetic text",
        )
      ).outcome,
    ).toBe("blocked");
    expect(s.transport.create).not.toHaveBeenCalled();
  });

  it("never retries uncertain provider writes and returns no provider content", async () => {
    const s = setup();
    s.transport.create.mockRejectedValue(new Error("private provider content"));
    const first = await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "Synthetic text",
    );
    expect(first.outcome).toBe("recovery_required");
    expect(JSON.stringify(first)).not.toContain("private");
    expect((await s.repository.get(s.context.item.item_id))?.status).toBe(
      "uncertain",
    );
    expect(
      (
        await new DraftWriter(s.dependencies).createOrReplaceRoutineDraft(
          s.context.item,
          "Synthetic text",
        )
      ).outcome,
    ).toBe("recovery_required");
    expect(s.transport.create).toHaveBeenCalledTimes(1);
  });

  it("leaves a blocking reservation if success cannot be finalized", async () => {
    const s = setup();
    s.transport.create.mockImplementation(async () => {
      s.tables.failWrites = true;
      return {
        outcome: "written",
        draftId: "draft-1",
        threadId: "thread-1",
        draftRevision: "revision-1",
      };
    });
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Synthetic text",
        )
      ).outcome,
    ).toBe("recovery_required");
    expect((await s.repository.get(s.context.item.item_id))?.status).toBe(
      "pending",
    );
    s.tables.failWrites = false;
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Synthetic text",
        )
      ).outcome,
    ).toBe("recovery_required");
    expect(s.transport.create).toHaveBeenCalledTimes(1);
  });

  it("quarantines an unexpected returned thread instead of accepting the draft", async () => {
    const s = setup();
    s.transport.create.mockResolvedValue({
      outcome: "written",
      draftId: "draft-1",
      threadId: "wrong",
      draftRevision: "revision-1",
    });
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Synthetic text",
        )
      ).outcome,
    ).toBe("recovery_required");
  });

  it("marks a draft stale if the source advances while creation is in flight", async () => {
    const s = setup();
    s.transport.create.mockImplementation(async () => {
      s.context.sourceMessageId = "message-2";
      return {
        outcome: "written",
        draftId: "draft-1",
        threadId: "thread-1",
        draftRevision: "revision-1",
      };
    });
    expect(
      await s.writer.createOrReplaceRoutineDraft(
        s.context.item,
        "Synthetic text",
      ),
    ).toEqual({ outcome: "stale", draftId: "draft-1" });
    expect((await s.repository.get(s.context.item.item_id))?.status).toBe(
      "stale",
    );
  });

  it("preserves a stale request made during an in-flight write", async () => {
    const s = setup();
    s.transport.create.mockImplementation(async () => {
      await s.writer.markDraftStale(s.context.item.item_id);
      return {
        outcome: "written",
        draftId: "draft-1",
        threadId: "thread-1",
        draftRevision: "revision-1",
      };
    });
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Synthetic text",
        )
      ).outcome,
    ).toBe("stale");
  });

  it("only replaces through a compare-and-write transport", async () => {
    const s = setup();
    await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "First synthetic text",
    );
    expect(
      await s.writer.createOrReplaceRoutineDraft(
        s.context.item,
        "Updated synthetic text",
      ),
    ).toEqual({ outcome: "replaced", draftId: "draft-1" });
    expect(s.transport.replaceIfUnchanged).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: "draft-1",
        expectedBodyHash: hash("First synthetic text"),
        body: "Updated synthetic text",
      }),
    );
  });

  it("preserves a human-edited draft on transport conflict", async () => {
    const s = setup();
    await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "First synthetic text",
    );
    s.transport.replaceIfUnchanged.mockResolvedValue({
      outcome: "conflict",
    } as never);
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Updated text",
        )
      ).outcome,
    ).toBe("blocked");
    const saved = await s.repository.get(s.context.item.item_id);
    expect(saved?.status).toBe("stale");
    expect(saved?.body_hash).toBe(hash("First synthetic text"));
    expect(s.transport.deleteIfUnchanged).not.toHaveBeenCalled();
  });

  it("protects recipient or subject edits using a full-draft revision", async () => {
    const s = setup();
    await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "First synthetic text",
    );
    // The transport observes a human header edit, even though the body did not change.
    s.transport.replaceIfUnchanged.mockResolvedValue({
      outcome: "conflict",
    } as never);
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Updated text",
        )
      ).outcome,
    ).toBe("blocked");
    expect(s.transport.replaceIfUnchanged).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: "revision-1" }),
    );
  });

  it("marks the old draft stale when replacement is cancelled by a newer source", async () => {
    const s = setup();
    await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "First synthetic text",
    );
    s.context.item.source_record_id = "message-2";
    s.context.item.content_hash = hash("source-2");
    s.context.sourceMessageId = "message-2";
    s.context.sourceContentHash = hash("source-2");
    s.loadContext.mockClear();
    s.loadContext.mockImplementation(async () => {
      if (s.loadContext.mock.calls.length === 2)
        s.context.sourceMessageId = "message-3";
      return structuredClone(s.context);
    });
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Second response",
        )
      ).outcome,
    ).toBe("blocked");
    expect(s.transport.replaceIfUnchanged).not.toHaveBeenCalled();
    expect((await s.repository.get(s.context.item.item_id))?.status).toBe(
      "stale",
    );
  });

  it("does not synthesize delete-and-create when replacement is unsupported", async () => {
    const s = setup();
    await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "First synthetic text",
    );
    s.transport.replaceIfUnchanged.mockResolvedValue({
      outcome: "unsupported",
    } as never);
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Updated text",
        )
      ).outcome,
    ).toBe("blocked");
    expect(s.transport.create).toHaveBeenCalledTimes(1);
    expect(s.transport.deleteIfUnchanged).not.toHaveBeenCalled();
    expect((await s.repository.get(s.context.item.item_id))?.body_hash).toBe(
      hash("First synthetic text"),
    );
  });

  it("deletes only a ledger-owned synthetic unchanged draft and keeps a tombstone", async () => {
    const s = setup();
    await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "Synthetic text",
    );
    expect(await s.writer.deleteSyntheticDraft("draft-1")).toEqual({
      outcome: "deleted",
      draftId: "draft-1",
    });
    expect((await s.repository.get(s.context.item.item_id))?.status).toBe(
      "deleted",
    );
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Synthetic text",
        )
      ).outcome,
    ).toBe("blocked");
    expect(s.transport.create).toHaveBeenCalledTimes(1);
    expect(
      (await s.writer.deleteSyntheticDraft("arbitrary-draft")).outcome,
    ).toBe("blocked");
    expect(s.transport.deleteIfUnchanged).toHaveBeenCalledTimes(1);
  });

  it("refuses synthetic cleanup for an actual-message record", async () => {
    const s = setup();
    s.context.synthetic = false;
    await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "Synthetic fixture pretending to be actual",
    );
    expect((await s.writer.deleteSyntheticDraft("draft-1")).outcome).toBe(
      "blocked",
    );
    expect(s.transport.deleteIfUnchanged).not.toHaveBeenCalled();
  });

  it("preserves a deleted tombstone when a new-source create is cancelled", async () => {
    const s = setup();
    await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "First synthetic text",
    );
    await s.writer.deleteSyntheticDraft("draft-1");
    s.context.item.source_record_id = s.context.sourceMessageId = "message-2";
    s.context.item.content_hash = s.context.sourceContentHash =
      hash("source-2");
    s.loadContext.mockClear();
    s.loadContext.mockImplementation(async () => {
      if (s.loadContext.mock.calls.length === 2)
        s.flags.draftingEnabled = false;
      return structuredClone(s.context);
    });
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Second synthetic text",
        )
      ).outcome,
    ).toBe("blocked");
    expect((await s.repository.get(s.context.item.item_id))?.status).toBe(
      "deleted",
    );
    s.flags.draftingEnabled = true;
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Second synthetic text",
        )
      ).outcome,
    ).toBe("created");
    expect(s.transport.create).toHaveBeenCalledTimes(2);
    expect(s.transport.replaceIfUnchanged).not.toHaveBeenCalled();
  });

  it("refuses cleanup of a ledger record owned by another mailbox", async () => {
    const s = setup();
    await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "Synthetic text",
    );
    await s.repository.mutate(s.context.item.item_id, (record) => ({
      ...record!,
      mailbox: "different@example.com",
    }));
    expect((await s.writer.deleteSyntheticDraft("draft-1")).outcome).toBe(
      "blocked",
    );
    expect(s.transport.deleteIfUnchanged).not.toHaveBeenCalled();
  });

  it("cancels without writing if the source advances after reservation", async () => {
    const s = setup();
    s.loadContext.mockImplementation(async () => {
      if (s.loadContext.mock.calls.length === 2)
        s.context.sourceMessageId = "new-message";
      return structuredClone(s.context);
    });
    expect(
      (
        await s.writer.createOrReplaceRoutineDraft(
          s.context.item,
          "Synthetic text",
        )
      ).outcome,
    ).toBe("blocked");
    expect(s.transport.create).not.toHaveBeenCalled();
    expect((await s.repository.get(s.context.item.item_id))?.status).toBe(
      "cancelled",
    );
  });

  it("keeps a failed synthetic deletion uncertain and refuses automatic retry", async () => {
    const s = setup();
    await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "Synthetic text",
    );
    s.transport.deleteIfUnchanged.mockRejectedValue(
      new Error("private content"),
    );
    expect((await s.writer.deleteSyntheticDraft("draft-1")).outcome).toBe(
      "recovery_required",
    );
    expect((await s.writer.deleteSyntheticDraft("draft-1")).outcome).toBe(
      "recovery_required",
    );
    expect(s.transport.deleteIfUnchanged).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed context without leaking source content", async () => {
    const s = setup();
    s.loadContext.mockResolvedValue({
      ...s.context,
      body: "private source",
    } as never);
    const result = await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "Synthetic text",
    );
    expect(result.outcome).toBe("blocked");
    expect(JSON.stringify(result)).not.toContain("private source");
    expect(s.transport.create).not.toHaveBeenCalled();
  });

  it("does not let stale marking remove uncertainty or enable retries", async () => {
    const s = setup();
    s.transport.create.mockRejectedValue(new Error("private"));
    await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "Synthetic text",
    );
    await s.writer.markDraftStale(s.context.item.item_id);
    const record: DraftOperation | null = await s.repository.get(
      s.context.item.item_id,
    );
    expect(record?.status).toBe("uncertain");
    expect(record?.stale_requested).toBe(true);
    await s.writer.createOrReplaceRoutineDraft(
      s.context.item,
      "Synthetic text",
    );
    expect(s.transport.create).toHaveBeenCalledTimes(1);
  });

  it.each(["", " ", "x".repeat(12001), null, { body: "raw" }])(
    "rejects invalid draft text %#",
    async (text) => {
      const s = setup();
      expect(
        (await s.writer.createOrReplaceRoutineDraft(s.context.item, text))
          .outcome,
      ).toBe("blocked");
      expect(s.transport.create).not.toHaveBeenCalled();
    },
  );
});
