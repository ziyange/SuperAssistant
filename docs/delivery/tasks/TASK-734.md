# TASK-734: Produce a bundled CommonJS desktop preload

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user-approved continuous H1 remediation; real Electron sandbox validation remains deferred.

## Requirement IDs
REQ-002, REQ-090, REQ-091, REQ-093, REQ-094, REQ-095

## Objective
Fix the known normal-build preload ESM-format incompatibility using the existing pinned Vite toolchain without disabling desktop isolation.

## Context Pack
- docs/verification/reports/phase-007-task-721.md
- docs/delivery/tasks/TASK-733.md
- docs/delivery/phase-007-integration-recovery.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/architecture.md
- docs/security.md
- docs/operations.md
- docs/verification/quality-gate.md
- apps/desktop/package.json
- apps/desktop/src/preload/index.ts
- apps/desktop/src/main/window-policy.ts

## Allowed Files
- docs/delivery/tasks/TASK-734.md
- docs/verification/reports/phase-007-task-734.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/architecture.md
- docs/security.md
- apps/desktop/package.json
- apps/desktop/vite.preload.config.ts
- apps/desktop/src/main/main.ts
- apps/desktop/tests/main/runtime-package.test.ts

## Forbidden Files
Do not change Electron security settings, preload API permissions, package locks or dependency versions, original project files, archived evidence, or user worktrees. Do not run Electron sandbox or preload security validation in this task.

## Interfaces / Contracts
The main process points to dist/preload/index.cjs. The existing preload API remains unchanged. Vite produces a single CommonJS artifact with electron as the only external require; no external local preload modules or ESM syntax remain.

## Data Constraints
No user database, credentials or Project content changes; build outputs are disposable generated files.

## UI Constraints
No UI layout changes. Existing interface and security policies remain unchanged.

## Implementation Requirements
Write the artifact contract in engineering facts and add a failing static build-artifact test before implementation. Reuse the already pinned Vite dependency; typecheck preload sources before bundling. Do not interpret static syntax checks as actual sandbox validation.

## Test Requirements
Prove the prior artifact test fails, then run the preload build, Node syntax and static require checks, affected TypeScript checks, lint and full unit suite. Run task pack and runtime trace validation. Real Electron sandbox/preload execution is deferred.

## Acceptance Criteria
The normal build produces a parseable index.cjs with electron as the sole external require and main refers to it. Existing IPC channels and sandbox, contextIsolation, and nodeIntegration settings remain intact.

## Done Definition
Record exact commands and limitations. This task does not close G2, M1 or release acceptance without later real Electron sandbox evidence.

## Risks
Static checks cannot prove the actual Electron preload can start or that sender validation works; retain the deferred gate.

## Output Required
docs/verification/reports/phase-007-task-734.md
