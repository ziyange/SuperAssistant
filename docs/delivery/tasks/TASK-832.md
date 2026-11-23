# TASK-832: Revalidate the original claimed Attempt before fixture dispatch

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: user authorized continuous implementation of the fake App Server, immutable Proposal and original-Attempt recovery loop; production routing and deferred verification remain closed.

## Requirement IDs
REQ-020, REQ-024, REQ-027, REQ-028, REQ-031, REQ-033, REQ-049, REQ-090, REQ-098

## Objective
Reject stale protected authority after an original Attempt is claimed and before the fixture transport is created or asked to start.

## Context Pack
- docs/delivery/tasks/TASK-823.md
- docs/delivery/tasks/TASK-826.md
- docs/delivery/tasks/TASK-827.md
- docs/orchestration.md
- docs/api/sai.md

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
- docs/delivery/tasks/TASK-832.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/orchestration.md
- apps/desktop/src/main/protected-proposal-authority.ts
- apps/desktop/src/main/fixture-protected-dispatch.ts
- apps/desktop/tests/main/protected-proposal-authority.test.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts

## Forbidden Files
Other paths, production composition or routing, main startup, renderer or IPC, registering migration 033, real user data or credentials, archive evidence, other worktrees, real Codex, Electron sandbox verification, external operations and merge.

## Interfaces / Contracts
The main-only `verifyClaimedContext(scope, claimToken)` is a fixture-stage recheck, not a launch authorization. It must reauthenticate the bound encrypted Proposal, approval HMAC, original Attempt and matching DISPATCHING Outbox claim, current Grant, Project, Agent, Function, executable identity, Git baseline and unexpired highest-fence Lease. It never creates or replaces an Attempt, changes a claim, prompts, releases a Lease or starts a process. The fixture dispatcher rechecks after worktree creation and again after transport initialization before requesting start; failure quarantines the same Attempt or exposes a quarantine-persistence failure. An operation after the last check is still not atomic with filesystem or external effects and remains untrusted for production.

The receipt transaction must also reject changed database-side authority, Grant, Project/Agent/Function, claim, Lease window, fence or resource collision before persisting a receipt or marking RUNNING. It must not silently lose an authenticated observed Lease-expiry watermark when rejecting a stale receipt. This synchronous database guard cannot recheck Git or executable bytes atomically with the external start and is not an OS fence.

## Data Constraints
Use synthetic vaults, test-owned temporary Git repositories and fake transports only. Never log decrypted goals, claim tokens or credentials. On failure preserve the original Attempt and Lease; do not retry or dispatch a replacement.

## UI Constraints
No UI, renderer or IPC changes. The production execution and running-cancellation paths stay disabled.

## Implementation Requirements
First reproduce a Project, Agent or Lease change during fixture transport initialization causing a fake start despite stale preflight. Reuse the existing protected authority validation and exact context/HMAC checks while admitting only the same DISPATCHING claim token, without reopening a PENDING or already resolved claim. Add rechecks after worktree preparation and after initialization. Preserve existing `claimQueued`, `claimQueuedContext` and confirmation behavior. Do not equate a successful recheck with process provenance, OS confinement or a continuing fence.

## Test Requirements
Observe a red test before implementation. Test live valid claim, wrong token, stale Agent/Project/Function or runtime, advanced Git baseline, Lease expiry, claim mismatch, duplicate/replayed Attempt and changes between worktree creation, initialization, start and receipt. Prove no fake start occurs after failed recheck, stale receipt cannot become RUNNING, and the same original Attempt becomes UNKNOWN with its Lease ACTIVE. Run targeted protected/fake-service tests, independent review, lint, typecheck, build, full unit and contract plus governance.

## Acceptance Criteria
No stale, mismatched or expired claim may reach fake start; an unchanged original claim can complete the existing fake acknowledgement flow. Failure preserves the original Attempt and Lease and never causes a replacement. Real production dispatch stays disabled.

## Done Definition
Record red/green, scoped security review and local evidence, synchronize facts and commit the isolated code; this is not production or merge acceptance.

## Risks
The state may change immediately after a successful recheck. Real execution requires an independently trusted worktree, process ownership, confinement and per-effect fence enforcement; this task supplies none of those guarantees.

## Output Required
Claim-token revalidation, fixture lifecycle guards, race regressions and explicit production limitations.

## Local Evidence
- Red: stale Agent at initialization reached fake start; changes to the Project
  snapshot or Lease resource could incorrectly persist a receipt. Regression
  tests now reject each case and retain the original Attempt and Lease.
- Targeted authority and fixture integration: 165 passed. Full Windows host
  unit suite: 1114 passed, 9 skipped; contract suite: 50 passed. Lint,
  typecheck and production build passed. The skipped tests are not PASS evidence.
- Independent read-only review found no additional confirmed critical or
  important issue in this scope. Documentation scan: 389 files, no issues;
  Task Packs, traceability, schemas, runtime audit and 38 governance tests passed.
- This is fixture-only evidence, not H1/H3 acceptance or permission to merge.
  Production dispatch, trusted process ownership, filesystem confinement and
  safe cancellation/Lease release remain unresolved. Real Codex and Electron
  sandbox verification remain deferred by user instruction.
