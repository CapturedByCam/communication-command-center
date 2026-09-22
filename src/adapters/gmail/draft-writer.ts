import { z } from "zod";
import { classifyDraftRisk } from "../../domain/risk.js";
import {
  CommunicationItemSchema,
  DraftRiskSchema,
} from "../../domain/schemas.js";
import type { CommunicationItem } from "../../domain/types.js";
import type { DraftRepository } from "../sheets/draft-repository.js";
import { DraftOperationSchema, type DraftOperation } from "./draft-state.js";

const identifier = z.string().min(1).max(512);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const itemIdSchema = CommunicationItemSchema.shape.item_id;

/** Supplied by authoritative reconciliation and curated registries, never directly by a model. */
export const DraftContextSchema = z
  .object({
    mailbox: z.string().email(),
    item: CommunicationItemSchema,
    sourceMessageId: identifier,
    sourceThreadId: identifier,
    sourceContentHash: digest,
    knownContact: z.boolean(),
    directResponseRequested: z.boolean(),
    modelDraftRisk: DraftRiskSchema,
    messageKind: z
      .enum([
        "receipt",
        "newsletter",
        "automated_notice",
        "spam",
        "closed_acknowledgement",
        "information_only",
      ])
      .nullable(),
    consequences: z
      .array(
        z.enum([
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
        ]),
      )
      .max(11),
    modelUncertain: z.boolean(),
    synthetic: z.boolean(),
  })
  .strict();
export type DraftContext = z.infer<typeof DraftContextSchema>;

const FlagsSchema = z
  .object({ draftingEnabled: z.boolean(), externalWritesEnabled: z.boolean() })
  .strict();
const ResponseSchema = z.discriminatedUnion("outcome", [
  z
    .object({
      outcome: z.literal("written"),
      draftId: identifier,
      threadId: identifier,
      draftRevision: identifier,
    })
    .strict(),
  z.object({ outcome: z.literal("deleted") }).strict(),
  z.object({ outcome: z.literal("conflict") }).strict(),
  z.object({ outcome: z.literal("unsupported") }).strict(),
]);

export interface DraftTarget {
  readonly mailbox: string;
  readonly threadId: string;
  readonly sourceMessageId: string;
}

/** No send operation. Conflict/unsupported MUST guarantee no external mutation.
 * Revisions must cover the entire draft, including recipients, subject, and body.
 * Compare-and-write must be atomic relative to human edits, or return unsupported.
 * A real Gmail implementation satisfying this contract has NOT been supplied.
 */
export interface DraftTransport {
  create(request: DraftTarget & { readonly body: string }): Promise<unknown>;
  replaceIfUnchanged(
    request: DraftTarget & {
      readonly draftId: string;
      readonly expectedBodyHash: string;
      readonly expectedRevision: string;
      readonly body: string;
    },
  ): Promise<unknown>;
  deleteIfUnchanged(
    request: DraftTarget & {
      readonly draftId: string;
      readonly expectedBodyHash: string;
      readonly expectedRevision: string;
    },
  ): Promise<unknown>;
}

export interface DraftWriterDependencies {
  readonly repository: DraftRepository;
  readonly transport: DraftTransport;
  readonly approvedMailbox: string;
  readonly loadContext: (itemId: string) => Promise<unknown>;
  readonly readFlags: () => Promise<unknown>;
  readonly hash: (text: string) => string;
  readonly newOperationId: () => string;
  readonly now: () => string;
}

type ErrorCode =
  | "INVALID_INPUT"
  | "INELIGIBLE"
  | "DISABLED"
  | "STATE_UNAVAILABLE"
  | "RECOVERY_REQUIRED"
  | "DRAFT_CONFLICT"
  | "TRANSPORT_UNSUPPORTED"
  | "NOT_OWNED_SYNTHETIC"
  | "NOT_FOUND";
export type DraftWriteResult =
  | {
      readonly outcome:
        "created" | "replaced" | "existing" | "stale" | "deleted";
      readonly draftId: string | null;
    }
  | {
      readonly outcome: "blocked" | "recovery_required";
      readonly code: ErrorCode;
    };
const blocked = (code: ErrorCode): DraftWriteResult => ({
  outcome: "blocked",
  code,
});
const recovery = (): DraftWriteResult => ({
  outcome: "recovery_required",
  code: "RECOVERY_REQUIRED",
});

function sameSource(
  left: CommunicationItem,
  right: CommunicationItem,
): boolean {
  return (
    left.item_id === right.item_id &&
    left.source_record_id === right.source_record_id &&
    left.source_thread_id === right.source_thread_id &&
    left.content_hash === right.content_hash &&
    left.updated_at === right.updated_at
  );
}

