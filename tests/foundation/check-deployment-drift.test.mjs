import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories = [];

function setup({ files }) {
  const directory = mkdtempSync(path.join(tmpdir(), "ccc-drift-"));
  temporaryDirectories.push(directory);
  const dist = path.join(directory, "dist");
  mkdirSync(dist);
  writeFileSync(path.join(dist, "Code.js"), 'const safe = "private";\n');
  writeFileSync(
    path.join(dist, "appsscript.json"),
    JSON.stringify({ timeZone: "America/New_York", runtimeVersion: "V8" }),
  );
  const content = path.join(directory, "projects-get-content.json");
  writeFileSync(content, JSON.stringify({ files }));
  return { content, dist };
}

function expectedFiles() {
  return [
    { name: "Code", type: "SERVER_JS", source: 'const safe = "private";\r\n' },
    {
      name: "appsscript",
      type: "JSON",
      source: '{"runtimeVersion":"V8","timeZone":"America/New_York"}',
    },
  ];
}

function run({ content, dist }) {
  return spawnSync(
    process.execPath,
    [
      "scripts/check-deployment-drift.mjs",
      "--content",
      content,
      "--dist",
      dist,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("offline Apps Script deployment drift checker", () => {
  it("accepts LF-normalized matching source and semantic manifest JSON", () => {
    const result = run(setup({ files: expectedFiles() }));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("STATUS=match");
    expect(result.stdout).toMatch(
      /CODE status=match expected_sha256=[a-f0-9]{64} actual_sha256=[a-f0-9]{64}/u,
    );
    expect(result.stdout).not.toContain("private");
  });

  it("fails without printing source when deployed code differs", () => {
    const files = expectedFiles();
    files[0].source = 'const changed = "private";\n';

    const result = run(setup({ files }));

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("STATUS=drift");
    expect(result.stdout).toContain("CODE status=drift");
    expect(result.stdout).not.toContain("changed");
    expect(result.stdout).not.toContain("private");
  });

  it("rejects extra or missing runnable files", () => {
    const extra = expectedFiles();
    extra.push({
      name: "Helper",
      type: "SERVER_JS",
      source: "function helper() {}\n",
    });
    const extraResult = run(setup({ files: extra }));
    const missingResult = run(setup({ files: expectedFiles().slice(1) }));

    expect(extraResult.status).not.toBe(0);
    expect(extraResult.stdout).toContain("RUNNABLE status=drift");
    expect(missingResult.status).not.toBe(0);
    expect(missingResult.stdout).toContain("RUNNABLE status=drift");
  });
});
