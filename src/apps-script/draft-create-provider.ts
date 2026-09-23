import { z } from "zod";
import {
  APPROVED_GMAIL_MAILBOX,
  SourceEmailSchema,
} from "../adapters/gmail/gmail-client.js";
import {
  DraftContextSchema,
  type DraftCreateRequest,
  type DraftTarget,
  type DraftTransport,
} from "../adapters/gmail/draft-writer.js";

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_BODY_LENGTH = 12_000;
const MAX_HEADER_LINE_LENGTH = 998;
const MAX_REFERENCES_VALUE_LENGTH =
  MAX_HEADER_LINE_LENGTH - "References: ".length;
const MAX_IN_REPLY_TO_VALUE_LENGTH =
  MAX_HEADER_LINE_LENGTH - "In-Reply-To: ".length;
const METADATA_HEADERS = [
  "From",
  "Reply-To",
  "To",
  "Cc",
  "Subject",
  "Message-ID",
  "References",
  "Auto-Submitted",
  "Precedence",
  "List-Id",
  "X-Auto-Response-Suppress",
] as const;
const EXCLUDED_LABELS = new Set([
  "SENT",
  "DRAFT",
  "SPAM",
  "TRASH",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_FORUMS",
]);
const AUTOMATED_HEADERS = new Set([
  "auto-submitted",
  "precedence",
  "list-id",
  "x-auto-response-suppress",
]);
const identifier = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[^\r\n]+$/)
  .refine((value) => !value.includes(String.fromCharCode(0)));
const mailbox = SourceEmailSchema.transform((value) => value.toLowerCase());

type MaybePromise<T> = T | Promise<T>;

export interface GmailDraftCreateGateway {
  getProfile(userId: "me"): MaybePromise<unknown>;
  getMessage(
    userId: "me",
    id: string,
    options: {
      readonly format: "metadata";
      readonly metadataHeaders: readonly string[];
    },
  ): MaybePromise<unknown>;
  createDraft(
    userId: "me",
    request: {
      readonly message: { readonly threadId: string; readonly raw: string };
    },
  ): MaybePromise<unknown>;
}

export interface NativeDraftProviderDependencies {
  readonly gateway: GmailDraftCreateGateway;
  /** Includes owner, bound-workbook and CCC_DRAFT_CREATION checks. */
  readonly authorizeCreate: () => MaybePromise<boolean>;
  readonly now: () => string;
  readonly encodeBase64UrlUtf8: (value: string) => string;
  /** Only the configured approved mailbox is supported in V1. */
  readonly approvedMailbox?: string;
}

export interface NativeDraftContextGuardDependencies {
  readonly gateway: GmailDraftCreateGateway;
  /** Includes owner, bound-workbook and CCC_DRAFT_CREATION checks. */
  readonly authorizeCreate: () => MaybePromise<boolean>;
  readonly now: () => string;
  readonly approvedMailbox?: string;
  readonly loadContext: (itemId: string) => Promise<unknown>;
}

type SourceRequest = Pick<
  DraftTarget,
  "mailbox" | "threadId" | "sourceMessageId"
>;
type SourceDependencies = Omit<
  NativeDraftProviderDependencies,
  "encodeBase64UrlUtf8"
>;

type ReplyMetadata = {
  readonly threadId: string;
  readonly recipient: string;
  readonly subject: string;
  readonly messageId: string;
  readonly references: string;
};

function configuredMailbox(dependencies: SourceDependencies): string | null {
  const candidate = dependencies.approvedMailbox ?? APPROVED_GMAIL_MAILBOX;
  const parsed = mailbox.safeParse(candidate);
  return parsed.success && parsed.data === APPROVED_GMAIL_MAILBOX
    ? parsed.data
    : null;
}

async function allowed(dependencies: SourceDependencies): Promise<boolean> {
  try {
    return (await dependencies.authorizeCreate()) === true;
  } catch {
    return false;
  }
}

function validNow(now: () => string): number | null {
  try {
    const value = now();
    const parsed = Date.parse(value);
    return typeof value === "string" && Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validInternalDate(value: unknown): number | null {
  if (typeof value === "number")
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,15})$/.test(value))
    return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function hasUnsafeText(value: string, max: number): boolean {
  return (
    value.length > max ||
    /[\r\n]/.test(value) ||
    value.includes(String.fromCharCode(0))
  );
}

