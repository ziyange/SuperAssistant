# TASK-789: Audit retained work and add safe desktop lifecycle primitives

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user requested selective intake against current main, retention of both source worktrees, and official desktop Proposal confirmation, cancellation and original-Attempt recovery. This pack provides the intake decision and the first two fail-closed primitives in that deliverable.

## Requirement IDs
REQ-025, REQ-026, REQ-027, REQ-033, REQ-037, REQ-049, REQ-087, REQ-090, REQ-092, REQ-093, REQ-094, REQ-098, REQ-099

## Objective
Audit both retained trees against main and accept no old patch without equivalent current gates. Provide native desktop cancellation only for a demonstrably unclaimed local H1 start, and add exact Thread/Turn observation to the read-only adapter. Active cancellation, executable confirmation and the production original-Attempt binding require separate typed composition and are not inferred from fixture evidence.

## Context Pack
- docs/delivery/tasks/TASK-716.md
- docs/delivery/tasks/TASK-720.md
- docs/delivery/tasks/TASK-788.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/orchestration.md
- docs/security.md
- docs/adapters/codex.md
- docs/verification/quality-gate.md

## Allowed Files
- .github/workflows/docs-gates.yml
- docs/delivery/execution-trace.json
- docs/delivery/permission-audit.log
- docs/delivery/tasks/TASK-789.md
- docs/verification/reports/phase-007-task-789.md
- docs/orchestration.md
- docs/adapters/codex.md
- apps/desktop/src/main/queued-task-cancellation.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/renderer/App.tsx
- apps/desktop/src/renderer/task-center.tsx
- apps/desktop/tests/main/queued-task-cancellation.test.ts
- apps/desktop/tests/renderer/task-cancellation-navigation.test.tsx
- packages/domain/src/task-projection.ts
- packages/codex-adapter/src/app-server-client.ts
- packages/codex-adapter/tests/discovery.contract.test.ts

## Forbidden Files
All other files. Do not modify either retained worktree, mutate main, integrate obsolete governance/audit data, add a production fixture switch, or run real Codex or Electron sandbox validation.

## Interfaces / Contracts
Task Center sends only a Task ID via task:cancel-queued. Main requests native confirmation after resolving the owned Task and repeats the SQLite proof after the dialog. This cancels only a single queued H1 Attempt with its untouched pending start message and current matching resource lease. An already claimed, mismatched or unknown Attempt is unchanged. The read-only App Server transport supports observing the exact trusted Thread/Turn pair with thread/read and includeTurns; it never launches, resumes or interrupts a Turn.

## Data Constraints
Cancel closes the pending Outbox row, Attempt, WorkItem, Task and Lease atomically under the same writer transaction. Missing evidence or extra rows fail closed. Read-only observation is not proof of process termination, Task acceptance or Lease release.

## UI Constraints
Task Center exposes cancellation for queued cards only and reports refusal without simulating completion. Renderer cannot supply an owner, process ID, adapter binding, lease or fence. Do not show a success action for active cancellation or confirmation until the actual authority exists.

## Implementation Requirements
Test scope, unused claims and transaction rollback first. Reuse sender validation and SQL owner scope. Verify dynamic exact original identifiers and negative observations through App Server framing. Do not import the fixture-only execution class into main.

## Test Requirements
Run focused desktop cancellation unit and App Server contract regressions, build, lint, typecheck and full deterministic suites as available. Verify all Task Pack/link/schema/runtime gates and exact scope, and retain blocked evidence explicitly.

## Acceptance Criteria
The former worktrees remain unchanged; no unverified old code is imported. Only proven unsent queued local work can cancel; uncertainty does not release resources. Exact observation rejects different, absent or ambiguous Turns and never writes upstream.

## Done Definition
Record intake counts and exclusions, actual tests, established behavior and remaining production gate gaps.

## Risks
Old notification delivery lacks current fencing. Task or Turn status alone cannot authorize process termination or Lease release. Legacy desktop execution placeholder has no reliable upstream proof and must remain disabled.

## Output Required
[Verification evidence](../../verification/reports/phase-007-task-789.md)
