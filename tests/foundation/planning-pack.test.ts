import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const requiredFiles = [
  "AGENTS.md",
  "START_HERE_CODEX.md",
  "COMMUNICATION_COMMAND_CENTER_ROADMAP.md",
  "docs/spec/PRODUCT_AND_ARCHITECTURE_SPEC.md",
  "docs/wayfinder/MAP.md",
  "docs/pmc/BOOTSTRAP.md",
];

describe("Phase 0 planning pack", () => {
  it.each(requiredFiles)("contains %s", async (file) => {
    await expect(access(file)).resolves.toBeUndefined();
  });

  it("preserves the no-auto-send invariant", async () => {
    const agents = await readFile("AGENTS.md", "utf8");
    expect(agents).toContain("never send");
  });
});
