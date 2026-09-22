# GitHub Repository Automation

## Automatic checks

`.github/workflows/ci.yml` runs on every pull request and every push to `main`.
It installs dependencies from the committed lockfile, runs `pnpm verify`, and
validates the planning pack.

The `CI / Verify repository` result is advisory while required status checks
are unavailable for this private repository under the current GitHub account
plan. Do not merge a failing pull request even when GitHub permits the merge.

## Automatic closure

Pull requests close automatically when merged or when a maintainer explicitly
closes them. The repository does not automatically close inactive pull requests,
because inactivity is not evidence that the work is invalid.

The pull request template includes `Closes #ISSUE_NUMBER`. Replace the
placeholder with the implementation issue number. GitHub will close that linked
issue when the pull request is merged into `main`.
