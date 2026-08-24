# TASK-717: H3 integrated system acceptance
## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-081, REQ-082, REQ-083, REQ-084, REQ-085, REQ-086, REQ-087, REQ-088, REQ-089, REQ-090, REQ-096, REQ-099
## Objective
Prove integrated H3 behavior across Team API, PostgreSQL, OIDC fixture, Electron and recovery/security/performance gates.
## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/verification/quality-gate.md
- docs/verification/test-strategy.md
## Must Read
- AGENTS.md
- docs/security.md
- docs/operations.md
- docs/delivery/phase-007.md
## Implementation Requirements
This Pack adds only acceptance harnesses/evidence; failed tests reopen their owning Task instead of weakening H3 gates.
## Done Definition
All H3 quantitative and recovery gates have current deterministic evidence, including 200 negative authorization cases.
## Allowed Files
- services/team/tests/h3-authorization-matrix.test.ts
- services/team/tests/h3-recovery.test.ts
- services/team/tests/h3-backup-restore.test.ts
- services/team/tests/h3-performance.test.ts
- apps/desktop/tests/e2e/h3-team-governance.spec.ts
- apps/desktop/tests/e2e/h3-notification-security.spec.ts
- docs/operations.md
- docs/security.md
- docs/delivery/tasks/TASK-717.md
- docs/verification/reports/phase-007-task-717.md
## Forbidden Files
Production credentials/data, test skips, lowered performance/security criteria, archive mutation or remote release.
## Interfaces / Contracts
Tests use public Team API and desktop ports, never internal mutable state shortcuts.
## Data Constraints
Fixtures are synthetic; disposable databases are destroyed and backup artifacts are checksummed.
## UI Constraints
E2E covers keyboard navigation and access-checked protected surfaces.
## Test Requirements
All H3 deterministic E2E/API/database/recovery/security/performance suites, lint, typecheck, build and governance gates; PostgreSQL 17 evidence is required.
## Acceptance Criteria
Every H3 requirement has appropriately scoped evidence; no skipped critical gate or unknown outcome remains.
## Risks
Missing PostgreSQL 17, identity, security or recovery evidence blocks the Task.
## Output Required
H3 system acceptance evidence, not an archive.
