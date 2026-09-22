import { APPROVED_GMAIL_MAILBOX } from "../adapters/gmail/gmail-client.js";
import { assertOwner, flag, workbookId } from "./google-services.js";
import {
  createNativeDraftContextGuard,
  NativeGmailCreateOnlyTransport,
  type GmailDraftCreateGateway,
} from "./draft-create-provider.js";

/**
 * Explicit, unbound factory. The caller must supply a trusted context resolver
 * and the bound workbook ID. There is deliberately no Apps Script entrypoint,
 * OAuth expansion, automatic worker or model eligibility inference here.
 */
export function createNativeDraftBinding(
  expectedWorkbookId: string,
  loadContext: (itemId: string) => Promise<unknown>,
) {
  const authorizeCreate = (): boolean => {
    try {
      assertOwner();
      return (
        flag("DRAFT_CREATION") &&
        /^[A-Za-z0-9_-]{20,}$/.test(expectedWorkbookId) &&
        workbookId() === expectedWorkbookId
      );
    } catch {
      return false;
    }
  };
  const gateway: GmailDraftCreateGateway = {
    getProfile: (user) => Gmail!.Users!.getProfile(user),
    getMessage: (user, id, options) =>
      Gmail!.Users!.Messages!.get(user, id, {
        format: options.format,
        metadataHeaders: [...options.metadataHeaders],
        fields: "id,threadId,internalDate,labelIds,payload/headers",
      }),
    createDraft: (user, request) => Gmail!.Users!.Drafts!.create(request, user),
  };
  const common = {
    gateway,
    authorizeCreate,
    now: () => new Date().toISOString(),
    approvedMailbox: APPROVED_GMAIL_MAILBOX,
  };
  return {
    transport: new NativeGmailCreateOnlyTransport({
      ...common,
      encodeBase64UrlUtf8: (value: string) =>
        Utilities.base64EncodeWebSafe(value, Utilities.Charset.UTF_8),
    }),
    loadContext: createNativeDraftContextGuard({ ...common, loadContext }),
    readFlags: async () => {
      const enabled = authorizeCreate();
      return { draftingEnabled: enabled, externalWritesEnabled: enabled };
    },
  };
}
