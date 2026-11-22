# TASK-820: Bind protected Proposal reads to a SQLite authority transaction

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User requested autonomous completion of the protected Proposal execution path.

## Requirement IDs
REQ-020, REQ-021, REQ-023, REQ-024, REQ-027, REQ-090, REQ-092, REQ-094, REQ-095, REQ-098

## Objective
Add a main-only, non-authorizing protected Proposal consistency check. It constructs the store against the same database, revalidates exact encrypted envelope and current scope after asynchronous decryption inside a SQLite transaction, and returns no plaintext or reusable execution authority. This prerequisite does not issue a Grant or start execution.

## Context Pack
- docs/delivery/tasks/TASK-811.md
- docs/delivery/tasks/TASK-819.md
- docs/decisions/ADR-008-protected-task-content.md
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
- docs/delivery/tasks/TASK-820.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/security.md
- docs/data-model.md
- apps/desktop/src/main/protected-proposal-authority.ts
- apps/desktop/tests/main/protected-proposal-authority.test.ts

## Forbidden Files
Other files, production credentials, real WinCred effects, application data, other worktrees, archives, remote operations, real Codex and Electron sandbox verification.

## Interfaces / Contracts
A main-only checker constructs its encrypted Proposal store with the exact same SQLite connection. It captures the immutable encrypted envelope and linked key reservation before decryption, then begins its own SQLite IMMEDIATE transaction, rechecks byte-exact envelope identity and linked reservation, reconstructs the full Proposal digest and checks active Workspace, Project, Agent, Function, versions and time. It accepts no caller callback and returns no Proposal plaintext or reusable authority. An explicit negative result or exception does not permit any subsequent side effect.

Security-review amendment: arbitrary callbacks cannot be confined to synchronous SQLite-only work, and an independently supplied store may point to another database. The checker therefore owns store construction and does not invoke callbacks. Any future Grant write must be implemented and revalidated within its own transaction; a previous CURRENT result is never an authorization.

## Data Constraints
Never persist or log plaintext, keys or secret values. Do not use legacy plaintext Proposal tables. No schema changes, key creation, Grant or Task. The seam is not a native confirmation or executable authorization. Secure handling of arbitrary credentials, protected key provenance, live Git baseline and external action fencing remain outstanding.

## UI Constraints
No renderer, IPC, native window or UI wiring. No real execution.

## Implementation Requirements
Capture a copy of ordinary scoped input before awaiting and reject malformed scope, mismatched Proposal identity, digest or content, expired Proposal/deadline, stale project snapshot, unavailable Agent or inactive Function. Recheck the envelope and current facts within an immediate transaction after asynchronous read. Do not retry vault or other external effects. No callback or side effect follows a successful check. Wall-clock rollback is not prevented; future authorization must enforce its own anti-rollback policy.

## Test Requirements
Use TDD, real SQLite and fake vault. Test a current exact Proposal, envelope and linked reservation changes during decryption, current Project/Agent/Function changes, deadline, wrong scope and nested transaction. Check no plaintext or Grant/Task creation. Run targeted, lint, typecheck, build, full unit/contract and governance.

## Acceptance Criteria
Only an unchanged authenticated Proposal with matching current facts produces a CURRENT result; stale, ambiguous or malformed cases fail closed. The result is informational only, reveals no plaintext and cannot authorize execution. No external execution or new Grant/Task occurs.

## Done Definition
Record actual tests, independent review and remaining production boundaries. Real Codex, Electron sandbox, WinCred provenance, secure user-input policy and protected Grant/Task lifecycle remain unverified.

## Risks
Database snapshot revalidation is not a live Git baseline lock, native user approval, key-vault provenance, process sandbox or external side-effect fence. It cannot enable production dispatch.

## Output Required
Main-only protected Proposal consistency checker, tests and scoped evidence.

## Local evidence (2026-11-23; working patch on 8d12be6)
- Red tests reproduced stale default-Agent acceptance, while independent review identified cross-database store binding and deferred callback effects. The final checker constructs its own same-database store, accepts no callback and returns no plaintext or reusable authority.
- Eleven focused tests cover a valid check, vault and Project/Agent/Function/envelope/reservation changes, copied input, expiry, wrong scope, wrong vault and caller-owned transactions.
- Node 22.19.0/npm 10.9.3: lint, typecheck and build passed; full unit 177 files, 815 passed and 9 skipped; contract 8 files, 49 passed.
- Independent read-only review found no further Critical/Important defect within this informational checker after the redesign.
- Limitations: no persistent anti-rollback time watermark, independent-connection race evidence, real WinCred, trusted helper provenance, native user approval, Grant/Task write or Adapter dispatch. A CURRENT result is not a durable authorization.
- Working-patch results are not clean-SHA CI, integrated H1 acceptance or merge approval.
