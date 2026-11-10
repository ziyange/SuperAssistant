# TASK-762: Fence queue claims for uncertain Attempts

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: standing authorization for PHASE-007 integration remediation.

## Requirement IDs
REQ-030, REQ-038, REQ-049, REQ-092, REQ-093, REQ-097, REQ-099

## Objective
Prevent a pending outbox message from being claimed when its persisted Attempt is already UNKNOWN or RECONCILING.

## Context Pack
- docs/verification/reports/phase-007-task-761.md
- packages/persistence/src/repositories/outbox-repository.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/api/sai.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-761.md

## Allowed Files
- docs/delivery/tasks/TASK-762.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/orchestration.md
- docs/security.md
- docs/verification/reports/phase-007-task-762.md
- packages/persistence/src/repositories/outbox-repository.ts
- packages/persistence/tests/outbox-inbox.test.ts

## Forbidden Files
No production dispatch wiring, real Adapter execution, user database, Electron sandbox, credential, archived evidence, remote or Git operations.

## Interfaces / Contracts
The conditional claim update must atomically check persisted Attempt state. A still-pending command whose Attempt is UNKNOWN or RECONCILING is moved to RECONCILING without changing its Attempt or producing a dispatchable payload. A lost race does not steal another claim. This does not eliminate a subsequent state change after claim and before Adapter invocation.

## Data Constraints
Use isolated in-memory SQLite and fake adapters. Do not requeue quarantined rows. Do not change existing migration files.

## UI Constraints
No UI changes.

## Implementation Requirements
Update engineering facts first. Add failing UNKNOWN and RECONCILING cases to the existing SQLite dispatcher integration tests; assert no adapter call, no Attempt change and no requeue. Implement an atomic state predicate and safe quarantine; retain claim token fencing and interleaved claimant tests.

## Test Requirements
Run targeted red and green, production build, lint, typecheck, full unit and contract suites, documentation checks and anchored runtime verification. Record skips.

## Acceptance Criteria
Already uncertain Attempts cannot be claimed and their pending messages are quarantined. Normal valid claims and token fencing continue to work. No claim is made that the post-claim dispatch race is solved.

## Done Definition
Record evidence and retain real dispatch, authorization revalidation, adapter recovery and post-claim atomicity as open gates.

## Risks
State can change after a successful claim; this bounded fix alone is insufficient to authorize an external effect.

## Output Required
docs/verification/reports/phase-007-task-762.md
