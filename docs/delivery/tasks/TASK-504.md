# TASK-504: Bound automated follow-up
## Status
APPROVED
PHASE: PHASE-005
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-067, REQ-068, REQ-069
## Objective
Apply cooldown, concurrency and budget controls before monitoring follow-up Proposals.
## Context Pack
- docs/security.md
- docs/orchestration.md
## Implementation Requirements
- Every follow-up side effect remains Proposal/Grant gated.
## Done Definition
Budget and authorization evidence pass.
## Must Read
- AGENTS.md
- docs/product.md
- docs/security.md
- docs/orchestration.md
- docs/operations.md
## Allowed Files
- packages/domain/src/follow-up-budget.ts
- packages/domain/tests/follow-up-budget.test.ts
- packages/persistence/src/repositories/follow-up-budget-repository.ts
- packages/persistence/tests/follow-up-budget-repository.test.ts
- docs/security.md
- docs/orchestration.md
- docs/operations.md
- docs/delivery/tasks/TASK-504.md
- docs/verification/reports/phase-005-task-504.md
## Forbidden Files
Any file not explicitly listed; automatic side effect without Proposal/Grant; budget bypass.
## Interfaces / Contracts
Limits apply before Proposal creation and never replace authorization.
## Data Constraints
Cooldown and budget decisions are auditable.
## UI Constraints
Blocked follow-ups explain limit reason.
## Test Requirements
Run budget, cooldown, authorization, lint, typecheck, build and governance gates.
## Acceptance Criteria
Over-limit calls are blocked or delayed and never mutate without Grant.
## Risks
Automation storms fail closed.
## Output Required
Report limits and authorization evidence.