function recordMatches(
  record: DraftOperation,
  item: CommunicationItem,
): boolean {
  return (
    record.item_id === item.item_id &&
    record.thread_id === item.source_thread_id &&
    record.source_message_id === item.source_record_id &&
    record.source_content_hash === item.content_hash
  );
}

/** Local orchestration only. Keeps bodies transient and Gmail effects outside workbook transactions. */
export class DraftWriter {
  constructor(private readonly dependencies: DraftWriterDependencies) {}

  private async enabled(): Promise<boolean> {
    const flags = FlagsSchema.safeParse(await this.dependencies.readFlags());
    return (
      flags.success &&
      flags.data.draftingEnabled &&
      flags.data.externalWritesEnabled
    );
  }

  private async context(itemId: string): Promise<DraftContext | null> {
    const result = DraftContextSchema.safeParse(
      await this.dependencies.loadContext(itemId),
    );
    return result.success && result.data.item.item_id === itemId
      ? result.data
      : null;
  }

  private scoped(context: DraftContext): boolean {
    const approved = z
      .string()
      .email()
      .safeParse(this.dependencies.approvedMailbox);
    return (
      approved.success &&
      context.mailbox.toLowerCase() === approved.data.toLowerCase() &&
      context.item.source === "gmail"
    );
  }

  private eligible(context: DraftContext, item: CommunicationItem): boolean {
    return (
      this.scoped(context) &&
      sameSource(context.item, item) &&
      context.sourceMessageId === item.source_record_id &&
      context.sourceThreadId === item.source_thread_id &&
      context.sourceContentHash === item.content_hash &&
      context.item.status === "open" &&
      context.item.waiting_on === "me" &&
      context.item.next_action_type === "reply" &&
      context.item.draft_status === "needed" &&
      !context.item.manual_override &&
      !context.item.last_error_code &&
      context.modelDraftRisk === "routine" &&
      classifyDraftRisk(context) === "routine"
    );
  }

  async createOrReplaceRoutineDraft(
    input: unknown,
    text: unknown,
  ): Promise<DraftWriteResult> {
    const parsed = CommunicationItemSchema.safeParse(input);
    if (
      !parsed.success ||
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 12000
    )
      return blocked("INVALID_INPUT");
    const item = parsed.data;
    try {
      if (!(await this.enabled())) return blocked("DISABLED");
      const context = await this.context(item.item_id);
      if (!context || !this.eligible(context, item))
        return blocked("INELIGIBLE");
      const bodyHash = digest.parse(this.dependencies.hash(text));
      let prior: DraftOperation | null = null;
      let refusal: DraftWriteResult | null = null;
      const reserved = await this.dependencies.repository.mutate(
        item.item_id,
        (current) => {
          prior = current;
          if (
            current?.status === "pending" ||
            current?.status === "uncertain"
          ) {
            refusal = recovery();
            return null;
          }
          if (
            (current &&
              (current.mailbox !== context.mailbox.toLowerCase() ||
                current.thread_id !== item.source_thread_id)) ||
            (context.item.gmail_draft_id &&
              context.item.gmail_draft_id !== current?.draft_id)
          ) {
            refusal = blocked("INELIGIBLE");
            return null;
          }
          if (current && recordMatches(current, item)) {
            if (
              current.status === "deleted" ||
              current.stale_requested ||
              current.status === "stale"
            ) {
              refusal = blocked("INELIGIBLE");
              return null;
            }
            if (
              current.status === "generated" &&
              current.body_hash === bodyHash
            ) {
              refusal = { outcome: "existing", draftId: current.draft_id };
              return null;
            }
          }
          const replace = !!current?.draft_id && current.status !== "deleted";
          return DraftOperationSchema.parse({
            schema_version: "1.0",
            item_id: item.item_id,
            mailbox: context.mailbox.toLowerCase(),
            thread_id: item.source_thread_id,
            source_message_id: item.source_record_id,
            source_content_hash: item.content_hash,
            operation_id: this.dependencies.newOperationId(),
            operation: replace ? "replace" : "create",
            status: "pending",
            draft_id: replace ? current.draft_id : null,
            draft_revision: replace ? current.draft_revision : null,
            body_hash: bodyHash,
            expected_body_hash: replace ? current.body_hash : null,
            synthetic: context.synthetic && (!replace || current.synthetic),
            stale_requested: false,
            updated_at: this.dependencies.now(),
            error_code: null,
          });
        },
      );
      if (refusal) return refusal;
      if (!reserved) return blocked("STATE_UNAVAILABLE");
      return await this.perform(reserved, prior, item, text);
    } catch {
      return blocked("STATE_UNAVAILABLE");
    }
  }

