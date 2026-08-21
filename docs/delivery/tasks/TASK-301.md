# TASK-301: Route questions and persist one Decision

## Status

APPROVED

PHASE: PHASE-003

MAX_ITERATIONS: 5

user_confirmed: true

## Requirement IDs

REQ-040, REQ-041, REQ-042, REQ-043, REQ-044, REQ-097, REQ-098

## Objective

Implement the L1–L4 Question Router and immutable Decision record. A repeated
L3/L4 question for the same scope creates one Decision and an idempotent human
resolution resumes its originating work once.

## Context Pack

- `docs/security.md`
- `docs/orchestration.md`
- `docs/data-model.md`
- `docs/ux.md`

## Must Read

- AGENTS.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/api/sai.md
- docs/ux.md
- docs/delivery/phase-003.md

## Allowed Files

- packages/domain/src/decision.ts
- packages/domain/src/decision-resolution.ts
- packages/domain/src/question-router.ts
- packages/domain/src/ports/decision-repository.ts
- packages/domain/src/index.ts
- packages/domain/tests/decision.test.ts
- packages/domain/tests/decision-resolution.test.ts
- packages/domain/tests/question-router.test.ts
- packages/persistence/src/sqlite/migrations/006-decision.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/repositories/decision-repository.ts
- packages/persistence/src/repositories/outbox-repository.ts
- packages/persistence/src/index.ts
- packages/persistence/tests/decision-repository.test.ts
- packages/persistence/tests/migration-runner.test.ts
- packages/persistence/tests/outbox-inbox.test.ts
- apps/desktop/src/main/decision-ipc.ts
- apps/desktop/src/main/outbox-dispatcher.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/renderer/decision-center.tsx
- apps/desktop/src/renderer/App.tsx
- apps/desktop/src/renderer/task-detail.tsx
- apps/desktop/tests/main/decision-ipc.test.ts
- apps/desktop/tests/main/ipc-router.test.ts
- apps/desktop/tests/main/orchestrator.test.ts
- apps/desktop/tests/renderer/decision-center.test.tsx
- apps/desktop/tests/renderer/task-detail.test.tsx
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/ux.md
- docs/delivery/tasks/TASK-301.md
- docs/verification/reports/phase-003-task-301.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Automatic L3/L4 approval, mutable Decision history, provider Thread/Turn
  identifiers, credentials, remote configuration, or acceptance repair.

## Interfaces / Contracts

The router returns one of L1, L2, L3, L4. L3/L4 returns a stable Decision ID;
resolution uses an idempotency key and cannot dispatch while the Attempt is
`UNKNOWN` or `RECONCILING`.

## Data Constraints

Decision records are append-only and scoped to Workspace, Project, Task, and
Work Item. A resolved Decision preserves its question, alternatives, actor,
resolution and audit timestamps.

## UI Constraints

Decision views show risk, affected work, alternatives and timeout without
representing urgency as consent. Keyboard operation and safe error/empty states
are required.

## Implementation Requirements

- Deduplicate by stable Decision scope and question fingerprint.
- Resume once after resolution and keep duplicate resolutions harmless.
- Project the same Decision record in Assistant and Task surfaces.
- The migration-runner and IPC-router test files are included to keep the
  existing migration and strict IPC regression suites aligned with this
  Decision contract; no unrelated test behavior may change.
- The Decision-resolution, outbox, and dispatcher files are included for the
  narrowly bounded resume-once transaction: it must reject `UNKNOWN` and
  `RECONCILING` Attempts, persist the first resolution, and emit one resume
  command. No scheduling, acceptance, or Task lifecycle behavior is expanded.
- Task Detail and its renderer test are included solely to render the same
  Decision identifier and state supplied to Super Assistant; they may not
  create, copy, or independently mutate a Decision.

## Test Requirements

Run focused domain/persistence/IPC/renderer tests, fake resume duplicate tests,
lint, typecheck, unit, contract, Playwright, build, governance gate and runtime
trace.

## Acceptance Criteria

L3/L4 repeats create one Decision; L1/L2 are routed without a Decision; a
duplicate resolution cannot create another resume or external effect.

## Done Definition

All required tests and gates pass, current facts describe the implemented
Decision contract, and the report records evidence and residual risks.

## Risks

Decision duplication, accidental consent, and resuming ambiguous work are
fail-closed conditions.

## Output Required

Return affected files, decision uniqueness and resume evidence, command output,
and report path.
