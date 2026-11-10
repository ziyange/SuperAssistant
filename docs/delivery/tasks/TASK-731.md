# TASK-731: Implement workspace-scoped idempotent Project catalog persistence

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user-approved continuous H1 remediation.

## Requirement IDs
REQ-006, REQ-007, REQ-010, REQ-090, REQ-095, REQ-099

## Objective
Provide the durable scoped Project listing and duplicate-safe registration required by the H1 Project Center.

## Context Pack
- docs/delivery/tasks/TASK-104.md
- docs/delivery/phase-007-integration-recovery.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/verification/quality-gate.md
- packages/domain/src/ports/project-repository.ts
- packages/persistence/src/repositories/project-repository.ts

## Allowed Files
- docs/delivery/tasks/TASK-731.md
- docs/verification/reports/phase-007-task-731.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/data-model.md
- packages/domain/src/ports/project-repository.ts
- packages/persistence/src/repositories/project-repository.ts
- packages/persistence/tests/project-repository.test.ts

## Forbidden Files
No UI, IPC, production path discovery, migrations, user projects, secrets, archived evidence or unrelated code changes.

## Interfaces / Contracts
ProjectRepository exposes list scoped by Workspace. Re-registering an already canonicalized path in the same Workspace returns its existing record without modifying metadata; different Workspaces remain isolated. Path existence, Git detection and realpath canonicalization remain the responsibility of a later main-process registration service.

## Data Constraints
Use the existing unique Workspace and canonical-key constraint. Preserve existing project IDs, metadata, lifecycle states and all prior data.

## UI Constraints
No UI changes; the Project Center must not be declared connected by this task.

## Implementation Requirements
Write failing tests for repeated normalized-path registration, workspace isolation, and stable list projection before changing the repository. Resolve only the specific canonical-key uniqueness conflict as an idempotent return; propagate other database failures.

## Test Requirements
Run focused real SQLite repository tests, full lint and relevant TypeScript checks. Run complete unit regression, task pack validation and anchored runtime verification.

## Acceptance Criteria
Equivalent normalized paths in one Workspace return one stable Project without metadata changes; separate Workspaces are isolated; listing returns only the requested Workspace and deterministic ordering.

## Done Definition
Tests and governance evidence are recorded. Actual filesystem canonicalization, Project IPC, native folder selection and renderer integration remain unaccepted until subsequent tasks.

## Risks
Incorrect uniqueness handling could expose another Workspace or conceal unrelated storage errors; all lookups must bind the Workspace and catch only the relevant constraint.

## Output Required
docs/verification/reports/phase-007-task-731.md
