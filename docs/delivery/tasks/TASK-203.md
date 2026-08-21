# TASK-203: Present Task progress and immutable Artifact evidence

## Status

APPROVED

PHASE: PHASE-002

MAX_ITERATIONS: 5

user_confirmed: true

## Requirement IDs

REQ-003, REQ-013, REQ-032, REQ-034, REQ-035, REQ-036, REQ-037, REQ-038, REQ-039, REQ-046, REQ-047, REQ-090, REQ-094, REQ-097, REQ-099

## Objective

Build the H1 Task Center and Task detail projection for one required Work Item, stream safe progress, expose cancellation and reconciliation states, and retain checksummed immutable ArtifactVersion evidence tied to the authorized Attempt.

## Context Pack

- `docs/ux.md`
- `docs/data-model.md`
- `docs/orchestration.md`

## Must Read

- `AGENTS.md`
- `docs/product.md`
- `docs/requirements.md`
- `docs/data-model.md`
- `docs/security.md`
- `docs/orchestration.md`
- `docs/ux.md`

## Allowed Files

- packages/domain/src/artifact.ts
- packages/domain/src/task-projection.ts
- packages/domain/src/ports/artifact-repository.ts
- packages/domain/src/index.ts
- packages/domain/tests/artifact.test.ts
- packages/domain/tests/task-projection.test.ts
- packages/persistence/src/sqlite/migrations/005-artifact.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/repositories/artifact-repository.ts
- packages/persistence/src/queries/task-projection.ts
- packages/persistence/src/index.ts
- packages/persistence/tests/artifact-repository.test.ts
- packages/persistence/tests/migration-runner.test.ts
- packages/persistence/tests/task-projection.test.ts
- apps/desktop/src/main/artifact-ipc.ts
- apps/desktop/src/main/task-ipc.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/renderer/task-center.tsx
- apps/desktop/src/renderer/task-detail.tsx
- apps/desktop/src/renderer/task-progress.tsx
- apps/desktop/src/renderer/artifact-view.tsx
- apps/desktop/src/renderer/App.tsx
- apps/desktop/tests/main/artifact-ipc.test.ts
- apps/desktop/tests/renderer/task-center.test.tsx
- apps/desktop/tests/renderer/task-detail.test.tsx
- apps/desktop/tests/renderer/artifact-view.test.tsx
- apps/desktop/tests/e2e/task-lifecycle.spec.ts
- apps/desktop/tests/e2e/onboarding.spec.ts
- apps/desktop/tests/e2e/proposal-confirmation.spec.ts
- docs/data-model.md
- docs/security.md
- docs/ux.md
- docs/verification/reports/phase-002-task-203.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Raw unsanitized provider output, executable Artifact rendering, overwriting an Artifact version, product display of Thread/Turn, false completed state, Decision implementation, and automatic acceptance repair.

## Interfaces / Contracts

Task projections derive state deterministically from persisted Task, required Work Item, Attempt, cancellation/reconciliation, and available evidence. ArtifactPort creates immutable versions with Artifact identity, Attempt, Project baseline, authorization, MIME type, size, checksum, storage reference, and creation time.

## Data Constraints

Artifact content remains outside ordinary SQLite rows; the database stores metadata and checksums. A retry creates a new ArtifactVersion. Task completed state requires successful required Work Item and required evidence; PHASE-003 will add Decision and full acceptance conditions without changing H1 identifiers.

## UI Constraints

Simple Tasks hide Work Item orchestration by default. Task Center shows goal, Project, Agent, deterministic state, and updated time. Task detail shows safe progress, cancellation/reconciliation, result evidence, and Artifact versions. Unknown or reconciling is never rendered as failed or completed.

## Implementation Requirements

- Sanitize streamed text and Artifact metadata before renderer delivery.
- Bound progress memory and use persisted pagination for historical events.
- Verify checksum and authorization before Artifact open/download.
- Preserve accessibility, keyboard operation, loading/empty/error states, and state labels defined in UX facts.

## Test Requirements

- Projection table tests for every Work Item/Attempt/cancel/reconcile combination.
- Artifact create, retry-version, checksum mismatch, unauthorized read, unsafe MIME, and size-limit tests.
- Renderer tests for safe streaming and no provider-native identifier exposure.
- Playwright goal-confirm-progress-cancel/result-Artifact flows against fake execution.
- Run lint, typecheck, unit, repository, Playwright, and build.

## Acceptance Criteria

- Task status is reproducible from persisted facts after restart.
- Artifact retries never overwrite an earlier version and checksum mismatch blocks access.
- Unknown/reconciling and cancellation stages are explicit and truthful.
- Task UI exposes no Thread/Turn and safely renders hostile fixture content.
- A successful fake execution provides attributable basic result evidence.

## Done Definition

Projection, Artifact security, renderer, and Playwright suites pass; facts reflect the actual UI/data contracts; no PHASE-003 Decision behavior is smuggled in; and the draft is re-approved before implementation.

## Risks

`SECURITY_PERMISSION 0.600` is active and confirmed. Untrusted content rendering, artifact path authorization, checksum confusion, and false completion are principal risks. Progress memory growth is bounded and tested even though the performance card is below activation.

This approved revision follows TASK-202 migration `004-execution`; execution
waits for PHASE-001 archival and preceding PHASE-002 Pack PASS evidence.

## Approved scope expansion

The user authorized `packages/persistence/src/sqlite/migration-runner.ts` and
`packages/persistence/tests/migration-runner.test.ts` on 2026-08-14 solely to
register and verify the already-approved `005-artifact.sql` migration.

The user authorized `apps/desktop/src/main/ipc-schemas.ts` and
`apps/desktop/src/main/main.ts` on 2026-08-14 solely to validate and register
the Task and Artifact read-only IPC channels defined by this Task Pack.

The user authorized `apps/desktop/src/preload/index.ts` on 2026-08-14 solely
to expose the same validated Task and Artifact read-only IPC operations.

The user authorized `apps/desktop/tests/e2e/onboarding.spec.ts` and
`apps/desktop/tests/e2e/proposal-confirmation.spec.ts` on 2026-08-21 solely
to align their navigation assertions with the approved H1 shell: reload starts
at Super Assistant and the stale Proposal Review is on that page, not Task
Center. No product behavior is changed by this expansion.

## Output Required

Return changed files, projection truth table, Artifact version/checksum evidence, hostile-content test results, Playwright captures, command results, and the phase report path.
