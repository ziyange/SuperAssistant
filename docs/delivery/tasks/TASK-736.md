# TASK-736: Replace misleading onboarding actions with truthful navigation

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user-approved continuous H1 remediation; unavailable H1 features remain required for M1.

## Requirement IDs
REQ-002, REQ-005, REQ-014, REQ-019, REQ-090, REQ-094, REQ-098

## Objective
Make onboarding navigation honest while real Codex and task execution remain disconnected: Project navigation works and unsupported actions cannot falsely mark onboarding complete.

## Context Pack
- docs/ux.md
- docs/verification/reports/phase-007-task-733.md
- docs/verification/reports/phase-007-task-735.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/ux.md
- docs/security.md
- docs/verification/quality-gate.md
- apps/desktop/src/renderer/App.tsx
- apps/desktop/src/renderer/onboarding.tsx
- apps/desktop/src/renderer/agent-center.tsx

## Allowed Files
- docs/delivery/tasks/TASK-736.md
- docs/verification/reports/phase-007-task-736.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/ux.md
- apps/desktop/src/renderer/App.tsx
- apps/desktop/src/renderer/onboarding.tsx
- apps/desktop/tests/renderer/navigation.test.tsx
- apps/desktop/tests/e2e/onboarding.spec.ts

## Forbidden Files
Do not enable Codex execution, alter security settings, modify database schemas, dependencies, archived evidence or user projects. Do not run Electron sandbox/preload verification in this task.

## Interfaces / Contracts
Add Project navigates to the existing Project Center. Connect Codex navigates to the existing Agent Center, which truthfully shows UNAVAILABLE until real discovery is integrated. Start Task is disabled with a visible explanation; it must never set onboarding completed. This temporary state does not satisfy the H1 task-creation requirement.

## Data Constraints
These navigation actions do not create a Project, Agent, Task, Grant or onboarding completion record.

## UI Constraints
Reuse existing navigation and components. Show a clear unavailable explanation; keep all H1 features on the roadmap and never count disabling as M1 acceptance.

## Implementation Requirements
Update the UX interaction states before implementation. Add failing component/navigation tests demonstrating correct destinations and no false completion; update obsolete E2E expectations without running real Electron sandbox tests.

## Test Requirements
Run focused renderer unit tests, full lint and TypeScript checks, full unit regression, contract tests and runtime validation. Real Electron E2E remains deferred.

## Acceptance Criteria
Add Project and Connect Codex navigate to their actual views; the Agent view does not claim a connection; Start Task is disabled and does not invoke onboarding completion.

## Done Definition
Record evidence and remaining limitations. G2, H1 task execution and M1 remain open.

## Risks
Routing to an unavailable destination could imply capability exists; the Agent and task states must be explicit.

## Output Required
docs/verification/reports/phase-007-task-736.md
