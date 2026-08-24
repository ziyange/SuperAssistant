# TASK-713: Integrated Team authorization, credentials and approvals
## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 7
user_confirmed: true
## Requirement IDs
REQ-082, REQ-083, REQ-084, REQ-094, REQ-095, REQ-096, REQ-099
## Objective
Enforce RBAC, credential namespaces and multi-party approvals transactionally at every Team command, query and event subscription.
## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/security.md
- docs/orchestration.md
## Must Read
- AGENTS.md
- docs/data-model.md
- docs/operations.md
- docs/decisions/ADR-006-team-authority-and-oidc.md
## Implementation Requirements
Authorization occurs before protected data access. Grants bind immutable Proposal digest, Workspace, requester and distinct eligible approvers, then consume once.
## Done Definition
Every protected Team route uses one middleware; role/grant/credential invariants survive restarts and 200 negative cases pass.
## Allowed Files
- services/team/src/team-authorization.ts
- services/team/src/team-grant-service.ts
- services/team/src/credential-reference-service.ts
- services/team/src/approval-service.ts
- services/team/src/team-api.ts
- services/team/src/postgres/team-repository.ts
- services/team/tests/team-authorization.test.ts
- services/team/tests/team-grant-service.test.ts
- services/team/tests/credential-reference-service.test.ts
- services/team/tests/approval-service.test.ts
- services/team/tests/team-authorization-negative.test.ts
- docs/security.md
- docs/data-model.md
- docs/operations.md
- docs/delivery/tasks/TASK-713.md
- docs/verification/reports/phase-007-task-713.md
## Forbidden Files
Administrator bypass, cross-Workspace query, raw credential persistence, caller-supplied actor identity or grant reuse.
## Interfaces / Contracts
Authorization input is actor/session-derived and returns only opaque credential/grant references.
## Data Constraints
All Team writes are transactional; an approval quorum and its Grant are one atomic state transition.
## UI Constraints
No client-provided role or approval state is trusted.
## Test Requirements
200 negative authorization matrix, concurrent quorum/replay tests, PostgreSQL restart evidence and governance gates.
## Acceptance Criteria
No cross-Workspace protected operation succeeds; only distinct qualified approvals produce one usable Grant.
## Risks
Any unguarded route or nontransactional Grant blocks the Task.
## Output Required
Authorization and approval conformance evidence.
