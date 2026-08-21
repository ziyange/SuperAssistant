# TASK-302: Add append-only history, changes and rollback

## Status

APPROVED

PHASE: PHASE-003

MAX_ITERATIONS: 5

user_confirmed: true

## Requirement IDs

REQ-045, REQ-046, REQ-047, REQ-048, REQ-094, REQ-096, REQ-099

## Objective

Persist separate Task Log and Human History projections, attributable
ArtifactVersion access, ProjectChange records and compensating rollback.

## Context Pack

- `docs/data-model.md`
- `docs/security.md`
- `docs/operations.md`
- `docs/ux.md`

## Must Read

- AGENTS.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/ux.md
- docs/delivery/phase-003.md

## Allowed Files

- packages/domain/src/history.ts
- packages/domain/src/project-change.ts
- packages/domain/src/ports/history-repository.ts
- packages/domain/src/ports/project-change-repository.ts
- packages/domain/src/index.ts
- packages/domain/tests/history.test.ts
- packages/domain/tests/project-change.test.ts
- packages/persistence/src/sqlite/migrations/007-history-change.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/repositories/history-repository.ts
- packages/persistence/src/repositories/project-change-repository.ts
- packages/persistence/src/index.ts
- packages/persistence/tests/history-repository.test.ts
- packages/persistence/tests/project-change-repository.test.ts
- apps/desktop/src/main/history-ipc.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/renderer/task-history.tsx
- apps/desktop/src/renderer/project-changes.tsx
- apps/desktop/src/renderer/App.tsx
- apps/desktop/tests/main/history-ipc.test.ts
- apps/desktop/tests/renderer/task-history.test.tsx
- apps/desktop/tests/renderer/project-changes.test.tsx
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/ux.md
- docs/delivery/tasks/TASK-302.md
- docs/verification/reports/phase-003-task-302.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- In-place audit edits, destructive rollback, secret persistence, Decision
  routing changes, or provider-native UI fields.

## Interfaces / Contracts

History records are append-only. Rollback creates a new compensating
ProjectChange and references the original change; it never rewrites history.

## Data Constraints

Artifact metadata retains Attempt, Grant, baseline and checksum lineage;
content remains outside SQLite. Access inherits Workspace/Project scope.

## UI Constraints

Human actions and Agent activity remain visually distinct. Change/rollback
views are safe text projections with explicit access-denied states.

## Implementation Requirements

- Preserve monotonic history ordering and actor attribution.
- Enforce Artifact and change access scope at repository and IPC boundaries.
- Record compensation rather than performing destructive state restoration.

## Test Requirements

Run append-only, access-negative, Artifact lineage, rollback, IPC, renderer,
lint, typecheck, unit, contract, Playwright, build and governance tests.

## Acceptance Criteria

History cannot be overwritten; rollback adds a linked change; unauthorized
Artifact/history reads fail closed.

## Done Definition

All gates pass and current facts plus the task report contain direct lineage and
negative-access evidence.

## Risks

Audit tampering, cross-scope disclosure and destructive rollback are stop-class
failures.

## Output Required

Return changed files, lineage/rollback evidence, command results and report.
