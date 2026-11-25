# TASK-847: Protected credential and owned Attempt integration

## Status
IN_PROGRESS
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: the user authorized continuous desktop credential, execution and original-Attempt recovery work; real Codex and Electron sandbox-security validation remain deferred.

## Requirement IDs
REQ-021, REQ-023, REQ-027, REQ-031, REQ-033, REQ-038, REQ-049, REQ-090, REQ-094, REQ-095, REQ-097

## Objective
Exercise the existing protected Proposal and original Attempt against an actual in-process Windows Credential Manager test-namespace binding and the in-process Windows Job owner, using a disposable Git Project and fake App Server. Prove a database reopened within the same process reads the original authenticated receipt and never creates a replacement Attempt. This is not proof of application-process restart recovery and does not enable production dispatch.

## Context Pack
- docs/delivery/tasks/TASK-845.md
- docs/delivery/tasks/TASK-846.md
- docs/decisions/ADR-008-protected-task-content.md
- docs/api/sai.md

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
- docs/delivery/tasks/TASK-847.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/orchestration.md
- apps/desktop/tests/main/protected-approval-execution.test.ts
- .github/workflows/application-gates.yml

## Forbidden Files
All other repository files, real user credentials and Projects, production credential namespace, real Codex, Electron sandbox-security validation, production IPC activation, merge and release.

## Interfaces / Contracts
Use WindowsNativeVault with the SA_WINCRED_TEST addon, the existing protected authority, encrypted Proposal store, original Attempt, InProcessOwnerTransport and fake App Server. Native consent is simulated and must be described as such. Missing credentials or ambiguous outcomes fail closed; UNKNOWN/RECONCILING cannot redispatch or release a Lease.

## Data Constraints
Only generated TestAddon credentials may be created. Track the exact randomly generated references and matching key bytes in test memory, clean each exact matching test credential, clear test buffers, and never print secrets. Use disposable repositories and isolated SQLite. Production credentials, paths and user data must not be inspected.

## UI Constraints
No renderer-exposed credential, process identity, confirmation or production execution route is enabled. This task cannot claim real native approval or H1 acceptance.

## Implementation Requirements
Write the integration test before making any supporting change. Use the real Windows test binding rather than an in-memory vault for protected storage and receipt recovery. Exercise confirmation, one Attempt, isolated worktree, fake App Server, cancellation, retained Lease and restart reconciliation using that same Attempt. Check authenticated content is absent in serialized SQLite and credentials remain in the synthetic namespace. Preserve uncertainty if the owner result or cleanup is not proven.

## Test Requirements
Run the new Windows integration on a synthetic credential, existing protected execution and native owner tests, lint, typecheck, build, full CI-aligned unit and contract tests, desktop functional tests and governance. The CI job must execute the integration with no silent skip on Windows. Real Codex and Electron sandbox-security tests are deferred.

## Acceptance Criteria
The exact same original Attempt and encrypted receipt survive reopen using the real test-namespace Credential Manager vault. No plaintext goal or key appears in SQLite. Process-tree stop is observed but remains unverified for production Lease release; the Lease remains active and recovery does not redispatch. All synthetic credentials are cleaned by exact reference and matching key.

## Done Definition
Record actual commands, counts, local evidence and candidate CI. Do not claim that the simulated consent is a real UI review, that the test namespace establishes trusted installation, or that production H1 or merge acceptance is complete.

## Risks
Credential Manager has no transaction with SQLite; crashes may leave synthetic credentials and require exact-match cleanup. Windows Job membership is not filesystem/network confinement. A real credential integration test does not establish trusted signed packaging or native UI approval.

## Output Required
Integrated Windows credential, encrypted Proposal, fake execution and recovery regression with precise evidence and explicit remaining production gates.

## Local evidence (candidate CI pending)

- The first integration attempt failed because its objective did not match
  the fake server's fixed fixture input; it preserved UNKNOWN and its Lease.
  With the fixture input corrected, the real TestAddon credential, owned fake
  server, isolated worktree, cancellation and same-process database-reopen
  test passed and cleaned its matching synthetic credentials.
- Independent static review identified missing exact-test CI enforcement and
  a cleanup path that could skip credential cleanup. The workflow now requires
  exactly one passed named integration; resource cleanup uses nested finally
  blocks and attempts each matching credential cleanup independently. Review
  found no remaining confirmed critical or important issue. Forced process
  death can still leave a test credential, and is not a proven cleanup case.
- Windows full unit: 186 files, 1,172 passed and nine explicitly allowed skips;
  the exact named integration passed once. Contract: 50 passed, zero skipped.
  Lint, typecheck, Windows production build, native owned-tree and I/O stress,
  isolated Electron functional 2/2 and browser 9/9 passed locally.
- Consent and effect confinement in this fixture are simulated. The SQLite
  backup is reopened in the same process using the same vault instance; this
  does not establish application-process restart recovery or production IPC.
  Candidate CI and all production activation gates remain outstanding.
