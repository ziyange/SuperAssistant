# TASK-767: Add nonempty application and PostgreSQL CI gates

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user approved development-baseline merge blocker remediation.

## Requirement IDs
REQ-090, REQ-092, REQ-093, REQ-095, REQ-096, REQ-099

## Objective
Add candidate-branch CI for Windows application checks and disposable PostgreSQL compatibility, without representing deferred real Codex or Electron sandbox validation as passed.

## Context Pack
- .github/workflows/docs-gates.yml
- docs/verification/quality-gate.md
- docs/verification/reports/phase-007-task-766.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/operations.md
- docs/verification/quality-gate.md
- docs/verification/test-strategy.md
- docs/delivery/tasks/TASK-766.md

## Allowed Files
- docs/delivery/tasks/TASK-767.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/verification/quality-gate.md
- docs/README.md
- docs/verification/reports/phase-007-task-767.md
- .github/workflows/application-gates.yml
- .github/workflows/docs-gates.yml
- scripts/check_vitest_summary.py
- tests/test_check_vitest_summary.py

## Execution Expansion
The existing documentation workflow applies TASK-000 scope to the entire
subsequent audit history and currently returns Exit 2. Under the user's
approved blocker remediation, update this exact workflow to use TASK-767's
validated task-start anchor while still checking the complete audit chain.
Future tasks must update the CI anchor as part of their own approved scope.

## Forbidden Files
No application code, package dependencies or lockfile changes, live credentials, user databases, real Codex, Electron sandbox execution, archived evidence, main merge or cleanup.

## Interfaces / Contracts
CI runs on pull requests, candidate branch push, main push and manual dispatch. Windows Node 22.19.0 runs npm ci, build, lint, typecheck, unit and contract tests. A separate Linux PostgreSQL 16 service runs both database test files against synthetic disposable data. The report checker fails on missing, invalid, failed, zero-test, inconsistent or unexpectedly skipped results; Windows unit may skip only the six database cases in their two named files because a separate database job must pass with zero skips. CI results remain planned until a real run on the candidate SHA completes.

## Data Constraints
CI database is an isolated ephemeral service with synthetic test data and no secrets. Local tests use temporary files only. No production or existing PostgreSQL database is touched.

## UI Constraints
No UI changes.

## Implementation Requirements
Update current gate facts first. Test the summary checker before implementation for passing reports, zero tests, failed tests, mismatched counts, unknown skipped files and missing required files. Add the workflow using direct Vitest invocations without pass-with-no-tests. Keep current documentation workflow intact.

## Test Requirements
Run checker tests RED then GREEN, validate workflow YAML, run representative real Vitest JSON through the checker, run Python governance and document links, build, lint, typecheck, full unit and contract tests. Record explicit CI and sandbox deferrals. Push candidate only after an independently checked clean candidate is available.

## Acceptance Criteria
Checker fails closed on missing, zero, failed, inconsistent or unauthorized skips. Workflow defines distinct Windows application and PostgreSQL jobs and cannot report a green result from zero discovered tests. No remote CI success is claimed until observed on the final SHA.

## Done Definition
Record local evidence and any remaining candidate, CI, security or release blockers; do not represent a development-baseline merge as H1 acceptance.

## Risks
Windows runner installation, native modules, disposable PostgreSQL service or permissions may fail remotely; preserve the run evidence and fix rather than weakening checks.

## Output Required
docs/verification/reports/phase-007-task-767.md
