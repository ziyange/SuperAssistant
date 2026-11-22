# TASK-815: Preserve Decision and original Attempt integrity

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User requested autonomous work to complete Decision, idempotent recovery and merge gates.

## Requirement IDs
REQ-033, REQ-038, REQ-040, REQ-041, REQ-042, REQ-043, REQ-044, REQ-049, REQ-090, REQ-092, REQ-098

## Objective
Harden the existing SQLite Decision resolution and resume transaction against conflicting duplicates, wrong-Attempt selection and silent outbox conflicts before desktop integration.

## Context Pack
- docs/orchestration.md
- docs/delivery/tasks/TASK-813.md

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
- docs/delivery/tasks/TASK-815.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/orchestration.md
- packages/domain/src/decision.ts
- packages/domain/tests/decision.test.ts
- packages/persistence/src/repositories/decision-repository.ts
- packages/persistence/tests/decision-repository.test.ts

## Forbidden Files
Other files, real credentials, production databases, archived evidence, other worktrees, real Codex execution, Electron sandbox validation, remote operations and merge.

## Interfaces / Contracts
A repeat of a resolved Decision with the same idempotency key, actor and option returns the original resolution even if a new resolution ID or timestamp is supplied. Reusing that key with a different actor or option fails. A different key remains rejected. Only one provably matching WAITING_USER or WAITING_INPUT Attempt may receive the resume; while the existing Decision schema has no explicit Attempt ID, multiple historical Attempts are ambiguous and must fail closed. UNKNOWN and RECONCILING remain blocked. Any resume outbox insertion conflict rolls back the Decision update.

## Data Constraints
No schema changes, production data or credentials. Preserve immutable historical records and use immediate SQLite transaction.

## UI Constraints
No UI changes; this does not claim native Decision interaction is wired.

## Implementation Requirements
Enforce conflict checks in both domain and SQLite duplicate path. Before resolving, require exactly one Attempt for the WorkItem and ensure it is waiting; do not infer the original by timestamp. Insert the resume using a normal constraint-enforced insert, and roll back on any conflict. Preserve existing no-duplicate behavior.

## Test Requirements
TDD: exercise same-key different actor/option, exact retry, ambiguous multiple Attempts, terminal/running/unknown Attempts and existing conflicting resume message using real SQLite. Verify original state remains unchanged after each rejected transaction. Run unit, contract, lint, typecheck, build and governance checks.

## Acceptance Criteria
No conflicting Decision is accepted as a duplicate, no wrong or unknown Attempt gets a resume, and no Decision becomes resolved without its exactly-one matching outbox record. Full native interaction and actual restart recovery remain separate merge gates.

## Done Definition
Record actual local evidence and limitations; do not claim H1/M1 or remote CI acceptance.

## Risks
Legacy schema lacks an originating Attempt reference, so legitimate same-WorkItem retries with multiple Attempts remain blocked pending a versioned binding. Concurrent confirmation across connections must serialize, not create duplicate messages.

## Output Required
A scoped transactional fix, regression tests and evidence.

## Local evidence and remaining scope (2026-11-22)

- Eight new domain/SQLite regression cases failed before the fix: changed actor/choice, four non-waiting states, ambiguous Attempts and a conflicting resume key. The corrected code passed all focused cases and the existing real SQLite Outbox tests.
- A separate worker-thread test opened two SQLite connections against one disposable database: conflicting same-key resolutions produced one accepted result, one conflict, a single durable Decision and one Outbox row. This is not an Electron or external Adapter integration test.
- Full Windows unit: 716 passed, nine expected skips, zero failures, 174 files. Contract: 49 passed, zero skipped. Build passed; lint initially failed on a test-only missing URL global, then lint and typecheck passed after correction.
- Multi-Attempt Decisions are intentionally rejected because the existing schema does not store the originating Attempt ID. This protects against a wrong resume but leaves legitimate retry recovery incomplete; a versioned binding and migration are still required.
- Native Decision interaction, protected Proposal/Grant integration, real Codex and Electron sandbox verification, GitHub CI for this candidate and merge acceptance remain unproven.
- Independent review found unresolved blockers: the legacy direct `resolve()` can bypass Outbox, already-resolved duplicates do not verify a matching durable resume, Decision scope is not checked against its Task and WorkItem, and malformed resolution fields can create an undeliverable message. The ALLOW/DENY payload is also not yet transmitted by the current Adapter bridge. These findings supersede any suggestion that this Task meets its full acceptance criteria. The current change is WIP and must not be used as approval to expose Decision resolution.
