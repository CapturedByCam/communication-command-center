import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ShortcutIntakeSchema } from "../../src/domain/schemas.js";

const payloadPath = new URL(
  "../../shortcuts/example-payload.json",
  import.meta.url,
);

describe("Apple Shortcut payload artifact", () => {
  it("is a redacted, versioned ShortcutIntake example", async () => {
    const raw = await readFile(payloadPath, "utf8");
    const payload = ShortcutIntakeSchema.parse(JSON.parse(raw));

    expect(payload.source).toBe("apple_share_sheet");
    expect(payload.auth_token).toMatch(/^SYNTHETIC_NOT_A_REAL_SECRET_/);
    expect(raw).not.toMatch(/sk-[A-Za-z0-9]/);
  });

  it("documents the local 12,000-character capture ceiling", async () => {
    const inventory = await readFile(
      new URL("../../shortcuts/ADD_TO_COMMAND_CENTER.md", import.meta.url),
      "utf8",
    );

    expect(inventory).toContain("12,000 characters");
    expect(inventory).toContain("Action inventory version: `1.0`");
  });
});
