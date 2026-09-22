import { z } from "zod";
import { CategorySchema, DraftRiskSchema } from "../../domain/schemas.js";

export const APPROVED_GMAIL_MAILBOX = "contact@elev8mediaky.com";

const EmailSchema = z.string().email().max(320);
/** Source addresses may use RFC local-parts that the default Gmail-style regex rejects. */
export const SourceEmailSchema = z
  .string()
  .max(320)
  .regex(/^[^\r\n]*$/)
  .regex(z.regexes.rfc5322Email);

const InterpretationSchema = z
  .object({
    kind: z.enum([
      "question",
      "acknowledgement",
      "informational",
      "ambiguous",
      "promise",
    ]),
    category: CategorySchema,
    risk: DraftRiskSchema,
    summary: z.string().max(500),
    confidence: z.number().min(0).max(1),
  })
  .strict();

const ThreadMessageSchema = z
  .object({
    id: z.string().min(1).max(512),
    internalDate: z.number().int().safe().min(0).max(8_640_000_000_000_000),
    sender: EmailSchema,
    recipients: z.array(EmailSchema).max(100),
    labels: z.array(z.string().min(1).max(128)).max(100),
    automated: z.boolean(),
    bulk: z.boolean(),
    receipt: z.boolean().default(false),
    interpretation: InterpretationSchema,
  })
  .strict();

const LegacyThreadSnapshotSchema = z
  .object({
    schema_version: z.literal("1.0"),
    mailbox: EmailSchema,
    threadId: z.string().min(1).max(512),
    messages: z.array(ThreadMessageSchema).min(1).max(1_000),
  })
  .strict();

const CurrentThreadSnapshotSchema = LegacyThreadSnapshotSchema.extend({
  schema_version: z.literal("1.1"),
  messages: z
    .array(
      ThreadMessageSchema.extend({
        sender: SourceEmailSchema,
        recipients: z.array(SourceEmailSchema).max(100),
      }),
    )
    .min(1)
    .max(1_000),
});

export const ThreadSnapshotSchema = z.discriminatedUnion("schema_version", [
  LegacyThreadSnapshotSchema,
  CurrentThreadSnapshotSchema,
]);

/** Input contract; `receipt` may be omitted and is normalized to false by the schema. */
export type ThreadSnapshot = z.input<typeof ThreadSnapshotSchema>;

export interface GmailSnapshotReader {
  getThreadSnapshot(messageId: string): Promise<unknown>;
}

/**
 * A read-only boundary around a snapshot provider. Google service objects, if
 * introduced later, belong behind GmailSnapshotReader and never enter domain code.
 */
export class GmailClient {
  constructor(private readonly reader: GmailSnapshotReader) {}

  async getThreadSnapshot(messageId: string): Promise<ThreadSnapshot> {
    if (!messageId || messageId.length > 512) {
      throw new Error("A valid requested Gmail message ID is required.");
    }

    const snapshot = ThreadSnapshotSchema.parse(
      await this.reader.getThreadSnapshot(messageId),
    );

    if (snapshot.mailbox.toLowerCase() !== APPROVED_GMAIL_MAILBOX) {
      throw new Error("Snapshot mailbox is outside the approved Gmail scope.");
    }

    if (!snapshot.messages.some((message) => message.id === messageId)) {
      throw new Error(
        "Returned snapshot does not contain the requested message ID.",
      );
    }

    return snapshot;
  }
}
