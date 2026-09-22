import { z } from "zod";
import {
  APPROVED_GMAIL_MAILBOX,
  ThreadSnapshotSchema,
} from "../adapters/gmail/gmail-client.js";
import {
  GmailReadError,
  type GmailReconciliationReader,
} from "../adapters/gmail/reconciliation.js";

const approvedMailbox = APPROVED_GMAIL_MAILBOX;
const maxWindowMillis = 30 * 24 * 60 * 60 * 1000;
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
] as const;
const genericInterpretation = {
  kind: "ambiguous" as const,
  category: "other" as const,
  risk: "review_only" as const,
  summary: "Gmail metadata requires human review.",
  confidence: 0,
};

const IdSchema = z.string().min(1).max(512);
const EmailSchema = z.string().email().max(320);
const HeaderSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(78)
      .regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/),
    value: z
      .string()
      .max(998)
      .regex(/^[^\r\n]*$/),
  })
  .strict()
  .superRefine((header, ctx) => {
    if (header.name.length + 2 + header.value.length > 998) {
      ctx.addIssue({
        code: "custom",
        message: "Gmail header exceeds RFC line limit.",
      });
    }
  });
const MessageSchema = z
  .object({
    id: IdSchema,
    threadId: IdSchema,
    internalDate: z.union([z.string(), z.number()]),
    labelIds: z.array(z.string().min(1).max(128)).max(100).default([]),
    // Advanced Gmail may include unrelated fields despite a metadata request;
    // validate and retain only headers below.
    payload: z
      .object({ headers: z.array(HeaderSchema).max(100) })
      .passthrough(),
  })
  .passthrough();
const ThreadSchema = z
  .object({ id: IdSchema, messages: z.array(MessageSchema).min(1).max(1_000) })
  .passthrough();
const ListSchema = z
  .object({
    messages: z
      .array(z.object({ id: IdSchema, threadId: IdSchema }).strict())
      .max(100)
      .default([]),
    nextPageToken: z.string().min(1).max(2048).optional(),
  })
  .passthrough();
