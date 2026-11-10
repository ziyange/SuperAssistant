# TASK-733: Connect Project Center to local folder registration

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-approved continuous H1 integration remediation.

## Requirement IDs
REQ-001, REQ-005, REQ-006, REQ-007, REQ-010, REQ-013, REQ-090, REQ-094, REQ-095, REQ-098

## Objective
Connect the existing Project Center to the validated local Project catalog through a trusted main-process native folder picker and limited IPC.

## Context Pack
- docs/delivery/tasks/TASK-731.md
- docs/delivery/tasks/TASK-732.md
- docs/delivery/phase-007-integration-recovery.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/ux.md
- docs/verification/quality-gate.md
- apps/desktop/src/main/project-ipc.ts

## Allowed Files
- docs/delivery/tasks/TASK-733.md
- docs/verification/reports/phase-007-task-733.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/ux.md
- docs/security.md
- docs/architecture.md
- apps/desktop/src/main/project-ipc.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/renderer/project-center.tsx
- apps/desktop/src/renderer/App.tsx
- apps/desktop/tests/main/project-ipc.test.ts
- apps/desktop/tests/main/ipc-router.test.ts
- apps/desktop/tests/renderer/project-center.test.tsx

## Forbidden Files
Do not alter sandbox settings, Team authority, Codex execution, original Project files, user worktrees, existing migrations, dependency locks or archived evidence.

## Interfaces / Contracts
project:list and project:choose accept empty payloads only. Main derives the single local Workspace from owner local-owner, refuses ambiguous multiple active matches, and invokes the OS folder chooser. Renderer never supplies a filesystem path or Workspace ID. List returns a minimal Project card projection; choose returns REGISTERED, CANCELLED or ERROR plus the refreshed scoped list. The generic error does not contain raw paths or exception details.

## Data Constraints
List does not create a Workspace. The first successful choose creates the local Workspace and Project in one SQLite transaction; cancellation and invalid paths create no data. Existing Project data and source files remain unchanged. Different or ambiguous Workspace ownership fails closed.

## UI Constraints
Project Center retains existing cards and adds an Add Project action. Display loading, empty, error, cancel and success states; disable repeated selection while loading. Use the existing navigation and visual system.

## Implementation Requirements
Write UX and security bindings before code. Add failing tests for empty-payload validation, local Workspace isolation, cancellation, invalid directory rollback and registration projection; then implement main, preload and renderer wiring. Native Electron sandbox/preload verification remains deferred until pre-release.

## Test Requirements
Run targeted SQLite/IPC/renderer tests, security negative cases, lint, TypeScript, build, full unit regression and anchored runtime verification. Do not run real Electron sandbox tests now.

## Acceptance Criteria
User-triggered selection of a valid folder creates exactly one persisted Project; alias selection returns the same Project; cancellation or invalid selection changes nothing; list is workspace-scoped; renderer cannot submit a path or cause raw errors to be displayed. Real Electron end-to-end remains unaccepted until the deferred gate.

## Done Definition
Write factual evidence and limitations, preserve the original workspace and user data, and leave overall G2/M1 unpassed pending deferred and other required tests.

## Risks
Folder picker and Workspace mapping are security boundaries; arbitrary renderer paths, ambiguous identities or swallowed transaction failures could create or disclose the wrong Project.

## Output Required
docs/verification/reports/phase-007-task-733.md
