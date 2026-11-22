# TASK-817: Revalidate Decision authorization before queuing resume

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User requested autonomous remediation of Decision authorization and recovery before merge.

## Requirement IDs
REQ-027, REQ-031, REQ-033, REQ-038, REQ-040, REQ-043, REQ-044, REQ-049, REQ-090, REQ-092, REQ-098

## Objective
At the actual SQLite Decision transaction, revalidate immutable Proposal, consumed Grant, current Project/Agent/Function facts and the uniquely owned live Project Lease before closing a Decision and queuing resume.

## Context Pack
- docs/delivery/tasks/TASK-815.md
- docs/delivery/tasks/TASK-816.md
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
- docs/api/sai.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-817.md
- docs/delivery/tasks/TASK-816.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/orchestration.md
- docs/security.md
- packages/persistence/src/repositories/decision-repository.ts
- packages/persistence/tests/decision-repository.test.ts
- packages/persistence/tests/outbox-inbox.test.ts

## Forbidden Files
Other files, production databases, credentials, existing archives, other worktrees, real Codex execution, Electron sandbox verification, remote operations and merge.

## Interfaces / Contracts
The repository accepts an independently trusted principal and an injected clock; both default fail-closed for principal and to the actual clock for time. A first resolution rechecks the Proposal digest, exact Grant action scope and validity, current Project/Agent/Function versions and availability, one unexpired correctly fenced Project Lease for the original Attempt, and absence of competing Project/worktree leases. It uses the current trusted clock, not a renderer-supplied timestamp. Same-key already-resolved requests merely read exact historical evidence and never enqueue again, even if authority later expires.

## Data Constraints
No schema changes, production data or credential values. Perform all checks and Decision/Outbox write in one immediate SQLite transaction; failures leave Decision and Outbox unchanged.

## UI Constraints
No UI or native confirmation wiring. A successful transaction is not proof of later dispatch, process confinement, acceptance or option delivery.

## Implementation Requirements
Reconstruct Proposal through the existing domain API, verify all frozen fields and exact action scope; validate canonical timestamps and expiry. Require an ACTIVE Project and matching snapshot, connected/available Agent and active matching Function. Use existing ResourceLease validation with trusted clock; ensure resource key, fencing and competing histories are correct. Never alter legacy immutable Proposal evidence or retry an unknown Attempt.

## Test Requirements
TDD real SQLite negative tests for expired/malformed Grant, altered Grant actions, stale Project snapshot, unavailable Agent, changed Function, absent/released/expired/competing Lease and clock rollback; positive current evidence and idempotent retry after later expiry. Run focused, full unit/contract, build, lint, typecheck, and governance checks.

## Acceptance Criteria
An expired or inconsistent authorization, stale domain fact, invalid clock, missing/expired Lease or conflicting fence cannot resolve the Decision or create a resume. Valid exact authority creates one durable resume, duplicate read does not create another. Later dispatch must independently revalidate and remains unimplemented.

## Done Definition
Record actual tests and independent review. Do not claim production native authorization, live Git baseline verification, process confinement, Decision-option transport or H1 acceptance.

## Risks
All new checks apply to the legacy plaintext Proposal path only; protected Proposal integration remains unresolved. Lease validation cannot prove OS process ownership, and a later dispatcher must recheck after this transaction.

## Output Required
Scoped existing repository changes, real SQLite tests, documentation and evidence.

## Local evidence and limitations (2026-11-22)

- Targeted real-SQLite regressions first failed for expired/altered Grant, stale catalog facts, absent/released/expired Lease and invalid clock. After implementation they passed, and resolution time was verified to come from the injected transaction clock.
- Independent review found that throwing after an expired Lease check rolled back its watermark. Tests reproduced Lease-expiry then rollback, Grant-expiry then rollback, malformed prior fence and Outbox conflict; the fix retains the observation outside a rolled-back savepoint and rejects caller-owned outer transactions. A disposable database reopen test verifies the persisted observation. Independent read-only re-review found no remaining instance of that specific flaw; it did not execute tests.
- Focused Decision/Outbox/domain suite: 104 passed. Windows full unit: 766 passed, nine declared skips, zero failures, 174 files. Fake-service contract: 49 passed, zero skips. Build, lint and typecheck passed.
- A documentation edit failed to apply because its context differed; the pending audit intent was inspected, the same authorized edit applied once, and its matching result recorded. No external side effect was repeated.
- The watermark covers only a Lease timestamp that successfully commits; earlier rejected authority/evidence paths do not record time. It is neither a global trusted clock nor database rollback protection. This transaction is not wired to native confirmation and does not establish Git baseline, process ownership, effective confinement, Grant/Lease recheck immediately before dispatch, actual option delivery, H1 acceptance or remote CI.
