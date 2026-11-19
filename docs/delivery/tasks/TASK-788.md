# TASK-788: Exercise the full review, confirmation and exact-Attempt recovery with a fake App Server

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: explicit user request to integrate Function, complete Proposal confirmation and recovery first against a fake App Server, without live Codex or Electron sandbox validation.

## Requirement IDs
REQ-017, REQ-019, REQ-021, REQ-022, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-031, REQ-037, REQ-049, REQ-092, REQ-093, REQ-094, REQ-099

## Objective
Prove one narrowly scoped fixture Function across real JSON-RPC messages, internal main-process review and confirmation, SQLite queue and isolated Git worktree, restart, and original Turn reconciliation. No synthetic adapter is installed in the desktop composition.

## Context Pack
- docs/delivery/tasks/TASK-785.md
- docs/delivery/tasks/TASK-786.md
- docs/delivery/tasks/TASK-787.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/data-model.md
- docs/orchestration.md
- docs/adapters/codex.md
- docs/verification/quality-gate.md

## Allowed Files
- .github/workflows/docs-gates.yml
- apps/desktop/src/main/fixture-proposal-loop.ts
- apps/desktop/tests/main/fixture-proposal-loop.test.ts
- apps/desktop/tests/main/fixtures/verified-app-server.mjs
- packages/domain/src/proposal.ts
- packages/persistence/src/repositories/proposal-repository.ts
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/sqlite/migrations/024-full-proposal-review.sql
- packages/persistence/tests/migration-runner.test.ts
- docs/data-model.md
- docs/orchestration.md
- docs/delivery/execution-trace.json
- docs/delivery/permission-audit.log
- docs/delivery/tasks/TASK-788.md
- docs/verification/reports/phase-007-task-788.md

## Forbidden Files
All other files. No production entry-point changes, renderer IPC or test environment switch in the application, no user Project execution, real Codex, Electron sandbox verification, remote main changes or merge.

## Interfaces / Contracts
The injected fixture transport has one explicit runtime and Function version, an authenticated initialize/account handshake and a fixed single-file effect scope; arbitrary model lists or active catalog rows are not trust. Review preserves and hashes the complete parsed immutable candidate. Confirmation accepts only the stored version ID plus exact digest, checks ownership, registered Function and current Git baseline, issues an exact Grant and creates one queued Attempt atomically. Legacy short Proposal rows are not accepted by this composition.

## Data Constraints
An additive migration preserves legacy ProposalVersion rows and adds immutable full JSON plus private original Thread and Turn binding. Recovery observes only the saved binding through thread/read with includeTurns. Missing, mismatched, duplicate, active or failed observation leaves the Attempt unreconciled; coherent terminal Turn evidence can update that Attempt but cannot complete its Task or release its Lease.

## UI Constraints
No UI, IPC, production fixture path or live execution entry point.

## Implementation Requirements
Reuse the existing scoped SQLite Proposal, Grant, Attempt and Outbox boundaries and pinned worktree. Mark start uncertainty without automatic reissue. The fake child implements only fixed requests and never executes user commands. Reuse exact digest for replay. Actual production adapter, terminal resource evidence, and UI consent remain separate.

## Test Requirements
Use a disposable Git repository, real SQLite reopen, and a Node fake App Server child over stdio. Prove function/version rejection, stale or altered confirmation rejection, exactly one Grant/Attempt, approved worktree baseline, exclusive start, and exact original Attempt recovery across reopen; prove missing or mismatched evidence never redispatches or releases. Run build, lint, typecheck, focused/full application checks, and governance.

## Acceptance Criteria
The fixture path performs no task work before confirmation and one bounded effect after confirmation. Confirmation covers every candidate field. Recovery uses the original Attempt and uses no execution API to resolve it. Live production and merge acceptance must not be inferred from this test.

## Done Definition
Record red, green, migration, exact local gate and CI evidence with any still-open merge gate.

## Risks
Fixture trust is established by test composition, not a claim from an arbitrary server. Verified Turn completion is not acceptance evidence or process termination. No redispatch after a lost reply.

## Output Required
[Verification evidence](../../verification/reports/phase-007-task-788.md)
