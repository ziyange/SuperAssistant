# TASK-503: Aggregate monitoring signals
## Status
APPROVED
PHASE: PHASE-005
MAX_ITERATIONS: 5
user_confirmed: true
## Requirement IDs
REQ-066, REQ-068
## Objective
Normalize, correlate and aggregate equivalent events with durable lineage.
## Context Pack
- docs/data-model.md
- docs/orchestration.md
## Implementation Requirements
- Preserve source lineage while forming bounded correlation groups.
## Done Definition
Aggregation and lineage evidence pass.
## Must Read
- AGENTS.md
- docs/data-model.md
- docs/orchestration.md
- docs/operations.md
## Allowed Files
- packages/domain/src/event-aggregation.ts
- packages/domain/tests/event-aggregation.test.ts
- packages/persistence/src/repositories/event-aggregation-repository.ts
- packages/persistence/tests/event-aggregation-repository.test.ts
- docs/data-model.md
- docs/orchestration.md
- docs/delivery/tasks/TASK-503.md
- docs/verification/reports/phase-005-task-503.md
## Forbidden Files
Any file not explicitly listed; evidence loss; implicit Task creation.
## Interfaces / Contracts
Aggregation exposes source lineage and correlation window.
## Data Constraints
Raw evidence remains available.
## UI Constraints
Groups identify their count and source evidence.
## Test Requirements
Run window, dedupe, lineage, lint, typecheck, build and governance gates.
## Acceptance Criteria
Equivalent events form one group without lost evidence.
## Risks
Overaggregation fails safe.
## Output Required
Report aggregation evidence.
