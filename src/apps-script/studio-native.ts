import { z } from "zod";
import { SourceEmailSchema } from "../adapters/gmail/gmail-client.js";
import { assertHeaders, rowToRecord } from "../adapters/sheets/sheet-table.js";
import type { CuratedContact } from "../services/context-registry.js";
import { createStudioStep, type StudioStepResult } from "./studio-step.js";
import {
  assertOwner,
  flag,
  googleGateway,
  workbookId,
} from "./google-services.js";
import type { TableGateway } from "./sheet-adapter.js";

const CuratedRow = z
  .object({
    contact_id: z.string().min(1).max(128),
    name: z.string().max(200),
    email: SourceEmailSchema.nullable(),
    active: z.boolean(),
  })
  .passthrough();

export function readStudioContacts(
  gateway: TableGateway,
  id: string,
): CuratedContact[] {
  const table = gateway.read(id, "Contacts");
  const headers = assertHeaders("Contacts", table.headers);
  return table.rows.map((row) => {
    const item = CuratedRow.parse(rowToRecord(headers, row));
    return {
      contactId: item.contact_id,
      name: item.name,
      emails: item.email ? [item.email] : [],
      approvedAliases: [],
      active: item.active,
    };
  });
}

/** Static configuration only. Never interpolate event or source content into this card. */
export function cccConfigureStudioStep() {
  assertOwner();
  const input = (name: string, title: string) =>
    CardService.newTextInput()
      .setFieldName(name)
      .setTitle(title)
      .setInputMode(CardService.TextInputMode.PLAIN_TEXT)
      .setHostAppDataSource(
        CardService.newHostAppDataSource().setWorkflowDataSource(
          CardService.newWorkflowDataSource().setIncludeVariables(true),
        ),
      );
  return CardService.newCardBuilder()
    .addSection(
      CardService.newCardSection()
        .setHeader("Validate Gmail interpretation")
        .addWidget(
          CardService.newTextParagraph().setText(
            "Choose the Gmail starter message ID and bounded interpretation JSON. This step stages validated metadata only. Drafts and sending are unavailable.",
          ),
        )
        .addWidget(input("gmail_message_id", "Gmail message ID"))
        .addWidget(
          input(
            "model_json",
            "Interpretation JSON (maximum 12,000 UTF-8 bytes)",
          ),
        ),
    )
    .build();
}

export function studioOutput(result: StudioStepResult): unknown {
  const action = AddOnsResponseService.newReturnOutputVariablesAction()
    .addVariableData(
      "status",
      AddOnsResponseService.newVariableData().addStringValue(result.status),
    )
    .addVariableData(
      "ingest_id",
      AddOnsResponseService.newVariableData().addStringValue(
        "ingest_id" in result ? result.ingest_id : "",
      ),
    );
  return AddOnsResponseService.newRenderActionBuilder()
    .setHostAppAction(
      AddOnsResponseService.newHostAppAction().setWorkflowAction(action),
    )
    .build();
}

export function cccExecuteStudioStep(event: unknown): unknown {
  let result: StudioStepResult;
  try {
    assertOwner();
    if (!flag("STUDIO_PROCESSING")) return studioOutput({ status: "disabled" });
    const id = workbookId();
    const gateway = googleGateway();
    result = createStudioStep({
      gateway,
      spreadsheetId: id,
      assertOwner,
      assertBinding: workbookId,
      isEnabled: () => flag("STUDIO_PROCESSING"),
      now: () => new Date().toISOString(),
      byteLength: (value) => Utilities.newBlob(value).getBytes().length,
      gmail: {
        getProfile: (userId) => Gmail!.Users!.getProfile(userId),
        getMessage: (userId, messageId, options) =>
          Gmail!.Users!.Messages!.get(userId, messageId, {
            format: options.format,
            metadataHeaders: [...options.metadataHeaders],
            fields: "id,threadId,internalDate,labelIds,payload/headers",
          }),
      },
      getCuratedContacts: () => readStudioContacts(gateway, id),
    }).execute(event);
  } catch {
    result = { status: "rejected" };
  }
  return studioOutput(result);
}
