# TASK-755: Fence Outbox acknowledgements and preserve unknown outcomes

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authorization: approved PHASE-007 recovery plan and continuous autonomous execution.

## Requirement IDs
REQ-027, REQ-030, REQ-032, REQ-038, REQ-049, REQ-090, REQ-091, REQ-092, REQ-096, REQ-098, REQ-099

## Objective
Add durable claim tokens, fence acknowledgements and preserve interrupted delivery as RECONCILING, with an automatic pre-migration SQLite backup.

## Context Pack
- docs/verification/reports/phase-007-task-754.md
- packages/persistence/src/repositories/outbox-repository.ts
- packages/persistence/src/sqlite/migration-runner.ts
- apps/desktop/src/main/outbox-dispatcher.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/orchestration.md
- docs/verification/quality-gate.md
- packages/persistence/src/sqlite/database.ts
- packages/persistence/src/repositories/outbox-repository.ts
- apps/desktop/src/main/outbox-dispatcher.ts

## Allowed Files
- docs/delivery/tasks/TASK-755.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/data-model.md
- docs/operations.md
- docs/orchestration.md
- docs/verification/reports/phase-007-task-755.md
- packages/persistence/src/sqlite/database.ts
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/sqlite/migrations/019-outbox-claims.sql
- packages/persistence/src/repositories/outbox-repository.ts
- packages/persistence/src/repositories/execution-repository.ts
- packages/persistence/src/repositories/decision-repository.ts
- packages/persistence/tests/migration-runner.test.ts
- packages/persistence/tests/outbox-inbox.test.ts
- apps/desktop/src/main/outbox-dispatcher.ts
- apps/desktop/tests/main/orchestrator.test.ts

## Forbidden Files
No real application database, user Project, real Codex, sandbox validation, runtime dispatcher wiring, credentials, archived evidence or Git integration.

## Interfaces / Contracts
Migration 019 adds nullable Outbox claim_token with a unique non-null index. Before applying pending migrations to an existing on-disk database, create a distinct consistent SQLite backup adjacent to it; if backup fails, do not migrate. In-memory or newly created databases need no backup. Claiming atomically records a fresh unguessable token and returns it only to the winner. Acknowledgement and failure transitions require the exact message/token pair. Failed or interrupted dispatch enters RECONCILING with the Attempt UNKNOWN; do not requeue or redispatch without separate upstream reconciliation. A stale token cannot acknowledge or change a newer claim. Startup recovery may mark interrupted claims only after the caller established previous worker ownership is gone; this task does not wire such a caller.

## Data Constraints
Migration is additive; never modify a previously published migration or delete a backup. Use isolated temporary SQLite test databases. No real application DB, credentials, external model or user repository.

## UI Constraints
No UI or IPC changes; do not activate the real dispatcher.

## Implementation Requirements
Write failing tests for backup-before-migration, backup failure, claim fencing, stale acknowledgement, dispatch error and interrupted recovery. Use parameterized SQL and transactional state changes. Preserve previous rows and no automatic retries.
Decision resolution also inserts Outbox rows and must use explicit columns
to remain compatible with migration 019; retain its existing idempotency test.

## Test Requirements
Run migration and outbox red/green tests, rollback and backup/restore checks, build, lint, typecheck, complete unit and contract suites, ordered governance and anchored goal-mode trace. Do not run live Codex or Electron sandbox tests.

## Acceptance Criteria
An existing database is backed up before migration; a failed backup leaves schema untouched. Concurrent claims have one winner; wrong/stale tokens cannot acknowledge or resolve another claim. Failure and restart preserve unknown state without redispatch. Existing data and newly created databases migrate correctly.

## Done Definition
Record actual test evidence, migration/backup paths and remaining real dispatcher/Adapter integration gaps; M1 remains unaccepted.

## Risks
Backup can fail due to permissions or storage, in which case startup fails closed and preserves the original database. A token alone does not validate actual external side effects or terminate a live worker.

## Output Required
docs/verification/reports/phase-007-task-755.md
