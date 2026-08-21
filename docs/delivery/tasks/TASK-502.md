# TASK-502: Collect authenticated signals
## Status
APPROVED
PHASE: PHASE-005
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-066, REQ-067
## Objective
Implement authenticated Webhook, polling and restart-safe scheduler collection.
## Context Pack
- docs/security.md
- docs/operations.md
## Implementation Requirements
- Verify Webhook authenticity and recover scheduler state.
## Done Definition
Collector and restart evidence pass.
## Must Read
- AGENTS.md
- docs/security.md
- docs/operations.md
- docs/orchestration.md
## Allowed Files
- packages/domain/src/monitoring-collector.ts
- packages/domain/tests/monitoring-collector.test.ts
- apps/desktop/src/main/monitoring-collector.ts
- apps/desktop/tests/main/monitoring-collector.test.ts
- docs/security.md
- docs/operations.md
- docs/delivery/tasks/TASK-502.md
- docs/verification/reports/phase-005-task-502.md
## Forbidden Files
Any file not explicitly listed; unauthenticated webhook acceptance; credentials in logs.
## Interfaces / Contracts
Collectors use bounded authenticated inputs and durable schedules.
## Data Constraints
Backpressure is explicit.
## UI Constraints
Unavailable sources are truthful.
## Test Requirements
Run authentication, backpressure, restart, lint, typecheck, build and governance gates.
## Acceptance Criteria
Invalid Webhooks and restart duplication are rejected.
## Risks
Signal storms fail closed.
## Output Required
Report collector evidence.
