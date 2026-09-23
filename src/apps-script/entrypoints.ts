import "./runtime-polyfills.js";
export {
  cccConfigureStudioStep,
  cccExecuteStudioStep,
} from "./studio-native.js";
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
  SheetApiReadError,
} from "./google-services.js";
import { literalCell } from "./google-sheet-gateway.js";
import { migrateEmptyCommitments } from "./commitment-migration.js";
import { runBriefing } from "./briefing-runtime.js";
import { runtimeReconciler } from "./gmail-runtime.js";
import {
  resetBoundedGmailReconciliation,
  runBoundedGmailReconciliation,
  type GmailLookbackDays,
} from "./bounded-gmail-runtime.js";
import { SheetCommitUncertainError } from "./sheet-adapter.js";
import {
  replaySelectedGmailQueueItem,
  retrySelectedGmailSnapshotInvalid,
} from "./gmail-replay.js";
import type { GmailMetadataGateway } from "./gmail-reader.js";
import { selectedSnapshotInvalidDeadLetter } from "../adapters/sheets/gmail-sync-repository.js";
import {
  applyManualQueueControl,
  selectedQueueSnapshot,
  type ManualQueueOperation,
} from "./queue-controls.js";
import { createSelectedQueueDraft } from "./draft-create-runtime.js";
import { readStudioContacts } from "./studio-native.js";

