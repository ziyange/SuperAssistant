# TASK-604: HR Agent boundary
## Status
COMPLETED
PHASE: PHASE-006
MAX_ITERATIONS: 5
user_confirmed: true
## Requirement IDs
REQ-072, REQ-073, REQ-076, REQ-090, REQ-096
## Objective
Implement HR data classification, retention and human-decision boundary.
## Context Pack
- docs/security.md
- docs/data-model.md
## Implementation Requirements
- Sensitive HR output is redacted and employment actions always require a human Decision.
## Done Definition
Isolation and denied-action evidence pass.
## Must Read
- AGENTS.md
- docs/security.md
- docs/data-model.md
- docs/operations.md
## Allowed Files
- packages/domain/src/hr-policy.ts
- packages/domain/src/index.ts
- packages/domain/tests/hr-policy.test.ts
- docs/product.md
- docs/security.md
- docs/data-model.md
- docs/operations.md
- docs/delivery/tasks/TASK-604.md
- docs/verification/reports/phase-006-task-604.md
## Forbidden Files
Any file not explicitly listed; employment action; secret or sensitive display.
## Interfaces / Contracts
HR action intent maps to L4 Decision only.
## Data Constraints
Sensitive fields are classified and redacted.
## UI Constraints
Human-decision requirement is visible.
## Test Requirements
Run policy, redaction, lint, typecheck, build and governance gates.
## Acceptance Criteria
Unauthorized employment action is rejected.
## Risks
Sensitive data exposure fails closed.
## Output Required
Report HR boundary evidence.
