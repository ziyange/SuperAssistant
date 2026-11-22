# TASK-811: Encrypted immutable Proposal repository

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User requested completion of the real immutable Proposal flow with encrypted content and autonomous progress to the merge gate.

## Requirement IDs
REQ-020, REQ-021, REQ-023, REQ-024, REQ-027, REQ-049, REQ-090, REQ-092, REQ-094, REQ-095, REQ-098, REQ-099

## Objective
Create an isolated repository for the actual full H1 ProposalVersion using the encrypted reserved-payload service, with strict immutable snapshot, identity and digest checks. It must not use existing plaintext Proposal tables or enable execution.

## Context Pack
- docs/delivery/tasks/TASK-798.md
- docs/delivery/tasks/TASK-807.md
- docs/delivery/tasks/TASK-810.md
- docs/decisions/ADR-008-protected-task-content.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-811.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/security.md
- docs/data-model.md
- docs/operations.md
- apps/desktop/src/main/encrypted-proposal-store.ts
- apps/desktop/tests/main/encrypted-proposal-store.test.ts

## Forbidden Files
Other application files, production credentials or WinCred writes, existing databases, archived evidence, other worktrees, main, remote operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
The main-only repository saves, reads and reconciles a full H1 ProposalVersion by exact Workspace, Project and ProposalVersion ID. Reconstruct and validate the canonical domain Proposal and digest before saving and after decrypting. The serialized snapshot is captured before any await. No renderer-provided authority, executable or authorization is accepted through this repository.

## Data Constraints
Only the authenticated encrypted envelope and nonsecret reservation metadata are stored. Full Proposal text, goal, criterion and digest are not placed in legacy plaintext Proposal tables, logs or files. Duplicate IDs never create a second key. Caller input may contain actual credentials and cannot be reliably classified automatically; this repository is not connected to user input until credential isolation policy is independently established.

## UI Constraints
No UI, renderer, native authorization, Grant, Attempt or Task changes. Existing review-only flow stays unchanged.

## Implementation Requirements
Reject malformed input, extra or missing Proposal fields, inconsistent full review and incorrect digest before vault effects. Bind encrypted scope to exact Proposal identity and content kind. On read, parse strictly and reconstruct the domain Proposal before returning it. Reconciliation may establish cryptographic linkage only; a malformed Proposal must never be returned or used to authorize execution. No production vault or real credentials are used.

## Test Requirements
Use TDD with real SQLite, domain Proposal validation and an isolated vault. Cover save/reopen/read, no plaintext in SQLite and legacy tables, wrong digest, altered full review, extra fields, duplicate ID, scope mismatch, mutation during asynchronous write, tampered ciphertext, failed link and restart recovery. Run lint, typecheck, build, full unit/contract and governance gates.

## Acceptance Criteria
A valid full immutable Proposal survives storage and reopen only under exact scope and validates to the same digest and fields. Invalid or mutated input cannot create vault effects or be returned as valid. Recovery does not create a new key or Task.

## Done Definition
Record actual evidence and unresolved production integration in this Task Pack. This isolated repository does not authorize a user goal, issue a Grant, run Codex or establish merge readiness.

## Risks
Ciphertext protection does not establish the absence of actual credentials in arbitrary user input. Legacy plaintext schema, helper provenance, process confinement, Grant/Attempt lifecycle and OS vault recovery remain separate blockers.

## Output Required
A focused encrypted Proposal repository, tests and one Task Pack evidence record.

## Local evidence and limitations (2026-11-22)

- The focused suite first failed because the Proposal repository did not exist; a later red case showed that an undefined extra property could be silently dropped by JSON serialization. Validation now runs against the original full object before serializing the canonical rebuilt snapshot.
- Eight focused tests passed, covering full Proposal and digest roundtrip, malformed values, scope and duplicate rejection, mutation during an async vault call, ciphertext tampering, interrupted-link recovery and encrypted read through the existing confirmation component with a fake presenter.
- A disposable on-disk WAL test found neither of two synthetic objective/criterion strings in the database or WAL and read the full Proposal through a second SQLite connection. This is not proof about every field, backups, historical plaintext, independent process restart or real WinCred. No real native review window or authorization was exercised.
- Independent read-only review identified and verified the semantic boundary: UNRESOLVED can follow a cryptographic LINKED transition when decrypted content is not a valid Proposal; the repository returns no Proposal and creates no Grant or Task. LINKED alone does not establish domain validity.
- lint, workspace typecheck and build exited 0. Full unit exited 0: 174 files, 706 passed and 9 skipped (six PostgreSQL-dependent cases and three explicitly gated native credential tests, whose separate evidence appears in earlier tasks). Remote CI remains unrun. Production user-input, native authorization and execution integration are not yet enabled.
