import fs from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(fs.readFileSync("appsscript.json", "utf8"));

describe("Studio custom-step deployment contract", () => {
  it("exposes only bounded interpretation input and controlled output variables", () => {
    const elements = manifest.addOns?.studio?.flows?.workflowElements;
    expect(elements).toHaveLength(1);
    const step = elements[0].workflowAction;
    expect(step.inputs.map((field: { id: string }) => field.id)).toEqual([
      "gmail_message_id",
      "model_json",
    ]);
    expect(step.outputs.map((field: { id: string }) => field.id)).toEqual([
      "status",
      "ingest_id",
    ]);
    for (const field of [...step.inputs, ...step.outputs]) {
      expect(field.cardinality).toBe("SINGLE");
      expect(field.dataType).toEqual({ basicType: "STRING" });
    }
    expect(step.onConfigFunction).toBe("cccConfigureStudioStep");
    expect(step.onExecuteFunction).toBe("cccExecuteStudioStep");
    expect(elements[0].workflowTrigger).toBeUndefined();
  });

  it("exposes only the approved fixed-rejection public endpoint and exact runtime scopes", () => {
    expect(manifest.webapp).toEqual({
      access: "ANYONE_ANONYMOUS",
      executeAs: "USER_DEPLOYING",
    });
    expect(manifest.oauthScopes).toEqual([
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/script.scriptapp",
    ]);
    expect(manifest.addOns?.common?.useLocaleFromApp).toBeUndefined();
    expect(manifest.exceptionLogging).toBe("NONE");
  });
});
