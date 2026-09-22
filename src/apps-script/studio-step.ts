import { z } from "zod";
import {
  APPROVED_GMAIL_MAILBOX,
  SourceEmailSchema,
} from "../adapters/gmail/gmail-client.js";
import {
  prepareStudioStaging,
  StudioInterpretationSchema,
} from "../adapters/studio/prepare-staging.js";
import {
  assertHeaders,
  recordToRow,
  rowToRecord,
  type CellValue,
  type SheetTable,
} from "../adapters/sheets/sheet-table.js";
import {
  resolveContact,
  type CuratedContact,
} from "../services/context-registry.js";
import type { TableChange, TableGateway } from "./sheet-adapter.js";

const maxModelJsonBytes = 12_000;
const maxSourceAgeMilliseconds = 30 * 24 * 60 * 60 * 1000;
const ineligibleLabelIds = new Set([
  "DRAFT",
  "SENT",
  "SPAM",
  "TRASH",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_FORUMS",
]);
const immutableStagingColumns = [
  "schema_version",
  "ingest_id",
  "flow_run_id",
  "gmail_message_id",
  "received_at",
  "sender_email",
  "subject",
  "requires_response",
  "draft_risk",
  "category_hint",
  "project_hint",
  "deadline_text",
  "next_action_hint",
  "summary_hint",
  "confidence_hint",
] as const;

