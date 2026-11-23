# TASK-825: Exact identity checks for asynchronous migration backups

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: user authorized independent resolution of merge blockers without routine confirmation. TASK-824 remains WIP and its production execution restrictions remain unchanged.

## Requirement IDs
REQ-090, REQ-092, REQ-095, REQ-099

## Objective
Prevent asynchronous SQLite migration backup reservation checks from treating distinct filesystem identifiers as equal because JavaScript Number loses integer precision.

## Context Pack
- docs/delivery/tasks/TASK-823.md
- docs/delivery/tasks/TASK-824.md
- docs/data-model.md
- docs/operations.md

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
- docs/delivery/tasks/TASK-825.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/operations.md
- packages/persistence/src/sqlite/database.ts
- packages/persistence/tests/migration-runner.test.ts

## Forbidden Files
Other paths, archived evidence, user databases, original project workspaces, other worktrees, remote operations, merge, production route activation, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
The existing asynchronous database opener remains API-compatible. Reservation and post-backup filesystem identifiers must be read and compared as exact bigint values; unavailable or changed identity fails closed before migration. The established migration and backup validation contracts remain mandatory. Exact equality alone is not a defense against all path replacement races or a substitute for trusted filesystem ownership.

## Data Constraints
Tests use only newly created disposable SQLite databases and temporary backup paths. Preserve existing databases and backups on failure; never delete or modify user data. Do not print database contents or secrets.

## UI Constraints
No renderer, preload or UI changes.

## Implementation Requirements
Demonstrate the precision collision on the async backup validation path with a deterministic test, then compare exact stat identity fields. Preserve symbolic-link, canonical-parent, data-version and migration checks. Do not claim that this change fully solves filesystem replacement attacks or allows production protected execution.

## Test Requirements
Run the new regression before and after the change, existing migration tests including hard-link and backup checks, lint, typecheck, build, full unit, contract and governance checks. Record counts, skips and environment honestly. Real Codex and Electron sandbox remain deferred.

## Acceptance Criteria
Distinct identifiers that round to the same Number are rejected after backup and before migration. Identical bigint identities remain valid, and existing migration and backup behavior passes. No application execution or Lease behavior changes.

## Done Definition
Commit a reviewed fix with its test evidence and document the remaining independent ownership and path-replacement limitations. This task alone is not merge readiness.

## Risks
Mocked metadata tests prove comparison behavior rather than a real filesystem attack. Asynchronous path replacement between checks requires separate operating-system and ownership controls.

## Output Required
Exact-identity migration fix, deterministic regression, updated operational facts and local verification evidence.

## Local verification
The collision regression initially failed because the opener proceeded to migrate; after both backup identity reads were changed to bigint it passed and verified the source had no migration table. The matching large-identity case passed as well. The migration test file passed 21/21. The full Windows host unit suite passed 1,042 with nine skipped across 182 files; the contract suite passed 49/49. Lint, typecheck and production build passed. The skipped cases are not passes. Independent static review found no critical or important issue and did not run tests; dev-field collision and explicit retained-backup assertions are nonblocking future test enhancements. Documentation links, REQ traceability and all five schemas passed. This scoped result does not establish trusted filesystem ownership, close path replacement races, enable execution, or constitute merge acceptance.