const FLAGS = [
  "GMAIL_INTAKE",
  "STUDIO_PROCESSING",
  "SHORTCUT_INTAKE",
  "DRAFT_CREATION",
  "DRAFT_REPLACEMENT",
  "BRIEFING_DELIVERY",
  "MANUAL_WRITES",
] as const;
function gmailLookbackDays(): GmailLookbackDays {
  const value =
    PropertiesService.getScriptProperties().getProperty(
      "CCC_GMAIL_LOOKBACK_DAYS",
    ) ?? "7";
  if (value === "7") return 7;
  if (value === "30") return 30;
  throw new Error("INVALID_GMAIL_LOOKBACK_DAYS");
}
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
    .addItem("Set selected Queue waiting state", "cccSetSelectedQueueWaiting")
    .addItem(
      "Create unsent draft for selected Queue row",
      "cccCreateDraftForSelectedQueueRow",
    )
    .addSeparator()
    .addItem(
      "Retry selected Gmail snapshot failure",
      "cccRetrySelectedGmailSnapshotFailure",
    )
    .addItem(
      "Replay selected Gmail Queue item",
      "cccReplaySelectedGmailQueueItem",
    )
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
      allowPreAuthRequest: () => {
        const lock = LockService.getScriptLock();
        if (!lock.tryLock(500)) return false;
        try {
          const cache = CacheService.getScriptCache(),
            key = "shortcut_preauth_rate_" + Math.floor(Date.now() / 60000);
          const count = Number(cache.get(key) ?? "0");
          if (!Number.isFinite(count) || count >= 10) return false;
          cache.put(key, String(count + 1), 120);
          return true;
        } finally {
          lock.releaseLock();
        }
      },
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
        recordRejected: (_event, stillAuthorized = () => true) => {
          gateway.acquire();
          try {
            if (!stillAuthorized()) return false;
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
            return true;
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
/** Explicit release migration; never called by initialization or a trigger. */
export function cccMigrateEmptyCommitments() {
  return codeResult(() => {
    assertOwner();
    const id = workbookId();
    const services = googleSheetServices();
    const result = migrateEmptyCommitments(
      {
        ...services,
        read: (spreadsheetId) => {
          // Inspect every row, including formulas that currently render blank.
          const values =
            Sheets!.Spreadsheets!.Values!.get(
              spreadsheetId,
              "'Commitments'!A:ZZ",
              {
                valueRenderOption: "FORMULA",
              },
            ).values ?? [];
          return {
            headers: (values[0] ?? []).map(String),
            rows: values.slice(1),
          };
        },
      },
      id,
      () => {
        assertOwner();
        return workbookId() === id && FLAGS.every((name) => !flag(name));
      },
    );
    return { ok: true, ...result };
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
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) throw new Error("BUSY");
    try {
      const props = PropertiesService.getScriptProperties();
      for (const name of FLAGS) props.setProperty("CCC_" + name, "false");
      const managed = new Set([
        "cccReconcileGmail",
        "cccReconcileGmailBatch",
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
    } finally {
      lock.releaseLock();
    }
  });
}
function manualResult(
  active: GoogleAppsScript.Spreadsheet.Spreadsheet | null,
  result: unknown,
): unknown {
  // This path deliberately emits only controlled operation status, never cells or provider errors.
  const outcome = result as { status?: string; error_code?: string };
  const message =
    outcome.status === "resolved"
      ? "Selected Queue row resolved."
      : outcome.status === "open"
        ? "Selected Queue row reopened."
        : outcome.status === "snoozed"
          ? "Selected Queue row snoozed."
          : outcome.status === "waiting_updated"
            ? "Selected Queue waiting state updated."
            : outcome.status === "unchanged"
              ? "Selected Queue row already has that waiting state."
              : outcome.status === "disabled"
                ? "Manual Queue controls are disabled."
                : outcome.status === "cancelled"
                  ? "Queue action cancelled."
                  : outcome.error_code === "SELECTION_CHANGED"
                    ? "Queue row changed; no update was made."
                    : outcome.error_code === "WRITE_UNCERTAIN"
                      ? "Queue action could not be confirmed. Check the row before retrying."
                      : "Queue action did not run.";
  try {
    active?.toast(message, "Communication Command Center", 5);
  } catch {
    // A UI feedback failure must not expose details or change the control result.
  }
  console.info(JSON.stringify(result));
  return result;
}
async function controlSelectedQueueRow(operation: ManualQueueOperation) {
  try {
    assertOwner();
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (!flag("MANUAL_WRITES"))
      return manualResult(active, { ok: true, status: "disabled" });
    const id = workbookId();
    if (!active || active.getId() !== id)
      return manualResult(active, {
        ok: false,
        error_code: "WORKBOOK_MISMATCH",
      });
    const range = active.getActiveRange();
    if (
      !range ||
      range.getSheet().getName() !== "Queue" ||
      range.getNumRows() !== 1 ||
      range.getRow() < 2
    )
      return manualResult(active, {
        ok: false,
        error_code: "INVALID_SELECTION",
      });
    const gateway = googleGateway();
    const before = gateway.read(id, "Queue");
    const selectedRow = selectedQueueSnapshot(
      before.headers,
      before.rows,
      range.getRow() - 2,
    );
    if (!selectedRow)
      return manualResult(active, {
        ok: false,
        error_code: "INVALID_SELECTION",
      });
    const ui = SpreadsheetApp.getUi();
    let snoozeUntil: string | undefined;
    let waitingOn: string | undefined;
    if (operation === "set_waiting") {
      const response = ui.prompt(
        "Set selected Queue waiting state",
        "Enter exactly one value: me, them, none, or unknown.",
        ui.ButtonSet.OK_CANCEL,
      );
      if (response.getSelectedButton() !== ui.Button.OK)
        return manualResult(active, { ok: true, status: "cancelled" });
      waitingOn = response.getResponseText();
    } else if (operation === "snooze") {
      const response = ui.prompt(
        "Snooze selected Queue row",
        "Enter a future ISO timestamp with a numeric offset (for example 2026-09-25T14:30:00-04:00).",
        ui.ButtonSet.OK_CANCEL,
      );
      if (response.getSelectedButton() !== ui.Button.OK)
        return manualResult(active, { ok: true, status: "cancelled" });
      snoozeUntil = response.getResponseText();
    } else {
      const response = ui.prompt(
        `${operation === "resolve" ? "Resolve" : "Reopen"} selected Queue row`,
        "Confirm this selected row action.",
        ui.ButtonSet.OK_CANCEL,
      );
      if (response.getSelectedButton() !== ui.Button.OK)
        return manualResult(active, { ok: true, status: "cancelled" });
    }
    return manualResult(
      active,
      await applyManualQueueControl(gateway, {
        operation,
        spreadsheetId: id,
        selectedRowIndex: range.getRow() - 2,
        selectedRow,
        snoozeUntil,
        waitingOn,
        now: () => new Date(),
        sha256,
        authorize: () => {
          try {
            assertOwner();
            const current = SpreadsheetApp.getActiveSpreadsheet();
            return (
              flag("MANUAL_WRITES") &&
              Boolean(current && current.getId() === id && workbookId() === id)
            );
          } catch {
            return false;
          }
        },
      }),
    );
  } catch {
    return manualResult(null, { ok: false, error_code: "OPERATION_FAILED" });
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
export function cccSetSelectedQueueWaiting() {
  return controlSelectedQueueRow("set_waiting");
}

export function manualDraftMessage(result: unknown): string {
  const outcome = result as { outcome?: string; code?: string };
  return outcome.outcome === "created"
    ? "Unsent Gmail draft created for the selected Queue row."
    : outcome.outcome === "existing"
      ? "The selected Queue row already has this draft."
      : outcome.outcome === "stale"
        ? "An unsent Gmail draft was created but became stale; review recovery before retrying."
        : outcome.outcome === "recovery_required"
          ? "Draft outcome needs manual recovery review before any retry."
          : outcome.code === "DISABLED"
            ? "Gmail draft creation is disabled."
            : outcome.code === "INELIGIBLE"
              ? "The selected Queue row is not eligible for routine drafting."
              : outcome.code === "INVALID_INPUT"
                ? "The interpretation or draft input is invalid."
                : "No Gmail draft was created.";
}

function manualDraftResult(
  active: GoogleAppsScript.Spreadsheet.Spreadsheet | null,
  result: unknown,
): unknown {
  const outcome = result as { outcome?: string; code?: string };
  const message = manualDraftMessage(result);
  try {
    active?.toast(message, "Communication Command Center", 7);
  } catch {
    // Feedback failure must not expose transient input or alter the result.
  }
  console.info(
    JSON.stringify({
      outcome: outcome.outcome ?? "blocked",
      code: outcome.code ?? null,
    }),
  );
  return result;
}

/** Owner-only, selected-row acceptance path. It can create an unsent draft but has no send operation. */
export async function cccCreateDraftForSelectedQueueRow() {
  try {
    assertOwner();
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (!flag("DRAFT_CREATION"))
      return manualDraftResult(active, {
        outcome: "blocked",
        code: "DISABLED",
      });
    const id = workbookId();
    if (!active || active.getId() !== id)
      return manualDraftResult(active, {
        outcome: "blocked",
        code: "INELIGIBLE",
      });
    const range = active.getActiveRange();
    if (
      !range ||
      range.getSheet().getName() !== "Queue" ||
      range.getNumRows() !== 1 ||
      range.getRow() < 2
    )
      return manualDraftResult(active, {
        outcome: "blocked",
        code: "INVALID_INPUT",
      });

    const gateway = googleGateway();
    const before = gateway.read(id, "Queue");
    const selectedRow = selectedQueueSnapshot(
      before.headers,
      before.rows,
      range.getRow() - 2,
    );
    if (!selectedRow)
      return manualDraftResult(active, {
        outcome: "blocked",
        code: "INVALID_INPUT",
      });

    const ui = SpreadsheetApp.getUi();
    const interpretationPrompt = ui.prompt(
      "Create unsent Gmail draft",
      "Paste the strict bounded interpretation JSON for this selected row. The JSON is validated and is not persisted.",
      ui.ButtonSet.OK_CANCEL,
    );
    if (interpretationPrompt.getSelectedButton() !== ui.Button.OK)
      return manualDraftResult(active, {
        outcome: "blocked",
        code: "DISABLED",
      });
    const interpretationText = interpretationPrompt.getResponseText();
    if (Utilities.newBlob(interpretationText).getBytes().length > 12_000)
      return manualDraftResult(active, {
        outcome: "blocked",
        code: "INVALID_INPUT",
      });
    let interpretation: unknown;
    try {
      interpretation = JSON.parse(interpretationText);
    } catch {
      return manualDraftResult(active, {
        outcome: "blocked",
        code: "INVALID_INPUT",
      });
    }

    const draftPrompt = ui.prompt(
      "Confirm unsent Gmail draft",
      "Paste the reviewed plain-text draft. Choosing OK creates one unsent Gmail draft if every eligibility and kill-switch check still passes.",
      ui.ButtonSet.OK_CANCEL,
    );
    if (draftPrompt.getSelectedButton() !== ui.Button.OK)
      return manualDraftResult(active, {
        outcome: "blocked",
        code: "DISABLED",
      });

    return manualDraftResult(
      active,
      await createSelectedQueueDraft({
        gateway,
        spreadsheetId: id,
        selectedRowIndex: range.getRow() - 2,
        selectedRow,
        interpretation,
        draftText: draftPrompt.getResponseText(),
        getCuratedContacts: () => readStudioContacts(gateway, id),
        now: () => new Date().toISOString(),
        hash: sha256,
        newOperationId: () => Utilities.getUuid(),
      }),
    );
  } catch {
    return manualDraftResult(null, {
      outcome: "blocked",
      code: "STATE_UNAVAILABLE",
    });
  }
}

function gmailReplayResult(
  active: GoogleAppsScript.Spreadsheet.Spreadsheet | null,
  result: unknown,
): unknown {
  const outcome = result as { status?: string; error_code?: string };
  const message =
    outcome.status === "replayed"
      ? "Selected Gmail row replayed."
      : outcome.status === "disabled"
        ? "Manual Gmail replay controls are disabled."
        : outcome.status === "cancelled"
          ? "Gmail replay cancelled."
          : outcome.error_code === "SELECTION_CHANGED"
            ? "Selected row changed; no replay was made."
            : outcome.error_code === "WRITE_UNCERTAIN"
              ? "Gmail replay could not be confirmed. Check the row before retrying."
              : "Gmail replay did not run.";
  try {
    active?.toast(message, "Communication Command Center", 5);
  } catch {
    // UI feedback does not alter recovery state.
  }
  console.info(JSON.stringify(result));
  return result;
}

async function controlSelectedGmailReplay(target: "failure" | "queue") {
  try {
    assertOwner();
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (!flag("MANUAL_WRITES") || !flag("GMAIL_INTAKE"))
      return gmailReplayResult(active, { ok: true, status: "disabled" });
    const id = workbookId();
    if (!active || active.getId() !== id)
      return gmailReplayResult(active, {
        ok: false,
        error_code: "WORKBOOK_MISMATCH",
      });
    const sheetName = target === "failure" ? "Dead_Letter" : "Queue";
    const range = active.getActiveRange();
    if (
      !range ||
      range.getSheet().getName() !== sheetName ||
      range.getNumRows() !== 1 ||
      range.getRow() < 2
    )
      return gmailReplayResult(active, {
        ok: false,
        error_code: "INVALID_SELECTION",
      });
    const gateway = googleGateway();
    const before = gateway.read(id, sheetName);
    const selectedRow =
      target === "failure"
        ? selectedSnapshotInvalidDeadLetter(
            before.headers,
            before.rows,
            range.getRow() - 2,
          )
        : selectedQueueSnapshot(
            before.headers,
            before.rows,
            range.getRow() - 2,
          );
    if (!selectedRow)
      return gmailReplayResult(active, {
        ok: false,
        error_code: "INVALID_SELECTION",
      });
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
      target === "failure"
        ? "Retry selected Gmail snapshot failure"
        : "Replay selected Gmail Queue item",
      "Confirm this selected Gmail metadata-only replay.",
      ui.ButtonSet.OK_CANCEL,
    );
    if (response.getSelectedButton() !== ui.Button.OK)
      return gmailReplayResult(active, { ok: true, status: "cancelled" });
    const selection = {
      selectedRowIndex: range.getRow() - 2,
      selectedRow,
      authorize: () => {
        try {
          assertOwner();
          const current = SpreadsheetApp.getActiveSpreadsheet();
          return (
            flag("MANUAL_WRITES") &&
            flag("GMAIL_INTAKE") &&
            Boolean(current && current.getId() === id && workbookId() === id)
          );
        } catch {
          return false;
        }
      },
    };
    const result =
      target === "failure"
        ? await retrySelectedGmailSnapshotInvalid(
            gateway,
            nativeGmail(),
            id,
            new Date().toISOString(),
            sha256,
            selection,
          )
        : await replaySelectedGmailQueueItem(
            gateway,
            nativeGmail(),
            id,
            new Date().toISOString(),
            sha256,
            selection,
          );
    return gmailReplayResult(active, result);
  } catch {
    return gmailReplayResult(null, {
      ok: false,
      error_code: "OPERATION_FAILED",
    });
  }
}

export function cccRetrySelectedGmailSnapshotFailure() {
  return controlSelectedGmailReplay("failure");
}
export function cccReplaySelectedGmailQueueItem() {
  return controlSelectedGmailReplay("queue");
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
  let failureStage:
    "authorization" | "feature_flag" | "setup" | "reconciliation" =
    "authorization";
  try {
    assertOwner();
    failureStage = "feature_flag";
    if (!flag(studio ? "STUDIO_PROCESSING" : "GMAIL_INTAKE"))
      return codeResult(() => ({ ok: true, status: "disabled" }));
    failureStage = "setup";
    const gateway = googleGateway(),
      gmail = nativeGmail(),
      id = workbookId(),
      now = new Date().toISOString();
    failureStage = "reconciliation";
    const result = studio
      ? await runtimeReconciler(gateway, gmail, id, sha256).processStudioInbox(
          now,
          5,
        )
      : await runBoundedGmailReconciliation(
          gateway,
          gmail,
          id,
          now,
          sha256,
          () => {
            assertOwner();
            return flag("GMAIL_INTAKE") && workbookId() === id;
          },
          gmailLookbackDays(),
        );
    // The domain result contains only fixed statuses and numeric counts.
    return codeResult(() => ({ ok: true, ...result }));
  } catch (error) {
    const failureKind =
      error instanceof SheetCommitUncertainError
        ? "sheet_commit_uncertain"
        : error instanceof SheetApiReadError
          ? error.operation === "values"
            ? "sheet_values_read_failure"
            : "sheet_metadata_read_failure"
          : error instanceof Error &&
              error.name === "GoogleJsonResponseException"
            ? "google_api_failure"
            : "unexpected_failure";
    return codeResult(() => ({
      ok: false,
      error_code: "RECONCILIATION_FAILED",
      failure_stage: failureStage,
      failure_kind: failureKind,
      ...(error instanceof SheetApiReadError && error.target
        ? { failure_target: error.target }
        : {}),
    }));
  }
}
export function cccReconcileGmail() {
  return reconcile(false);
}
/**
 * Advances at most eight durable Gmail steps in one operator invocation.
 * Every step persists independently. Transient Sheets reads share two bounded
 * backoffs across the invocation; all other controlled retry, block, disable,
 * and completion states stop the batch immediately.
 */
export async function cccReconcileGmailBatch() {
  const total = {
    ok: true,
    status: "more",
    steps: 0,
    processed: 0,
    excluded: 0,
    failed: 0,
  };
  let readRetriesUsed = 0;
  for (let step = 0; step < 8; step++) {
    let result: {
      ok: boolean;
      status?: string;
      processed?: number;
      excluded?: number;
      failed?: number;
      failure_stage?: string;
      failure_kind?: string;
    };
    let retryableReadFailure: boolean;
    do {
      result = (await reconcile(false)) as typeof result;
      retryableReadFailure =
        !result.ok &&
        result.failure_stage === "reconciliation" &&
        (result.failure_kind === "sheet_values_read_failure" ||
          result.failure_kind === "sheet_metadata_read_failure") &&
        readRetriesUsed < 2;
      if (retryableReadFailure) {
        readRetriesUsed++;
        Utilities.sleep(30_000 * readRetriesUsed);
      }
    } while (retryableReadFailure);
    if (!result.ok || result.status === "disabled") return result;
    total.steps++;
    total.processed += result.processed ?? 0;
    total.excluded += result.excluded ?? 0;
    total.failed += result.failed ?? 0;
    total.status = result.status ?? "blocked";
    if (total.status !== "more") break;
    if (step < 7) Utilities.sleep(6000);
  }
  return codeResult(() => total);
}
export function cccProcessStudio() {
  return reconcile(true);
}

/** Starts the configured bounded Gmail window; requires Gmail intake to be off. */
export async function cccStartGmailReconciliationWindow() {
  try {
    assertOwner();
    const gateway = googleGateway(),
      id = workbookId(),
      result = await resetBoundedGmailReconciliation(
        gateway,
        id,
        new Date().toISOString(),
        gmailLookbackDays(),
        () => {
          assertOwner();
          return !flag("GMAIL_INTAKE") && workbookId() === id;
        },
      );
    return codeResult(() => ({ ok: true, ...result }));
  } catch {
    return codeResult(() => ({ ok: false, error_code: "WINDOW_START_FAILED" }));
  }
}

export function cccGmailReadProbe() {
  return codeResult(() => {
    assertOwner();
    const profile = Gmail!.Users!.getProfile("me");
    if (profile.emailAddress?.toLowerCase() !== "contact@elev8mediaky.com")
      throw new Error("ACCOUNT_MISMATCH");
    const lookbackDays = gmailLookbackDays();
    const now = Math.floor(Date.now() / 1000);
    const page = Gmail!.Users!.Messages!.list("me", {
      q: `after:${now - lookbackDays * 86400} before:${now} -category:promotions -category:forums -in:spam -in:trash`,
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
      bounded_days: lookbackDays,
      sampled_messages: first ? 1 : 0,
      metadata_verified: verified,
      raw_content_stored: false,
      mutations: 0,
    };
  });
}
