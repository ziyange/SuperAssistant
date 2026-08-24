# TASK-605: Legacy adapter compatibility
## Status
COMPLETED
PHASE: PHASE-006
MAX_ITERATIONS: 5
user_confirmed: true
## Requirement IDs
REQ-078, REQ-079, REQ-090, REQ-091
## Objective
Add configuration-led legacy adapter compatibility evaluation.
## Context Pack
- docs/api/sai.md
- docs/operations.md
## Implementation Requirements
- Upstream incompatibility remains disabled and provider terms never reach product UI.
## Done Definition
Compatibility matrix evidence passes.
## Must Read
- AGENTS.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
## Allowed Files
- packages/codex-adapter/src/legacy-compatibility.ts
- packages/codex-adapter/tests/legacy-compatibility.test.ts
- docs/api/sai.md
- docs/operations.md
- docs/delivery/tasks/TASK-605.md
- docs/verification/reports/phase-006-task-605.md
## Forbidden Files
Any file not explicitly listed; terminal scrape; provider-native UI labels.
## Interfaces / Contracts
Compatibility maps only stable SAI operations.
## Data Constraints
No vendor credential value is stored.
## UI Constraints
Failure gives product-language reason.
## Test Requirements
Run conformance, lint, typecheck, build and governance gates.
## Acceptance Criteria
Upstream drift fails closed.
## Risks
Unsupported provider remains disabled.
## Output Required
Report compatibility matrix.
