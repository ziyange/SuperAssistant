# TASK-756: Verify PostgreSQL 16 compatibility in an isolated cluster

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authorization: user explicitly provided E:/commSoft/PostgreSQL-16.4 for project development and approved autonomous remediation.

## Requirement IDs
REQ-081, REQ-082, REQ-083, REQ-084, REQ-085, REQ-086, REQ-090, REQ-092, REQ-096, REQ-099

## Objective
Run the six currently skipped PostgreSQL integration cases against a newly initialized disposable PostgreSQL 16.4 cluster, without touching the user's existing database.

## Context Pack
- docs/verification/reports/phase-007-task-755.md
- services/team/tests/postgres-team-repository.test.ts
- services/team/tests/migration.test.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/security.md
- docs/operations.md
- docs/verification/quality-gate.md
- services/team/tests/postgres-team-repository.test.ts
- services/team/tests/migration.test.ts

## Allowed Files
- docs/delivery/tasks/TASK-756.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/verification/reports/phase-007-task-756.md

## Forbidden Files
Do not connect to or change E:/commSoft/PostgreSQL-16.4/data, any existing database, credentials, application database, user repositories, archived evidence, source files, Git history, or Electron sandbox.

## Interfaces / Contracts
Initialize a unique empty data directory under the system temporary directory, bind a test-only server to 127.0.0.1 on a selected free port, run only the designated PostgreSQL test files with a disposable database flag, then stop the exact server by its explicit data directory. No remote host, existing service or production credentials are used. Tests may truncate and drop tables only within this freshly created disposable cluster.

## Data Constraints
Only synthetic test records. Retain the test directory and logs for evidence; do not remove or overwrite existing paths. Do not expose secrets.

## UI Constraints
No UI changes; no Electron process or sandbox validation.

## Implementation Requirements
Record exact binary version, isolated path, port, test commands, process startup and shutdown, test counts and failures. A startup failure is BLOCKED and does not justify connecting to an existing cluster.

## Test Requirements
Run services/team/tests/postgres-team-repository.test.ts and services/team/tests/migration.test.ts with explicit disposable settings and one test worker. Verify the isolated server is stopped. Run ordered documentation and goal-mode runtime gates afterward.

## Acceptance Criteria
The six formerly skipped PostgreSQL cases run against the isolated 16.4 cluster, with zero failures or silent skips, and the test server is confirmed stopped. A 16.4 result is compatibility evidence only and cannot satisfy the required PostgreSQL 17.x H3 gate.

## Done Definition
Record real output, environmental failures, cleanup state and any unrun PostgreSQL 17.x and full-system requirements.

## Risks
Trust authentication is used only on the loopback-bound disposable cluster containing synthetic data. Port collision or initdb privilege failure must leave existing services untouched and be reported without retries against existing data.

## Output Required
docs/verification/reports/phase-007-task-756.md
