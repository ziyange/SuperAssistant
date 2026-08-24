# TASK-716: Durable governed notification delivery
## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-087, REQ-088, REQ-089, REQ-094, REQ-096, REQ-099
## Objective
Turn notification policy rules into a durable, bounded Team notification workflow with access-checked delivery and deep links.
## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/operations.md
- docs/ux.md
## Must Read
- AGENTS.md
- docs/security.md
- docs/data-model.md
- docs/architecture.md
## Implementation Requirements
Notifications are persisted, idempotent and bounded; delivery and deep-link resolution reauthorize current access.
## Done Definition
Preferences/outbox/delivery/channel retry, aggregation/quiet-hours and deep-link E2E evidence pass.
## Allowed Files
- services/team/src/notification-preference-service.ts
- services/team/src/notification-outbox.ts
- services/team/src/notification-delivery-service.ts
- services/team/src/team-api.ts
- services/team/src/postgres/team-repository.ts
- services/team/tests/notification-preference-service.test.ts
- services/team/tests/notification-outbox.test.ts
- services/team/tests/notification-delivery-service.test.ts
- services/team/tests/notification-api.contract.test.ts
- apps/desktop/src/main/team-notification-client.ts
- apps/desktop/src/renderer/team-notification-settings.tsx
- apps/desktop/tests/renderer/team-notification-settings.test.tsx
- apps/desktop/tests/e2e/team-notification.spec.ts
- docs/operations.md
- docs/ux.md
- docs/security.md
- docs/delivery/tasks/TASK-716.md
- docs/verification/reports/phase-007-task-716.md
## Forbidden Files
Unbounded fanout, delivery without current authorization, protected body before deep-link reauthorization or credentials in notifications.
## Interfaces / Contracts
Notification identifiers and links contain opaque target references; server resolves authorization at delivery and navigation time.
## Data Constraints
Outbox rows are scoped/idempotent, retention-aware and redacted.
## UI Constraints
Quiet hours, aggregation and Emergency audit state are visible without displaying protected content early.
## Test Requirements
PostgreSQL outbox/retry/idempotency tests, API and renderer contracts, Playwright access-negative E2E and governance gates.
## Acceptance Criteria
No unauthorized alert or deep-linked content is delivered; bounded authorized delivery is durable across restart.
## Risks
Duplicate or stale delivery blocks the Task.
## Output Required
Notification delivery evidence.
