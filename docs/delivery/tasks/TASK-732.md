# TASK-732: Validate and canonicalize Project registration paths

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user-approved continuous H1 remediation.

## Requirement IDs
REQ-006, REQ-007, REQ-010, REQ-090, REQ-094, REQ-095, REQ-098

## Objective
Add a main-process registration service that validates accessible directories and resolves filesystem aliases before invoking the Workspace-scoped catalog.

## Context Pack
- docs/delivery/tasks/TASK-104.md
- docs/delivery/tasks/TASK-731.md
- docs/delivery/phase-007-integration-recovery.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/data-model.md
- docs/verification/quality-gate.md
- apps/desktop/src/main/project-ipc.ts
- packages/persistence/src/repositories/project-repository.ts

## Allowed Files
- docs/delivery/tasks/TASK-732.md
- docs/verification/reports/phase-007-task-732.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/architecture.md
- apps/desktop/src/main/project-ipc.ts
- apps/desktop/tests/main/project-ipc.test.ts

## Forbidden Files
No UI, preload, IPC transport, migration, external repository modification, network operation, archived evidence, package lock or unrelated application change.

## Interfaces / Contracts
The main-process service accepts a trusted Workspace ID and candidate path, resolves realpath, verifies readable directory and rejects filesystem roots before one catalog registration. A duplicate resolved path returns the existing Project. Unknown metadata remains null and is never invented. Errors exposed to UI remain generic.

## Data Constraints
Path validation precedes every catalog write. No credentials, remote URLs, filesystem content or raw error details are stored as metadata.

## UI Constraints
No UI changes; this service is not exposed to the renderer until a later reviewed IPC task.

## Implementation Requirements
Document the service boundary before coding. Test aliases, missing paths, file paths, root rejection, Workspace isolation and unchanged original files with temporary directories and a real SQLite catalog.

## Test Requirements
Run new failure test before implementation; run focused unit tests, full lint and desktop typecheck; then full unit regression and anchored runtime verification.

## Acceptance Criteria
Valid directories persist once per Workspace; a filesystem alias returns the same Project; invalid paths create no rows; the service does not mutate the registered directory or leak raw path errors to the renderer-facing error function.

## Done Definition
Record test evidence and limitations. Project IPC, native folder selection, renderer integration and M1 remain unaccepted.

## Risks
Path aliases and invalid input could point work at the wrong location. Realpath and directory checks are required before persistence; link traversal after registration remains a separate preflight concern.

## Output Required
docs/verification/reports/phase-007-task-732.md
