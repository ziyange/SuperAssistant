# TASK-768: Prepare and verify the development-baseline candidate

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user requested completion of the seven development-baseline prerequisites and a merge-readiness judgment.

## Requirement IDs
REQ-090, REQ-092, REQ-093, REQ-095, REQ-096, REQ-099

## Objective
Preserve the existing audited candidate, stage its exact reviewed file set, create a reviewable candidate commit and obtain clean-SHA local and remote CI evidence without claiming H1/M1 acceptance.

## Context Pack
- docs/delivery/integration-recovery-baseline.md
- docs/verification/reports/phase-007-task-766.md
- docs/verification/reports/phase-007-task-767.md
- docs/verification/quality-gate.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-767.md

## Allowed Files
- .github/workflows/application-gates.yml
- .github/workflows/docs-gates.yml
- AGENTS.md
- apps/desktop/package.json
- apps/desktop/src/main/codex-discovery-ipc.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/main/lease-renewal-supervisor.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/outbox-dispatcher.ts
- apps/desktop/src/main/project-ipc.ts
- apps/desktop/src/main/window-policy.ts
- apps/desktop/src/main/worktree-service.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/renderer/App.tsx
- apps/desktop/src/renderer/agent-center.tsx
- apps/desktop/src/renderer/onboarding.tsx
- apps/desktop/src/renderer/project-center.tsx
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/tests/e2e/onboarding.spec.ts
- apps/desktop/tests/main/codex-discovery-ipc.test.ts
- apps/desktop/tests/main/ipc-router.test.ts
- apps/desktop/tests/main/lease-renewal-supervisor.test.ts
- apps/desktop/tests/main/orchestrator.test.ts
- apps/desktop/tests/main/project-ipc.test.ts
- apps/desktop/tests/main/runtime-package.test.ts
- apps/desktop/tests/main/window-policy.test.ts
- apps/desktop/tests/main/worktree-service.test.ts
- apps/desktop/tests/renderer/agent-center.test.tsx
- apps/desktop/tests/renderer/navigation.test.tsx
- apps/desktop/tests/renderer/project-center.test.tsx
- apps/desktop/vite.preload.config.ts
- docs/README.md
- docs/adapters/codex.md
- docs/architecture.md
- docs/data-model.md
- docs/delivery/execution-trace.json
- docs/delivery/permission-audit.log
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-721.md
- docs/delivery/tasks/TASK-727.md
- docs/delivery/tasks/TASK-728.md
- docs/delivery/tasks/TASK-729.md
- docs/delivery/tasks/TASK-730.md
- docs/delivery/tasks/TASK-731.md
- docs/delivery/tasks/TASK-732.md
- docs/delivery/tasks/TASK-733.md
- docs/delivery/tasks/TASK-734.md
- docs/delivery/tasks/TASK-735.md
- docs/delivery/tasks/TASK-736.md
- docs/delivery/tasks/TASK-737.md
- docs/delivery/tasks/TASK-738.md
- docs/delivery/tasks/TASK-739.md
- docs/delivery/tasks/TASK-740.md
- docs/delivery/tasks/TASK-741.md
- docs/delivery/tasks/TASK-742.md
- docs/delivery/tasks/TASK-743.md
- docs/delivery/tasks/TASK-744.md
- docs/delivery/tasks/TASK-745.md
- docs/delivery/tasks/TASK-746.md
- docs/delivery/tasks/TASK-747.md
- docs/delivery/tasks/TASK-748.md
- docs/delivery/tasks/TASK-749.md
- docs/delivery/tasks/TASK-750.md
- docs/delivery/tasks/TASK-751.md
- docs/delivery/tasks/TASK-752.md
- docs/delivery/tasks/TASK-753.md
- docs/delivery/tasks/TASK-754.md
- docs/delivery/tasks/TASK-755.md
- docs/delivery/tasks/TASK-756.md
- docs/delivery/tasks/TASK-757.md
- docs/delivery/tasks/TASK-758.md
- docs/delivery/tasks/TASK-759.md
- docs/delivery/tasks/TASK-760.md
- docs/delivery/tasks/TASK-761.md
- docs/delivery/tasks/TASK-762.md
- docs/delivery/tasks/TASK-763.md
- docs/delivery/tasks/TASK-764.md
- docs/delivery/tasks/TASK-765.md
- docs/delivery/tasks/TASK-766.md
- docs/delivery/tasks/TASK-767.md
- docs/delivery/tasks/TASK-768.md
- docs/operations.md
- docs/orchestration.md
- docs/security.md
- docs/ux.md
- docs/verification/quality-gate.md
- docs/verification/reports/phase-007-task-721.md
- docs/verification/reports/phase-007-task-727.md
- docs/verification/reports/phase-007-task-728.md
- docs/verification/reports/phase-007-task-729.md
- docs/verification/reports/phase-007-task-730.md
- docs/verification/reports/phase-007-task-731.md
- docs/verification/reports/phase-007-task-732.md
- docs/verification/reports/phase-007-task-733.md
- docs/verification/reports/phase-007-task-734.md
- docs/verification/reports/phase-007-task-735.md
- docs/verification/reports/phase-007-task-736.md
- docs/verification/reports/phase-007-task-737.md
- docs/verification/reports/phase-007-task-738.md
- docs/verification/reports/phase-007-task-739.md
- docs/verification/reports/phase-007-task-740.md
- docs/verification/reports/phase-007-task-741.md
- docs/verification/reports/phase-007-task-742.md
- docs/verification/reports/phase-007-task-743.md
- docs/verification/reports/phase-007-task-744.md
- docs/verification/reports/phase-007-task-745.md
- docs/verification/reports/phase-007-task-746.md
- docs/verification/reports/phase-007-task-747.md
- docs/verification/reports/phase-007-task-748.md
- docs/verification/reports/phase-007-task-749.md
- docs/verification/reports/phase-007-task-750.md
- docs/verification/reports/phase-007-task-751.md
- docs/verification/reports/phase-007-task-752.md
- docs/verification/reports/phase-007-task-753.md
- docs/verification/reports/phase-007-task-754.md
- docs/verification/reports/phase-007-task-755.md
- docs/verification/reports/phase-007-task-756.md
- docs/verification/reports/phase-007-task-757.md
- docs/verification/reports/phase-007-task-758.md
- docs/verification/reports/phase-007-task-759.md
- docs/verification/reports/phase-007-task-760.md
- docs/verification/reports/phase-007-task-761.md
- docs/verification/reports/phase-007-task-762.md
- docs/verification/reports/phase-007-task-763.md
- docs/verification/reports/phase-007-task-764.md
- docs/verification/reports/phase-007-task-765.md
- docs/verification/reports/phase-007-task-766.md
- docs/verification/reports/phase-007-task-767.md
- docs/verification/reports/phase-007-task-768.md
- eslint.config.mjs
- package-lock.json
- package.json
- packages/codex-adapter/package.json
- packages/codex-adapter/src/app-server-client.ts
- packages/codex-adapter/src/app-server-discovery.ts
- packages/codex-adapter/src/app-server-supervisor.ts
- packages/codex-adapter/src/execution.ts
- packages/codex-adapter/src/index.ts
- packages/codex-adapter/src/stdio-transport.ts
- packages/codex-adapter/src/worker.ts
- packages/codex-adapter/tests/app-server-client.test.ts
- packages/codex-adapter/tests/app-server-discovery.test.ts
- packages/codex-adapter/tests/app-server-supervisor.test.ts
- packages/codex-adapter/tests/cancel.contract.test.ts
- packages/codex-adapter/tests/discovery.contract.test.ts
- packages/codex-adapter/tests/fixtures/fake-app-server-rpc.mjs
- packages/codex-adapter/tests/typecheck-coverage.test.ts
- packages/codex-adapter/tsconfig.build.json
- packages/codex-adapter/tsconfig.json
- packages/domain/src/ports/project-repository.ts
- packages/domain/src/preflight.ts
- packages/domain/src/routing.ts
- packages/domain/tests/preflight.test.ts
- packages/domain/tests/routing.test.ts
- packages/dsh-adapter/tests/dsh-probe.test.ts
- packages/dsh-adapter/tests/dsh-tool-guard-plugin.test.ts
- packages/dsh-adapter/tests/dsh-tool-runtime-conformance.test.ts
- packages/dsh-adapter/tsconfig.json
- packages/persistence/src/index.ts
- packages/persistence/src/repositories/authorization-repository.ts
- packages/persistence/src/repositories/decision-repository.ts
- packages/persistence/src/repositories/execution-repository.ts
- packages/persistence/src/repositories/onboarding-repository.ts
- packages/persistence/src/repositories/outbox-repository.ts
- packages/persistence/src/repositories/project-repository.ts
- packages/persistence/src/repositories/resource-lease-repository.ts
- packages/persistence/src/sqlite/database.ts
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/sqlite/migrations/018-onboarding.sql
- packages/persistence/src/sqlite/migrations/019-outbox-claims.sql
- packages/persistence/src/sqlite/migrations/020-resource-lease-expiry.sql
- packages/persistence/tests/execution-transaction.test.ts
- packages/persistence/tests/migration-runner.test.ts
- packages/persistence/tests/onboarding-repository.test.ts
- packages/persistence/tests/outbox-inbox.test.ts
- packages/persistence/tests/project-repository.test.ts
- packages/persistence/tests/proposal-repository.test.ts
- packages/persistence/tests/resource-lease-expiry.test.ts
- scripts/check_vitest_summary.py
- scripts/verify_runtime_trace.py
- services/team/src/notification-outbox.ts
- services/team/src/notification-policy.ts
- services/team/src/postgres/schema.ts
- services/team/src/postgres/team-repository.ts
- services/team/src/team-api.ts
- services/team/tests/notification-outbox.test.ts
- services/team/tests/notification-policy.test.ts
- services/team/tests/postgres-team-repository.test.ts
- services/team/tests/team-api.test.ts
- tests/test_check_vitest_summary.py
- tests/test_verify_runtime_trace.py

