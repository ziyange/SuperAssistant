# TASK-603: Operations Data Agent
## Status
COMPLETED
PHASE: PHASE-006
MAX_ITERATIONS: 5
user_confirmed: true
## Requirement IDs
REQ-071, REQ-073, REQ-074, REQ-075, REQ-076
## Objective
Deliver lineage-backed operations analysis projections.
## Context Pack
- docs/product.md
- docs/ux.md
- docs/security.md
## Implementation Requirements
- Current, trend, comparison, anomaly, ranking and correlation results cite dataset versions.
## Done Definition
Lineage and safe visualization tests pass.
## Must Read
- AGENTS.md
- docs/product.md
- docs/ux.md
- docs/security.md
## Allowed Files
- packages/domain/src/operations-analysis.ts
- packages/domain/src/index.ts
- packages/domain/tests/operations-analysis.test.ts
- apps/desktop/src/renderer/operations-analysis.tsx
- apps/desktop/tests/renderer/operations-analysis.test.tsx
- docs/product.md
- docs/data-model.md
- docs/ux.md
- docs/delivery/tasks/TASK-603.md
- docs/verification/reports/phase-006-task-603.md
## Forbidden Files
Any file not explicitly listed; uncited conclusion; action execution.
## Interfaces / Contracts
Every value contains source dataset/version lineage.
## Data Constraints
Correlation is not causation.
## UI Constraints
Insufficient data has an explicit state.
## Test Requirements
Run domain, renderer, lint, typecheck, build and governance gates.
## Acceptance Criteria
Every displayed conclusion has verifiable lineage.
## Risks
Stale data renders a warning.
## Output Required
Report operations lineage evidence.
