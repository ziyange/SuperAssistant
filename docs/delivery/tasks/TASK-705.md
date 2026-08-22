# TASK-705: Multi-party approval
## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-084, REQ-090, REQ-091, REQ-096
## Objective
Implement distinct qualified approver quorum and replay-safe Grant issuance.
## Context Pack
- docs/security.md
- docs/orchestration.md
## Must Read
- AGENTS.md
- docs/delivery/phase-007.md
- docs/data-model.md
## Implementation Requirements
Approval is atomic, immutable, Proposal-version-bound and idempotent.
## Done Definition
Concurrent/replay approval tests prove only qualified distinct quorum issues a Grant.
## Allowed Files
- services/team/src/approval-quorum.ts
- services/team/tests/approval-quorum.test.ts
- packages/domain/src/team-approval.ts
- packages/domain/tests/team-approval.test.ts
- docs/security.md
- docs/delivery/tasks/TASK-705.md
- docs/verification/reports/phase-007-task-705.md
## Forbidden Files
Any file not explicitly listed; self-approval where separation is required.
## Interfaces / Contracts
Grant remains one-use and carries immutable approver evidence.
## Data Constraints
Approver identity and policy version are append-only audit records.
## UI Constraints
Quorum progress does not reveal unauthorized approver details.
## Test Requirements
Run concurrent quorum tests, typecheck and governance gates.
## Acceptance Criteria
Only distinct eligible approvers can reach policy quorum.
## Risks
Concurrent conflict retries read-only reconciliation before reattempt.
## Output Required
Approval replay and quorum evidence.
