import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const RUNNABLE_TYPES = new Set(["SERVER_JS", "HTML"]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeLf(value) {
  return value.replace(/\r\n?/gu, "\n");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  return value;
}

function semanticJson(source) {
  if (typeof source !== "string") return null;
  try {
    return JSON.stringify(canonicalJson(JSON.parse(source)));
  } catch {
    return null;
  }
}

function parsedArguments(argv) {
  let content = null;
  let dist = "dist";
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--content") content = argv[++index] ?? null;
    else if (value === "--dist") dist = argv[++index] ?? "";
    else return null;
  }
  return content && dist ? { content, dist } : null;
}

function statusLine(name, expected, actual) {
  const matches = expected !== null && actual !== null && expected === actual;
  return {
    matches,
    output: `${name} status=${matches ? "match" : "drift"} expected_sha256=${expected ? sha256(expected) : "absent"} actual_sha256=${actual ? sha256(actual) : "absent"}`,
  };
}

async function main() {
  const args = parsedArguments(process.argv.slice(2));
  if (!args) {
    console.log("STATUS=invalid");
    process.exitCode = 2;
    return;
  }

  let expectedCode;
  let expectedManifest;
  let deployment;
  try {
    [expectedCode, expectedManifest, deployment] = await Promise.all([
      readFile(path.join(args.dist, "Code.js"), "utf8"),
      readFile(path.join(args.dist, "appsscript.json"), "utf8"),
      readFile(args.content, "utf8"),
    ]);
  } catch {
    console.log("STATUS=invalid");
    process.exitCode = 2;
    return;
  }

  let files;
  try {
    const content = JSON.parse(deployment);
    files = Array.isArray(content.files) ? content.files : null;
  } catch {
    files = null;
  }
  if (!files) {
    console.log("STATUS=invalid");
    process.exitCode = 2;
    return;
  }

  const runnable = files
    .filter(
      (file) =>
        file &&
        typeof file.name === "string" &&
        typeof file.type === "string" &&
        RUNNABLE_TYPES.has(file.type),
    )
    .map((file) => `${file.type}:${file.name}`)
    .sort();
  const expectedRunnable = ["SERVER_JS:Code"];
  const runnableMatches =
    JSON.stringify(runnable) === JSON.stringify(expectedRunnable);
  const code = files.find(
    (file) => file?.name === "Code" && file?.type === "SERVER_JS",
  );
  const manifest = files.find(
    (file) => file?.name === "appsscript" && file?.type === "JSON",
  );
  const codeLine = statusLine(
    "CODE",
    normalizeLf(expectedCode),
    typeof code?.source === "string" ? normalizeLf(code.source) : null,
  );
  const manifestLine = statusLine(
    "MANIFEST",
    semanticJson(expectedManifest),
    semanticJson(manifest?.source),
  );

  console.log(`RUNNABLE status=${runnableMatches ? "match" : "drift"}`);
  console.log(codeLine.output);
  console.log(manifestLine.output);
  const matches = runnableMatches && codeLine.matches && manifestLine.matches;
  console.log(`STATUS=${matches ? "match" : "drift"}`);
  if (!matches) process.exitCode = 1;
}

await main();
