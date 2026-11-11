# TASK-777: Persist Codex registration without stale readiness

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authorization: user requested autonomous completion of merge blockers and previously approved the H1 Codex onboarding contract.

## Requirement IDs
REQ-001, REQ-002, REQ-014, REQ-015, REQ-017, REQ-019, REQ-090, REQ-092, REQ-094, REQ-095, REQ-097, REQ-098

## Objective
Persist the native-picker-selected Codex runtime and stable Agent identity after a completed read-only discovery. After restart expose only a sanitized registration version and a recheck-required state; never infer current health or executable capability from cached data.

## Context Pack
- docs/delivery/tasks/TASK-105.md
- docs/verification/reports/phase-007-task-776.md
- apps/desktop/src/main/codex-discovery-ipc.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/ux.md
- docs/operations.md
- docs/adapters/codex.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-777.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/ux.md
- docs/operations.md
- packages/persistence/src/sqlite/migrations/021-local-codex-registration.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/tests/migration-runner.test.ts
- apps/desktop/src/main/local-workspace.ts
- apps/desktop/src/main/local-codex-registration.ts
- apps/desktop/src/main/project-ipc.ts
- apps/desktop/src/main/codex-discovery-ipc.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/renderer/App.tsx
- apps/desktop/tests/main/local-codex-registration.test.ts
- apps/desktop/tests/main/codex-discovery-ipc.test.ts
- apps/desktop/tests/main/ipc-router.test.ts
- apps/desktop/tests/renderer/agent-center.test.tsx
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-777.md

## Forbidden Files
No Codex execution start, automatic persisted-path execution, fabricated Function or capability, credential persistence, renderer-provided path, user Project or database fixtures, Electron sandbox, source evidence, archived evidence, merge or branch cleanup.

## Interfaces / Contracts
Use one Workspace-scoped runtime row linked to a stable Agent identity. A successful native-picker read-only probe persists only its canonical executable path and validated version; the Agent's durable state remains UNAVAILABLE and PAUSED until a future authoritative live-health implementation exists. Registration reads expose only version and RECHECK_REQUIRED; never expose executable path, credentials or claim the Agent is live. Registration and Workspace creation are atomic and ambiguous local Workspaces fail closed. Renderer may not supply path or arguments. Do not start or probe the saved executable automatically after restart.
An existing unlinked Agent named Codex is neither adopted nor duplicated: fail closed for explicit identity reconciliation.
Locked local-owner Workspace authority also fails closed rather than creating a replacement Workspace.

## Data Constraints
Migration 021 is additive and retains prior rows. Use only disposable SQLite and fake discovery fixtures. Rollback must not destroy existing database evidence; established backup-before-migration behavior remains in force.

## UI Constraints
Reuse the existing Agent Center layout and Check Codex button. A cached registration may show its version and a recheck-required notice with UNAVAILABLE state. Existing loading, error and observed-state behavior remains unchanged.

## Implementation Requirements
Write architecture, data, security, UX and operations facts before code. Use test-first SQLite reopen, duplicate registration, failure/cancel, ambiguous Workspace, renderer projection and IPC boundary tests. Reuse a shared local-Workspace helper rather than duplicate owner-selection logic. Do not fabricate Functions.

## Test Requirements
Run targeted migration, registration, discovery, Project, IPC and renderer tests; build, lint, typecheck, complete unit and contract suites; governance, runtime and candidate CI. Real Codex and Electron sandbox remain deferred.

## Acceptance Criteria
One successful discovery creates one stable Agent and local runtime registration; rechecking updates the same identity; cancel, malformed observation or failed persistence cannot report registration success. After database reopen Renderer sees only version and recheck-required state, not the selected path or a stale connected/available claim. IPC rejects extra renderer fields. Existing Projects remain accessible and no Function is invented.

## Done Definition
Report executed tests, skipped checks and external CI. Live health, Function discovery, Project assignment and actual execution remain open.

## Risks
Persisted executable path is untrusted input for any later execution: the future execution path must revalidate canonical identity, permissions, current version and policy. Cached discovery never authorizes execution.

## Output Required
docs/verification/reports/phase-007-task-777.md
