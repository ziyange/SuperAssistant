# TASK-753: Bind executable Grants to immutable Proposal actions

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-approved PHASE-007 security remediation and continued autonomous execution.

## Requirement IDs
REQ-020, REQ-021, REQ-022, REQ-025, REQ-026, REQ-027, REQ-090, REQ-091, REQ-098

## Objective
Prevent Grant issuance and new Attempt creation for invalid, read-only, mismatched or digest-corrupted Proposal action scopes.

## Context Pack
- docs/verification/reports/phase-007-task-752.md
- packages/persistence/src/repositories/authorization-repository.ts
- packages/persistence/src/repositories/execution-repository.ts
- packages/domain/src/proposal.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/security.md
- docs/orchestration.md
- docs/data-model.md
- docs/verification/quality-gate.md
- packages/domain/src/proposal.ts
- packages/persistence/src/repositories/authorization-repository.ts
- packages/persistence/src/repositories/execution-repository.ts

## Allowed Files
- docs/delivery/tasks/TASK-753.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/orchestration.md
- docs/verification/reports/phase-007-task-753.md
- packages/persistence/src/repositories/authorization-repository.ts
- packages/persistence/src/repositories/execution-repository.ts
- packages/persistence/tests/proposal-repository.test.ts
- packages/persistence/tests/execution-transaction.test.ts
- packages/persistence/tests/outbox-inbox.test.ts

## Forbidden Files
No execution entry point, user repositories, schema migrations, credentials, real Codex, Electron sandbox, archived evidence or Git integration.

## Interfaces / Contracts
Grant issuance requires a valid nonempty side-effecting Proposal action list. Before a new Attempt consumes a Grant, reload the immutable Proposal and Grant inside the same transaction, recompute the Proposal digest, validate both action lists and require exact equality. A rejected scope or digest cannot consume the Grant or create Task, Attempt, Lease or Outbox. Existing idempotent replay is receipt-only and cannot dispatch.
The Grant expiry must equal the immutable Proposal expiry; a later or
otherwise changed Grant expiry cannot extend approval.

## Data Constraints
In-memory SQLite fixtures use genuine Proposal digests and valid COMMAND scope. No network, credentials or external process.

## UI Constraints
No UI, IPC or real execution changes.

## Implementation Requirements
Write red tests for invalid/read-only grant issuance, mismatched grant scope and forged digest; update fixtures from placeholder digests to genuine digests and preserve existing idempotency checks.
The outbox/inbox integration fixture also invokes execution creation and
must use a genuinely bound Proposal/Grant, without weakening its assertions.

## Test Requirements
Run red/green persistence tests, full build, lint, typecheck, unit and contract suites, ordered governance and anchored goal runtime trace. Do not run live Codex or Electron sandbox tests.

## Acceptance Criteria
Invalid or read-only scopes cannot issue Grants; changed action scope or forged digest cannot create an Attempt or consume a Grant; properly bound valid scopes retain exactly-once database creation.

## Done Definition
Record actual commands, test outcomes and remaining dispatch-time capability/baseline limitations.

## Risks
A valid action list alone cannot prove the concrete command, filesystem or network operation stays within authorization. Executor-level enforcement, durable reconciliation, capability version and Git baseline remain required before dispatch.

## Output Required
docs/verification/reports/phase-007-task-753.md
