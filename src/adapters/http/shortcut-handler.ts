import { ShortcutIntakeSchema } from "../../domain/schemas.js";
import type { CommunicationItem, ShortcutIntake } from "../../domain/types.js";
import { constantTimeEqual } from "./auth.js";
import { rejected, type ShortcutResponse } from "./response.js";

const defaultMaxBodyBytes = 24_000;

export interface ShortcutRequest {
  readonly body: string;
  /** A transport-derived value, used only to apply the pre-auth rate limit. */
  readonly remoteAddress: string | null;
}

export interface ShortcutStorageRecord {
  readonly item: CommunicationItem;
  readonly idempotencyKey: string;
  readonly contentHash: string;
}

/**
 * Implementations must make createIfAbsent atomic on idempotencyKey. They must
 * store only the supplied normalized record, never the original request body.
 */
export interface ShortcutStorage {
  createIfAbsent(
    record: ShortcutStorageRecord,
    stillAuthorized: () => boolean,
  ): "created" | "duplicate" | "authorization_lost";
  findByIdempotencyKey(
    idempotencyKey: string,
  ): { readonly itemId: string } | null;
}

export interface ShortcutRejectionSink {
  /**
   * Persist only the controlled error code. Implementations must not attach the
   * request body, token, contact hint, model fields, or transport metadata.
   */
  recordRejected(
    event: { readonly errorCode: "invalid_payload" },
    stillAuthorized: () => boolean,
  ): boolean;
}

