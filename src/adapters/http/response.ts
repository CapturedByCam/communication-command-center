export type ShortcutResponse =
  | {
      readonly status: "created" | "duplicate" | "needs_review";
      readonly item_id: string;
    }
  | {
      readonly status: "rejected";
      readonly error_code:
        | "disabled"
        | "rate_limited"
        | "payload_too_large"
        | "invalid_payload"
        | "unauthorized"
        | "configuration_error"
        | "storage_unavailable";
    };

export function rejected(
  errorCode: Extract<ShortcutResponse, { status: "rejected" }>["error_code"],
): ShortcutResponse {
  return { status: "rejected", error_code: errorCode };
}
