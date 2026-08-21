# TASK-403: Durable Work Item DAG
## Status
APPROVED
PHASE: PHASE-004
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-056, REQ-057, REQ-058, REQ-065
## Objective
Implement required/optional Work Item DAGs and durable handoff context.
## Context Pack
- docs/data-model.md
- docs/orchestration.md
## Implementation Requirements
- Persist graph changes and reject cycles before scheduling.
## Done Definition
Graph and restart evidence are recorded.
## Must Read
- AGENTS.md
- docs/data-model.md
- docs/orchestration.md
- docs/api/sai.md
## Allowed Files
- packages/domain/src/work-item-graph.ts
- packages/domain/src/index.ts
- packages/domain/tests/work-item-graph.test.ts
- packages/persistence/src/sqlite/migrations/011-work-item-graph.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/repositories/work-item-graph-repository.ts
- packages/persistence/tests/work-item-graph-repository.test.ts
- packages/persistence/tests/migration-runner.test.ts
- docs/data-model.md
- docs/orchestration.md
- docs/delivery/tasks/TASK-403.md
- docs/verification/reports/phase-004-task-403.md
## Forbidden Files
Any file not explicitly listed; cyclic graphs; new top-level remediation Tasks.

## Approved Revision

- 2026-08-21: add the exact migration runner needed to register migration
  `011` through the established transactional migration path.
- 2026-08-21: add the domain package barrel required for the persistence
  repository to consume the public DAG contract.
- 2026-08-21: add the migration-runner regression test required to advance the
  expected schema to migration `011` and retain rollback coverage.
## Interfaces / Contracts
Unmet dependencies block scheduling; graph revision is durable.
## Data Constraints
Nodes and edges are scoped to the original Task.
## UI Constraints
Dependency status is attributable.
## Test Requirements
Run property, restart, persistence, lint, typecheck, build and governance gates.
## Acceptance Criteria
Cycles are rejected and restart does not alter DAG meaning.
## Risks
Dependency drift fails closed.
## Output Required
Report graph/recovery evidence.
