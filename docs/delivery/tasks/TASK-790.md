# TASK-790: Reconcile an original local Codex Attempt from its durable start receipt

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: continuation of the approved official desktop lifecycle work against 8b9f710; predecessor 45770ff.

## Requirement IDs
REQ-025, REQ-029, REQ-033, REQ-037, REQ-049, REQ-092, REQ-093, REQ-098

## Objective
Bind an acknowledged start to one immutable local Attempt, upstream pair, worktree and executable fingerprint. On an explicit desktop reconnection reconcile only exact supported terminal observations; never dispatch from recovery.

## Context Pack
- docs/delivery/tasks/TASK-789.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/adapters/codex.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-790.md
- .github/workflows/docs-gates.yml
- docs/adapters/codex.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/verification/reports/phase-007-task-790.md
- packages/persistence/src/sqlite/migrations/025-codex-start-receipts.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/tests/migration-runner.test.ts
- apps/desktop/src/main/codex-attempt-recovery.ts
- apps/desktop/src/main/queued-task-cancellation.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/codex-discovery-ipc.ts
- packages/codex-adapter/src/app-server-supervisor.ts
- packages/codex-adapter/src/app-server-client.ts
- apps/desktop/tests/main/codex-attempt-recovery.test.ts
- packages/codex-adapter/tests/discovery.contract.test.ts

## Forbidden Files
All other paths, retained worktrees, main, real Codex, Electron sandbox, remote writes.

## Interfaces / Contracts
Private receipt recording requires a claimed start with a consumed matching Grant and full Proposal. Main can observe on a user-selected matching runtime only. No renderer-supplied protocol identifiers. Recheck ownership atomically after the observation.

## Data Constraints
Additive SQLite migration 025. No fixture imports or backfill. A receipt and acknowledgement commit together. Never release leases, accept Tasks or retry effects from a Turn status.

## UI Constraints
Reuse the existing Agent Center check. Checking an executable is not approval to start or resume a Task.

## Implementation Requirements
Use the actual read-only transport and SQLite transactions. On mismatched executable, credentials, working directory, Thread, Turn or missing authority, preserve UNKNOWN.

## Test Requirements
Run targeted Vitest unit and contract, migration tests, build, lint, typecheck and deterministic suites; validate Markdown, packs, REQ, schemas, Plan trace, Python tests and Git scope.

## Acceptance Criteria
A persisted original receipt survives restart; a matched terminal Turn updates only its Attempt. Missing or fixture evidence, stale claims and authority changes cannot recover a Task or start additional work.

## Done Definition
Record verified behavior and outstanding dispatch/confirmation and active cancellation work; no H1 or CI acceptance claim.

## Risks
Lost receipt after an upstream effect remains UNKNOWN. Terminal Turn status is not confirmation of process-tree termination. Executable version alone is not identity.

## Output Required
docs/verification/reports/phase-007-task-790.md
