# TASK-404: Schedule fenced resources
## Status
APPROVED
PHASE: PHASE-004
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-059, REQ-060, REQ-061
## Objective
Add canonical hierarchical leases, fencing, fairness and deadlock prevention.
## Context Pack
- docs/orchestration.md
- docs/security.md
## Implementation Requirements
- Acquire canonical resources before execution and fence stale owners.
## Done Definition
Concurrency and recovery evidence are recorded.
## Must Read
- AGENTS.md
- docs/orchestration.md
- docs/security.md
- docs/data-model.md
## Allowed Files
- packages/domain/src/resource-scheduler.ts
- packages/domain/tests/resource-scheduler.test.ts
- packages/persistence/src/sqlite/migrations/012-resource-scheduler.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/repositories/resource-scheduler-repository.ts
- packages/persistence/tests/resource-scheduler-repository.test.ts
- packages/persistence/tests/migration-runner.test.ts
- docs/data-model.md
- docs/orchestration.md
- docs/security.md
- docs/delivery/tasks/TASK-404.md
- docs/verification/reports/phase-004-task-404.md
## Forbidden Files
Any file not explicitly listed; overlapping writes; stale-token acceptance.

## Approved Revision

- 2026-08-21: add the exact migration runner required to register migration
  `012` via the established transactional migration path.
- 2026-08-21: add the migration-runner regression test required to advance the
  expected schema to migration `012` and retain rollback coverage.
## Interfaces / Contracts
Scheduler checks resource claims before dispatch and fences stale owners.
## Data Constraints
Lease transitions are auditable.
## UI Constraints
Conflicts are shown before execution.
## Test Requirements
Run concurrent lease, deadlock, recovery, lint, typecheck, build and governance gates.
## Acceptance Criteria
Conflicts block and nonconflicts can run concurrently.
## Risks
Starvation and deadlock fail closed.
## Output Required
Report concurrency evidence.
