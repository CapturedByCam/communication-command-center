import {
  WORKBOOK_MANIFEST,
  headersEqual,
} from "../adapters/sheets/workbook-manifest.js";
import { assertHeaders, recordToRow } from "../adapters/sheets/sheet-table.js";
import { createShortcutHandler } from "../adapters/http/shortcut-handler.js";
import { createShortcutStorage } from "./shortcut-runtime.js";
import {
  assertOwner,
  workbookId,
  flag,
  sha256,
  googleGateway,
  googleSheetServices,
} from "./google-services.js";
import { literalCell } from "./google-sheet-gateway.js";
import { runBriefing } from "./briefing-runtime.js";
import { runGmailReconciliation, runtimeReconciler } from "./gmail-runtime.js";
import type { GmailMetadataGateway } from "./gmail-reader.js";
import {
  applyManualQueueControl,
  selectedQueueSnapshot,
  type ManualQueueOperation,
} from "./queue-controls.js";

const FLAGS = [
  "GMAIL_INTAKE",
  "STUDIO_PROCESSING",
  "SHORTCUT_INTAKE",
  "DRAFT_CREATION",
  "DRAFT_REPLACEMENT",
  "BRIEFING_DELIVERY",
  "MANUAL_WRITES",
] as const;
function json(value: unknown) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
function codeResult(operation: () => unknown): unknown {
  try {
    const result = operation();
    console.info(JSON.stringify(result)); // These admin results contain only controlled status and counts.
    return result;
  } catch {
    const result = { ok: false, error_code: "OPERATION_FAILED" };
    console.info(JSON.stringify(result));
    return result;
  }
}
export function doGet() {
  return json({ status: "rejected", error_code: "method_not_allowed" });
}

