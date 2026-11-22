# TASK-810: Authenticated encrypted-payload restart recovery

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User requested continued development through the merge gate, including restart recovery without repeated effects.

## Requirement IDs
REQ-023, REQ-027, REQ-040, REQ-049, REQ-090, REQ-092, REQ-094, REQ-095, REQ-098, REQ-099

## Objective
Recover a committed encrypted payload whose key reservation was not linked before interruption, by authenticating the exact existing ciphertext with the existing key and atomically linking its reservation. Never create a key, write a vault item or re-execute a Task during recovery.

## Context Pack
- docs/delivery/tasks/TASK-804.md
- docs/delivery/tasks/TASK-805.md
- docs/delivery/tasks/TASK-807.md
- docs/delivery/tasks/TASK-808.md
- docs/delivery/tasks/TASK-809.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/security.md
- docs/data-model.md
- docs/operations.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-810.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/security.md
- docs/data-model.md
- docs/operations.md
- apps/desktop/src/main/protected-payload-store.ts
- apps/desktop/src/main/protected-key-reservations.ts
- apps/desktop/src/main/reserved-payload-service.ts
- apps/desktop/tests/main/reserved-payload-service.test.ts
- apps/desktop/tests/main/protected-key-reservations.test.ts

## Forbidden Files
Other application files, production credentials, production WinCred writes, existing databases, archived evidence, other worktrees, main, remote operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
Recovery is a main-only operation of the reserved payload service. It reads the existing key reference and key without creating or modifying vault entries. It returns LINKED only when the exact Workspace, Project, record ID, content kind, key reference, envelope and authentication tag pass verification while an immediate SQLite transaction holds the authority and linking boundary. Missing or wrong keys, stale authority, mismatched bindings, missing payloads or invalid ciphertext remain unresolved without database mutation. Repeated recovery is idempotent.

## Data Constraints
No plaintext, key bytes or credentials are returned by recovery, written to logs or stored in SQLite. Decrypted temporary buffers and owned key copies are cleared best effort. Recovery cannot repair or infer a missing key, rewrite ciphertext, delete a vault entry, create a new Attempt or re-dispatch. Legacy records are unchanged.

## UI Constraints
No renderer, UI, Grant, Proposal execution or Attempt wiring. This isolated recovery capability is not yet an H1 acceptance claim.

## Implementation Requirements
Permit recovery only for an existing reservation and exact matching encrypted payload in STORED or UNCERTAIN state. Fetch the existing key outside the SQLite transaction, then recheck local authority, reservation, key reference, content kind and authenticate the entire AES-GCM envelope inside one immediate transaction before linking. No application-provided verification callback can bypass authentication. Stale or conflicting states fail closed; owner-bound normal linking remains idempotent if recovery completed first.

## Test Requirements
Use TDD and real SQLite, including database reopen and two connections. Cover successful crash-equivalent recovery, repeated recovery, failed authentication, tampered content, wrong workspace/kind/reference, missing key, changed authority while awaiting key, conflicting reservation, concurrent recovery and vault failures. Verify no key creation, plaintext database writes or new Attempts. Run lint, typecheck, build, full unit/contract and governance gates.

## Acceptance Criteria
Only an authenticated exact existing payload may become LINKED after restart, without a new key or external effect. All negative and ambiguous cases preserve durable records and remain non-retryable. Repeated recovery does not change the payload or create effects.

## Done Definition
Record real evidence and security review. Production WinCred deployment, legacy plaintext migration, secret-input isolation, Proposal execution and merge gates remain separate.

## Risks
SQLite and Windows Credential Manager do not share transactions. Missing keys and orphaned credentials cannot be automatically repaired or deleted. Database rollback and malicious same-user processes remain outside this specific recovery guarantee.

## Output Required
Scoped recovery implementation, tests, security/data/operations writeback and one Task Pack evidence record.

## Local evidence and limits (2026-11-22)

- Recovery tests first failed because the operation was absent. The implementation reads only the existing key and authenticates the exact envelope inside the same immediate SQLite transaction that links the existing reservation. No new key, Task, Attempt, vault write or dispatch is created.
- Focused tests: 58 passed across recovery, encrypted storage and reservation suites, including wrong/missing key, tampered ciphertext, wrong scope/kind/reference, revoked authority during vault read, no committed payload, repeated recovery, disk reopen and two simultaneously released worker connections. The worker barrier coordinates entry but does not force a particular lock acquisition order.
- Independent read-only security review found no new blocking issue within the isolated recovery increment. SQLite authentication proves the copied key matched at verification time; it cannot prevent an independent same-user process from changing Credential Manager afterward. Missing keys and orphaned vault records remain unresolved, not retried or deleted.
- lint, workspace typecheck and production build exited 0. Full unit exited 0: 173 files, 698 passed, 9 skipped (six PostgreSQL-dependent cases and three explicitly gated native credential tests). The current native tests were previously run separately; skipped tests are not full-unit passes. Production helper packaging and provenance, legacy plaintext migration, user credential input isolation, live Proposal/Attempt wiring and remote CI remain unverified.
