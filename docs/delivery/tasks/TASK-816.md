# TASK-816: Close Decision authorization and delivery gaps

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User requested continuous remediation of Decision and original-Attempt recovery until merge readiness.

## Requirement IDs
REQ-033, REQ-038, REQ-040, REQ-041, REQ-042, REQ-043, REQ-044, REQ-049, REQ-090, REQ-092, REQ-094, REQ-098

## Objective
Fix the independent review blockers of TASK-815 in the actual Decision repository: remove the direct-write bypass, require exact durable ownership and valid input, and refuse duplicate success without the matching outbox evidence.

## Context Pack
- docs/delivery/tasks/TASK-815.md
- docs/orchestration.md
- docs/security.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-816.md
- docs/delivery/tasks/TASK-815.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/orchestration.md
- packages/domain/src/decision.ts
- packages/domain/tests/decision.test.ts
- packages/persistence/src/repositories/decision-repository.ts
- packages/persistence/tests/decision-repository.test.ts
- packages/persistence/tests/outbox-inbox.test.ts

## Forbidden Files
Other files, real credentials, production databases, archived evidence, other worktrees, real Codex execution, Electron sandbox validation, remote operations and merge.

## Interfaces / Contracts
Legacy direct resolve is fail-closed; atomic resolution verifies the exact Task, WorkItem, Project, Workspace, independently supplied authenticated principal, owner and consumed Grant before writing. A caller-supplied actor alone is never authority. Same-key retries also require the original matching Outbox evidence, otherwise fail closed without inventing or reissuing it. Resolution IDs, keys, actor IDs, choices and timestamps are validated at runtime. Only the one uniquely associated waiting Attempt can be resumed.

## Data Constraints
No schema mutation, no secret values, no production data. Historical malformed records remain unchanged and require explicit reconciliation.

## UI Constraints
No UI changes; Decision interaction remains unavailable until authorized native confirmation and original Attempt delivery are integrated.

## Implementation Requirements
Use existing database authority and explicit cross-table joins. Limit this local H1 path to the active Workspace owner; do not infer team RBAC authorization. Preserve the original atomic Decision/Outbox insertion and fail closed on ambiguous or inconsistent historical evidence. Existing adversarial Outbox tests may seed deliberately inconsistent records directly; do not weaken assertions.

## Test Requirements
TDD: use valid real SQLite relational fixtures and cover altered scope, cross-owner, invalid input, direct resolve bypass and missing/mismatched historical Outbox evidence. Exercise duplicate, unknown, multiple Attempt, cancellation and concurrent paths. Run full unit, contract, build, lint, typecheck and governance checks.

## Acceptance Criteria
No direct method can close a Decision without its transactional resume; unauthorized or invalid resolution causes zero change; duplicates return the old result only if the unique exact evidence remains present. Existing historical rows are never silently repaired or redelivered.

## Done Definition
Record actual verification and open issues; delivery of ALLOW/DENY to the Adapter remains a separate blocker and cannot be claimed here.

## Risks
Decision does not yet bind an originating Attempt ID, so first resolution with multiple Attempts is blocked. An already-resolved same-key read can return existing evidence without redispatch even when more than one Attempt exists. Local owner checks do not establish team authorization or native confirmation.

## Output Required
Scoped repository hardening, real database regression tests and one evidence record.

## Local evidence and remaining scope (2026-11-22)

- Real relational SQLite regressions first reproduced direct-write bypass, mismatched Workspace/Project/Task, a forged owner, malformed resolution values and a missing original Outbox record. Follow-up red tests reproduced the default-principal spoof, invalid Attempt IDs, a cancelled Task with a stale waiting Attempt, and duplicate resume evidence across Attempts. The related 77 tests passed after fixes.
- The repository now defaults to no principal; only an explicitly supplied trusted principal matching the active Workspace owner can resolve. This is an internal dependency boundary, not proof that the desktop supplies a native-authenticated principal. Existing direct resolve is disabled; adversarial Outbox fixtures seed inconsistent history explicitly.
- Full Windows unit: 739 passed, nine explicitly accounted skips, zero failures, 174 files. Full contract: 49 passed, zero skipped. Workspace lint and typecheck passed. The initial full build passed before later persistence edits; the final persistence build passed after them. These are local results, not remote CI.
- The initial TASK-815 review findings for direct bypass, exact scope, field validation and missing Outbox evidence are addressed in this increment. Actual Grant expiry/scope revalidation, live ResourceLease, native confirmation, durable delivery of ALLOW/DENY, originating-Attempt binding after retries, encrypted Proposal integration and end-to-end recovery remain unresolved. Do not wire this path to user actions or claim merge readiness based on these tests.
- Subsequent independent reviews identified further malformed historical evidence cases. Seven targeted tests first reproduced the gaps; after validating message fields, related Decision identity, actor and timestamp, 85 affected domain, real-SQLite and Outbox tests passed, including a legitimate distinct historical Decision. Final Windows full-unit rerun: 747 passed, nine skips, zero failed, 174 files; final contract: 49 passed, zero skipped. Lint and typecheck passed. A later read-only re-review found no new definite Decision/Outbox blocker within this increment, while clarifying that already-resolved retries can return existing evidence with multiple Attempts. This remains WIP, not merge acceptance.
