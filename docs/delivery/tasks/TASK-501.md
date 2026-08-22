# TASK-501: Persist monitoring events
## Status
APPROVED
PHASE: PHASE-005
MAX_ITERATIONS: 5
user_confirmed: true
## Requirement IDs
REQ-066, REQ-090, REQ-091, REQ-096, REQ-099
## Objective
Persist immutable RawEvent and NormalizedEvent records with source idempotency.
## Context Pack
- docs/data-model.md
- docs/security.md
## Implementation Requirements
- Preserve raw evidence and enforce source-key idempotency.
## Done Definition
Event persistence, retention facts and migration evidence pass.
## Must Read
- AGENTS.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/delivery/phase-005.md
## Allowed Files
- packages/domain/src/monitoring-event.ts
- packages/domain/src/index.ts
- packages/domain/tests/monitoring-event.test.ts
- packages/persistence/src/sqlite/migrations/014-monitoring-events.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/repositories/monitoring-event-repository.ts
- packages/persistence/src/index.ts
- packages/persistence/tests/monitoring-event-repository.test.ts
- packages/persistence/tests/migration-runner.test.ts
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/delivery/tasks/TASK-501.md
- docs/verification/reports/phase-005-task-501.md
## Forbidden Files
Any file not explicitly listed; raw-event deletion; credentials.
## Interfaces / Contracts
Events retain source lineage and idempotency identity.
## Data Constraints
Raw records are immutable and scoped.
## UI Constraints
No raw secret output is rendered.
## Test Requirements
Run persistence, redaction, migration, lint, typecheck, build and governance gates.
## Acceptance Criteria
Duplicate source keys do not duplicate evidence.
## Risks
Data loss fails closed.
## Output Required
Report event persistence and retention evidence.

## Approved Revision

- 2026-08-22: add the exact domain and persistence barrel exports required by
  the established cross-package repository pattern, plus the migration-runner
  regression test required to prove version `014` registration and rollback.
