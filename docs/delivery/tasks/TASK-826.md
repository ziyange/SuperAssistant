# TASK-826: Bind fixture dispatch input to the authenticated claim

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: user authorized continuous work on the approved fake App Server, immutable Proposal and original-Attempt recovery plan. TASK-824 remains WIP and production launch remains disabled.

## Requirement IDs
REQ-020, REQ-021, REQ-024, REQ-027, REQ-028, REQ-031, REQ-033, REQ-049, REQ-090, REQ-098

## Objective
Remove the fixture integration's untrusted copy of the Proposal objective and baseline by exposing a claim-bound, read-only test-stage execution context from the authority that authenticates and claims the original Attempt.

## Context Pack
- docs/delivery/tasks/TASK-823.md
- docs/delivery/tasks/TASK-824.md
- docs/delivery/tasks/TASK-825.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/orchestration.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-826.md
- docs/superpowers/plans/2026-11-23-protected-claim-context.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/orchestration.md
- apps/desktop/src/main/protected-proposal-authority.ts
- apps/desktop/tests/main/protected-proposal-authority.test.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts

## Forbidden Files
Other paths, real user data or credentials, archived evidence, original projects, other worktrees, registered migration 033, production routing, renderer or IPC changes, real Codex execution, Electron sandbox verification, remote operations and merge.

## Interfaces / Contracts
Existing `claimQueued(scope)` remains API-compatible. A separate main-only fixture-stage `claimQueuedContext(scope)` derives its objective, baseline and execution identity solely from the already-authenticated protected Proposal and current authority context. It rejects caller-supplied execution fields. Its result is immutable and explicitly not authorization to launch, confinement proof or a terminal receipt. The atomic Outbox claim must bind the exact original Attempt, Grant, Lease, fence, encrypted envelope fingerprint and context digest; any failed verification leaves the protected execution undispatched and retains its Lease.

## Data Constraints
Use synthetic vaults and disposable Git repositories only. Do not log or persist decrypted objective, paths, tokens or credentials beyond the existing approved encrypted storage. Do not expose fixture context to renderer, IPC or production composition.

## UI Constraints
No user-facing or renderer change. The existing disabled production execution controls remain disabled.

## Implementation Requirements
First create the plan record, then write failing regressions for changed Proposal, stale Project/baseline or executable, changed fence or expired Lease, competing claims and forged extra input. Use the existing authenticated claim transaction to derive a frozen primitive-value context without a second unbound Proposal read; preserve current claim and confirmation semantics. Replace fixture tests' use of fixture-owned objective/baseline with the claimed values. A post-claim context is a snapshot and cannot authorize later side effects without revalidation, a trusted worktree root, a versioned launch profile, trusted binary/owner and OS confinement. Keep all production paths fail-closed.

## Test Requirements
Observe at least one missing-context regression fail before implementation. Run affected protected-authority and fake-App-Server integration tests, negative security cases, lint, typecheck, build, full unit and contract suites, independent review and governance. Real Codex and Electron sandbox remain deferred.

## Acceptance Criteria
One successful protected claim produces only the values from its authenticated original Proposal and committed execution identity. Tampered context, expired or stale authority, duplicate/competing claims and extra input cannot result in a launch-capable result. Fixture App Server tests consume the claimed values and preserve the original Attempt and active Lease on UNKNOWN. No production dispatch, helper trust or cancellation completion is claimed.

## Done Definition
Record real red/green and local test evidence, update relevant facts, and commit the isolated code. This task is not the production supervisor, H1 acceptance or merge readiness.

## Risks
Returning decrypted values creates additional in-process exposure; limit them to the main process and never log them. A valid claim snapshot can become stale immediately afterward; later work must revalidate it before each side effect and establish worktree containment and custody.

## Output Required
Claim-bound fixture-stage context, negative tests, fake-server integration and precise remaining production blockers.

## Work in progress
The first regression failed because no claim-bound context existed. The authority now produces a frozen primitive-value snapshot within the same IMMEDIATE transaction that validates the authenticated Proposal and claims the original Attempt; the existing claim method keeps its prior result shape. Fixture integrations now use the claimed objective and baseline rather than the fixture's independent Proposal copy. On the current patch, 143 protected authority and fake-server tests passed, including concurrent claims, forged input, expired Lease, changed Project, runtime, fence, baseline and approval; lint, typecheck and build passed. Independent static review found no substantiated Critical or Important issue in the initial code and did not run tests. The snapshot is not a launch capability; actual filesystem state can change after claim. Full-suite and contract results remain pending.

After the final application and test edits, the Windows host full unit suite passed 1,052 with nine skipped across 182 files. The fake-service contract suite passed 49/49. The nine skips are not passes and no real Codex or Electron sandbox verification occurred. The isolated context is not production dispatch, confinement, trustworthy process custody, terminal reconciliation, H1 acceptance or merge readiness.
