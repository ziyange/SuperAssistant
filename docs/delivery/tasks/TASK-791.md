# TASK-791: Separate execution success from Task acceptance in the desktop view

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authority: user-approved official desktop recovery, original Task acceptance and safe development gates. Trigger: review of TASK-790 showed a successful terminal observation renders as a completed Task without an accepted Task.

## Requirement IDs
REQ-032, REQ-036, REQ-037, REQ-038, REQ-049

## Objective
Project the same truthful state in Task Center list and detail. A successful Attempt is pending acceptance unless the authoritative Task has already been finalized and the persisted Work Item, Artifact and Decision facts agree.

## Context Pack
- docs/delivery/tasks/TASK-790.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/data-model.md
- docs/ux.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-791.md
- .github/workflows/docs-gates.yml
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/ux.md
- packages/domain/src/task-projection.ts
- packages/persistence/src/queries/task-projection.ts
- packages/persistence/tests/task-projection.test.ts

## Forbidden Files
All other files, main and the two retained dirty worktrees, live Codex and Electron sandbox tests.

## Interfaces / Contracts
Keep list and detail read-only. Without required/optional metadata use conservative evidence for all represented Work Items. Return the existing domain meaning ACCEPTANCE_PENDING rather than claiming COMPLETED from SUCCEEDED alone.

## Data Constraints
Never write acceptance evidence from the projection. Only the acceptance workflow owns the final persisted Task state.

## UI Constraints
Task Center and its detail show pending acceptance after recovery unless Task-level completion has been recorded.

## Implementation Requirements
Read the persisted Task state on both query paths and retain precedence for unknown, reconciling or cancelling execution.

## Test Requirements
Test a successful Attempt before and after persisted Task completion, including authoritative contradictory nonterminal Attempt facts. Run unit, contract, build, lint, typecheck and repository governance.

## Acceptance Criteria
Views agree; an unaccepted success never displays completed. Reading either projection changes no database row.

## Done Definition
Record actual verification in this pack. Not a release gate or implementation of the acceptance writer.

## Risks
Confusing execution and acceptance enables premature handoff. Do not infer past Task acceptance from legacy Attempt history.

## Output Required
This Task Pack is the closure record for the projection correction.

Local verification (2026-11-19; base `2280543`): the red SQLite regression
observed COMPLETED in list and detail for an unaccepted successful Attempt.
After correction both queries returned ACCEPTANCE_PENDING, including when
the stored completion flag lacked matching Artifact evidence or an open
Decision remained. Matching finalized evidence returned COMPLETED and
UNKNOWN still took precedence. Target: 2/2. Production build, lint,
typecheck, 561 unit tests (six PostgreSQL skips) and 50 contracts passed
on Windows, Node 22.19.0. Local governance: 344 Markdown files, 138 packs,
five schemas, REQ traceability, Plan Exit 0 and 34 Python tests passed;
eight exact paths. No remote CI, real Codex or Electron sandbox run.
These are read-side guarantees, not confirmation, dispatch or active cancellation.
