# TASK-701: Team authority migration
## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 7
user_confirmed: true
## Requirement IDs
REQ-081, REQ-090, REQ-092, REQ-095, REQ-096, REQ-099
## Objective
Add the self-hosted Team Service and one-way local-to-team authority migration.
## Context Pack
- docs/architecture.md
- docs/data-model.md
- docs/security.md
## Must Read
- AGENTS.md
- docs/delivery/phase-007.md
- docs/operations.md
- docs/decisions/README.md
## Implementation Requirements
PostgreSQL is authoritative only for Team Workspaces; SQLite remains a cache.
## Done Definition
Backup, import, count/hash validation, rollback rehearsal and cutover pass.
## Allowed Files
- services/team/package.json
- services/team/src/server.ts
- services/team/src/migration.ts
- services/team/tests/migration.test.ts
- docs/architecture.md
- docs/data-model.md
- docs/decisions/ADR-006-team-authority.md
- docs/delivery/tasks/TASK-701.md
- docs/verification/reports/phase-007-task-701.md
## Forbidden Files
Any file not explicitly listed; dual-write authority; remote deployment.
## Interfaces / Contracts
HTTPS JSON commands/queries and SSE retain SAI envelope compatibility.
## Data Constraints
Migration validates IDs and audit hashes before authority cutover.
## UI Constraints
Team connection cannot show writable until cutover proof exists.
## Test Requirements
Run migration/restore, typecheck, build and governance gates.
## Acceptance Criteria
One Workspace has exactly one authoritative database at every point.
## Risks
Failed migration retains local authority and restores from validated backup.
## Output Required
Migration evidence and superseding authority ADR.
