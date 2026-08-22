# TASK-707: Retention and legal hold
## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
## Requirement IDs
REQ-086, REQ-096
## Objective
Implement retention, legal hold and evidenced deletion dry-run.
## Context Pack
- docs/operations.md
- docs/security.md
## Must Read
- AGENTS.md
- docs/delivery/phase-007.md
- docs/data-model.md
## Implementation Requirements
Legal hold blocks deletion and deletion preserves audit-chain meaning.
## Done Definition
Clock, dry-run, hold and restore evidence pass.
## Allowed Files
- services/team/src/retention.ts
- services/team/tests/retention.test.ts
- packages/domain/src/legal-hold.ts
- packages/domain/tests/legal-hold.test.ts
- docs/operations.md
- docs/delivery/tasks/TASK-707.md
- docs/verification/reports/phase-007-task-707.md
## Forbidden Files
Any file not explicitly listed; automatic deletion of held evidence.
## Interfaces / Contracts
Retention action records policy version, scope, outcome and audit digest.
## Data Constraints
Dry-run is required before destructive execution.
## UI Constraints
Held records visibly reject deletion with a reason.
## Test Requirements
Run legal-hold and audit-chain tests plus governance gates.
## Acceptance Criteria
Legal hold prevents deletion without exception.
## Risks
Unknown retention state defaults to preserve.
## Output Required
Retention and legal-hold evidence.
