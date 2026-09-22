import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getExpectedHeaders } from "../../src/adapters/sheets/sheet-table.js";

const manifestPath = resolve("studio/flow-manifest.json");
const readManifest = () => JSON.parse(readFileSync(manifestPath, "utf8"));

describe("Workspace Studio deployment blueprint", () => {
  it("provides a versioned manifest for a disabled, unbound pilot", () => {
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = readManifest();
    expect(manifest.manifest_version).toBe("1.0");
    expect(manifest.staging_schema_version).toBe("1.0");
    expect(manifest.enabled).toBe(false);
    expect(manifest.deployment_ready).toBe(false);
    expect(manifest.bindings.spreadsheet_id).toBe("${PILOT_SPREADSHEET_ID}");
    expect(manifest.bindings.synthetic_sender).toBe(
      "${APPROVED_SYNTHETIC_SENDER}",
    );
    expect(manifest.send_steps).toEqual([]);
  });

  it("allows only the reviewed built-in actions and order", () => {
    const manifest = readManifest();
    expect(manifest.starter.action).toBe("When I get an email");
    expect(manifest.starter.include_flow_created_mail).toBe(false);
    expect(
      manifest.steps.map((step: { action: string }) => step.action),
    ).toEqual([
      "Decide",
      "Extract",
      "Add a row",
      "Check if",
      "Ask Gemini",
      "Draft an email",
    ]);
    expect(manifest.steps[3].all_of).toEqual([
      "validated.requires_response",
      "validated.draft_risk_is_routine",
      "trusted.known_contact",
      "validated.direct_response_requested",
      "trusted.intake_enabled",
      "trusted.drafting_enabled",
      "trusted.no_existing_or_uncertain_draft",
      "trusted.source_is_current",
    ]);
    expect(manifest.steps[5].enabled).toBe(false);
    expect(manifest.steps[5].parent).toBe("routine_gate");
    expect(manifest.steps[4].parent).toBe("routine_gate");
  });

  it("maps only validated bounded metadata to every staging column", () => {
    const mapping = readManifest().steps[2].field_mappings;
    expect(Object.keys(mapping)).toEqual(getExpectedHeaders("Studio_Inbox"));
    for (const [column, variable] of Object.entries(mapping)) {
      expect(variable).toBe(`validated.${column}`);
    }
    expect(readManifest().steps[2].sheet).toBe("Studio_Inbox");
  });

  it("pins every model prompt to the exact reviewed bytes", () => {
    const manifest = readManifest();
    const prompts = manifest.steps.filter(
      (step: { prompt?: unknown }) => step.prompt,
    );
    expect(prompts).toHaveLength(3);
    for (const step of prompts) {
      expect(step.prompt.path).toMatch(/^studio\/prompts\/[a-z-]+\.txt$/);
      const bytes = readFileSync(resolve(step.prompt.path));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        step.prompt.sha256,
      );
    }
  });

  it("keeps unproven platform bindings blocked", () => {
    const gates = readManifest().activation_gates;
    expect(gates.map((gate: { id: string }) => gate.id)).toEqual([
      "google_access",
      "source_identity",
      "event_metadata",
      "validation_binding",
      "literal_sheet_writes",
      "canonical_reconciliation",
      "draft_idempotency",
      "draft_thread_target",
      "kill_switches",
      "synthetic_account_tests",
    ]);
    expect(
      gates.every((gate: { status: string }) => gate.status === "pending"),
    ).toBe(true);
  });
});