function singleMailbox(value: string): string | null {
  if (hasUnsafeText(value, 320)) return null;
  const trimmed = value.trim();
  const angled = /^(?:[^<>\r\n,]+\s)?<([^<>\s,]+)>$/.exec(trimmed);
  const candidate = angled ? angled[1] : trimmed;
  if (!candidate || /[<>,\s]/.test(candidate)) return null;
  const parsed = mailbox.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function recipientList(value: string): string[] | null {
  if (hasUnsafeText(value, 998) || !value.trim()) return null;
  const values = value.split(",").map((candidate) => singleMailbox(candidate));
  return values.every((candidate): candidate is string => candidate !== null)
    ? values
    : null;
}

function safeSubject(value: string): boolean {
  return (
    !hasUnsafeText(value, 500) &&
    /^[\x20-\x7e]+$/.test(value) &&
    !value.includes("=?")
  );
}

function messageIdentifier(value: string): string | null {
  return hasUnsafeText(value, 998) ||
    !/^[\x21-\x7e]+$/.test(value) ||
    !/^<[^\s<>@]+@[^\s<>@]+>$/.test(value)
    ? null
    : value;
}

function references(value: string): string | null {
  if (hasUnsafeText(value, 998)) return null;
  const values = value.trim().split(/ +/);
  return values.length > 0 && values.every((entry) => messageIdentifier(entry))
    ? values.join(" ")
    : null;
}

function headerValues(headers: unknown): Map<string, string[]> | null {
  if (!Array.isArray(headers) || headers.length > 32) return null;
  const values = new Map<string, string[]>();
  for (const header of headers) {
    if (
      !header ||
      typeof header !== "object" ||
      typeof (header as { name?: unknown }).name !== "string" ||
      typeof (header as { value?: unknown }).value !== "string"
    )
      return null;
    const name = (header as { name: string }).name;
    const value = (header as { value: string }).value;
    if (
      name.length === 0 ||
      name.length > 78 ||
      !/^[A-Za-z0-9-]+$/.test(name) ||
      hasUnsafeText(value, 998)
    )
      return null;
    const key = name.toLowerCase();
    const existing = values.get(key) ?? [];
    existing.push(value);
    values.set(key, existing);
  }
  return values;
}

function exactlyOne(
  headers: Map<string, string[]>,
  name: string,
): string | null {
  const entries = headers.get(name.toLowerCase());
  return entries?.length === 1 ? entries[0] : null;
}

function parseReplyMetadata(
  headers: Map<string, string[]>,
  approvedMailbox: string,
): Omit<ReplyMetadata, "threadId"> | null {
  const from = exactlyOne(headers, "From");
  const to = headers.get("to") ?? [];
  const cc = headers.get("cc") ?? [];
  const subject = exactlyOne(headers, "Subject");
  const sourceMessageId = exactlyOne(headers, "Message-ID");
  const replyTo = headers.get("reply-to") ?? [];
  const sourceReferences = headers.get("references") ?? [];
  if (
    !from ||
    !subject ||
    !sourceMessageId ||
    replyTo.length > 1 ||
    sourceReferences.length > 1 ||
    to.length > 1 ||
    cc.length > 1 ||
    !safeSubject(subject)
  )
    return null;
  const sender = singleMailbox(from);
  const recipient = replyTo.length === 1 ? singleMailbox(replyTo[0]) : sender;
  if (
    !sender ||
    !recipient ||
    sender !== recipient ||
    sender === approvedMailbox ||
    recipient === approvedMailbox
  )
    return null;
  const inboundRecipients = [...to, ...cc].flatMap(
    (entry) => recipientList(entry) ?? [],
  );
  if (
    inboundRecipients.length === 0 ||
    ![...to, ...cc].every((entry) => recipientList(entry) !== null) ||
    !inboundRecipients.includes(approvedMailbox)
  )
    return null;
  const messageId = messageIdentifier(sourceMessageId);
  const sourceRefs =
    sourceReferences.length === 0 ? "" : references(sourceReferences[0]);
  if (!messageId || sourceRefs === null) return null;
  if (messageId.length > MAX_IN_REPLY_TO_VALUE_LENGTH) return null;
  const combinedReferences = [sourceRefs, messageId].filter(Boolean).join(" ");
  if (combinedReferences.length > MAX_REFERENCES_VALUE_LENGTH) return null;
  return { recipient, subject, messageId, references: combinedReferences };
}

function containsExcludedMetadata(headers: Map<string, string[]>): boolean {
  for (const name of AUTOMATED_HEADERS) {
    const values = headers.get(name);
    if (values && values.some((value) => value.trim().length > 0)) return true;
  }
  return false;
}

async function inspectSource(
  dependencies: SourceDependencies,
  request: SourceRequest,
): Promise<ReplyMetadata | null> {
  const approvedMailbox = configuredMailbox(dependencies);
  if (!approvedMailbox || !(await allowed(dependencies))) return null;
  const requestedMailbox = mailbox.safeParse(request.mailbox);
  if (
    !requestedMailbox.success ||
    requestedMailbox.data !== approvedMailbox ||
    !identifier.safeParse(request.threadId).success ||
    !identifier.safeParse(request.sourceMessageId).success
  )
    return null;
  try {
    const profile = await dependencies.gateway.getProfile("me");
    const profileMailbox =
      profile && typeof profile === "object"
        ? mailbox.safeParse(
            (profile as { emailAddress?: unknown }).emailAddress,
          )
        : { success: false as const };
    if (!profileMailbox.success || profileMailbox.data !== approvedMailbox)
      return null;
    const message = await dependencies.gateway.getMessage(
      "me",
      request.sourceMessageId,
      {
        format: "metadata",
        metadataHeaders: METADATA_HEADERS,
      },
    );
    if (!message || typeof message !== "object") return null;
    const response = message as {
      id?: unknown;
      threadId?: unknown;
      internalDate?: unknown;
      labelIds?: unknown;
      payload?: { headers?: unknown };
    };
    if (
      identifier.safeParse(response.id).success === false ||
      response.id !== request.sourceMessageId ||
      identifier.safeParse(response.threadId).success === false ||
      response.threadId !== request.threadId ||
      !Array.isArray(response.labelIds) ||
      response.labelIds.length > 100 ||
      response.labelIds.some(
        (label) =>
          typeof label !== "string" || label.length === 0 || label.length > 128,
      ) ||
      response.labelIds.some((label) =>
        EXCLUDED_LABELS.has(label.toUpperCase()),
      )
    )
      return null;
    const internalDate = validInternalDate(response.internalDate);
    const current = validNow(dependencies.now);
    if (
      internalDate === null ||
      current === null ||
      internalDate < current - WINDOW_MS ||
      internalDate >= current
    )
      return null;
    const headers = headerValues(response.payload?.headers);
    if (!headers || containsExcludedMetadata(headers)) return null;
    const reply = parseReplyMetadata(headers, approvedMailbox);
    if (!reply) return null;
    // The clock is read after the metadata call, immediately before a later create.
    const rechecked = validNow(dependencies.now);
    if (
      rechecked === null ||
      internalDate < rechecked - WINDOW_MS ||
      internalDate >= rechecked
    )
      return null;
    return { ...reply, threadId: request.threadId };
  } catch {
    return null;
  }
}

function validPlainText(value: string): string | null {
  if (!value || value.length > MAX_BODY_LENGTH || value.includes("\u0000"))
    return null;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (index + 1 >= value.length) return null;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return null;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return null;
  }
  return value.replace(/\r\n|\r|\n/g, "\r\n");
}

