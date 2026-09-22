import { access, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const entrypoint = path.resolve("src/apps-script/entrypoints.ts");
await access(entrypoint); // Missing runtime code is a build failure.
await mkdir("dist", { recursive: true });
const entrypoints = [
  "doGet",
  "doPost",
  "onOpen",
  "cccInitializePilot",
  "cccMigrateEmptyCommitments",
  "cccHealth",
  "cccDisableAll",
  "cccBuildBriefing",
  "cccGmailReadProbe",
  "cccReconcileGmail",
  "cccProcessStudio",
  "cccConfigureStudioStep",
  "cccExecuteStudioStep",
  "cccResolveSelectedQueueRow",
  "cccReopenSelectedQueueRow",
  "cccSnoozeSelectedQueueRow",
  "cccSetSelectedQueueWaiting",
  "cccRetrySelectedGmailSnapshotFailure",
  "cccReplaySelectedGmailQueueItem",
];
await build({
  entryPoints: [entrypoint],
  bundle: true,
  format: "iife",
  globalName: "CCC",
  outfile: "dist/Code.js",
  platform: "neutral",
  target: "es2019",
  footer: {
    js: entrypoints
      .map((name) => `function ${name}(event) { return CCC.${name}(event); }`)
      .join("\n"),
  },
});
await copyFile("appsscript.json", "dist/appsscript.json");
console.log("PASS: built callable Apps Script globals and explicit manifest");
