# TASK-602: Domain template contracts
## Status
APPROVED
PHASE: PHASE-006
MAX_ITERATIONS: 5
user_confirmed: true
## Requirement IDs
REQ-070, REQ-073, REQ-076, REQ-090, REQ-094
## Objective
Define versioned domain Template/Function contracts and data classification boundaries.
## Context Pack
- docs/product.md
- docs/data-model.md
- docs/security.md
## Implementation Requirements
- Separate inference, cited fact and side-effect intent.
## Done Definition
Immutable versions and classification tests pass.
## Must Read
- AGENTS.md
- docs/product.md
- docs/data-model.md
- docs/security.md
## Allowed Files
- packages/domain/src/domain-template.ts
- packages/domain/src/index.ts
- packages/domain/tests/domain-template.test.ts
- docs/product.md
- docs/data-model.md
- docs/security.md
- docs/ux.md
- docs/delivery/tasks/TASK-602.md
- docs/verification/reports/phase-006-task-602.md
## Forbidden Files
Any file not explicitly listed; domain action execution; regulated automatic decision.
## Interfaces / Contracts
Template version pins Function and data classification.
## Data Constraints
Sensitive input has an explicit classification.
## UI Constraints
Facts and recommendations have distinct labels.
## Test Requirements
Run domain, lint, typecheck, build and governance gates.
## Acceptance Criteria
Unclassified data and action intent are rejected.
## Risks
Inference is never presented as authority.
## Output Required
Report template provenance and classification evidence.
