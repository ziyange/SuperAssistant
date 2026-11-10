# TASK-742: Use a trusted local clock for Grant and Attempt authorization

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-confirmed continuous PHASE-007 security remediation.

## Requirement IDs
REQ-024, REQ-025, REQ-027, REQ-028, REQ-030, REQ-090, REQ-094, REQ-096

## Objective
Prevent caller-supplied timestamps from reviving expired local Proposals or Grants.

## Context Pack
- docs/security.md
- docs/verification/reports/phase-007-task-741.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/security.md
- docs/data-model.md
- docs/verification/quality-gate.md
- packages/persistence/src/repositories/authorization-repository.ts
- packages/persistence/src/repositories/execution-repository.ts

## Allowed Files
- docs/delivery/tasks/TASK-742.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/verification/reports/phase-007-task-742.md
- packages/persistence/src/repositories/authorization-repository.ts
- packages/persistence/src/repositories/execution-repository.ts
- packages/persistence/tests/proposal-repository.test.ts
- packages/persistence/tests/execution-transaction.test.ts
- packages/persistence/tests/outbox-inbox.test.ts

## Forbidden Files
Do not enable dispatch, modify credentials, migrations, dependencies, sandbox controls, archived evidence or real user databases.

## Interfaces / Contracts
Repositories use an internal clock defaulting to the system clock; trusted test composition can inject a clock. Legacy issuedAt/createdAt inputs cannot control authorization or stored audit times. On a new authorization, invalid clock/expiry and now at or after expiry fail closed. Execution reads and validates the Grant expiry within its existing transaction before its atomic consumed transition. Existing matching replay returns prior identity without a new side effect.

## Data Constraints
Use in-memory databases only. A rejected expired Grant remains ISSUED and creates no Task, Lease, Attempt or Outbox record.

## UI Constraints
No UI or IPC changes.

## Implementation Requirements
First reproduce stale timestamp bypass using an injected test clock. Replace authorization and write timestamps with the repository clock; compare parsed instants rather than lexicographic date strings. Preserve existing idempotency behavior.

## Test Requirements
Test expired and invalid clock, supplied stale time, exact expiry boundary, legitimate grant, duplicate replay and no partial writes. Then build, lint, typecheck, full unit and contract regression and anchored runtime gate. No real Electron sandbox test.

## Acceptance Criteria
Caller timestamps cannot alter stored Grant/Task times or revive an expired authorization; malformed times fail closed. Tests inject deterministic clock and pass without weakening expiration checks.

## Done Definition
Evidence records red/green tests, full regression, skips and remaining actor/resource enforcement work.

## Risks
A clock supplied from a renderer or other untrusted caller is not trusted. Real dispatch remains disabled until control-plane actor and resource policy are bound.

## Output Required
docs/verification/reports/phase-007-task-742.md
