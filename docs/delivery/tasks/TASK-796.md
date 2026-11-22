# TASK-796: Provision and verify the built-in Codex Function

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: user directed continued implementation of a trusted executable Function and Proposal workflow using fake App Server; existing development authorization applies.

## Requirement IDs
REQ-014, REQ-015, REQ-017, REQ-020, REQ-021, REQ-027, REQ-090, REQ-098

## Objective
Provision a fixed built-in Codex Function through the main-process local Agent registration and require its exact catalog identity when preparing a local Proposal. This is a catalog boundary, not permission to execute.

## Context Pack
- docs/delivery/tasks/TASK-794.md
- docs/delivery/tasks/TASK-795.md
- docs/delivery/phase-007.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/adapters/codex.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-796.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- apps/desktop/src/main/local-codex-function.ts
- apps/desktop/src/main/local-codex-registration.ts
- apps/desktop/src/main/proposal-catalog-check.ts
- apps/desktop/tests/main/local-codex-function.test.ts
- apps/desktop/tests/main/local-codex-registration.test.ts
- apps/desktop/tests/main/proposal-catalog-check.test.ts
- apps/desktop/tests/main/proposal-draft-store.test.ts
- apps/desktop/tests/main/local-proposal-review.test.ts
- apps/desktop/src/main/fixture-proposal-loop.ts
- apps/desktop/tests/main/fixture-proposal-loop.test.ts
- docs/adapters/codex.md

## Forbidden Files
Files outside the allowlist, archive evidence, other worktrees, main, remote operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
The main process owns the built-in descriptor, deterministic agent-scoped identity and pinned protocol compatibility. A catalog match is only a prerequisite for a Proposal, never a Grant, process identity proof, confinement proof or authority to dispatch. Renderer input cannot create or alter the built-in descriptor.

## Data Constraints
The registration transaction provisions at most one built-in function for the same registered local Agent. Incompatible protocol versions fail closed. Existing disabled or altered functions cannot be silently reactivated or repurposed. Foreign or ambiguous Workspaces cannot provision or match.

## UI Constraints
Existing prerequisite projection may indicate a reviewable Function, but must not claim execution readiness. No execution or approval button is enabled by this task.

## Implementation Requirements
Add a fixed, versioned built-in descriptor and deterministic identity, bound to the single locally registered Codex Agent. Provision during registration transaction; reject collisions or altered immutable fields. Check the same descriptor and live pinned version in Proposal context and candidate catalog. Preserve lifecycle state and never turn disabled records active. Existing arbitrary catalog entries are not execution authority.

## Test Requirements
First demonstrate red tests. Verify idempotent registration, pinned and unsupported versions, altered or disabled rows, registration rollback, foreign Workspace, arbitrary Function rejection, persisted re-open, and Proposal draft/review compatibility. Run target tests and full build/lint/typecheck/unit/contract plus governance gates.

## Acceptance Criteria
A valid local 0.121.0 registration creates one stable built-in Function. Re-registration is idempotent without resurrecting disabled or modified functions. Unsupported version does not authorize the Function. Context and candidate checks reject arbitrary, mismatched, foreign and altered Function rows. No Grant, Attempt or external effect is created.

## Done Definition
Record results and remaining production dispatch, native Grant, process provenance and OS confinement gaps; do not claim merge readiness.

## Risks
A stored catalog row or self-reported upstream version is not independent executable provenance; production dispatch remains disabled until separately verified.

## Output Required
Tests and factual Adapter documentation describe the catalog boundary and remaining work.

### Implementation progress — 2026-11-22

The main registration transaction now provisions a deterministic built-in
Function for reported App Server 0.121.0. Proposal context and candidate checks
recognize only its exact active catalog fields. This opens no execution path.
Focused tests reproduced the former arbitrary-Function acceptance and passed
after the catalog guard was added. Independent review also found registration
could silently re-enable a disabled Agent; a red regression now covers
same-version and changed-version re-registration after database reopen, and
the guarded update preserves the disabled state.

The identity is predictable and does not prove binary provenance. In particular,
version rollback or same-version executable replacement can make old Proposal
facts catalog-compatible again. A production Grant must bind immutable,
non-rollbackable registration generation and independently verified executable
identity and revalidate both atomically at consumption. Until then, no live
dispatch is authorized. Full gates and independent re-review remain pending.

Scope revision: the full unit run exposed four fixture-loop failures because
the old fixture used an arbitrary Function identity. The two exact fixture
paths above are added to align that fake-only loop with the built-in identity
while retaining all its existing lifecycle assertions. No real execution path
is enabled by this revision.

### Local verification and re-review — 2026-11-22

After the fixture identity correction, Windows Node 22.19.0 / npm 10.9.3
production build, lint and typecheck passed. The full unit suite reported
619 passed and six PostgreSQL-environment skips; the contract suite reported
50 passed. The six skipped tests are not passes. Four fixture-loop scenarios
also passed in a focused run, covering normal operation, lost receipt, moved
baseline and paused Agent. The earlier full run failed those four scenarios
because the fixture still used an arbitrary catalog identity; the failure was
preserved in this record and was not resolved by reducing assertions.

Independent read-only re-review found the disabled-Agent update is guarded
inside the same transaction and found no production import of the fake loop.
The reviewer did not run tests and did not endorse catalog identity as
execution authority. Native Grant wiring, registration generation, binary
provenance, independent confinement, process-tree termination, full end-to-end
acceptance and CI remain pending.
