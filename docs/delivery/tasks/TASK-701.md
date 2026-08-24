# TASK-701: Team authority migration
## Status
COMPLETED
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
- services/team/tsconfig.json
- services/team/tsconfig.build.json
- services/team/src/server.ts
- services/team/src/migration.ts
- services/team/tests/migration.test.ts
- services/team/tests/server.test.ts
- package.json
- package-lock.json
- vitest.workspace.ts
- docs/architecture.md
- docs/data-model.md
- docs/decisions/ADR-006-team-authority.md
- docs/delivery/tasks/TASK-701.md
- docs/delivery/tasks/README.md
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

## Approved Scope Expansion

- 2026-08-24: the service must be an actual registered workspace so its server,
  migration and tests participate in deterministic lint, typecheck, build and
  unit gates. This adds exactly the root `package.json`, `package-lock.json`,
  `vitest.workspace.ts`, and `services/team/tsconfig.json`. It also pins the
  PostgreSQL driver used solely by the Team Service. No renderer, SQLite
  write-path, deployment, remote action, dual-write or production database
  change is authorized.
- 2026-08-24: a bounded HTTP/SSE contract test requires exactly
  `services/team/tests/server.test.ts`; it uses only an in-memory request
  handler and does not bind a port or contact PostgreSQL.
- 2026-08-24: separating test typechecking from emitted production service
  artifacts requires exactly `services/team/tsconfig.build.json`; it prevents
  test files from becoming server artifacts and adds no runtime scope.
- 2026-08-24: completion writeback requires exactly
  `docs/delivery/tasks/README.md` so the execution registry cannot disagree
  with this completed Pack. No additional implementation scope is added.