const ProfileSchema = z.object({ emailAddress: EmailSchema }).passthrough();
const ReadRequestSchema = z
  .object({
    mailbox: z.literal(approvedMailbox),
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    pageToken: z.string().min(1).max(2048).nullable(),
    limit: z.number().int().min(1).max(100),
    excludeAutomated: z.literal(true),
    excludeBulk: z.literal(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    const from = Date.parse(value.from);
    const to = Date.parse(value.to);
    if (from >= to || to - from > maxWindowMillis) {
      ctx.addIssue({ code: "custom", message: "Invalid Gmail time window." });
    }
  });

/** Minimal synchronous surface of Apps Script's Advanced Gmail service. */
export interface GmailMetadataGateway {
  getProfile(userId: "me"): unknown;
  listMessages(
    userId: "me",
    options: { q: string; pageToken?: string; maxResults: number },
  ): unknown;
  getMessage(
    userId: "me",
    id: string,
    options: { format: "metadata"; metadataHeaders: readonly string[] },
  ): unknown;
  getThread(
    userId: "me",
    id: string,
    options: { format: "metadata"; metadataHeaders: readonly string[] },
  ): unknown;
}

type CursorReason = "invalid_page_token" | "expired_page_token";

function safeProviderFailure(error: unknown): {
  readonly statusCode: number | null;
  readonly cursorReason: CursorReason | null;
} {
  const record =
    error instanceof Error
      ? { message: error.message }
      : error && typeof error === "object"
        ? (error as { code?: unknown; status?: unknown; message?: unknown })
        : {};
  const rawCode = record.code ?? record.status;
  const statusCode =
    typeof rawCode === "number" && Number.isInteger(rawCode) ? rawCode : null;
  const message =
    typeof record.message === "string" && record.message.length <= 80
      ? record.message
      : "";
  if (/^invalid page token$/i.test(message)) {
    return { statusCode, cursorReason: "invalid_page_token" };
  }
  if (/^expired page token$/i.test(message)) {
    return { statusCode, cursorReason: "expired_page_token" };
  }
  return { statusCode, cursorReason: null };
}

function redactedReadError(error: unknown, cursor = false): Error {
  const failure = safeProviderFailure(error);
  if (failure.statusCode === 404) return new GmailReadError("NOT_FOUND");
  if (cursor && failure.cursorReason) {
    return new GmailReadError("CURSOR_EXPIRED");
  }
  return new Error("Gmail metadata read failed.");
}

function headerMap(headers: z.infer<typeof HeaderSchema>[]) {
  const values = new Map<string, string[]>();
  for (const header of headers) {
    const name = header.name.toLowerCase();
    values.set(name, [...(values.get(name) ?? []), header.value]);
  }
  return values;
}

function parseAddress(value: string): string | null {
  const trimmed = value.trim();
  const bracketed = /<([^<>\s]+@[^<>\s]+)>$/.exec(trimmed)?.[1] ?? trimmed;
  const parsed = EmailSchema.safeParse(bracketed.toLowerCase());
  return parsed.success ? parsed.data : null;
}

function parseRecipients(values: string[]): string[] | null {
  const addresses: string[] = [];
  for (const value of values) {
    for (const part of value.split(",")) {
      const address = parseAddress(part);
      if (!address) return null;
      addresses.push(address);
    }
  }
  return [...new Set(addresses)];
}

function hasHeader(
  headers: Map<string, string[]>,
  name: string,
  pattern: RegExp,
) {
  return (headers.get(name) ?? []).some((value) => pattern.test(value));
}

function messageFromMetadata(message: z.infer<typeof MessageSchema>) {
  const headers = headerMap(message.payload.headers);
  const sender = parseAddress(headers.get("from")?.[0] ?? "");
  const recipients = parseRecipients([
    ...(headers.get("to") ?? []),
    ...(headers.get("cc") ?? []),
    ...(headers.get("bcc") ?? []),
  ]);
  const internalDate = Number(message.internalDate);
  if (
    !sender ||
    !recipients ||
    !Number.isSafeInteger(internalDate) ||
    internalDate < 0
  ) {
    throw new Error("Gmail metadata read failed.");
  }
  const labels = message.labelIds;
  const automated =
    hasHeader(headers, "auto-submitted", /^(?!no$).+/i) ||
    hasHeader(headers, "x-auto-response-suppress", /.+/i) ||
    /^no[-_.]?reply@/i.test(sender);
  const bulk =
    hasHeader(headers, "precedence", /bulk|list|junk/i) ||
    hasHeader(headers, "list-id", /.+/) ||
    labels.some((label) =>
      /^(SPAM|CATEGORY_PROMOTIONS|CATEGORY_FORUMS)$/i.test(label),
    );
  const receipt =
    hasHeader(headers, "x-receipt-type", /.+/) ||
    labels.some((label) => /^(CATEGORY_)?RECEIPTS?$/i.test(label));
  return {
    id: message.id,
    internalDate,
    sender,
    recipients,
    labels,
    automated,
    bulk,
    receipt,
    interpretation: genericInterpretation,
  };
}

/**
 * Metadata-only adapter for Advanced Gmail. It does not request snippets or
 * bodies and exposes no mutation methods, so it cannot mark messages read.
 * Gmail search suppresses queryable bulk sources; header/label classification
 * below remains the final exclusion for automated and bulk mail.
 */
export class GmailMetadataReader implements GmailReconciliationReader {
  constructor(private readonly gateway: GmailMetadataGateway) {}

  private assertApprovedProfile(): void {
    let profile: unknown;
    try {
      profile = this.gateway.getProfile("me");
    } catch (error) {
      throw redactedReadError(error);
    }
    const parsed = ProfileSchema.safeParse(profile);
    if (
      !parsed.success ||
      parsed.data.emailAddress.toLowerCase() !== approvedMailbox
    ) {
      throw new Error("Gmail profile is outside the approved Gmail scope.");
    }
  }

  async listRecentMessages(
    request: Parameters<GmailReconciliationReader["listRecentMessages"]>[0],
  ): Promise<unknown> {
    const parsed = ReadRequestSchema.parse(request);
    this.assertApprovedProfile();
    const fromSeconds = Math.floor(Date.parse(parsed.from) / 1000);
    const toSeconds = Math.floor(Date.parse(parsed.to) / 1000);
    let result: unknown;
    try {
      result = this.gateway.listMessages("me", {
        q: `after:${fromSeconds} before:${toSeconds} -label:spam -label:trash -category:promotions -category:forums -from:(no-reply)`,
        ...(parsed.pageToken ? { pageToken: parsed.pageToken } : {}),
        maxResults: parsed.limit,
      });
    } catch (error) {
      throw redactedReadError(error, true);
    }
    const page = ListSchema.parse(result);
    if (page.messages.length > parsed.limit) {
      throw new Error("Gmail metadata read failed.");
    }
    return {
      messageIds: page.messages.map((message) => message.id),
      nextPageToken: page.nextPageToken ?? null,
    };
  }

  async getThreadSnapshot(messageId: string): Promise<unknown> {
    const requestedId = IdSchema.parse(messageId);
    this.assertApprovedProfile();
    let actualMessage: unknown;
    try {
      actualMessage = this.gateway.getMessage("me", requestedId, {
        format: "metadata",
        metadataHeaders,
      });
    } catch (error) {
      throw redactedReadError(error);
    }
    const message = MessageSchema.parse(actualMessage);
    if (message.id !== requestedId)
      throw new Error("Gmail metadata read failed.");

    let actualThread: unknown;
    try {
      actualThread = this.gateway.getThread("me", message.threadId, {
        format: "metadata",
        metadataHeaders,
      });
    } catch (error) {
      throw redactedReadError(error);
    }
    const thread = ThreadSchema.parse(actualThread);
    if (
      thread.id !== message.threadId ||
      !thread.messages.some((item) => item.id === requestedId) ||
      thread.messages.some((item) => item.threadId !== thread.id) ||
      new Set(thread.messages.map((item) => item.id)).size !==
        thread.messages.length
    ) {
      throw new Error("Gmail metadata read failed.");
    }
    return ThreadSnapshotSchema.parse({
      schema_version: "1.0",
      mailbox: approvedMailbox,
      threadId: thread.id,
      messages: thread.messages.map(messageFromMetadata),
    });
  }
}
