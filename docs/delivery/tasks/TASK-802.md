# TASK-802: Verify current candidate against disposable PostgreSQL 16

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authority: user requested use of installed PostgreSQL 16.4, completion of pre-merge blockers and continuous execution.

## Requirement IDs
REQ-081, REQ-082, REQ-084, REQ-085, REQ-086, REQ-090, REQ-092, REQ-095, REQ-096, REQ-099

## Objective
Run the current candidate's previously skipped database tests against an isolated, disposable loopback-only PostgreSQL 16.4 cluster and retain exact evidence.

## Context Pack
- docs/delivery/tasks/TASK-756.md
- docs/delivery/tasks/TASK-758.md
- docs/delivery/tasks/TASK-801.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-802.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-802.md

## Forbidden Files
Application code, existing PostgreSQL data, other worktrees, main, remote operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
Use installed PostgreSQL 16.4 binaries, a fresh task-owned temporary data directory, a fresh database and loopback-only server. Do not connect tests to an existing database. PostgreSQL 16 results are compatibility evidence only, not PostgreSQL 17 H3 acceptance.

## Data Constraints
The temporary data path, server PID, port and database identity must be recorded and verified before running destructive fixture tests. Stop only that exact server. Preserve any ambiguous or dirty data rather than deleting it. No production credentials or personal data are used.

## UI Constraints
No UI changes.

## Implementation Requirements
Initialize a fresh disposable cluster with local-only trust authentication, start on loopback and a checked ephemeral port, validate server identity and version, run the full designated database suite with the disposable flag, then stop the exact cluster. Only an explicitly validated, newly created clean temporary test directory may be removed.

## Test Requirements
Run database tests with nonzero discovered tests and zero skips, plus local governance gates. Record command, version, identity, test counts and cleanup outcome.

## Acceptance Criteria
All designated database tests run against the verified disposable PostgreSQL 16.4 cluster with zero failures and zero skips; the cluster is stopped and no unrelated data is touched. This does not prove PostgreSQL 17 or external CI.

## Done Definition
Report actual local evidence, skipped conditions, and remaining PostgreSQL 17/H3/CI work.

## Risks
Wrong database targeting can destroy data; if identity is ambiguous, stop without running destructive fixture tests.

## Output Required
A test report and audit trail.

### Local result — 2026-11-22

The designated PostgreSQL tests ran against a fresh, identity-verified,
loopback-only PostgreSQL 16.4 cluster on candidate application commit
`19f6cc76c8ce74f084f091520f549f724ac42758`: 13 passed, zero failed,
zero skipped. The cluster was stopped and its test directory retained.
See [the evidence report](../../verification/reports/phase-007-task-802.md).
This is 16.4 compatibility only, not PostgreSQL 17 H3 acceptance or CI.
