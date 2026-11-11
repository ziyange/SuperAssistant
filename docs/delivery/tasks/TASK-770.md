# TASK-770: Expose failing Windows CI tests

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authorization: user authorized remediation of development-baseline merge blockers.

## Requirement IDs
REQ-092, REQ-093, REQ-096

## Objective
Make Windows Vitest failures visible in CI logs while retaining JSON gate evidence and every existing test.

## Context Pack
- docs/verification/reports/phase-007-task-769.md
- docs/verification/quality-gate.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-769.md

## Allowed Files
- docs/delivery/tasks/TASK-770.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/application-gates.yml
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-770.md

## Forbidden Files
Application sources, source evidence, archived evidence, user workspaces and TASK-716 WIP. No real Codex or sandbox tests, merge or cleanup.

## Interfaces / Contracts
Vitest must still return a nonzero exit for failures and JSON counts must still be validated without skipping tests. Anchor documentation CI to this task while preserving chain integrity.

## Data Constraints
No credentials or real user data. Log test output only.

## UI Constraints
No UI changes.

## Implementation Requirements
Use the default console reporter together with a separate JSON report so failure details are visible. Rerun remote CI and address identified failure in a separately scoped task.

## Test Requirements
Run the governance sequence and actual candidate-SHA CI. Confirm the default reporter exposes failures and the JSON summary remains parseable.

## Acceptance Criteria
CI failures identify the failing tests; no failure can be masked and the JSON checker still runs after successful tests.

## Done Definition
Record observed CI results, with subsequent test fixes handled under explicit scope.

## Risks
Reporter options must not suppress failure exit codes or replace the JSON report.

## Output Required
docs/verification/reports/phase-007-task-770.md
