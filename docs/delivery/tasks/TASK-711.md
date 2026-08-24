# TASK-711: PostgreSQL Team authority and API foundation
## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-081, REQ-090, REQ-096, REQ-099
## Objective
Replace Team in-memory authority with transactional PostgreSQL persistence and a typed authenticated HTTP/SSE service boundary.
## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/architecture.md
- docs/data-model.md
## Must Read
- AGENTS.md
- docs/security.md
- docs/operations.md
- docs/decisions/ADR-006-team-authority-and-oidc.md
## Implementation Requirements
PostgreSQL is the only Team authority; local SQLite is cache-only. Commands, queries and streams carry actor/workspace context.
## Done Definition
Transactional Team persistence, API envelopes, migration/recovery rehearsal and authority outage behavior pass.
## Allowed Files
- services/team/src/postgres/schema.ts
- services/team/src/postgres/team-repository.ts
- services/team/src/postgres/team-transaction.ts
- services/team/src/team-api.ts
- services/team/src/server.ts
- services/team/tests/postgres-team-repository.test.ts
- services/team/tests/team-api.test.ts
- services/team/tests/team-recovery.test.ts
- docs/architecture.md
- docs/data-model.md
- docs/operations.md
- docs/delivery/tasks/TASK-711.md
- docs/verification/reports/phase-007-task-711.md
## Forbidden Files
Any fallback that makes SQLite authoritative in Team mode; plaintext credentials; remote deployment action.
## Interfaces / Contracts
Versioned HTTPS JSON commands/queries and SSE events use backward-compatible actor/workspace envelope fields.
## Data Constraints
Migrations are forward-only; test databases are disposable and contain no personal data.
## UI Constraints
None; Team API rejects unauthenticated/unauthorized data before a renderer can receive it.
## Test Requirements
PostgreSQL integration, transaction rollback, API contract, authority-loss recovery, lint, typecheck, build and governance gates.
## Acceptance Criteria
One Team Workspace has one PostgreSQL authority; API and stream behavior are transactional, scoped and fail closed.
## Risks
Partial migration or cache authority split blocks the Task.
## Output Required
PostgreSQL/API/recovery evidence.
