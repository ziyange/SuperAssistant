# TASK-715: Electron Team governance workflows
## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 7
user_confirmed: true
## Requirement IDs
REQ-081, REQ-082, REQ-083, REQ-084, REQ-085, REQ-086, REQ-089, REQ-098
## Objective
Connect the desktop client to Team mode and deliver accessible Workspace, membership, role, approval, audit and retention workflows.
## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/ux.md
- docs/security.md
## Must Read
- AGENTS.md
- docs/architecture.md
- docs/data-model.md
- docs/operations.md
## Implementation Requirements
The Electron client uses Team API ports only; it cannot make itself authoritative or trust client-supplied permissions.
## Done Definition
Keyboard-accessible Team workflows render authorized server projections and correctly handle denied/expired/degraded states.
## Allowed Files
- apps/desktop/src/main/team-client.ts
- apps/desktop/src/main/team-ipc.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/preload/team-api.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/renderer/App.tsx
- apps/desktop/src/renderer/team-workspace.tsx
- apps/desktop/src/renderer/team-members.tsx
- apps/desktop/src/renderer/team-approvals.tsx
- apps/desktop/src/renderer/team-governance.tsx
- apps/desktop/tests/main/team-ipc.test.ts
- apps/desktop/tests/renderer/team-workspace.test.tsx
- apps/desktop/tests/renderer/team-members.test.tsx
- apps/desktop/tests/renderer/team-approvals.test.tsx
- apps/desktop/tests/renderer/team-governance.test.tsx
- apps/desktop/tests/e2e/team-governance.spec.ts
- docs/ux.md
- docs/security.md
- docs/operations.md
- docs/delivery/tasks/TASK-715.md
- docs/verification/reports/phase-007-task-715.md
## Forbidden Files
New primary navigation destination, renderer direct database access, client-side permission bypass or token display.
## Interfaces / Contracts
Preload exposes only typed safe Team commands/queries; all access checks remain server authoritative.
## Data Constraints
The renderer receives redacted projections and opaque references only.
## UI Constraints
All controls are keyboard-operable and clearly distinguish unavailable, denied, waiting-approval and degraded states.
## Test Requirements
IPC negative tests, renderer accessibility tests, Team API fake-service contracts and Electron Playwright E2E.
## Acceptance Criteria
An authorized member can complete governed workflows; unauthorized/expired users see no protected content or executable control.
## Risks
UI state drift from server authority blocks the Task.
## Output Required
Desktop Team workflow evidence.

## Scope expansion

- Authorization: user directed on 2026-08-27 that non-critical authorization
  questions be executed directly.
- Reason: Team client, IPC and renderer components are otherwise unreachable:
  the existing typed channel registry, request validator, trusted Electron
  registration, preload bridge and root composition must be extended together.
- Added paths: `apps/desktop/src/main/ipc-router.ts`,
  `apps/desktop/src/main/ipc-schemas.ts`, `apps/desktop/src/main/main.ts`,
  `apps/desktop/src/preload/index.ts`, `apps/desktop/src/shared/ipc-contract.ts`
  and `apps/desktop/src/renderer/App.tsx`.
