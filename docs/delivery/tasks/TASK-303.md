# TASK-303: Enforce acceptance and original-Task remediation

## Status

APPROVED

PHASE: PHASE-003

MAX_ITERATIONS: 6

user_confirmed: true

## Requirement IDs

REQ-032, REQ-033, REQ-034, REQ-035, REQ-036, REQ-037, REQ-038, REQ-039,
REQ-046, REQ-047

## Objective

Add durable acceptance evidence and completion derivation. Failed acceptance
creates a repair Work Item under the original Task; it never creates a new
top-level Task.

## Context Pack

- `docs/product.md`
- `docs/orchestration.md`
- `docs/data-model.md`
- `docs/ux.md`

## Must Read

- AGENTS.md
- docs/product.md
- docs/requirements.md
- docs/data-model.md
- docs/orchestration.md
- docs/ux.md
- docs/delivery/phase-003.md

## Allowed Files

- packages/domain/src/acceptance.ts
- packages/domain/src/task-projection.ts
- packages/domain/src/index.ts
- packages/domain/tests/acceptance.test.ts
- packages/domain/tests/task-projection.test.ts
- packages/persistence/src/sqlite/migrations/008-acceptance.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/repositories/acceptance-repository.ts
- packages/persistence/src/queries/task-projection.ts
- packages/persistence/src/index.ts
- packages/persistence/tests/acceptance-repository.test.ts
- packages/persistence/tests/task-projection.test.ts
- apps/desktop/src/main/acceptance-ipc.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/renderer/task-detail.tsx
- apps/desktop/src/renderer/acceptance-panel.tsx
- apps/desktop/src/renderer/App.tsx
- apps/desktop/tests/main/acceptance-ipc.test.ts
- apps/desktop/tests/renderer/acceptance-panel.test.tsx
- apps/desktop/tests/e2e/acceptance-remediation.spec.ts
- docs/data-model.md
- docs/orchestration.md
- docs/ux.md
- docs/delivery/tasks/TASK-303.md
- docs/verification/reports/phase-003-task-303.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- New top-level Tasks on acceptance failure, automatic acceptance, evidence
  mutation, provider-native identity exposure, or multi-Agent DAG behavior.

## Interfaces / Contracts

A Task is complete only with accepted required Work Items, required evidence,
and no open Decision. Failed acceptance returns a repair Work Item under the
same Task lineage.

## Data Constraints

Acceptance evidence is immutable and references the Work Item, Attempt,
ArtifactVersion and evaluator. Repair work keeps the original Task identifier.

## UI Constraints

Completion, rejection and remediation states are explicit; an unresolved
Decision or missing evidence can never be rendered as completed.

## Implementation Requirements

- Derive acceptance state from persisted facts after restart.
- Reject evidence reuse across Task or Work Item scope.
- Preserve Task history through repeated repair/acceptance cycles.

## Test Requirements

Run state-table, persistence, restart, negative evidence, IPC, renderer,
Playwright, lint, typecheck, unit, contract, build and governance gates.

## Acceptance Criteria

Acceptance failure remains in one Task; completion requires every required
condition; retries produce new attributable evidence.

## Done Definition

All gates pass with acceptance/remediation evidence in the task report.

## Risks

False completion and broken Task lineage are fail-closed release blockers.

## Output Required

Return changed files, completion truth table, remediation evidence and report.
