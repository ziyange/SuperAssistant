# TASK-782: Check H1 Proposal candidate against local catalog

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user requested continued autonomous remediation.

## Requirement IDs
REQ-008, REQ-014, REQ-018, REQ-021, REQ-022, REQ-026, REQ-090, REQ-094

## Objective
Compare a structurally valid H1 candidate to local owner Workspace, assigned Project, registered Codex and Function records without enabling execution.

## Context Pack
- docs/data-model.md
- docs/orchestration.md
- docs/delivery/tasks/TASK-781.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-782.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/orchestration.md
- apps/desktop/src/main/proposal-catalog-check.ts
- apps/desktop/tests/main/proposal-catalog-check.test.ts
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-782.md

## Forbidden Files
All other files, including application UI, IPC, adapter execution, credentials, user databases, archived evidence and Git branch cleanup.

## Interfaces / Contracts
checkLocalProposalCatalog(database, input) parses untrusted input and returns REJECTED or REQUIRES_LIVE_VERIFICATION only. It reads the unique active local owner Workspace, an ACTIVE Project assigned to the same registered non-disabled Codex Agent, active Function belonging to that Agent, and matching Project snapshot and Agent/Function versions. It never returns READY.

## Data Constraints
Read-only SQLite access; no creation of workspace, records, Grant, Task, Attempt or external effects. No paths or secrets are returned.

## UI Constraints
No renderer or IPC changes.

## Implementation Requirements
Document boundaries first. Reject malformed, foreign, locked, missing, stale, disabled, mismatched or ambiguous facts. Persisted health is not live evidence.

## Test Requirements
Use real in-memory SQLite fixtures; cover matching and every rejected identity, assignment, state and version case; verify no mutation and generic outputs. Run targeted and full tests, build, lint, typecheck and governance.

## Acceptance Criteria
No input can yield READY; a match still requires live baseline, capability, policy, clock and authorization verification. No user project or side effect is touched.

## Done Definition
Record actual verification evidence and runtime Exit 0 with exact file boundary.

## Risks
This read is not transactional with any future Grant or Attempt creation and cannot authorize dispatch.

## Output Required
docs/verification/reports/phase-007-task-782.md
