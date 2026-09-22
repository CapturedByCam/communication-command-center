import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  CommunicationItemSchema,
  ShortcutIntakeSchema,
  StudioStagingSchema,
} from "../src/domain/schemas.ts";

const schemaDirectory = path.resolve("schemas");
const schemaFiles = (await readdir(schemaDirectory))
  .filter((file) => file.endsWith(".schema.json"))
  .sort();

if (schemaFiles.length === 0) {
  throw new Error("No JSON schemas found in schemas/");
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const fixtures = {
  "communication-item.schema.json": {
    schema_version: "1.0",
    item_id: "cc_123456789012",
    source: "gmail",
    source_record_id: "message-1",
    source_thread_id: "thread-1",
    captured_at: "2026-09-22T12:00:00Z",
    updated_at: "2026-09-22T12:00:00Z",
    category: "other",
    status: "open",
    waiting_on: "unknown",
    urgency: "later",
    priority_score: 10,
    next_action_type: "review",
    next_action: "Review synthetic item.",
    summary: "Synthetic validation fixture.",
    draft_status: "not_needed",
    confidence: 0.5,
    classifier_version: "fixture-v1",
    content_hash: "a".repeat(64),
    raw_content_stored: false,
  },
  "shortcut-intake.schema.json": {
    schema_version: "1.0",
    auth_token: "t".repeat(40),
    idempotency_key: "123e4567-e89b-42d3-a456-426614174000",
    captured_at: "2026-09-22T12:00:00Z",
    source: "apple_share_sheet",
    shared_text: "Synthetic shared text",
    model_fields: {
      classification_status: "needs_server_review",
      category: "other",
      urgency: "later",
      waiting_on: "unknown",
      next_action: "Review synthetic item.",
      summary: "Synthetic validation fixture.",
    },
  },
  "studio-staging.schema.json": {
    schema_version: "1.0",
    ingest_id: "ingest_123456",
    flow_run_id: "flow-1",
    gmail_message_id: "message-1",
    received_at: "2026-09-22T12:00:00Z",
    sender_email: "sender@example.com",
    subject: "Synthetic subject",
    requires_response: false,
    draft_risk: "no_draft",
    processing_status: "new",
  },
};

const zodSchemas = {
  "communication-item.schema.json": CommunicationItemSchema,
  "shortcut-intake.schema.json": ShortcutIntakeSchema,
  "studio-staging.schema.json": StudioStagingSchema,
};

const validators = {};

for (const file of schemaFiles) {
  const contents = await readFile(path.join(schemaDirectory, file), "utf8");
  const schema = JSON.parse(contents);
  const validate = ajv.compile(schema);
  validators[file] = validate;

  const fixture = fixtures[file];
  const zodSchema = zodSchemas[file];
  if (!fixture || !zodSchema) {
    throw new Error(`Missing cross-validator fixture for ${file}`);
  }
  if (!validate(fixture) || !zodSchema.safeParse(fixture).success) {
    throw new Error(`JSON Schema and Zod did not both accept ${file}`);
  }
}

const invalidCommunicationItem = {
  ...fixtures["communication-item.schema.json"],
  raw_content_stored: true,
};
if (
  validators["communication-item.schema.json"](invalidCommunicationItem) ||
  CommunicationItemSchema.safeParse(invalidCommunicationItem).success
) {
  throw new Error("JSON Schema and Zod must reject raw_content_stored=true");
}

console.log(`PASS: cross-validated ${schemaFiles.length} JSON and Zod schemas`);
