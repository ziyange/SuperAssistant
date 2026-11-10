# TASK-750: Desktop Codex discovery integration

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authorization: approved integration recovery and standing authorization to continue PHASE-007; no new version compatibility or execution permission is implied.

## Requirement IDs
REQ-014, REQ-015, REQ-017, REQ-018, REQ-019, REQ-028, REQ-029, REQ-090, REQ-091, REQ-094, REQ-098

## Objective
Connect the Agent Center to explicit, supervised read-only Codex discovery, with honest last-check states and no task execution.

## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/verification/reports/phase-007-task-749.md
- docs/adapters/codex.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/ux.md
- docs/adapters/codex.md
- docs/api/sai.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-750.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/ux.md
- docs/adapters/codex.md
- docs/verification/reports/phase-007-task-750.md
- apps/desktop/package.json
- package-lock.json
- packages/codex-adapter/src/index.ts
- packages/codex-adapter/src/worker.ts
- apps/desktop/src/main/codex-discovery-ipc.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/renderer/App.tsx
- apps/desktop/src/renderer/agent-center.tsx
- apps/desktop/tests/main/codex-discovery-ipc.test.ts
- apps/desktop/tests/main/ipc-router.test.ts
- apps/desktop/tests/renderer/navigation.test.tsx
- apps/desktop/tests/renderer/agent-center.test.tsx
- packages/codex-adapter/tests/discovery.contract.test.ts

## Forbidden Files
No archives, user projects, secrets, execution adapter, lockfile changes unrelated to the declared workspace dependency, version gating, sandbox settings, Git merge or push.

## Interfaces / Contracts
A trusted IPC request without parameters opens a native executable-selection dialog; renderer cannot supply paths, commands or environment. Only a user-selected absolute Windows executable is probed with --version and started as app-server with shell disabled, bounded timeouts and safe environment. A single in-flight request is shared; selection cancellation causes no process. The supervisor is always shut down before returning a sanitized last-check projection containing connection, availability, version and observed time only. No process identifier, path, credentials or upstream identifiers reach renderer. Failure is UNAVAILABLE, unsupported versions stay VERSION_UNSUPPORTED, and capabilities do not enable execution.

The version child is supervised separately: on timeout or oversized output the
whole owned process tree must be terminated and child close confirmed before
failure returns. Failure to confirm must fail closed without a successful
observation; no automatic retry is allowed.

## Data Constraints
No persistent credentials or executable paths. User-selected executable is an explicit trust decision; no PATH search or automatic launch. Never run a real upstream during development checks.

## UI Constraints
Reuse Agent Center layout; add a keyboard-accessible Check Codex button, busy state, visible last-check label and truthful unavailable, cancelled, authentication-required and incompatible states. No authentication-repair button until wired; no task execution button.

## Implementation Requirements
Synchronize UX and adapter facts before code. Add workspace dependency through lockfile-only offline resolution. Write failing tests for exact IPC validation, selection cancellation, success and shutdown, failure, duplicate clicks and renderer projection. Reuse supervisor, do not duplicate parser or allow renderer-controlled executable arguments.

## Test Requirements
Run focused red and green tests, production build, lint, typecheck, complete unit and contract suites, ordered governance and goal-mode runtime trace. Do not run Electron sandbox verification or real Codex execution.

## Acceptance Criteria
The Agent Center displays only user-triggered actual discovery observations; no processes on cancel, unsupported versions fail closed, supervisor shutdown precedes projection, failures reveal no private data, and IPC refuses extra fields. Actual packaged Electron and real Codex checks remain unverified.

## Done Definition
Record commands, test counts and omissions; leave M1 unaccepted pending real integrated evidence.

## Risks
Selected executables run with the current user's permissions; do not permit renderer-supplied paths or auto-discovery. A last observation is not a live connection and cannot establish execution support.

## Output Required
docs/verification/reports/phase-007-task-750.md