export function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Communication Command Center")
    .addItem("Health", "cccHealth")
    .addItem("Disable all controls", "cccDisableAll")
    .addSeparator()
    .addItem("Resolve selected Queue row", "cccResolveSelectedQueueRow")
    .addItem("Reopen selected Queue row", "cccReopenSelectedQueueRow")
    .addItem("Snooze selected Queue row", "cccSnoozeSelectedQueueRow")
    .addToUi();
}
export function doPost(e: GoogleAppsScript.Events.DoPost) {
  try {
    assertOwner();
    const gateway = googleGateway(),
      id = workbookId();
    const handler = createShortcutHandler({
      storage: createShortcutStorage(gateway, id),
      getToken: () =>
        PropertiesService.getScriptProperties().getProperty(
          "CCC_SHORTCUT_TOKEN",
        ),
      isEnabled: () => flag("SHORTCUT_INTAKE"),
      now: () => new Date(),
      hash: sha256,
      byteLength: (body) => Utilities.newBlob(body).getBytes().length,
      allowRequest: () => {
        const lock = LockService.getScriptLock();
        if (!lock.tryLock(500)) return false;
        try {
          const cache = CacheService.getScriptCache(),
            key = "shortcut_rate_" + Math.floor(Date.now() / 60000);
          const count = Number(cache.get(key) ?? "0");
          if (!Number.isFinite(count) || count >= 30) return false;
          cache.put(key, String(count + 1), 120);
          return true;
        } finally {
          lock.releaseLock();
        }
      },
      rejectionSink: {
        recordRejected: () => {
          gateway.acquire();
          try {
            const before = gateway.read(id, "Dead_Letter"),
              headers = assertHeaders("Dead_Letter", before.headers);
            const eventId = "dl_" + Utilities.getUuid().replace(/-/g, "");
            const row = recordToRow(headers, {
              dead_letter_id: eventId,
              received_at: new Date().toISOString(),
              source: "apple_share_sheet",
              source_record_id: null,
              error_code: "INVALID_PAYLOAD",
              payload_hash: sha256(eventId),
              status: "open",
              resolved_at: null,
              resolution_actor: null,
            });
            gateway.commit(id, [
              {
                sheetName: "Dead_Letter",
                before,
                after: { headers: [...headers], rows: [...before.rows, row] },
              },
            ]);
          } finally {
            gateway.release();
          }
        },
      },
    });
    return json(
      handler({ body: e?.postData?.contents ?? "", remoteAddress: null }),
    );
  } catch {
    return json({ status: "rejected", error_code: "unavailable" });
  }
}
export function cccInitializePilot() {
  return codeResult(() => {
    assertOwner();
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (!active) throw new Error("BOUND_WORKBOOK_REQUIRED");
    const props = PropertiesService.getScriptProperties();
    const configured = props.getProperty("CCC_WORKBOOK_ID");
    if (configured && configured !== active.getId())
      throw new Error("WORKBOOK_MISMATCH");
    const id = active.getId(),
      services = googleSheetServices();
    services.acquire();
    try {
      const existing =
        Sheets!.Spreadsheets!.get(id, { fields: "sheets.properties" }).sheets ??
        [];
      const byName = new Map(
        existing.map((sheet) => [sheet.properties!.title!, sheet.properties!]),
      );
      // Inspect all existing target tabs before mutating any of them.
      for (const def of WORKBOOK_MANIFEST) {
        if (byName.has(def.name)) {
          const headers = services.read(id, def.name).headers;
          if (headers.length && !headersEqual(headers, def.headers))
            throw new Error("HEADER_DRIFT");
          if (!headers.length)
            throw new Error("UNHEADED_TABLE_REQUIRES_REVIEW");
        }
      }
      let nextId =
        Math.max(0, ...existing.map((sheet) => sheet.properties!.sheetId!)) + 1;
      const requests: GoogleAppsScript.Sheets.Schema.Request[] = [
        {
          updateSpreadsheetProperties: {
            properties: { timeZone: "America/New_York" },
            fields: "timeZone",
          },
        },
      ];
      for (const def of WORKBOOK_MANIFEST) {
        let sheetId = byName.get(def.name)?.sheetId;
        if (sheetId === undefined) {
          sheetId = nextId++;
          requests.push({
            addSheet: {
              properties: {
                sheetId,
                title: def.name,
                gridProperties: {
                  rowCount: 6000,
                  columnCount: Math.max(40, def.headers.length),
                  frozenRowCount: 1,
                },
              },
            },
          });
        }
        const already =
          byName.has(def.name) &&
          services.read(id, def.name).headers.length > 0;
        if (!already)
          requests.push({
            updateCells: {
              start: { sheetId, rowIndex: 0, columnIndex: 0 },
              rows: [{ values: def.headers.map(literalCell) }],
              fields: "userEnteredValue",
            },
          });
      }
      if (requests.length) Sheets!.Spreadsheets!.batchUpdate({ requests }, id);
      props.setProperty("CCC_WORKBOOK_ID", id);
      for (const name of FLAGS) props.setProperty("CCC_" + name, "false");
      props.setProperty("CCC_TIME_ZONE", "America/New_York");
      return {
        ok: true,
        tab_count: WORKBOOK_MANIFEST.length,
        flags_enabled: FLAGS.filter((name) => flag(name)),
      };
    } finally {
      services.release();
    }
  });
}
export function cccHealth() {
  return codeResult(() => {
    assertOwner();
    const id = workbookId(),
      gateway = googleGateway();
    const headers = WORKBOOK_MANIFEST.map((def) => ({
      sheet: def.name,
      valid: headersEqual(gateway.read(id, def.name).headers, def.headers),
    }));
    return {
      ok: headers.every((row) => row.valid),
      headers,
      flags: Object.fromEntries(FLAGS.map((name) => [name, flag(name)])),
      time_zone: "America/New_York",
      send_capability: false,
    };
  });
}
export function cccDisableAll() {
  return codeResult(() => {
    assertOwner();
    const props = PropertiesService.getScriptProperties();
    for (const name of FLAGS) props.setProperty("CCC_" + name, "false");
    const managed = new Set([
      "cccReconcileGmail",
      "cccProcessStudio",
      "cccBuildBriefing",
    ]);
    let deleted = 0;
    for (const trigger of ScriptApp.getProjectTriggers())
      if (managed.has(trigger.getHandlerFunction())) {
        ScriptApp.deleteTrigger(trigger);
        deleted++;
      }
    const remaining = ScriptApp.getProjectTriggers().filter((trigger) =>
      managed.has(trigger.getHandlerFunction()),
    ).length;
    return {
      ok: remaining === 0,
      flags_enabled: [],
      managed_triggers_deleted: deleted,
      managed_triggers_remaining: remaining,
    };
  });
}

function manualResult(result: unknown): unknown {
  // This path deliberately emits only controlled operation status, never cells or provider errors.
  console.info(JSON.stringify(result));
  return result;
}