## Forbidden Files
Do not edit application sources, source evidence, archived reports, main-workspace untracked files or the independent TASK-716 worktree. Do not merge, delete branches, clean worktrees, rewrite history or run real Codex or Electron sandbox tests in this task.

## Interfaces / Contracts
Every staged path must be explicitly listed above and match the latest committed audit hash, excluding only the audit and execution trace files whose chain is separately validated. Update the documentation CI anchor to this task. Preserve TASK-716 WIP and main untracked files. A local clean candidate commit may be pushed to its candidate branch for CI; record observed SHA and run outcomes without calling an unrun check passed.

## Data Constraints
No credentials, real user database, user Project, or protected data is read or modified. Disposable test databases are loopback-only and retained after shutdown.

## UI Constraints
No UI changes. Incomplete execution remains unavailable.

## Implementation Requirements
Recheck exact hashes, current Git status and main untracked overlap before staging. Review staged paths and diff; commit only the listed candidate files. Verify clean status and run gates on that commit. Check remote main freshness and push only the candidate branch. Preserve all independent uncommitted work.

## Test Requirements
Run governance in order, clean candidate build, lint, typecheck, nonempty unit and contract suites, isolated PostgreSQL checks and actual candidate-SHA CI. Remote CI failure or missing evidence blocks the merge recommendation.

## Acceptance Criteria
No unauthorized staged paths or untracked residue in the candidate; clean candidate commit is descendant of main; local gates and required CI jobs pass on that SHA; no claim is made that deferred Codex or sandbox acceptance passed.

## Done Definition
Provide an evidence-based development-baseline merge-readiness judgment. PHASE-007, M1, H3 and release remain unaccepted.

## Risks
Existing WIP remains outside the candidate and must not be deleted. A remote or platform-dependent CI failure may require another bounded corrective task and new candidate SHA.

## Output Required
docs/verification/reports/phase-007-task-768.md
