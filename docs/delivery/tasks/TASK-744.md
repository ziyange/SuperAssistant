# TASK-744: Bind H1 execution to a fenced Project lease

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-confirmed continuous PHASE-007 remediation and safety gating.

## Requirement IDs
REQ-016, REQ-027, REQ-030, REQ-031, REQ-060, REQ-090, REQ-094, REQ-098

## Objective
Unify the H1 Project resource key and use one atomic lease acquisition path that blocks concurrent or stale writers before dispatch state is created.

## Context Pack
- docs/orchestration.md
- docs/security.md
- docs/verification/reports/phase-007-task-743.md
- apps/desktop/src/main/worktree-service.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/security.md
- docs/data-model.md
- docs/orchestration.md
- docs/decisions/ADR-004-task-worktrees.md
- docs/verification/quality-gate.md
- packages/persistence/src/repositories/resource-lease-repository.ts
- packages/persistence/src/repositories/execution-repository.ts

## Allowed Files
- docs/delivery/tasks/TASK-744.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/orchestration.md
- docs/verification/reports/phase-007-task-744.md
- packages/persistence/src/repositories/resource-lease-repository.ts
- packages/persistence/src/repositories/execution-repository.ts
- packages/persistence/tests/execution-transaction.test.ts
- packages/persistence/tests/outbox-inbox.test.ts

## Forbidden Files
Do not change Team scheduling, schema migrations, dependencies, real Codex execution, sandbox controls, archived evidence or user projects.

## Interfaces / Contracts
H1 Project lease key is the literal prefix project: followed by the Project ID, matching GitWorktreeService. A lease requires a positive safe integer fence strictly greater than any prior fence for that resource; any non-RELEASED lease blocks acquisition. Execution uses the shared lease repository inside the same SQLite transaction as Grant consumption and Task/Attempt/Outbox creation. Matching idempotent replay remains side-effect free. Existing historical leases with other key formats require explicit reconciliation and are not silently migrated.

## Data Constraints
Only in-memory SQLite fixtures. Failed acquisition rolls back consumed Grant and all Task, WorkItem, Attempt, Lease and Outbox inserts.

## UI Constraints
No UI or IPC changes.

## Implementation Requirements
First reproduce incorrect Project key, invalid/stale fencing and conflicting active lease. Reuse the shared lease acquisition path. Do not assert that this Project-level lease is a complete worktree sandbox or per-write enforcement.

## Test Requirements
Cover invalid Project key, nonpositive or stale fence, active/uncertain conflict, released successor with higher fence, idempotent replay, rollback, owner and time checks; run build, lint, typecheck, full unit and contract suites plus runtime trace. No Electron sandbox validation.

## Acceptance Criteria
Only the Proposal's canonical Project key can be acquired; stale, invalid or overlapping claims cannot consume a Grant or create dispatch records; a safely released lease allows only a higher fence. No real dispatch is enabled.

## Done Definition
Record red/green and complete regression evidence, skipped tests and remaining per-write/worktree policy gap.

## Risks
A project-level key deliberately serializes H1 Project writes; it is not H2 hierarchical locking, actual OS sandbox enforcement or proof of Agent-controlled file boundaries.

## Output Required
docs/verification/reports/phase-007-task-744.md
