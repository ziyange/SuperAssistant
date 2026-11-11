# TASK-774: Require explicit emergency quiet-hours bypass

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user requested autonomous remediation of merge blockers under the approved G6 notification policy.

## Requirement IDs
REQ-087, REQ-088, REQ-089, REQ-094, REQ-096

## Objective
Correct the notification policy so an Emergency bypasses scoped quiet hours only when explicitly configured, with the existing audit marker. No notification delivery is enabled by this task.

## Context Pack
- docs/ux.md
- docs/security.md
- services/team/src/notification-policy.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/ux.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-716.md

## Allowed Files
- docs/delivery/tasks/TASK-774.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/ux.md
- services/team/src/notification-policy.ts
- services/team/tests/notification-policy.test.ts
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-774.md

## Forbidden Files
No main-process or Team API wiring, user credentials or data, user worktrees, real network delivery, Electron sandbox, archived evidence, merge or cleanup.

## Interfaces / Contracts
The policy accepts optional emergencyBypassAllowed; only literal true permits an authorized Emergency to bypass matching principal-scoped quiet hours, returning the EMERGENCY_BYPASS audit marker. Missing, false or non-true values suppress delivery. Authorization remains required regardless of configuration. This marker is not proof of durable audit or actual notification delivery.

## Data Constraints
Pure deterministic policy tests only; no persisted settings or production notifications are altered.

## UI Constraints
No graphical UI change; synchronize the existing preference behavior description only.

## Implementation Requirements
Update product-facing behavior before code. Write RED tests for missing/false/non-boolean configuration, explicit true and authorization denial. Keep regular and cross-principal quiet-hours behavior intact.

## Test Requirements
Targeted policy tests, production build, lint, typecheck, complete unit and contract suites, governance and candidate CI.

## Acceptance Criteria
Emergency in scoped quiet hours is suppressed unless explicitly enabled and authorized; enabled bypass carries its audit marker. The notification worker, preference persistence and audit recording remain unaccepted.

## Done Definition
Report local and CI evidence separately from the remaining full notification delivery requirements.

## Risks
An audit marker is not a durable audit event; this does not integrate settings, notification delivery or click reauthorization.

## Output Required
docs/verification/reports/phase-007-task-774.md
