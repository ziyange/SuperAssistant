# TASK-608: Enterprise internal Agent
## Status
APPROVED
PHASE: PHASE-006
MAX_ITERATIONS: 5
user_confirmed: true
## Requirement IDs
REQ-080, REQ-090, REQ-094, REQ-096
## Objective
Onboard an internal Agent with auditable data-domain, credential and authorization scope.
## Context Pack
- docs/security.md
- docs/api/sai.md
## Implementation Requirements
- Enforce data scope and opaque credential reference at every command.
## Done Definition
Cross-scope access tests pass.
## Must Read
- AGENTS.md
- docs/security.md
- docs/data-model.md
- docs/api/sai.md
## Allowed Files
- packages/domain/src/internal-agent-policy.ts
- packages/domain/src/index.ts
- packages/domain/tests/internal-agent-policy.test.ts
- docs/security.md
- docs/data-model.md
- docs/delivery/tasks/TASK-608.md
- docs/verification/reports/phase-006-task-608.md
## Forbidden Files
Any file not explicitly listed; credential value; cross-domain access.
## Interfaces / Contracts
Authorization scope intersects Agent data domain.
## Data Constraints
Every access is auditable.
## UI Constraints
Scope and limitation are visible.
## Test Requirements
Run domain, authorization, lint, typecheck, build and governance gates.
## Acceptance Criteria
Cross-domain credential attempt is denied.
## Risks
Unknown scope fails closed.
## Output Required
Report internal-Agent scope evidence.
