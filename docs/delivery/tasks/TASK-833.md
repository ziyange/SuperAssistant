# TASK-833: Preserve original fixture claim identity across asynchronous dispatch

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: user authorized continuous fake-App-Server integration and correction of blockers on the path to merge. This task does not enable production execution.

## Requirement IDs
REQ-027, REQ-028, REQ-033, REQ-049, REQ-090, REQ-098

## Objective
Prevent caller mutation of a fixture request from redirecting claim validation or UNKNOWN quarantine away from the original Attempt.

## Context Pack
- docs/delivery/tasks/TASK-827.md
- docs/delivery/tasks/TASK-832.md
- docs/orchestration.md
- docs/security.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-833.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/orchestration.md
- apps/desktop/src/main/fixture-protected-dispatch.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts

## Forbidden Files
All other files, production routes, user projects or credentials, remote operations, merge, real Codex and Electron sandbox verification.

## Interfaces / Contracts
Snapshot the exact request identity once before the first asynchronous boundary. All claim, revalidation, receipt and quarantine operations use the immutable captured identity. Untrusted or mutated identity must not create another Attempt or release a Lease. This fixture check is not production process custody or an OS fence.

## Data Constraints
Use only disposable fixture repositories and synthetic payloads. Do not log user goals or credentials.

## UI Constraints
No UI or production routing change.

## Implementation Requirements
Reproduce mutation of caller-owned scope after claim but before a fake failure. Ensure the originally claimed Attempt is quarantined even if the caller later changes its object. Preserve existing fixture behavior and reject invalid scope through existing authority checks.

## Test Requirements
Observe the mutation regression fail before the fix; run targeted protected execution tests, independent review, lint, typecheck, build, full unit and contract suites, and governance.

## Acceptance Criteria
Scope mutation cannot redirect receipt checks or quarantine. The original Attempt is UNKNOWN with its Lease ACTIVE on failure; no replacement Attempt exists.

## Done Definition
Record local red/green and review evidence, synchronize the fixture boundary and commit. Production merge and H1 acceptance remain separate.

## Risks
A snapshot cannot prevent a changed filesystem or establish process termination. An external effect may already have occurred.

## Output Required
Immutable fixture scope and deterministic regression evidence.

## Local Evidence
- The regression first failed with `FIXTURE_QUARANTINE_FAILED` after mutation
  of the caller's Proposal ID. With the snapshot, the original Attempt enters
  UNKNOWN, its Outbox enters RECONCILING and its Lease remains ACTIVE.
- Targeted fake-service suite: 19 passed. Full host unit: 1115 passed and nine
  skipped; contract: 50 passed. Lint, typecheck and production build passed.
  Skips are not acceptance evidence.
- Independent read-only review found no additional confirmed major issue.
  Documentation scanning covered 390 files; all Task Packs, traceability,
  schemas and runtime trace passed; 38 governance tests passed.
- Fixture-only: no production dispatch, process termination proof, H1/H3
  acceptance or merge readiness follows from this result. Real Codex and
  Electron sandbox validation remain deferred.
