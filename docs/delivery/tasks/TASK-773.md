# TASK-773: Close legacy direct-dispatch bypass

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user requested autonomous remediation of merge-blocking security issues.

## Requirement IDs
REQ-027, REQ-030, REQ-031, REQ-038, REQ-090, REQ-091, REQ-095, REQ-098

## Objective
Fail closed the unused legacy ExecutionOrchestrator direct-adapter dispatch path, which bypasses the guarded durable OutboxDispatcher. Do not enable actual execution.

## Context Pack
- docs/verification/reports/phase-007-task-772.md
- docs/orchestration.md
- apps/desktop/src/main/outbox-dispatcher.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-772.md

## Allowed Files
- docs/delivery/tasks/TASK-773.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/orchestration.md
- apps/desktop/src/main/orchestrator.ts
- apps/desktop/tests/main/orchestrator.test.ts
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-773.md

## Forbidden Files
No production startup wiring, real Adapter execution, user database, user project, Electron sandbox, source evidence, archived evidence, dirty worktrees, merge or cleanup.

## Interfaces / Contracts
Legacy direct dispatch remains callable for compatibility but fails closed before repository or adapter side effects for every state. OutboxDispatcher is a separately guarded component and is not production execution. Do not pretend this implements authorization, full preflight or runtime fencing.

## Data Constraints
Use fake external ports and no user data. No records or subprocesses are created by the disabled direct path.

## UI Constraints
No UI changes; production execution remains disabled.

## Implementation Requirements
Document the disabled path before coding. Write RED tests that demonstrate the unsafe path invokes repository and adapter before replacing it with an explicit error. Preserve tests for guarded outbox dispatch.

## Test Requirements
Run targeted tests, lint, typecheck, build, complete unit and contract suites, ordered governance and anchored runtime. Run candidate CI.

## Acceptance Criteria
Every direct dispatch, including UNKNOWN and RECONCILING, rejects without repository or adapter effects. Guarded outbox tests remain intact. No feature or acceptance claim is implied.

## Done Definition
Record actual test and CI evidence and remaining live execution blockers.

## Risks
This removes an unsafe internal capability; it does not provide a working replacement. Enabling execution still requires a fully integrated trusted path.

## Output Required
docs/verification/reports/phase-007-task-773.md
