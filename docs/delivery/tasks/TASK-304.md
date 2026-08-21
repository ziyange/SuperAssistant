# TASK-304: Recover after restart and export local audit

## Status

APPROVED

PHASE: PHASE-003

MAX_ITERATIONS: 6

user_confirmed: true

## Requirement IDs

REQ-049, REQ-090, REQ-092, REQ-093, REQ-094, REQ-095, REQ-096, REQ-097,
REQ-099

## Objective

Implement Electron/App Server restart reconciliation, truthful degraded
read-only state and locally verifiable scoped audit export.

## Context Pack

- `docs/architecture.md`
- `docs/operations.md`
- `docs/security.md`
- `docs/adapters/codex.md`

## Must Read

- AGENTS.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/adapters/codex.md
- docs/operations.md
- docs/delivery/phase-003.md

## Allowed Files

- packages/domain/src/recovery.ts
- packages/domain/src/audit-export.ts
- packages/domain/src/index.ts
- packages/domain/tests/recovery.test.ts
- packages/domain/tests/audit-export.test.ts
- packages/persistence/src/sqlite/migrations/009-recovery-audit.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/repositories/audit-export-repository.ts
- packages/persistence/src/index.ts
- packages/persistence/tests/audit-export-repository.test.ts
- packages/persistence/tests/migration-runner.test.ts
- apps/desktop/src/main/recovery-service.ts
- apps/desktop/src/main/audit-export-ipc.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/renderer/degraded-state.tsx
- apps/desktop/src/renderer/audit-export.tsx
- apps/desktop/src/renderer/App.tsx
- apps/desktop/tests/main/recovery-service.test.ts
- apps/desktop/tests/main/audit-export-ipc.test.ts
- apps/desktop/tests/renderer/degraded-state.test.tsx
- apps/desktop/tests/e2e/restart-reconciliation.spec.ts
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/adapters/codex.md
- docs/operations.md
- docs/delivery/tasks/TASK-304.md
- docs/verification/reports/phase-003-task-304.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Redispatch from `UNKNOWN` or `RECONCILING`, destructive audit deletion,
secret export, remote service deployment, or silent degraded write behavior.

## Approved Revision

- 2026-08-21: add the exact migration-runner regression test required to
  assert migration `009` and its rollback boundary. This correction does not
  widen product behavior or the Task's requirements; it keeps the required
  schema migration covered by the repository's existing test seam.

## Interfaces / Contracts

Recovery queries stable status/events/result before dispatch. A missing result
never authorizes retry. Audit export is scoped, checksummed and redacted.

## Data Constraints

Recovery state, export manifest and checksums are durable. Secret values and
raw credentials are excluded from database, export and UI.

## UI Constraints

Degraded state describes what is unavailable and preserves safe reads; it never
claims execution is complete or retryable before reconciliation.

## Implementation Requirements

- Reconcile after Electron, Worker and App Server restarts.
- Maintain read-only operation during Adapter/model failures.
- Produce a verifiable local audit export with scope and checksum manifest.

## Test Requirements

Run crash/restart/timeout fixtures, export checksum/redaction/authorization,
IPC, renderer, Playwright, lint, typecheck, unit, contract, build and
governance checks.

## Acceptance Criteria

No restart duplicate dispatch; UNKNOWN becomes real state within the frozen
reconciliation policy; exports contain governed records without secrets.

## Done Definition

All recovery and export evidence passes and is recorded in current facts and
the task report.

## Risks

Unknown external outcome, credential disclosure and degraded-mode writes are
stop-class failures.

## Output Required

Return changed files, restart/export evidence, command output and report.