function normalizeBase64Url(value: string): string | null {
  const match = /^([A-Za-z0-9_-]+)(={0,2})$/.exec(value);
  if (!match) return null;
  const data = match[1];
  const padding = match[2].length;
  const remainder = data.length % 4;
  if (remainder === 1) return null;
  const requiredPadding = remainder === 0 ? 0 : 4 - remainder;
  return padding === 0 || padding === requiredPadding ? data : null;
}

function encodeBody(
  encodeBase64UrlUtf8: (value: string) => string,
  body: string,
): string | null {
  const encoded = normalizeBase64Url(encodeBase64UrlUtf8(body));
  if (!encoded) return null;
  const standard = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (standard.length % 4)) % 4);
  return (standard + padding).match(/.{1,76}/g)?.join("\r\n") ?? null;
}

function mime(metadata: ReplyMetadata, encodedBody: string): string {
  const lines = [
    `To: ${metadata.recipient}`,
    `Subject: ${metadata.subject}`,
    `In-Reply-To: ${metadata.messageId}`,
    `References: ${metadata.references}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  return [...lines, "", encodedBody].join("\r\n");
}

const createResponse = z
  .object({
    id: identifier,
    message: z.object({ id: identifier, threadId: identifier }).passthrough(),
  })
  .passthrough();

/**
 * Binds the existing authoritative context policy to live Gmail source identity.
 * It does not derive eligibility from native metadata.
 */
export function createNativeDraftContextGuard(
  dependencies: NativeDraftContextGuardDependencies,
): (itemId: string) => Promise<unknown> {
  return async (itemId) => {
    if (!(await allowed(dependencies))) return null;
    try {
      const loaded = DraftContextSchema.safeParse(
        await dependencies.loadContext(itemId),
      );
      if (!loaded.success || loaded.data.item.item_id !== itemId) return null;
      const context = loaded.data;
      const source = await inspectSource(dependencies, {
        mailbox: context.mailbox,
        threadId: context.sourceThreadId,
        sourceMessageId: context.sourceMessageId,
      });
      const curatedRecipient = context.item.contact?.email?.toLowerCase();
      return source && curatedRecipient === source.recipient.toLowerCase()
        ? context
        : null;
    } catch {
      return null;
    }
  };
}

/** Gmail supports only bounded create; replacement and deletion never call the provider. */
export class NativeGmailCreateOnlyTransport implements DraftTransport {
  constructor(private readonly dependencies: NativeDraftProviderDependencies) {}

  async create(request: DraftCreateRequest): Promise<unknown> {
    const body = validPlainText(request.body);
    if (!body) return { outcome: "unsupported" };
    const source = await inspectSource(this.dependencies, request);
    if (
      !source ||
      !request.expectedRecipient ||
      source.recipient.toLowerCase() !== request.expectedRecipient.toLowerCase()
    )
      return { outcome: "unsupported" };
    let raw: string;
    try {
      const encodedBody = encodeBody(
        this.dependencies.encodeBase64UrlUtf8,
        body,
      );
      if (!encodedBody) return { outcome: "unsupported" };
      const encodedMime = normalizeBase64Url(
        this.dependencies.encodeBase64UrlUtf8(mime(source, encodedBody)),
      );
      if (!encodedMime) return { outcome: "unsupported" };
      raw = encodedMime;
    } catch {
      return { outcome: "unsupported" };
    }
    if (raw.length > 100_000) return { outcome: "unsupported" };
    try {
      if (
        !(await allowed(this.dependencies)) ||
        !(await request.authorizeWrite())
      )
        return { outcome: "unsupported" };
    } catch {
      return { outcome: "unsupported" };
    }
    try {
      const response = createResponse.safeParse(
        await this.dependencies.gateway.createDraft("me", {
          message: { threadId: source.threadId, raw },
        }),
      );
      if (
        !response.success ||
        response.data.message.threadId !== source.threadId
      )
        throw new Error("invalid provider response");
      return {
        outcome: "written",
        draftId: response.data.id,
        threadId: response.data.message.threadId,
        // An opaque receipt only; Gmail has no conditional draft revision API.
        draftRevision: response.data.message.id,
      };
    } catch {
      throw new Error("GMAIL_DRAFT_CREATE_UNCERTAIN");
    }
  }

  async replaceIfUnchanged(
    _request: DraftTarget & {
      readonly draftId: string;
      readonly expectedBodyHash: string;
      readonly expectedRevision: string;
      readonly body: string;
    },
  ): Promise<unknown> {
    void _request;
    return { outcome: "unsupported" };
  }

  async deleteIfUnchanged(
    _request: DraftTarget & {
      readonly draftId: string;
      readonly expectedBodyHash: string;
      readonly expectedRevision: string;
    },
  ): Promise<unknown> {
    void _request;
    return { outcome: "unsupported" };
  }
}
