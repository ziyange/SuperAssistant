# TASK-741: Bind local grants and execution to their approved Proposal

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-confirmed continuous PHASE-007 security remediation.

## Requirement IDs
REQ-021, REQ-024, REQ-025, REQ-027, REQ-028, REQ-030, REQ-031, REQ-090, REQ-094, REQ-096

## Objective
Reject forged Proposal inputs and mismatched idempotent replays before local Grant issuance or transactional execution creates any side effect.

## Context Pack
- docs/security.md
- docs/delivery/tasks/TASK-201.md
- docs/delivery/tasks/TASK-202.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/security.md
- docs/data-model.md
- docs/orchestration.md
- docs/verification/quality-gate.md
- packages/persistence/src/repositories/authorization-repository.ts
- packages/persistence/src/repositories/execution-repository.ts

## Allowed Files
- docs/delivery/tasks/TASK-741.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/verification/reports/phase-007-task-741.md
- packages/persistence/src/repositories/authorization-repository.ts
- packages/persistence/src/repositories/execution-repository.ts
- packages/persistence/tests/proposal-repository.test.ts
- packages/persistence/tests/execution-transaction.test.ts

## Forbidden Files
Do not enable dispatch, change adapter permissions, user data, migrations, dependencies, sandbox settings or archived evidence.

## Interfaces / Contracts
Grant issuance must load the immutable Proposal from SQLite and verify both caller and persisted canonical digests; an idempotency key replay must refer to the same Proposal and digest. Execution must check Proposal workspace/project/agent/function and Grant digest before atomic consumption. Idempotent execution replays must match existing Task/WorkItem authorization and resource identity; attempt IDs may differ on transport replay.

## Data Constraints
Use in-memory SQLite fixtures only. Rejections leave Grant state, Task, Attempt, Lease and Outbox unchanged.

## UI Constraints
No UI changes or live execution.

## Implementation Requirements
Write negative regression tests before the fix. Keep valid same-input replay behavior and transaction atomicity; fail closed on changed Proposal or authorization scope.

## Test Requirements
Run red and green SQLite tests covering forged Proposal content, Grant-key collision, mismatched project/agent/function/digest and execution-key collision; then build, lint, typecheck, full unit and contract suites and runtime trace. Do not run Electron sandbox verification.

## Acceptance Criteria
Every forged or mismatched request is rejected before mutation; legitimate duplicate confirmation returns its original matching result; unconsumed grants remain ISSUED after rejected execution.

## Done Definition
Record commands, red/green evidence and limits without claiming end-to-end dispatch acceptance.

## Risks
Mismatched identity and digest can authorize work under the wrong scope even when idempotency and foreign keys appear valid.

## Output Required
docs/verification/reports/phase-007-task-741.md
