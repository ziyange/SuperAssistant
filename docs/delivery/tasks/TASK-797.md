# TASK-797: Bind Proposal drafts and reviews to registration generation

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: user requested continued implementation of trusted Function and immutable Proposal confirmation through the merge gate.

## Requirement IDs
REQ-021, REQ-023, REQ-024, REQ-025, REQ-027, REQ-090, REQ-098

## Objective
Reject stale Proposal drafts and reviews when their registered Codex Agent generation changes, including changes back to an earlier reported version.

## Context Pack
- docs/delivery/tasks/TASK-794.md
- docs/delivery/tasks/TASK-795.md
- docs/delivery/tasks/TASK-796.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-797.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- apps/desktop/src/main/proposal-draft-store.ts
- apps/desktop/src/main/local-proposal-review.ts
- apps/desktop/tests/main/proposal-draft-store.test.ts
- apps/desktop/tests/main/local-proposal-review.test.ts
- packages/persistence/src/sqlite/migrations/028-draft-agent-generation.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/tests/migration-runner.test.ts
- docs/data-model.md
- docs/adapters/codex.md

## Forbidden Files
Other application files, archive evidence, other worktrees, main, remote operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
An immutable local draft captures its registered Agent row generation. Review preparation and read must compare the captured generation to current same-workspace registration, with no mutation on rejection. Legacy drafts lacking the binding fail closed. The database generation is local consistency evidence only, not independent binary provenance or anti-rollback after a database restore.

## Data Constraints
Migration 028 is additive and does not invent generation values for old drafts. Binding rows are append-only and tied to exactly one draft; invalid or missing bindings are rejected. Re-registration and any Agent row-version change invalidate old drafts and their associated reviews, even if version later returns to the same value.

## UI Constraints
No internal generation or executable path is exposed to renderer. Existing review acknowledgement remains REVIEWED_ONLY and does not issue a Grant.

## Implementation Requirements
Capture the current positive Agent row_version with a newly created draft in one immediate transaction. Recheck it on draft read and on every existing review read, including after restart and repeated registration. Fail closed on mismatch or legacy unbound draft. Keep original immutable Proposal payload and digest unchanged. Do not infer system-wide database anti-rollback or authentic executable identity.

## Test Requirements
Demonstrate failing tests before implementation. Cover same-version re-registration, version change and rollback, review read after restart, immutable binding, legacy unbound draft, and current draft success. Run migration, local Proposal, fake loop, build/lint/typecheck/unit/contract and governance gates.

## Acceptance Criteria
An old draft and review are rejected after registration generation changes and do not become valid again after reported version rollback. A newly created draft can be reviewed against the current valid catalog. No external execution or Grant is created by this change.

## Done Definition
Record tests and remaining executable hash/provenance, operating-system confinement, native Grant and process-tree termination gaps. This task alone does not confer merge readiness.

## Risks
A database restored from an older backup can roll back its own generation; prevention requires an independent external trust anchor and is outside this scoped guard.

## Output Required
Focused tests, migration evidence and authoritative data-model writeback.

### Implementation and review — 2026-11-22

Migration 028 adds an append-only draft-to-Agent generation binding, without
inventing values for existing drafts. New draft creation persists it with the
draft; prepare and read revalidate it and the immutable review digest inside
their final immediate transaction. A red test first reproduced old reviews
becoming valid after a version round-trip.

Independent review found two additional defects: a second SQLite connection
could change the Agent after the initial check, and INSERT OR REPLACE could
replace a binding despite update/delete triggers. Both were reproduced by
failing tests. The implementation now rechecks under the write lock and rejects
replacement with a BEFORE INSERT guard. A re-review found no further blocker
in this scope. Neither review independently ran tests.

The generation cannot detect database restore or a privileged database writer,
and is not executable provenance or proof that Git HEAD cannot change after
the check. Production Grant consumption must independently revalidate all
required authority, baseline and executable identity. Full gates are pending.

### Local verification — 2026-11-22

On Windows Node 22.19.0 and npm 10.9.3, production build, lint and typecheck
passed. The full unit suite reported 620 passes and six PostgreSQL-environment
skips; the contract suite reported 50 passes. Skips are not passes. Focused
tests exercised migration from version 27 without fabricated bindings, rejected
unbound legacy drafts, insert-or-replace/update/delete, same-version Agent row
generation change, version rollback, and independent-connection changes
during prepare and read. No real Codex or Electron sandbox test was run.

The fixture loop is not the production Grant consumption path. Production
consumption, independent executable provenance, worktree/process confinement
and process-tree termination remain unverified and are not authorized by this
test result. Remote CI was not run.
