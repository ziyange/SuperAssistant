# TASK-104: Register Projects and isolate task worktrees

## Status

APPROVED

PHASE: PHASE-001

MAX_ITERATIONS: 5

user_confirmed: true

## Requirement IDs

REQ-006, REQ-007, REQ-010, REQ-011, REQ-012, REQ-013, REQ-031, REQ-090, REQ-094, REQ-098

## Objective

Implement canonical Project registration, metadata provenance, lifecycle policy, Project Center projections, and a safe service that creates one isolated Git worktree/branch per future task without modifying the original workspace.

## Context Pack

- `docs/delivery/phase-001.md`
- `docs/data-model.md`
- `docs/decisions/ADR-004-task-worktrees.md`

## Must Read

- `AGENTS.md`
- `docs/requirements.md`
- `docs/data-model.md`
- `docs/security.md`
- `docs/operations.md`
- `docs/decisions/ADR-004-task-worktrees.md`

## Allowed Files

- packages/domain/src/project.ts
- packages/domain/src/services/project-service.ts
- packages/domain/src/ports/project-repository.ts
- packages/domain/src/ports/worktree-service.ts
- packages/domain/src/index.ts
- packages/domain/tests/project.test.ts
- packages/persistence/src/repositories/project-repository.ts
- packages/persistence/src/index.ts
- packages/persistence/tests/project-repository.test.ts
- apps/desktop/src/main/project-ipc.ts
- apps/desktop/src/main/worktree-service.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/renderer/project-center.tsx
- apps/desktop/tests/main/project-ipc.test.ts
- apps/desktop/tests/main/worktree-service.test.ts
- apps/desktop/tests/renderer/project-center.test.tsx
- apps/desktop/tests/e2e/project-onboarding.spec.ts
- docs/data-model.md
- docs/operations.md
- docs/verification/reports/phase-001-task-104.md
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/sqlite/migrations/002-project-metadata.sql
- apps/desktop/src/renderer/App.tsx
- packages/persistence/tests/migration-runner.test.ts

## Execution Expansion

The implementation agent approved these three exact paths on 2026-08-12 under
the user's full-plan execution delegation. Migration 002 adds Project metadata
without rewriting released migration 001; its runner must register that new
forward-only migration. `App.tsx` is the existing bounded composition point
needed to render the allowed Project Center on its already-fixed destination.
No dependency, credential, remote, execution, or broad file-scope change is
permitted.

The existing migration-runner regression test is also included solely to move
its expected applied schema from `[1]` to `[1, 2]` and inject its simulated
failure at version `3`. This preserves, rather than weakens, repeat and
rollback coverage after adding forward-only migration 002.

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- The user's source repository files, existing branches, credentials, Codex execution, Task orchestration, automatic commit, remote, push, merge, or recursive delete.

## Interfaces / Contracts

Project registration accepts a candidate local path, canonicalizes it, validates accessibility, discovers metadata with provenance, and commits one Project transaction. Worktree service accepts Project identity plus future Task identity and returns canonical worktree path, `codex/phase-00x-*` branch, baseline commit, and resource identity.

## Data Constraints

Canonical Project paths are unique per Workspace. User corrections retain provenance. Archived Projects are not deleted and cannot accept new Task worktrees. Worktree records never store credentials and must bind Project, repository baseline, branch, path, and cleanup state.

## UI Constraints

Project Center shows explicit initialization, active, paused, archived, and error states; repository and discovered metadata include provenance. Errors identify the failed validation without exposing secrets or raw command lines.

## Implementation Requirements

- Reject missing, inaccessible, duplicate, unsafe-root, or unsupported paths without partial records.
- Use native non-interactive Git commands with validated absolute paths.
- Create worktrees only under the configured project worktree root.
- Verify the original workspace status and content before and after worktree lifecycle tests.

## Test Requirements

- Test canonical aliases, missing paths, access failure, Git and non-Git metadata, user correction, lifecycle transition, and archive denial.
- In a disposable repository, create two task worktrees and prove distinct paths/branches and unchanged original files.
- Test failed creation cleanup and stale-worktree reconciliation without deleting unknown paths.
- Run focused unit, IPC, renderer, Playwright, lint, typecheck, and build commands.

## Acceptance Criteria

- Equivalent paths produce one Project.
- Registration failure leaves no partial Project.
- Each task fixture receives an isolated worktree and allowed branch name.
- Original workspace hash and branch remain unchanged throughout tests.
- Pause/archive policy prevents disallowed worktree creation.

## Done Definition

Project registration and worktree tests pass, safety evidence includes resolved paths and original-workspace hashes, facts are updated, and no remote operation occurred.

## Risks

`SECURITY_PERMISSION 0.600` is active and confirmed; path authority and Git command scope are principal controls. `CONCURRENCY_RACE 0.526` remains an engineering gate through distinct worktrees, canonical resource identities, and stale-state reconciliation.

## Output Required

Return changed files, path validation table, disposable repository evidence, original-workspace before/after hashes, Git commands used, cleanup result, and the phase report path.
