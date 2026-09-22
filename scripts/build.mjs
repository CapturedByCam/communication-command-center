import { access, mkdir } from "node:fs/promises";
import path from "node:path";

const entrypoint = path.resolve("src/apps-script/entrypoints.ts");

try {
  await access(entrypoint);
} catch {
  console.log("PASS: Phase 0 foundation has no application entrypoint yet");
  process.exit(0);
}

const { build } = await import("esbuild");
await mkdir("dist", { recursive: true });
await build({
  entryPoints: [entrypoint],
  bundle: true,
  format: "iife",
  outfile: "dist/Code.js",
  platform: "neutral",
  target: "es2022",
});
console.log("PASS: built dist/Code.js");
