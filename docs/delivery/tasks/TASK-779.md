# TASK-779: Prevent duplicate active authorization grants

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user explicitly requested repair of duplicate Proposal grants.

## Requirement IDs
REQ-021, REQ-024, REQ-025, REQ-027, REQ-090, REQ-093, REQ-095, REQ-098

## Objective
Ensure one issued Grant per actor and Proposal version even when confirmation requests use different idempotency keys.

## Context Pack
- docs/delivery/tasks/TASK-201.md
- docs/data-model.md
- docs/orchestration.md

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
- docs/delivery/tasks/TASK-779.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/data-model.md
- docs/security.md
- packages/persistence/src/sqlite/migrations/022-grant-uniqueness.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/repositories/authorization-repository.ts
- packages/persistence/tests/proposal-repository.test.ts
- packages/persistence/tests/migration-runner.test.ts
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-779.md

## Forbidden Files
All other files; do not delete or rewrite legacy Grant records, enable execution, mutate user databases, merge or delete branches.

## Interfaces / Contracts
The same valid actor and Proposal version return the existing ISSUED Grant regardless of request key. The existing key-conflict and digest checks remain fail-closed. SQLite enforces uniqueness across concurrent writers. A consumed, revoked or expired Grant does not block a separately authorized new Grant. Expired ISSUED records remain fail-closed until their status is changed by an authorized lifecycle operation.

## Data Constraints
Add forward-only migration 022 with a partial unique index on actor and Proposal version where status is ISSUED. Duplicate historic ISSUED records cause migration failure; preserve database and backup without automatic repair.

## UI Constraints
No UI changes.

## Implementation Requirements
Synchronize engineering facts first. Protect existing idempotency-key conflict checks and use a transaction plus database unique index. Do not silently broaden authorization.

## Test Requirements
Test different keys for the same Proposal, conflicting keys, separate Proposal versions, terminal Grant lifecycle, direct constraint bypass attempts, concurrency and legacy duplicate migration failure. Run targeted tests, lint, typecheck, build, unit, contract and governance.

## Acceptance Criteria
One ISSUED Grant per actor and Proposal version; duplicate confirmations return the same Grant; legacy duplicates fail closed and remain intact. No Task or external effect is created.

## Done Definition
Record actual test and migration evidence; runtime verification exits 0 and file boundaries are checked.

## Risks
Duplicate historical records block upgrade intentionally and need manual reconciliation. Production confirmation and execution remain disconnected.

## Output Required
docs/verification/reports/phase-007-task-779.md