async function controlSelectedQueueRow(operation: ManualQueueOperation) {
  try {
    assertOwner();
    if (!flag("MANUAL_WRITES"))
      return manualResult({ ok: true, status: "disabled" });

    const active = SpreadsheetApp.getActiveSpreadsheet();
    const id = workbookId();
    if (!active || active.getId() !== id)
      return manualResult({ ok: false, error_code: "WORKBOOK_MISMATCH" });
    const range = active.getActiveRange();
    if (
      !range ||
      range.getSheet().getName() !== "Queue" ||
      range.getNumRows() !== 1 ||
      range.getRow() < 2
    )
      return manualResult({ ok: false, error_code: "INVALID_SELECTION" });

    const gateway = googleGateway();
    const before = gateway.read(id, "Queue");
    const selectedRow = selectedQueueSnapshot(
      before.headers,
      before.rows,
      range.getRow() - 2,
    );
    if (!selectedRow)
      return manualResult({ ok: false, error_code: "INVALID_SELECTION" });

    const ui = SpreadsheetApp.getUi();
    let snoozeUntil: string | undefined;
    if (operation === "snooze") {
      const response = ui.prompt(
        "Snooze selected Queue row",
        "Enter a future ISO timestamp with a numeric offset (for example 2026-09-25T14:30:00-04:00).",
        ui.ButtonSet.OK_CANCEL,
      );
      if (response.getSelectedButton() !== ui.Button.OK)
        return manualResult({ ok: true, status: "cancelled" });
      snoozeUntil = response.getResponseText();
    } else {
      const response = ui.prompt(
        `${operation === "resolve" ? "Resolve" : "Reopen"} selected Queue row`,
        "Confirm this selected row action.",
        ui.ButtonSet.OK_CANCEL,
      );
      if (response.getSelectedButton() !== ui.Button.OK)
        return manualResult({ ok: true, status: "cancelled" });
    }
    return manualResult(
      await applyManualQueueControl(gateway, {
        operation,
        spreadsheetId: id,
        selectedRowIndex: range.getRow() - 2,
        selectedRow,
        snoozeUntil,
        now: () => new Date(),
        sha256,
      }),
    );
  } catch {
    return manualResult({ ok: false, error_code: "OPERATION_FAILED" });
  }
}

export function cccResolveSelectedQueueRow() {
  return controlSelectedQueueRow("resolve");
}
export function cccReopenSelectedQueueRow() {
  return controlSelectedQueueRow("reopen");
}
export function cccSnoozeSelectedQueueRow() {
  return controlSelectedQueueRow("snooze");
}
export function cccBuildBriefing() {
  return codeResult(() => {
    assertOwner();
    if (!flag("BRIEFING_DELIVERY")) return { ok: true, status: "disabled" };
    return {
      ok: true,
      ...runBriefing(
        googleGateway(),
        workbookId(),
        new Date().toISOString(),
        sha256,
      ),
    };
  });
}

function nativeGmail(): GmailMetadataGateway {
  return {
    getProfile: () => Gmail!.Users!.getProfile("me"),
    listMessages: (_user, options) =>
      Gmail!.Users!.Messages!.list("me", {
        ...options,
        fields: "messages/id,messages/threadId,nextPageToken",
      }),
    getMessage: (_user, id, options) =>
      Gmail!.Users!.Messages!.get("me", id, {
        ...options,
        metadataHeaders: [...options.metadataHeaders],
        fields: "id,threadId,internalDate,labelIds,payload/headers",
      }),
    getThread: (_user, id, options) =>
      Gmail!.Users!.Threads!.get("me", id, {
        ...options,
        metadataHeaders: [...options.metadataHeaders],
        fields:
          "id,messages(id,threadId,internalDate,labelIds,payload/headers)",
      }),
  };
}

async function reconcile(studio: boolean) {
  try {
    assertOwner();
    if (!flag(studio ? "STUDIO_PROCESSING" : "GMAIL_INTAKE"))
      return codeResult(() => ({ ok: true, status: "disabled" }));
    const gateway = googleGateway(),
      gmail = nativeGmail(),
      id = workbookId(),
      now = new Date().toISOString();
    const result = studio
      ? await runtimeReconciler(gateway, gmail, id, sha256).processStudioInbox(
          now,
          5,
        )
      : await runGmailReconciliation(gateway, gmail, id, now, sha256);
    // The domain result contains only fixed statuses and numeric counts.
    return codeResult(() => ({ ok: true, ...result }));
  } catch {
    return codeResult(() => ({
      ok: false,
      error_code: "RECONCILIATION_FAILED",
    }));
  }
}
export function cccReconcileGmail() {
  return reconcile(false);
}
export function cccProcessStudio() {
  return reconcile(true);
}

export function cccGmailReadProbe() {
  return codeResult(() => {
    assertOwner();
    const profile = Gmail!.Users!.getProfile("me");
    if (profile.emailAddress?.toLowerCase() !== "contact@elev8mediaky.com")
      throw new Error("ACCOUNT_MISMATCH");
    const now = Math.floor(Date.now() / 1000);
    const page = Gmail!.Users!.Messages!.list("me", {
      q: `after:${now - 30 * 86400} before:${now} -category:promotions -category:forums -in:spam -in:trash`,
      maxResults: 1,
      fields: "messages/id,nextPageToken",
    });
    const first = page.messages?.[0];
    let verified = false;
    if (first?.id) {
      const metadata = Gmail!.Users!.Messages!.get("me", first.id, {
        format: "metadata",
        metadataHeaders: ["From", "To"],
        fields: "id,threadId,internalDate,labelIds,payload/headers",
      });
      verified = metadata.id === first.id && Boolean(metadata.threadId);
    }
    return {
      ok: true,
      mailbox_verified: true,
      bounded_days: 30,
      sampled_messages: first ? 1 : 0,
      metadata_verified: verified,
      raw_content_stored: false,
      mutations: 0,
    };
  });
}