const ExecuteEventSchema = z
  .object({
    workflow: z
      .object({
        actionInvocation: z
          .object({
            inputs: z
              .object({
                gmail_message_id: z
                  .object({
                    stringValues: z.array(z.string().min(1).max(115)).length(1),
                  })
                  .strict(),
                model_json: z
                  .object({
                    stringValues: z.array(z.string().min(1)).length(1),
                  })
                  .strict(),
              })
              .strict(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

const MetadataSchema = z
  .object({
    id: z.string().min(1).max(115),
    threadId: z.string().min(1).max(512),
    internalDate: z.string().regex(/^\d+$/u),
    labelIds: z.array(z.string().min(1).max(128)).max(100),
    payload: z
      .object({
        headers: z
          .array(
            z
              .object({
                name: z.string().min(1).max(100),
                value: z
                  .string()
                  .max(1_000)
                  .regex(/^[^\r\n]*$/u),
              })
              .strict(),
          )
          .min(1)
          .max(100),
      })
      .strict(),
  })
  .strict();

const ProfileSchema = z
  .object({ emailAddress: z.string().email() })
  .passthrough();

export type StudioStepResult =
  | {
      readonly status: "staged" | "duplicate" | "conflict";
      readonly ingest_id: string;
    }
  | { readonly status: "disabled" | "rejected" | "uncertain" };

export interface StudioStepGmail {
  getProfile(userId: "me"): unknown;
  getMessage(
    userId: "me",
    id: string,
    options: {
      readonly format: "metadata";
      readonly metadataHeaders: readonly string[];
    },
  ): unknown;
}

export interface StudioStepDependencies {
  readonly gateway: TableGateway;
  readonly spreadsheetId: string;
  readonly assertOwner: () => void;
  readonly assertBinding: () => string;
  readonly isEnabled: () => boolean;
  readonly now: () => string;
  readonly byteLength: (value: string) => number;
  readonly gmail: StudioStepGmail;
  /** Called only after the locked authorization recheck. */
  readonly getCuratedContacts: () => readonly CuratedContact[];
}

function safeSender(value: string): string | null {
  const trimmed = value.trim();
  const bracketed =
    /^(?:(?:[^<>,\r\n"]+|"(?:[^"\\\r\n]|\\.)*")\s+)?<([^<>\s]+)>$/u.exec(
      trimmed,
    );
  const candidate =
    bracketed?.[1] ?? (/^[^<>,\s]+$/u.test(trimmed) ? trimmed : null);
  if (!candidate) return null;
  const parsed = SourceEmailSchema.safeParse(candidate.toLowerCase());
  return parsed.success ? parsed.data : null;
}

function metadataSource(
  raw: unknown,
  requestedId: string,
  now: string,
): { sender: string; subject: string; receivedAt: string } | null {
  const message = MetadataSchema.safeParse(raw);
  if (
    !message.success ||
    message.data.id !== requestedId ||
    message.data.labelIds.some((label) =>
      ineligibleLabelIds.has(label.toUpperCase()),
    )
  )
    return null;
  const receivedMilliseconds = Number(message.data.internalDate);
  const nowMilliseconds = Date.parse(now);
  if (
    !Number.isSafeInteger(receivedMilliseconds) ||
    !Number.isFinite(nowMilliseconds) ||
    receivedMilliseconds > nowMilliseconds ||
    nowMilliseconds - receivedMilliseconds > maxSourceAgeMilliseconds
  )
    return null;
  const header = new Map<string, string[]>();
  for (const item of message.data.payload.headers) {
    const key = item.name.toLowerCase();
    header.set(key, [...(header.get(key) ?? []), item.value]);
  }
  const senderValues = header.get("from") ?? [];
  const subjectValues = header.get("subject") ?? [];
  if (senderValues.length !== 1 || subjectValues.length !== 1) return null;
  const sender = safeSender(senderValues[0]!);
  const subject = subjectValues[0]!;
  if (!sender || subject.length > 500) return null;
  return {
    sender,
    subject,
    receivedAt: new Date(receivedMilliseconds).toISOString(),
  };
}

function immutableCells(
  record: Readonly<Record<string, CellValue | undefined>>,
): CellValue[] {
  return immutableStagingColumns.map((column) => record[column] ?? null);
}

function cellsEqual(
  left: readonly CellValue[],
  right: readonly CellValue[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function createStudioStep(dependencies: StudioStepDependencies) {
  function authorize(): "ok" | "disabled" | "rejected" {
    try {
      dependencies.assertOwner();
      if (!dependencies.isEnabled()) return "disabled";
      return dependencies.assertBinding() === dependencies.spreadsheetId
        ? "ok"
        : "rejected";
    } catch {
      return "rejected";
    }
  }

  function execute(event: unknown): StudioStepResult {
    const authorization = authorize();
    if (authorization !== "ok") return { status: authorization };
    const parsedEvent = ExecuteEventSchema.safeParse(event);
    if (!parsedEvent.success) return { status: "rejected" };
    const inputs = parsedEvent.data.workflow.actionInvocation.inputs;
    const messageId = inputs.gmail_message_id.stringValues[0]!;
    const modelJson = inputs.model_json.stringValues[0]!;
    if (dependencies.byteLength(modelJson) > maxModelJsonBytes)
      return { status: "rejected" };
    let model: unknown;
    try {
      model = JSON.parse(modelJson);
    } catch {
      return { status: "rejected" };
    }
    const interpretation = StudioInterpretationSchema.safeParse(model);
    if (!interpretation.success) return { status: "rejected" };

    let profile: unknown;
    try {
      profile = dependencies.gmail.getProfile("me");
    } catch {
      return { status: "rejected" };
    }
    const approvedProfile = ProfileSchema.safeParse(profile);
    if (
      !approvedProfile.success ||
      approvedProfile.data.emailAddress.toLowerCase() !== APPROVED_GMAIL_MAILBOX
    )
      return { status: "rejected" };

    let rawMetadata: unknown;
    try {
      rawMetadata = dependencies.gmail.getMessage("me", messageId, {
        format: "metadata",
        metadataHeaders: ["From", "Subject"],
      });
    } catch {
      return { status: "rejected" };
    }
    const source = metadataSource(rawMetadata, messageId, dependencies.now());
    if (!source) return { status: "rejected" };
    const validatedSource = source;

    let acquired = false;
    let commitAttempted = false;
    function runLocked(): StudioStepResult {
      const insideAuthorization = authorize();
      if (insideAuthorization !== "ok") return { status: insideAuthorization };
      const knownContact =
        resolveContact(dependencies.getCuratedContacts(), {
          email: validatedSource.sender,
        }).kind !== "unresolved";
      const prepared = prepareStudioStaging(
        {
          mailbox: APPROVED_GMAIL_MAILBOX,
          gmail_message_id: messageId,
          flow_run_id: `studio:gmail:${messageId}`,
          received_at: validatedSource.receivedAt,
          sender_email: validatedSource.sender,
          subject: validatedSource.subject,
        },
        interpretation.data,
        { approvedMailbox: APPROVED_GMAIL_MAILBOX, knownContact },
      );
      if (!prepared.ok) return { status: "rejected" };

      const before = dependencies.gateway.read(
        dependencies.spreadsheetId,
        "Studio_Inbox",
      );
      const headers = assertHeaders("Studio_Inbox", before.headers);
      const existing = before.rows
        .map((row) => rowToRecord(headers, row))
        .filter((record) => record.ingest_id === prepared.record.ingest_id);
      if (existing.length > 1)
        return { status: "conflict", ingest_id: prepared.record.ingest_id };
      if (existing.length === 1) {
        return cellsEqual(
          immutableCells(existing[0]!),
          immutableCells(prepared.record),
        )
          ? { status: "duplicate", ingest_id: prepared.record.ingest_id }
          : { status: "conflict", ingest_id: prepared.record.ingest_id };
      }
      const after: SheetTable = {
        headers: [...before.headers],
        rows: [
          ...before.rows.map((row) => [...row]),
          recordToRow(headers, prepared.record),
        ],
      };
      const changes: TableChange[] = [
        { sheetName: "Studio_Inbox", before, after },
      ];
      commitAttempted = true;
      dependencies.gateway.commit(dependencies.spreadsheetId, changes);
      return { status: "staged", ingest_id: prepared.record.ingest_id };
    }

    let result: StudioStepResult;
    try {
      dependencies.gateway.acquire();
      acquired = true;
      result = runLocked();
    } catch {
      result = { status: commitAttempted ? "uncertain" : "rejected" };
    }
    let releaseFailed = false;
    if (acquired) {
      try {
        dependencies.gateway.release();
      } catch {
        releaseFailed = true;
      }
    }
    // A completed atomic write remains uncertain when lock cleanup cannot be confirmed.
    return releaseFailed
      ? { status: commitAttempted ? "uncertain" : "rejected" }
      : result;
  }

  return { execute };
}
