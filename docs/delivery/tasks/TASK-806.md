# TASK-806: Windows Credential Manager bridge probe

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User approved encrypted content with Windows Credential Manager keys and autonomous continuation.

## Requirement IDs
REQ-090, REQ-092, REQ-094, REQ-095, REQ-098, REQ-099

## Objective
Implement and validate an isolated native Windows Credential Manager bridge probe with strictly synthetic, uniquely scoped test credentials. This is not production key management or Proposal execution.

## Context Pack
- docs/delivery/tasks/TASK-804.md
- docs/delivery/tasks/TASK-805.md
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
- docs/delivery/tasks/TASK-806.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/security.md
- docs/operations.md
- apps/desktop/tests/native/wincred-probe.ps1
- apps/desktop/tests/native/WinCredProbe.cs
- apps/desktop/tests/main/wincred-native-probe.test.ts

## Forbidden Files
All other application files, existing databases, archived evidence, other worktrees, main, remote operations, actual credentials, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
The isolated test probe uses Windows CredReadW, CredWriteW and CredDeleteW for a single fresh per-run target under SuperAssistant/TestProbe/ with a random 256-bit suffix. It creates a synthetic random 32-byte value in memory, verifies it via native read, detects an existing target before writing, and removes only the exact credential that this test demonstrably created and whose value still matches. Secret bytes are never sent in arguments, SQLite, files or output.

## Data Constraints
No production credential is listed, read, created, overwritten or deleted. Cleanup is attempted only for the exact generated test target after successful creation and matching readback; a changed or unverified value is preserved and reported. No broad credential enumeration. Avoid logging target secret bytes.

## UI Constraints
No UI, renderer access, user-goal persistence, Grant or Attempt.

## Implementation Requirements
Native fixture runs only on explicitly enabled Windows test invocation, not as a production provider or normal CI. Use P/Invoke WinCred and CredFree, strict target validation, in-memory cryptographic random values and explicit resource cleanup. Never claim check-then-write is atomic against noncooperating same-user processes. Native cleanup requires matching bytes and fails closed.

## Test Requirements
First add a failing test of the probe contract; then implement and run an explicitly enabled Windows test using only a disposable synthetic key, proving create/read/duplicate rejection and exact cleanup. Negative cases reject wrong target namespace and demonstrate no delete for wrong proof. Run governance, lint, typecheck and affected unit tests; full unit, contract and remote CI must be marked according to real results.

## Acceptance Criteria
The real Windows test shows successful create/read/duplicate rejection and exact synthetic cleanup with no leaked bytes. Missing logon credential set or sandbox access is BLOCKED, not PASS. The test must not alter production credentials.

## Done Definition
Record actual commands, exit codes and remaining risks in this Task Pack. Do not declare production broker, encrypted Proposal integration or merge readiness.

## Risks
CredWrite replaces an existing matching target and check-then-write is not atomic across malicious or noncooperating same-user processes. Test-only namespace and randomness reduce collision risk but do not supply a production create-if-absent primitive. SQLite and WinCred have no shared transaction; production needs coordination, identity validation and orphan reconciliation.

## Output Required
An auditable native API probe, disposable integration test, and a single Task Pack evidence record.

## Local evidence (2026-11-22)

- The default negative namespace test first failed because the fixture was absent; the implemented fixture's sandbox invocation was then rejected by Windows AuthorizationManager. The same read-only validation passed outside the sandbox without changing execution policy.
- With explicit SA_RUN_WINCRED_PROBE=1 and a predetermined nonsecret random test ID, the isolated Windows invocation returned exit 0: 2 tests passed, 0 skipped. The self-test verified synthetic create, readback, duplicate refusal, wrong-proof refusal, exact-match deletion and subsequent absence. No real credentials were enumerated or read. The unique test target is recorded in the command audit transaction task-806-command-001.
- A second independent synthetic target was used after strengthening the wrong-proof check to reread and verify the credential still matched before cleanup; 2 tests passed again and exact cleanup completed. Its nonsecret target and completed command are recorded as task-806-command-002.
- lint, typecheck and build exited 0. The first full-unit run failed one Git worktree test at 15.4 seconds against its unchanged 15-second limit while the documentation gate was running in parallel; the isolated test then passed in 4.3 seconds after the scan ended. The full run in the quieter environment passed 171 files, 660 tests, with 7 skipped: six PostgreSQL-dependent cases plus the explicitly gated native write test, which was separately run twice as described above. Resource contention is a plausible explanation, not a proven sole root cause. Git timeout limits were not changed.
- This is an explicitly enabled test fixture, not an installed or production WinCred bridge. The test result does not establish atomic create-if-absent against noncooperating processes, crash-safe cleanup, key backup or production Proposal integration. The Electron sandbox and real Codex remain deferred.
