# TASK-758: Run complete unit suite with isolated PostgreSQL 16

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authorization: user provided PostgreSQL 16.4 and approved continued autonomous integration remediation.

## Requirement IDs
REQ-081, REQ-082, REQ-083, REQ-084, REQ-085, REQ-086, REQ-090, REQ-092, REQ-096, REQ-099

## Objective
Run the full unit suite with the six PostgreSQL-dependent tests enabled on a newly initialized disposable 16.4 instance.

## Context Pack
- docs/verification/reports/phase-007-task-756.md
- docs/verification/reports/phase-007-task-757.md
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
- docs/delivery/tasks/TASK-758.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/verification/reports/phase-007-task-758.md

## Forbidden Files
No existing PostgreSQL data, application database, credentials, user repositories, source changes, archived evidence, remote repositories or Electron sandbox.

## Interfaces / Contracts
Create a fresh empty cluster in a unique system temporary directory, bind only 127.0.0.1 on a selected free port, run the entire unit project with the explicit disposable flag, and stop the exact server by its data directory. Tests may drop or truncate tables only within that cluster. PostgreSQL 16 is compatibility evidence, never a substitute for the required 17.x H3 gate.

## Data Constraints
Only synthetic test data. Keep the test cluster and logs as evidence; do not remove or overwrite existing paths.

## UI Constraints
No UI, real Electron or sandbox verification.

## Implementation Requirements
Record exact binary version, path, port, startup, shutdown, test counts and failure details. If initialization or startup fails, mark BLOCKED and do not connect to an existing cluster.

## Test Requirements
Run the full unit project with one worker and disposable PostgreSQL variables. Confirm server shutdown, then run documentation and anchored goal runtime gates.

## Acceptance Criteria
All discovered unit tests run with zero failures and zero skips, including the six PostgreSQL cases, and the test server is confirmed stopped.

## Done Definition
Record evidence and preserve unverified PostgreSQL 17.x, real Electron, clean SHA, CI and system acceptance as open.

## Risks
Temporary trust authentication is loopback-only and synthetic; the retained test cluster must not be exposed publicly. Existing database paths are never targeted.

## Output Required
docs/verification/reports/phase-007-task-758.md