  private async cancel(
    reserved: DraftOperation,
    prior: DraftOperation | null,
    conflict: boolean,
  ): Promise<boolean> {
    try {
      await this.dependencies.repository.mutate(reserved.item_id, (current) => {
        if (
          !current ||
          current.operation_id !== reserved.operation_id ||
          current.status !== "pending"
        )
          throw new Error("DRAFT_RESERVATION_LOST");
        const sourceAdvanced =
          prior &&
          (prior.source_message_id !== reserved.source_message_id ||
            prior.source_content_hash !== reserved.source_content_hash ||
            prior.thread_id !== reserved.thread_id);
        const stale = current.stale_requested || conflict || !!sourceAdvanced;
        return prior
          ? {
              ...prior,
              status:
                stale && prior.draft_id && prior.status !== "deleted"
                  ? "stale"
                  : prior.status,
              stale_requested: prior.stale_requested || stale,
              updated_at: this.dependencies.now(),
            }
          : {
              ...current,
              status: "cancelled",
              stale_requested: stale,
              updated_at: this.dependencies.now(),
            };
      });
      return true;
    } catch {
      return false;
    }
  }

  private async uncertain(
    reserved: DraftOperation,
    code: "WRITE_UNCERTAIN" | "FINALIZE_FAILED",
  ): Promise<DraftWriteResult> {
    try {
      await this.dependencies.repository.mutate(reserved.item_id, (current) => {
        if (
          !current ||
          current.operation_id !== reserved.operation_id ||
          current.status !== "pending"
        )
          return null;
        return {
          ...current,
          status: "uncertain",
          error_code: code,
          updated_at: this.dependencies.now(),
        };
      });
    } catch {
      /* The committed pending reservation still prevents automatic retry. */
    }
    return recovery();
  }

  private deletable(context: DraftContext, reserved: DraftOperation): boolean {
    return (
      this.scoped(context) &&
      reserved.mailbox === context.mailbox.toLowerCase() &&
      context.synthetic &&
      context.item.source_thread_id === reserved.thread_id &&
      !context.item.manual_override &&
      context.item.draft_status !== "reviewed" &&
      context.item.draft_status !== "sent"
    );
  }

