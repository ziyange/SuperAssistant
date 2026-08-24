# TASK-703: Workspace RBAC
## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-082, REQ-090, REQ-094, REQ-096
## Objective
Add deny-by-default roles, groups and separation of duties.
## Context Pack
- docs/security.md
- docs/data-model.md
## Must Read
- AGENTS.md
- docs/delivery/phase-007.md
- docs/operations.md
## Implementation Requirements
Every team command evaluates Workspace, principal, role, resource and action.
## Done Definition
Positive and negative role matrix passes.
## Allowed Files
- services/team/src/rbac.ts
- services/team/tests/rbac.test.ts
- packages/domain/src/team-rbac.ts
- packages/domain/tests/team-rbac.test.ts
- docs/security.md
- docs/delivery/tasks/TASK-703.md
- docs/delivery/tasks/README.md
- docs/verification/reports/phase-007-task-703.md
## Forbidden Files
Any file not explicitly listed; administrator bypass; allow-by-default policy.
## Interfaces / Contracts
Authorization denial is explicit and auditable.
## Data Constraints
Groups are Workspace-scoped.
## UI Constraints
Unavailable actions are not rendered as executable controls.
## Test Requirements
Run 200 cross-role negative tests, typecheck and governance gates.
## Acceptance Criteria
No cross-Workspace or role-escalation action succeeds.
## Risks
Policy uncertainty denies the action.
## Output Required
Role-matrix evidence.

## Approved Scope Expansion

- 2026-08-24: completion writeback requires exactly
  `docs/delivery/tasks/README.md` so the execution registry cannot disagree
  with this completed Pack. No implementation scope is added.
