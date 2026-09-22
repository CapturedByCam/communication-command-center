import type {
  GmailReplayResult,
  SelectedGmailReplay,
} from "../adapters/gmail/reconciliation.js";
import type { GmailMetadataGateway } from "./gmail-reader.js";
import { runtimeReconciler } from "./gmail-runtime.js";
import type { TableGateway } from "./sheet-adapter.js";

export type ManualGmailReplayResult =
  | GmailReplayResult
  | { readonly ok: false; readonly error_code: "WRITE_UNCERTAIN" };

async function run(
  operation: () => Promise<GmailReplayResult>,
): Promise<ManualGmailReplayResult> {
  try {
    return await operation();
  } catch {
    // Provider failures are never retried here and their details must not reach UI/logs.
    return { ok: false, error_code: "WRITE_UNCERTAIN" };
  }
}

export function retrySelectedGmailSnapshotInvalid(
  gateway: TableGateway,
  gmail: GmailMetadataGateway,
  spreadsheetId: string,
  now: string,
  hash: (value: string) => string,
  selection: SelectedGmailReplay,
): Promise<ManualGmailReplayResult> {
  return run(() =>
    runtimeReconciler(
      gateway,
      gmail,
      spreadsheetId,
      hash,
    ).replaySelectedSnapshotInvalid(selection, now),
  );
}

export function replaySelectedGmailQueueItem(
  gateway: TableGateway,
  gmail: GmailMetadataGateway,
  spreadsheetId: string,
  now: string,
  hash: (value: string) => string,
  selection: SelectedGmailReplay,
): Promise<ManualGmailReplayResult> {
  return run(() =>
    runtimeReconciler(
      gateway,
      gmail,
      spreadsheetId,
      hash,
    ).replaySelectedQueueItem(selection, now),
  );
}
