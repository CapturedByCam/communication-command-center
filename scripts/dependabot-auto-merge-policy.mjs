import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const repository = "CapturedByCam/communication-command-center";

function isStablePatch(previous, next) {
  const version = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  if (!version.test(previous) || !version.test(next)) return false;
  const before = previous.split(".");
  const after = next.split(".");
  return (
    before[0] === after[0] &&
    before[1] === after[1] &&
    BigInt(after[2]) > BigInt(before[2])
  );
}

// Metadata must first pass dependabot/fetch-metadata's author and signature checks.
export function isEligible({ pull, files, updates, expectedHead }) {
  return (
    /^[a-f0-9]{40}$/.test(expectedHead) &&
    pull?.head?.sha === expectedHead &&
    pull?.user?.login === "dependabot[bot]" &&
    pull.state === "open" &&
    pull.draft === false &&
    pull.commits === 1 &&
    pull.base?.ref === "main" &&
    pull.base?.repo?.full_name === repository &&
    pull.head?.repo?.full_name === repository &&
    Array.isArray(files) &&
    files.length > 0 &&
    files.length === pull.changed_files &&
    files.every(
      (file) =>
        file?.status === "modified" &&
        ["package.json", "pnpm-lock.yaml"].includes(file.filename),
    ) &&
    Array.isArray(updates) &&
    updates.length > 0 &&
    updates.every(
      (update) =>
        update?.dependencyType === "direct:development" &&
        update.updateType === "version-update:semver-patch" &&
        update.packageEcosystem === "npm_and_yarn" &&
        update.directory === "/" &&
        update.targetBranch === "main" &&
        update.maintainerChanges === false &&
        isStablePatch(update.prevVersion, update.newVersion),
    )
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [, , pullPath, filesPath] = process.argv;
  const eligible = isEligible({
    pull: JSON.parse(readFileSync(pullPath, "utf8")),
    files: JSON.parse(readFileSync(filesPath, "utf8")),
    updates: JSON.parse(process.env.DEPENDABOT_UPDATES),
    expectedHead: process.env.EXPECTED_HEAD,
  });
  console.log(`eligible=${eligible}`);
}
