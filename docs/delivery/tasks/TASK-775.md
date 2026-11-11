# TASK-775: Fail closed on malformed notification authorization

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user requested autonomous remediation of merge-blocking authorization defects.

## Requirement IDs
REQ-085, REQ-087, REQ-088, REQ-089, REQ-090, REQ-094, REQ-096

## Objective
Reject any notification authorization result other than literal true in quiet-hours policy, notification delivery and deep-link resolution.

## Context Pack
- docs/verification/reports/phase-007-task-774.md
- docs/security.md
- services/team/src/notification-outbox.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/ux.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-774.md

## Allowed Files
- docs/delivery/tasks/TASK-775.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- services/team/src/notification-policy.ts
- services/team/src/notification-outbox.ts
- services/team/tests/notification-policy.test.ts
- services/team/tests/notification-outbox.test.ts
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-775.md

## Forbidden Files
No main-process or Team API wiring, real notification delivery, credentials, user data, user worktrees, Electron sandbox, archived evidence, merge or cleanup.

## Interfaces / Contracts
Authorization ports are trusted only after returning literal boolean true; malformed truthy values, rejection and false deny. Notification delivery must not begin or send on denial; deep-link target resolution must not be called on denial. Existing valid behavior and scoped quiet-hours opt-in remain intact.

## Data Constraints
Use deterministic fixtures only; no real notification or personal data.

## UI Constraints
No UI changes.

## Implementation Requirements
Record the runtime authorization rule in security facts. Add RED tests for malformed truthy policy input and authorization results before implementing; retain all existing negative cases.

## Test Requirements
Targeted notification tests, production build, lint, typecheck, full unit and contract tests, ordered governance and candidate CI.

## Acceptance Criteria
Truthy non-boolean authorization never causes policy delivery, channel invocation or target resolution. Literal true is still accepted only under all other existing policy checks. No full notification or H3 acceptance claim is made.

## Done Definition
Record local and remote evidence and remaining delivery/audit integration blockers.

## Risks
Literal-true validation is necessary but does not prove the authorizer is backed by current Workspace membership, nor that channel delivery and audit are integrated.

## Output Required
docs/verification/reports/phase-007-task-775.md
