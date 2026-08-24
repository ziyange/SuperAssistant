# TASK-708: Governed notifications
## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
## Requirement IDs
REQ-087, REQ-088, REQ-089, REQ-094
## Objective
Add access-checked notifications, deep links, priority aggregation and quiet hours.
## Context Pack
- docs/product.md
- docs/ux.md
## Must Read
- AGENTS.md
- docs/delivery/phase-007.md
- docs/security.md
## Implementation Requirements
Every delivery rechecks authorization; Emergency bypass is explicit and audited.
## Done Definition
Quiet-hours, aggregation, deep-link and access-control tests pass.
## Allowed Files
- services/team/src/notification-policy.ts
- services/team/tests/notification-policy.test.ts
- apps/desktop/src/renderer/notification-settings.tsx
- apps/desktop/tests/renderer/notification-settings.test.tsx
- docs/ux.md
- docs/delivery/tasks/TASK-708.md
- docs/delivery/tasks/README.md
- docs/verification/reports/phase-007-task-708.md
## Forbidden Files
Any file not explicitly listed; access bypass; unbounded notification fanout.
## Interfaces / Contracts
Notifications reference only authorized task/decision identifiers.
## Data Constraints
Quiet-hour preferences are principal and Workspace scoped.
## UI Constraints
Deep links reauthorize before displaying content.
## Test Requirements
Run notification policy and renderer tests plus governance gates.
## Acceptance Criteria
Quiet hours suppress normal messages and retain Emergency audit evidence.
## Risks
Authorization uncertainty suppresses delivery.
## Output Required
Notification governance evidence.

## Approved Scope Expansion

- 2026-08-24: completion writeback requires exactly
  `docs/delivery/tasks/README.md` so the execution registry reflects this Pack.
  No implementation scope is added.
