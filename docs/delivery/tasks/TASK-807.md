# TASK-807: Reserved-key encrypted content orchestration

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User approved encrypted task content and autonomous continued implementation.

## Requirement IDs
REQ-021, REQ-023, REQ-024, REQ-027, REQ-090, REQ-092, REQ-094, REQ-095, REQ-098, REQ-099

## Objective
Connect the isolated encrypted payload store and key-reservation journal through an injected vault port, ensuring uncertain vault outcomes and committed-but-unlinked payloads are never retried automatically.

## Context Pack
- docs/delivery/tasks/TASK-804.md
- docs/delivery/tasks/TASK-805.md
- docs/delivery/tasks/TASK-806.md
- docs/decisions/ADR-008-protected-task-content.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/security.md
- docs/data-model.md
- docs/operations.md
- docs/architecture.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-807.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/security.md
- docs/data-model.md
- docs/operations.md
- apps/desktop/src/main/reserved-payload-service.ts
- apps/desktop/tests/main/reserved-payload-service.test.ts

## Forbidden Files
All other application files, real credentials, production WinCred writes, existing databases, archived evidence, other worktrees, main, remote operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
The vault port creates a key at the journal-reserved opaque reference without overwriting any existing value and reads it back. A new service reserves first, verifies vault write/readback, marks the key STORED, persists the authenticated payload using the same reference and marks LINKED only after exact durable binding. Failure at any boundary never causes automatic retry or deletion. Recovery is an observation only. Review revision: each vault call has a 10-second deadline; a maximum of four underlying calls remain outstanding process-wide, including timed-out calls until they actually settle. A timeout does not imply cancellation or permit redispatch.

## Data Constraints
Only encrypted payload and nonsecret journal metadata enter SQLite. User plaintext and key bytes never enter logs, arguments, SQLite or files. The injected vault is a test double only; no production binding is provided. Empty, oversized and malformed Unicode inputs fail before reservation or vault calls.

## UI Constraints
No renderer, product UI, Proposal execution, Grant or Attempt wiring.

## Implementation Requirements
Use the existing reservation journal and AES-GCM store without bypassing their scope or owner checks. Validate vault references and readback. Clear temporary key buffers where practical. If a vault write or confirmation is uncertain, mark UNCERTAIN when authority permits; otherwise preserve the previous durable state. If SQLite payload commit succeeds but journal linkage fails, preserve the payload and report a reconcilable state. Never generate a replacement key or delete a vault entry.

## Test Requirements
Use TDD, real SQLite and an explicit test-only vault to verify successful roundtrip, one write for duplicate requests, wrong or missing key readback, write failure after effect, revoked authority, crash-equivalent unlinked payload, tampering and restart observation. Test a hanging vault and late completion, and enforce the process-wide outstanding-call bound. Run affected tests, lint, typecheck, build and required governance gates.

## Acceptance Criteria
The payload reference equals the originally reserved key reference; duplicate requests cannot create another key; uncertain or interrupted states cannot lead to automatic retry. All vault effects and failures are surfaced without exposing secrets.

## Done Definition
Record commands, counts and remaining production blockers in this Task Pack. Do not claim real WinCred integration, H1 acceptance or merge readiness.

## Risks
A test vault does not prove that Windows Credential Manager can implement create-if-absent across noncooperating processes. Provider identity, crash cleanup, actual credentials accidentally entered as text and existing plaintext migrations remain separate blockers.

## Output Required
A test-only-integrated orchestration module, focused failure tests and one Task Pack evidence record.

## Local development evidence (2026-11-22)

- The service suite initially failed because the orchestration module was absent. The integrated test exercises real SQLite and AES-GCM with a test-only vault; duplicate requests, lost write responses, invalid input, readback mismatch, authority revocation, unlinked commit, reopen and ciphertext tampering are covered.
- Independent security review found borrowed-buffer corruption and unbounded hanging vault calls. Regression tests reproduced both, followed by fixes that copy borrowed buffers and retain a process-wide bound on outstanding calls after caller timeouts. Thirteen focused service tests passed, including late rejection, capacity recovery after settlement and read timeout.
- Ruling: if capacity is exhausted after a reservation is created, the journal conservatively records UNCERTAIN even if no vault call began. This avoids unsafe implicit retry but can strand that record until a later explicit recovery mechanism exists. A permanently hung underlying operation continues to occupy capacity.
- Timeout does not cancel a vault operation, and late effects remain uncertain. No automatic retry or deletion is performed. Production WinCred provider, secret-input isolation, crash-safe orphan handling, integrated Proposal execution, real Codex and Electron sandbox remain unverified or deferred.
- After the review fixes and added tests, lint and typecheck exited 0; build exited 0 on the same implementation before test-only additions. Full unit exited 0: 172 files, 673 passed, 7 skipped (six PostgreSQL-dependent cases and the opt-in real WinCred probe, which TASK-806 ran separately). Remote CI was not run.
