# GitHub Repository Automation

## Automatic checks

`.github/workflows/ci.yml` runs on every pull request, every push to `main`, and
manual dispatch.
It installs dependencies from the committed lockfile, runs `pnpm verify`, and
validates the planning pack.

Actions are pinned to verified full commit SHAs. Checkout does not retain Git
credentials. The workflow uses read-only repository contents, a 15-minute
timeout, and cancellation of superseded runs. It uses GitHub-hosted runners and
does not access production accounts or deploy application code.

## Main branch protection

Cam made the repository public and authorized GitHub hardening on 2026-09-22.
The active [Protect main ruleset](https://github.com/CapturedByCam/communication-command-center/rules/23805916)
applies to the default branch, currently `main`. Its reproducible configuration
is `.github/rulesets/main.json`.

- Require a pull request and resolved review conversations.
- Require the exact status context `Verify repository` from GitHub Actions
  (integration ID `15368`), displayed as `CI / Verify repository`.
- Require the branch to be up to date with the target before merging.
- Require CodeQL results, blocking high/critical security alerts and error-level
  code-scanning alerts.
- Block force pushes and branch deletion, with no bypass actors.
- Require zero approving reviews while Cam is the only collaborator. This
  avoids requiring an unavailable second reviewer; milestone review remains
  required by `AGENTS.md`. Revisit the count when another maintainer joins.

The ruleset supplies branch protection; do not duplicate it with a legacy branch
protection rule. Merge commits remain allowed to support existing branch
ancestry and parallel work. Merge queues, signed-commit enforcement, and
deployment gates are not configured because the project has no such workflow.

## Actions and security settings

- Default `GITHUB_TOKEN` permissions: read-only. Actions cannot create or
  approve pull requests using the repository default permission setting.
- Allowed actions: GitHub-owned actions plus `pnpm/action-setup@*`. Other
  Marketplace actions need an explicit allowlist update. Require full commit
  SHA pins for actions at repository level.
- All external contributors require approval before fork PR workflows run.
  Review workflow changes and invoked scripts before approving a run.
- Retain Actions logs and artifacts for 30 days. Logs and fixtures must remain
  free of private content and credentials.
- Enable Dependabot vulnerability alerts and security-update PRs. Weekly
  Actions and npm/pnpm version updates are configured in `.github/dependabot.yml`.
  Dependency PRs use the same verification gate and are not automatically merged.
- Enable secret scanning, secret push protection, and private vulnerability
  reporting.
- Enable GitHub-managed CodeQL default setup for JavaScript/TypeScript and
  Python. GitHub owns the analysis workflow; the repository does not deploy it.
- Offer branch updates and automatically delete merged remote branches.
  Existing local worktrees are not removed. Auto-merge remains available only
  when a maintainer explicitly enables it on an individual PR.

## Verification and maintenance

After changes, run `pnpm verify`, `pnpm validate:planning`, and inspect the hosted
`Verify repository` result before merge. Check `GET /repos/{owner}/{repo}/rules/branches/main`
to confirm effective branch rules. Read back the Actions permissions, security
settings, and CodeQL configuration through GitHub's API after updating them.
Only add a new required check after verifying its exact name and successful
hosted execution. Keep the stored ruleset JSON and this runbook aligned with
GitHub settings.

## Automatic closure

Pull requests close automatically when merged or when a maintainer explicitly
closes them. The repository does not automatically close inactive pull requests,
because inactivity is not evidence that the work is invalid.

The pull request template includes `Closes #ISSUE_NUMBER`. Replace the
placeholder with the implementation issue number. GitHub will close that linked
issue when the pull request is merged into `main`.
