# TASK-752: Revalidate local authority inside execution transaction

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: approved PHASE-007 security remediation and continuous execution.

## Requirement IDs
REQ-025, REQ-026, REQ-027, REQ-031, REQ-090, REQ-091, REQ-098

## Objective
Prevent creation of a new Attempt when authoritative Project, Agent or Function facts no longer match the approved Proposal.

## Context Pack
- docs/verification/reports/phase-007-task-751.md
- packages/persistence/src/repositories/execution-repository.ts
- packages/persistence/src/sqlite/migrations/001-foundation.sql

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/verification/quality-gate.md
- packages/persistence/src/repositories/execution-repository.ts

## Allowed Files
- docs/delivery/tasks/TASK-752.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/orchestration.md
- docs/verification/reports/phase-007-task-752.md
- packages/persistence/src/repositories/execution-repository.ts
- packages/persistence/tests/execution-transaction.test.ts

## Forbidden Files
No application execution wiring, user repositories, database migrations, credentials, real Codex, Electron sandbox, archived evidence or Git operations.

## Interfaces / Contracts
Within the existing transaction and before grant consumption, load the Project, Agent and Function linked by the Proposal and require an active Project, matching Project snapshot version, same Workspace, matching Agent version, connected/available Agent, matching Function version and active Function. A mismatch rejects without consuming the Grant or creating Task, Attempt, Lease or Outbox. Existing successful idempotent receipt lookup remains a read-only replay and never redispatches.

## Data Constraints
SQLite in-memory fixtures only; trusted clock and local principal remain authoritative. Do not invent a capability version or Git baseline authority that the schema cannot establish.

## UI Constraints
No UI or IPC changes; the existing execution entry point is not newly exposed.

## Implementation Requirements
Write failing transactional tests for Project snapshot/status, Agent version/connection/availability and Function version/lifecycle changes, then implement a single database-authoritative validation inside the same transaction.

## Test Requirements
Run red/green persistence tests, build, lint, typecheck, full unit and contract tests, plus ordered governance and goal-mode trace. Do not run live Codex or Electron sandbox tests.

## Acceptance Criteria
Every stale authoritative case leaves the Grant ISSUED and creates no Task, Attempt, Lease or Outbox; unchanged facts still permit exactly one authorized Attempt. Existing idempotent replay does not create a new external effect.

## Done Definition
Record actual test counts, transaction outcomes and remaining capability/baseline gaps; do not mark H1 or M1 accepted.

## Risks
Current schema lacks authoritative capability-version and Git baseline verification. These remain blockers to real dispatch and cannot be represented as validated by this task.

## Output Required
docs/verification/reports/phase-007-task-752.md
