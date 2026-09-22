import { GmailReconciler } from "../adapters/gmail/reconciliation.js";
import {
  GmailMetadataReader,
  type GmailMetadataGateway,
} from "./gmail-reader.js";
import { RuntimeSheetAdapter, type TableGateway } from "./sheet-adapter.js";

export function runtimeReconciler(
  gateway: TableGateway,
  gmail: GmailMetadataGateway,
  spreadsheetId: string,
  sha256: (value: string) => string,
) {
  return new GmailReconciler({
    adapter: new RuntimeSheetAdapter(gateway),
    // Advanced Gmail's thread endpoint cannot bound older history. The native
    // pilot therefore derives a generic, review-only state from the requested
    // message that was already selected inside the 30-day list window.
    reader: new GmailMetadataReader(gmail, { mode: "requested_message_only" }),
    spreadsheetId,
    sha256,
  });
}

/** Five metadata records maximum per invocation; the durable cursor owns continuation. */
export function runGmailReconciliation(
  gateway: TableGateway,
  gmail: GmailMetadataGateway,
  spreadsheetId: string,
  now: string,
  sha256: (value: string) => string,
) {
  return runtimeReconciler(
    gateway,
    gmail,
    spreadsheetId,
    sha256,
  ).reconcileRecentGmail(now, 5);
}
