# TASK-760: Back up every disk database before pending migrations

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: standing authorization for PHASE-007 safety remediation.

## Requirement IDs
REQ-090, REQ-092, REQ-096, REQ-099

## Objective
Eliminate the check-before-open race that can cause a newly appeared database to migrate without a backup.

## Context Pack
- docs/delivery/tasks/TASK-757.md
- docs/verification/reports/phase-007-task-757.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/verification/quality-gate.md
- packages/persistence/src/sqlite/database.ts

## Allowed Files
- docs/delivery/tasks/TASK-760.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/operations.md
- docs/security.md
- docs/verification/reports/phase-007-task-760.md
- packages/persistence/src/sqlite/database.ts
- packages/persistence/tests/migration-runner.test.ts

## Forbidden Files
No real application databases, user projects, credentials, archived records, remote operations, or Electron sandbox.

## Interfaces / Contracts
Every nonempty disk database path with pending migrations receives a consistent uniquely named backup and a data_version check under exclusive migration ownership, regardless of whether the file appeared to exist before opening. Fresh disk databases consequently retain an initial empty backup. In-memory and SQLite temporary databases do not create adjacent backups. Failure preserves files and stops migration.

## Data Constraints
Only isolated temporary SQLite fixtures may be opened by tests. No automatic deletion or retry of migration backups. Filesystem replacement and application-wide single-instance ownership remain unproven.

## UI Constraints
No UI changes.

## Implementation Requirements
Synchronize operational and security facts first. Write and run a failing test proving an initially absent disk database still receives a backup before migrations; then make the smallest fix. Preserve existing concurrent-commit and rollback safeguards.

## Test Requirements
Run migration tests red and green, build, lint, typecheck, complete unit and contract suites, ordered governance, and anchored runtime trace. Report skips and unavailable integrations.

## Acceptance Criteria
All pending on-disk migrations have a restorable preceding backup; existing databases preserve the version-check behavior; in-memory and temporary database tests continue to work.

## Done Definition
Report observed evidence and unresolved multi-process and final-system gates without claiming M1 acceptance.

## Risks
An initial empty backup consumes disk space. A non-SQLite actor replacing the file or an older process writing after migration remains outside this bounded fix.

## Output Required
docs/verification/reports/phase-007-task-760.md
