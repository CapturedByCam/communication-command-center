import type { WaitingOn } from "./types.js";

export type MessageDirection = "inbound" | "outbound";

export interface MeaningfulMessageSignal {
  direction: MessageDirection;
  requiresResponse?: boolean;
  expectsResponse?: boolean;
  isAcknowledgement?: boolean;
  isInformational?: boolean;
  isAmbiguous?: boolean;
}

export interface DeriveWaitingOnInput {
  manualOverride?: WaitingOn | null;
  hasOverdueUnresolvedPromise?: boolean;
  latestMessage?: MeaningfulMessageSignal | null;
}

export function deriveWaitingOn(input: DeriveWaitingOnInput): WaitingOn {
  if (input.manualOverride !== undefined && input.manualOverride !== null) {
    return input.manualOverride;
  }

  if (input.hasOverdueUnresolvedPromise) {
    return "me";
  }

  const latest = input.latestMessage;
  if (!latest) {
    return "unknown";
  }

  if (latest.isAmbiguous) {
    return "unknown";
  }

  if (latest.isAcknowledgement || latest.isInformational) {
    return "none";
  }

  if (latest.direction === "inbound" && latest.requiresResponse) {
    return "me";
  }

  if (latest.direction === "outbound" && latest.expectsResponse) {
    return "them";
  }

  return "none";
}
