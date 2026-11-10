# TASK-757: Fence writes between SQLite backup and migration

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: approved PHASE-007 data-safety remediation and continued autonomous execution.

## Requirement IDs
REQ-090, REQ-091, REQ-092, REQ-096, REQ-098, REQ-099

## Objective
Prevent migration after another database connection commits between the pre-migration backup snapshot and migration ownership.

## Context Pack
- docs/verification/reports/phase-007-task-755.md
- packages/persistence/src/sqlite/database.ts
- packages/persistence/src/sqlite/migration-runner.ts

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
- docs/delivery/tasks/TASK-757.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/operations.md
- docs/security.md
- docs/verification/reports/phase-007-task-757.md
- packages/persistence/src/sqlite/database.ts
- packages/persistence/tests/migration-runner.test.ts

## Forbidden Files
Do not open or change a real application database, real user Project, credentials, archived evidence, remote repositories or Electron sandbox.

## Interfaces / Contracts
For an existing on-disk database with pending migrations, record SQLite data_version, create the consistent backup, acquire an exclusive write transaction, and compare data_version again under that ownership. If another connection committed in the interval, roll back and fail without migrating or deleting the backup. Otherwise apply migrations under the held transaction and commit. No automatic retry or overwrite is allowed. This does not establish application-wide single-instance ownership after migration.

## Data Constraints
Use isolated temporary SQLite databases only; preserve every backup produced and never delete production data. Existing migration files are immutable.

## UI Constraints
No UI changes.

## Implementation Requirements
Write a failing deterministic test that commits a sentinel update from a second SQLite connection after backup and before migration; verify startup fails closed, schema remains old and the new user data is not discarded. Verify a normal unchanged migration still succeeds and backup restores correctly.

## Test Requirements
Run red/green migration and rollback tests, build, lint, typecheck, complete unit and contract suites, ordered governance and anchored goal runtime trace. No Electron sandbox or real Codex execution.

## Acceptance Criteria
An intervening commit prevents migration and retains the backup; normal migration preserves data; no automatic retry occurs; failed migration rolls back and does not delete evidence.

## Done Definition
Record test evidence and remaining application single-instance and real-database verification gaps.

## Risks
SQLite data_version detects commits from other connections, not uncoordinated file replacement by non-SQLite actors. A consistent backup may predate the intervening write and must not be restored blindly.

## Output Required
docs/verification/reports/phase-007-task-757.md