  private async perform(
    reserved: DraftOperation,
    prior: DraftOperation | null,
    item: CommunicationItem,
    body?: string,
  ): Promise<DraftWriteResult> {
    // Re-read after committing the reservation; a kill switch or newer source may have arrived.
    try {
      const current = await this.context(item.item_id);
      if (
        !current ||
        !(reserved.operation === "delete"
          ? this.deletable(current, reserved)
          : this.eligible(current, item))
      ) {
        return (await this.cancel(reserved, prior, true))
          ? blocked("INELIGIBLE")
          : recovery();
      }
      if (!(await this.enabled())) {
        return (await this.cancel(reserved, prior, false))
          ? blocked("DISABLED")
          : recovery();
      }
      const state = await this.dependencies.repository.get(item.item_id);
      if (
        !state ||
        state.operation_id !== reserved.operation_id ||
        state.status !== "pending" ||
        state.stale_requested
      ) {
        return (await this.cancel(reserved, prior, false))
          ? blocked("INELIGIBLE")
          : recovery();
      }
    } catch {
      return (await this.cancel(reserved, prior, true))
        ? blocked("STATE_UNAVAILABLE")
        : recovery();
    }

    const target: DraftTarget = {
      mailbox: reserved.mailbox,
      threadId: reserved.thread_id,
      sourceMessageId: reserved.source_message_id,
    };
    let response: z.infer<typeof ResponseSchema>;
    try {
      const result =
        reserved.operation === "create"
          ? await this.dependencies.transport.create({ ...target, body: body! })
          : reserved.operation === "replace"
            ? await this.dependencies.transport.replaceIfUnchanged({
                ...target,
                draftId: reserved.draft_id!,
                expectedBodyHash: reserved.expected_body_hash!,
                expectedRevision: reserved.draft_revision!,
                body: body!,
              })
            : await this.dependencies.transport.deleteIfUnchanged({
                ...target,
                draftId: reserved.draft_id!,
                expectedBodyHash: reserved.expected_body_hash!,
                expectedRevision: reserved.draft_revision!,
              });
      response = ResponseSchema.parse(result);
      if (
        response.outcome === "conflict" ||
        response.outcome === "unsupported"
      ) {
        return (await this.cancel(
          reserved,
          prior,
          response.outcome === "conflict",
        ))
          ? blocked(
              response.outcome === "conflict"
                ? "DRAFT_CONFLICT"
                : "TRANSPORT_UNSUPPORTED",
            )
          : recovery();
      }
      if (
        reserved.operation === "delete"
          ? response.outcome !== "deleted"
          : response.outcome !== "written" ||
            response.threadId !== reserved.thread_id ||
            (reserved.operation === "replace" &&
              response.draftId !== reserved.draft_id)
      )
        return await this.uncertain(reserved, "WRITE_UNCERTAIN");
    } catch {
      return await this.uncertain(reserved, "WRITE_UNCERTAIN");
    }

    const draftId =
      response.outcome === "written" ? response.draftId : reserved.draft_id;
    let stillCurrent = reserved.operation === "delete";
    if (!stillCurrent) {
      try {
        const context = await this.context(item.item_id);
        stillCurrent = !!context && this.eligible(context, item);
      } catch {
        /* Successful draft with unknown freshness is stale, never current. */
      }
    }
    try {
      const saved = await this.dependencies.repository.mutate(
        item.item_id,
        (current) => {
          if (
            !current ||
            current.operation_id !== reserved.operation_id ||
            current.status !== "pending"
          )
            throw new Error("DRAFT_RESERVATION_LOST");
          return {
            ...current,
            draft_id: draftId,
            draft_revision:
              response.outcome === "written"
                ? response.draftRevision
                : reserved.draft_revision,
            status:
              reserved.operation === "delete"
                ? "deleted"
                : stillCurrent && !current.stale_requested
                  ? "generated"
                  : "stale",
            updated_at: this.dependencies.now(),
            error_code: null,
          };
        },
      );
      if (!saved) return await this.uncertain(reserved, "FINALIZE_FAILED");
      return {
        outcome:
          saved.status === "stale"
            ? "stale"
            : reserved.operation === "delete"
              ? "deleted"
              : reserved.operation === "create"
                ? "created"
                : "replaced",
        draftId,
      };
    } catch {
      return await this.uncertain(reserved, "FINALIZE_FAILED");
    }
  }

  async markDraftStale(itemId: unknown): Promise<DraftWriteResult> {
    const id = itemIdSchema.safeParse(itemId);
    if (!id.success) return blocked("INVALID_INPUT");
    try {
      const record = await this.dependencies.repository.mutate(
        id.data,
        (current) => {
          if (
            !current ||
            current.status === "deleted" ||
            current.status === "cancelled"
          )
            return null;
          return {
            ...current,
            status:
              current.status === "pending" || current.status === "uncertain"
                ? current.status
                : "stale",
            stale_requested: true,
            updated_at: this.dependencies.now(),
          };
        },
      );
      return record
        ? { outcome: "stale", draftId: record.draft_id }
        : blocked("NOT_FOUND");
    } catch {
      return blocked("STATE_UNAVAILABLE");
    }
  }

  async deleteSyntheticDraft(draftId: unknown): Promise<DraftWriteResult> {
    const id = identifier.safeParse(draftId);
    if (!id.success) return blocked("INVALID_INPUT");
    try {
      if (!(await this.enabled())) return blocked("DISABLED");
      const matches = (await this.dependencies.repository.list()).filter(
        (record) => record.draft_id === id.data,
      );
      if (matches.length !== 1 || !matches[0].synthetic)
        return blocked("NOT_OWNED_SYNTHETIC");
      const prior = matches[0];
      if (prior.status === "pending" || prior.status === "uncertain")
        return recovery();
      if (prior.status === "deleted")
        return { outcome: "deleted", draftId: prior.draft_id };
      const context = await this.context(prior.item_id);
      if (!context || !this.deletable(context, prior))
        return blocked("NOT_OWNED_SYNTHETIC");
      const reserved = await this.dependencies.repository.mutate(
        prior.item_id,
        (current) => {
          if (JSON.stringify(current) !== JSON.stringify(prior)) return null;
          return {
            ...prior,
            operation_id: this.dependencies.newOperationId(),
            operation: "delete",
            status: "pending",
            expected_body_hash: prior.body_hash,
            stale_requested: false,
            updated_at: this.dependencies.now(),
            error_code: null,
          };
        },
      );
      return reserved
        ? await this.perform(reserved, prior, context.item)
        : recovery();
    } catch {
      return blocked("STATE_UNAVAILABLE");
    }
  }
}
