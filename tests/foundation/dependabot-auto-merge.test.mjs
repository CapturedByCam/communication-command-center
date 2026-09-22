import { describe, expect, it } from "vitest";
import { isEligible } from "../../scripts/dependabot-auto-merge-policy.mjs";

const repo = "CapturedByCam/communication-command-center";
function candidate() {
  return {
    expectedHead: "a".repeat(40),
    pull: {
      state: "open",
      draft: false,
      user: { login: "dependabot[bot]" },
      base: { ref: "main", repo: { full_name: repo } },
      head: { sha: "a".repeat(40), repo: { full_name: repo } },
      changed_files: 2,
      commits: 1,
    },
    files: ["package.json", "pnpm-lock.yaml"].map((filename) => ({
      filename,
      status: "modified",
    })),
    updates: [
      {
        dependencyType: "direct:development",
        updateType: "version-update:semver-patch",
        packageEcosystem: "npm_and_yarn",
        directory: "/",
        targetBranch: "main",
        prevVersion: "6.0.2",
        newVersion: "6.0.3",
        maintainerChanges: false,
      },
    ],
  };
}

describe("Dependabot auto-merge eligibility", () => {
  it("accepts a current development patch limited to manifests", () => {
    expect(isEligible(candidate())).toBe(true);
  });

  it.each([
    [
      "additional commits",
      (c) => {
        c.pull.commits = 2;
      },
    ],
    [
      "production dependencies",
      (c) => {
        c.updates[0].dependencyType = "direct:production";
      },
    ],
    [
      "mixed update groups",
      (c) => {
        c.updates.push({
          ...c.updates[0],
          updateType: "version-update:semver-minor",
        });
      },
    ],
    [
      "major upgrades",
      (c) => {
        c.updates[0].newVersion = "7.0.0";
      },
    ],
    [
      "prereleases",
      (c) => {
        c.updates[0].newVersion = "6.0.3-rc.1";
      },
    ],
    [
      "downgrades",
      (c) => {
        c.updates[0].newVersion = "6.0.1";
      },
    ],
    [
      "Actions updates",
      (c) => {
        c.updates[0].packageEcosystem = "github_actions";
      },
    ],
    [
      "unknown metadata",
      (c) => {
        c.updates = [];
      },
    ],
    [
      "null metadata",
      (c) => {
        c.updates = [null];
      },
    ],
    [
      "maintainer changes",
      (c) => {
        c.updates[0].maintainerChanges = true;
      },
    ],
    [
      "other authors",
      (c) => {
        c.pull.user.login = "contributor";
      },
    ],
    [
      "forks",
      (c) => {
        c.pull.head.repo.full_name = "fork/project";
      },
    ],
    [
      "other target branches",
      (c) => {
        c.pull.base.ref = "release";
      },
    ],
    [
      "drafts",
      (c) => {
        c.pull.draft = true;
      },
    ],
    [
      "closed PRs",
      (c) => {
        c.pull.state = "closed";
      },
    ],
    [
      "stale heads",
      (c) => {
        c.pull.head.sha = "b".repeat(40);
      },
    ],
    [
      "application changes",
      (c) => {
        c.files[0].filename = "src/app.ts";
      },
    ],
    [
      "workflow changes",
      (c) => {
        c.files.push({
          filename: ".github/workflows/ci.yml",
          status: "modified",
        });
        c.pull.changed_files++;
      },
    ],
    [
      "renamed files",
      (c) => {
        c.files[0].status = "renamed";
      },
    ],
    [
      "truncated file lists",
      (c) => {
        c.pull.changed_files++;
      },
    ],
  ])("rejects %s", (_name, mutate) => {
    const input = candidate();
    mutate(input);
    expect(isEligible(input)).toBe(false);
  });
});
