# TASK-704: Credential namespace isolation
## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-083, REQ-094, REQ-095
## Objective
Enforce user/service credential namespaces and non-transferable Grants.
## Context Pack
- docs/security.md
- docs/operations.md
## Must Read
- AGENTS.md
- docs/delivery/phase-007.md
- docs/data-model.md
## Implementation Requirements
Credential values remain in the owning Windows Credential Manager context.
## Done Definition
Cross-principal and cross-Workspace reads are rejected.
## Allowed Files
- services/team/src/credential-scope.ts
- services/team/tests/credential-scope.test.ts
- packages/domain/src/team-grant.ts
- packages/domain/tests/team-grant.test.ts
- docs/security.md
- docs/delivery/tasks/TASK-704.md
- docs/verification/reports/phase-007-task-704.md
## Forbidden Files
Any file not explicitly listed; credential values in Postgres, logs or UI.
## Interfaces / Contracts
Grant binds actor, Workspace, Proposal version and opaque credential reference.
## Data Constraints
Postgres persists only owner, scope, rotation metadata and opaque reference.
## UI Constraints
Credential presence never displays secret material.
## Test Requirements
Run isolation/redaction tests, typecheck and governance gates.
## Acceptance Criteria
Credential lookup across owner or Workspace returns zero data.
## Risks
Missing credentials block writes safely.
## Output Required
Credential-isolation evidence.
