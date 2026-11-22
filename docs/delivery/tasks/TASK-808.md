# TASK-808: Native Windows protected-key vault

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User approved Windows Credential Manager key storage and continuous independent implementation toward merge readiness.

## Requirement IDs
REQ-021, REQ-023, REQ-027, REQ-090, REQ-092, REQ-094, REQ-095, REQ-098, REQ-099

## Objective
Implement an isolated Windows Credential Manager vault compatible with ReservedVault, including a native helper and bounded Node process transport, then verify with synthetic credentials. Do not wire the desktop execution entry point until executable provenance and reconciliation are proven.

## Context Pack
- docs/delivery/tasks/TASK-804.md
- docs/delivery/tasks/TASK-805.md
- docs/delivery/tasks/TASK-806.md
- docs/delivery/tasks/TASK-807.md
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
- docs/delivery/tasks/TASK-808.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/security.md
- docs/operations.md
- apps/desktop/src/main/windows-credential-vault.ts
- apps/desktop/native/WinCredBridge.cs
- apps/desktop/tests/main/windows-credential-vault.test.ts
- apps/desktop/tests/native/wincred-bridge-integration.ps1

## Forbidden Files
All other application files, production credentials, production WinCred namespace, existing databases, archived evidence, other worktrees, main, remote operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
The vault exposes create(keyRef) and read(keyRef), requiring pkey- plus 64 lowercase hexadecimal characters. Only references cross command arguments; 32 key bytes cross private stdout pipes, never text logs. The native helper returns distinct statuses for missing, existing and error. Create checks existence under a named mutex shared by cooperating helpers and never intentionally overwrites. Callers treat uncertain result as non-retryable. A test-only compile flag uses a separate synthetic credential namespace and permits exact-match cleanup; production code contains no deletion command.

## Data Constraints
Key bytes and real credentials never enter SQLite, filenames, arguments, environment variables, stdout logs or repository files. Synthetic integration writes only a pre-recorded unique test namespace target and cleans only its own exact matching entry. Helper error output is fixed and sanitized. No general credential enumeration.

## UI Constraints
No renderer, product UI, Proposal execution, Grant or Attempt wiring.

## Implementation Requirements
Native helper validates the entire reference and operation, generates cryptographically random per-record 32-byte keys, handles missing as distinct from other WinCred errors, frees native buffers and uses cooperating cross-process serialization. The Node main-process vault validates references, limits output to 32 bytes, bounds process lifetime, wipes owned temporary buffers on failure and rejects malformed responses. Its path and SHA-256 must match configured expected values before spawning. Do not assert this hash check proves provenance or prevents path replacement. Production activation remains disabled.

## Test Requirements
Use red-green unit tests for invalid reference, malformed output, duplicate, missing, process errors, timeout and secret redaction. Compile the actual native helper in test mode and explicitly opt in to a Windows synthetic integration: create/read/duplicate/cleanup without touching other credentials. Test identifiers and action are recorded before side effects. Run lint, typecheck, build and applicable governance and unit/contract checks.

## Acceptance Criteria
The Node vault can use the native protocol without exposing key bytes to logs, invalid input never starts a helper, duplicate create is refused, and missing reads return null. A synthetic Windows integration must prove native behavior and exact cleanup. No product entry point is enabled.

## Done Definition
Record actual evidence, limitations, and independent security review. Production activation, bundled-helper provenance and recovery are separate prerequisites; do not claim merge readiness or H1 acceptance.

## Risks
CredWrite has no atomic create-if-absent against noncooperating same-user writers. Named mutex only coordinates cooperative helpers. Path hashing followed by process launch is vulnerable to replacement; signing/ACL/identity protection and OS confinement remain required. SQLite and WinCred do not share transactions. Test cleanup is exact-match only and crash can leave the explicitly identified synthetic entry.

## Output Required
Native helper, isolated Node vault, tests, explicit evidence and remaining activation blockers.

## Local evidence and remaining blockers (2026-11-22)

- Test-first vault cases initially failed because the module was absent. A real Windows synthetic test then exercised native helper selftest and Node vault → process transport → native helper → Credential Manager → Node; duplicate creation was rejected and both explicitly recorded synthetic credentials were confirmed removed. The final invocation passed 11 tests, zero skipped; exact nonsecret targets are recorded in task-808-command-003.
- Independent security review identified unbounded file reading, pipe error/late-output handling and late helper launch after preflight timeout. The implementation now hashes through a fixed-size buffer and file handle, waits for child close after termination requests, clears late output, and checks a seven-second preflight deadline before launch. Focused regression cases cover those boundaries.
- A stalled OS file operation or child that does not close can still remain outstanding. The parent TASK-807 coordinator stops waiting after ten seconds and retains its capacity slot until the underlying call actually settles; this is not proof of cancellation or process termination.
- Follow-up review identified wall-clock rollback as a late-launch risk. The seven-second preflight cutoff now uses monotonic time; a regression test simulates clock rollback and a delayed preflight. Native read additionally clears its unmanaged 32-byte copy before CredFree. The final native/Node synthetic integration was rerun: 11 passed, zero skipped, with both test targets removed (task-808-command-004).
- A late successful vault call can still return an owned key buffer after TASK-807 has timed out. The coordinator currently cannot distinguish owned from borrowed vault buffers for safe cleanup; this is a known unresolved production blocker and requires a separately scoped ownership-contract change.
- After the final native and monotonic-clock changes, lint, full workspace typecheck and production build exited 0. Full unit exited 0: 173 files, 682 passed, 9 skipped (six PostgreSQL-dependent cases, one TASK-806 opt-in test and two TASK-808 opt-in tests; the three native tests were run explicitly in their task evidence). Remote CI remains unrun.
- The actual integration uses a separately compiled test namespace. Production helper packaging, executable provenance/ACL and TOCTOU protection, noncooperating same-user writers, crash recovery/orphan handling, secret-input isolation and Proposal integration are not proven. Real Codex and Electron sandbox remain deferred.
