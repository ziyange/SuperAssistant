# TASK-813: Bind SAI retries to the original authority

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User approved autonomous work to close duplicate dispatch and original-Attempt recovery risks before merge.

## Requirement IDs
REQ-027, REQ-028, REQ-031, REQ-033, REQ-038, REQ-090, REQ-092, REQ-098

## Objective
Correct the existing Codex SAI adapter's in-process idempotency handling so a repeated key cannot silently reuse a receipt for another Attempt or authority, and concurrent or uncertain resume delivery cannot be sent twice.

## Context Pack
- docs/api/sai.md
- docs/delivery/tasks/TASK-812.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/orchestration.md
- docs/api/sai.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-813.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- packages/codex-adapter/src/execution.ts
- packages/codex-adapter/tests/execution.contract.test.ts
- docs/api/sai.md

## Forbidden Files
Other files, credentials, production databases, archived evidence, other worktrees, real Codex execution, Electron sandbox validation, remote operations and merge.

## Interfaces / Contracts
A start idempotency key is bound to the immutable Attempt, Proposal digest, Grant, Project snapshot and ordered resource fences; requestId may change on an otherwise identical retry. Different authority is IDEMPOTENCY_CONFLICT even while pending or after an uncertain response. An unchanged uncertain request remains UNKNOWN and is never redispatched. Resume binds each Attempt/input ID to its payload digest, serializes concurrent duplicates, and quarantines ambiguous transport failures.

## Data Constraints
No content or credentials are logged or persisted. These adapter maps are process-local and cannot replace the authoritative persistent Attempt and Inbox.

## UI Constraints
No UI or production dispatch wiring.

## Implementation Requirements
Snapshot all binding inputs before dispatch, including nested resource fences, so caller mutation cannot change sent authority or stored identity. Do not claim this legacy adapter provides a real App Server execution implementation, cross-process idempotency, or recovery.

## Test Requirements
Write failing tests for altered Attempt, Proposal, Grant, snapshot and fence across pending, acknowledged and uncertain starts, allowed request ID change, mutation after call, and simultaneous/failed resume. Run contract and unit suites and governance checks.

## Acceptance Criteria
One upstream start or resume per in-process key. Changed authority fails without transport; ambiguous result is not retried; legitimate retries return the original result. Persistent authorization and original-Attempt recovery remain separate gates.

## Done Definition
Record actual test results and remaining integration gaps; local contract tests do not prove a running desktop workflow or remote CI.

## Risks
Memory state is lost on restart. Durable journal and end-to-end production integration remain required. Do not enable this adapter for real execution based on this task.

## Output Required
Failing-then-passing contract tests, scoped implementation and evidence.

## Current local evidence and unresolved checks (2026-11-22)

- Red tests reproduced changed-authority reuse, mutated fence input, uncertain start reuse and mutable cached receipts; concurrency checks initially timed out because changed requests awaited the first request instead of rejecting. All eleven focused tests passed after the fixes.
- Final build, lint and typecheck passed; 49 contract tests passed with no skips in the Windows environment. A prior sandbox contract run exited nonzero and its ephemeral JSON report could not be recovered, so its cause remains unknown.
- Final unit run is NOT PASS: 705 passed, nine skipped, one failure in Team HTTP identity test (`fetch failed`). A preceding run before receipt freezing passed 706 with nine skipped; that is not evidence for the final source.
- The machine allocates ephemeral TCP ports starting at 1024; a separate disposable server reproduced Node fetch rejecting port 6000 with `bad port`. The failed test did not record its port, so this is a verified possible cause, not proof of that particular failure. A separate scoped test-stability correction and full rerun are required.
- TASK-814 replaced the affected loopback test client and reran the full suite: 707 passed and nine skipped, with 49 contract tests passed and no contract skips. The prior failure and its unknown exact cause remain recorded above.
- This remains local, in-process adapter behavior. Desktop authorization and dispatch, restart durability, real Codex and Electron sandbox verification remain unproven.