export interface ShortcutHandlerDependencies {
  readonly storage: ShortcutStorage;
  readonly getToken: () => string | null;
  readonly isEnabled: () => boolean;
  readonly now: () => Date;
  readonly hash: (value: string) => string;
  /** Called only after a bounded request proves knowledge of the configured token. */
  readonly allowRequest: (remoteAddress: string | null) => boolean;
  /**
   * Optional low global guard before parsing. Apps Script does not reliably
   * provide a caller address, so this cannot be the authenticated quota.
   */
  readonly allowPreAuthRequest?: (remoteAddress: string | null) => boolean;
  /** Optional audit sink for malformed requests that prove knowledge of the token. */
  readonly rejectionSink?: ShortcutRejectionSink;
  readonly maxBodyBytes?: number;
  readonly byteLength?: (body: string) => number;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasAuthenticatedToken(
  value: unknown,
  expectedToken: string | null,
): boolean {
  return (
    isObject(value) &&
    typeof value.auth_token === "string" &&
    expectedToken !== null &&
    constantTimeEqual(value.auth_token, expectedToken)
  );
}

function recordAuthenticatedSchemaRejection(
  rejectionSink: ShortcutRejectionSink | undefined,
  stillAuthorized: () => boolean,
): boolean {
  try {
    return (
      rejectionSink?.recordRejected(
        { errorCode: "invalid_payload" },
        stillAuthorized,
      ) ?? true
    );
  } catch {
    // The write-only endpoint must return the same redacted response if audit is down.
    return true;
  }
}

function authorizationFailure(
  dependencies: ShortcutHandlerDependencies,
): ShortcutResponse {
  try {
    if (!dependencies.isEnabled()) return rejected("disabled");
    dependencies.getToken();
    return rejected("unauthorized");
  } catch {
    return rejected("configuration_error");
  }
}

function normalizeItem(
  intake: ShortcutIntake,
  now: Date,
  hash: (value: string) => string,
): ShortcutStorageRecord {
  const idempotencyKey = intake.idempotency_key;
  const sourceId = `shortcut:${idempotencyKey}`;
  const contentHash = hash(intake.shared_text);
  const hasUnverifiedDate =
    intake.model_fields.deadline_at !== null ||
    intake.model_fields.deadline_text !== null;

  return {
    idempotencyKey,
    contentHash,
    item: {
      schema_version: "1.0",
      item_id: `cc_${hash(`shortcut:item:${idempotencyKey}`).slice(0, 20)}`,
      source: "apple_share_sheet",
      source_record_id: sourceId,
      source_thread_id: sourceId,
      source_link: null,
      captured_at: intake.captured_at,
      updated_at: now.toISOString(),
      // A hint has no curated identifier, so it cannot establish a contact association.
      contact: undefined,
      // Model fields may be malformed or semantically wrong despite schema validation.
      category: "other",
      project_id: null,
      status: "open",
      waiting_on: "unknown",
      urgency: "later",
      priority_score: 10,
      next_action_type: "review",
      next_action: "Review manually shared content in its source app.",
      summary: "Manual Shortcut capture requires review.",
      preview: null,
      // Model dates lack an authoritative source-time anchor. Keep only a generic
      // review marker; never persist a potentially echoed date phrase.
      deadline_at: null,
      deadline_text: hasUnverifiedDate
        ? "Unverified model-suggested deadline"
        : null,
      needs_date_review: true,
      follow_up_at: null,
      promised_follow_up: null,
      draft_status: "not_needed",
      gmail_draft_id: null,
      confidence: 0,
      classifier_version: "shortcut-intake-v1",
      content_hash: contentHash,
      manual_override: false,
      snooze_until: null,
      resolved_at: null,
      raw_content_stored: false,
      last_error_code: "shortcut_needs_review",
    },
  };
}

export function createShortcutHandler(
  dependencies: ShortcutHandlerDependencies,
) {
  const maxBodyBytes = dependencies.maxBodyBytes ?? defaultMaxBodyBytes;
  const byteLength = dependencies.byteLength ?? utf8ByteLength;

  return (request: ShortcutRequest): ShortcutResponse => {
    if (!dependencies.isEnabled()) {
      return rejected("disabled");
    }
    if (
      dependencies.allowPreAuthRequest &&
      !dependencies.allowPreAuthRequest(request.remoteAddress)
    ) {
      return rejected("rate_limited");
    }
    if (byteLength(request.body) > maxBodyBytes) {
      return rejected("payload_too_large");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(request.body);
    } catch {
      return rejected("invalid_payload");
    }

    let expectedToken: string | null;
    try {
      expectedToken = dependencies.getToken();
    } catch {
      return rejected("configuration_error");
    }
    const authenticated = hasAuthenticatedToken(parsed, expectedToken);
    const intakeResult = ShortcutIntakeSchema.safeParse(parsed);
    if (!intakeResult.success) {
      if (authenticated) {
        if (!dependencies.allowRequest(request.remoteAddress)) {
          return rejected("rate_limited");
        }
        const stillAuthorized = () => {
          try {
            return (
              dependencies.isEnabled() &&
              constantTimeEqual(
                dependencies.getToken() ?? "",
                (parsed as { auth_token: string }).auth_token,
              )
            );
          } catch {
            return false;
          }
        };
        if (
          !recordAuthenticatedSchemaRejection(
            dependencies.rejectionSink,
            stillAuthorized,
          )
        ) {
          return authorizationFailure(dependencies);
        }
      }
      return rejected("invalid_payload");
    }
    if (!authenticated) {
      return rejected("unauthorized");
    }
    if (!dependencies.allowRequest(request.remoteAddress)) {
      return rejected("rate_limited");
    }

    let record: ShortcutStorageRecord;
    try {
      record = normalizeItem(
        intakeResult.data,
        dependencies.now(),
        dependencies.hash,
      );
    } catch {
      return rejected("storage_unavailable");
    }

    try {
      const stillAuthorized = () => {
        try {
          return (
            dependencies.isEnabled() &&
            constantTimeEqual(
              dependencies.getToken() ?? "",
              intakeResult.data.auth_token,
            )
          );
        } catch {
          return false;
        }
      };
      const outcome = dependencies.storage.createIfAbsent(
        record,
        stillAuthorized,
      );
      if (outcome === "authorization_lost") {
        return authorizationFailure(dependencies);
      }
      return outcome === "created"
        ? { status: "needs_review", item_id: record.item.item_id }
        : { status: "duplicate", item_id: record.item.item_id };
    } catch {
      // A timeout may occur after the atomic write committed. Probe by the same
      // idempotency key before reporting failure, never retrying a blind write.
      try {
        const recovered = dependencies.storage.findByIdempotencyKey(
          record.idempotencyKey,
        );
        if (recovered) {
          return { status: "duplicate", item_id: recovered.itemId };
        }
      } catch {
        // Return the same redacted failure whether recovery is unavailable or empty.
      }
      return rejected("storage_unavailable");
    }
  };
}
