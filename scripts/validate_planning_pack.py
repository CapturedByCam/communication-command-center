\
#!/usr/bin/env python3
from pathlib import Path
import sys
import json
import re

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
required = [
    "AGENTS.md",
    "README.md",
    "START_HERE_CODEX.md",
    "docs/spec/PRODUCT_AND_ARCHITECTURE_SPEC.md",
    "docs/superpowers/plans/2026-09-21-communication-command-center.md",
    "docs/runbooks/DEPLOYMENT_AND_OPERATIONS_RUNBOOK.md",
    "docs/wayfinder/MAP.md",
    "docs/pmc/BOOTSTRAP.md",
    "schemas/communication-item.schema.json",
    "schemas/shortcut-intake.schema.json",
    "schemas/studio-staging.schema.json",
    "studio/GMAIL_INTAKE_FLOW.md",
    "studio/DAILY_BRIEFING_FLOW.md",
    "shortcuts/ADD_TO_COMMAND_CENTER.md",
]
errors = []
for rel in required:
    if not (root / rel).exists():
        errors.append(f"missing: {rel}")

for rel in [
    "docs/spec/PRODUCT_AND_ARCHITECTURE_SPEC.md",
    "docs/superpowers/plans/2026-09-21-communication-command-center.md",
    "docs/runbooks/DEPLOYMENT_AND_OPERATIONS_RUNBOOK.md",
]:
    p = root / rel
    if p.exists():
        text = p.read_text(encoding="utf-8")
        for forbidden in ["TODO", "TBD", "implement later", "add appropriate error handling"]:
            if forbidden.lower() in text.lower():
                errors.append(f"{rel}: forbidden placeholder phrase: {forbidden}")

schemas = [
    "schemas/communication-item.schema.json",
    "schemas/shortcut-intake.schema.json",
    "schemas/studio-staging.schema.json",
]
for rel in schemas:
    p = root / rel
    if p.exists():
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            if data.get("type") != "object":
                errors.append(f"{rel}: root type must be object")
            if data.get("additionalProperties") is not False:
                errors.append(f"{rel}: additionalProperties must be false")
        except Exception as exc:
            errors.append(f"{rel}: invalid JSON: {exc}")

runbook = root / "docs/runbooks/DEPLOYMENT_AND_OPERATIONS_RUNBOOK.md"
if runbook.exists():
    text = runbook.read_text(encoding="utf-8")
    for heading in [
        "## Safety classification",
        "## Global stop conditions",
        "## Phase 0 — Verify targets",
        "## Routine operations",
        "## Incident procedures",
        "## Final evidence packet",
    ]:
        if heading not in text:
            errors.append(f"runbook missing heading: {heading}")

if errors:
    print("FAIL")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("PASS")
print(f"Validated planning pack at {root}")
