# TASK-839: Stage real local goal drafts as protected Proposals

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authority: user authorized continuous work on immutable Proposal confirmation and fake App Server execution; real Codex and Electron sandbox security verification remain deferred.

## Requirement IDs
REQ-020, REQ-021, REQ-022, REQ-024, REQ-025, REQ-027, REQ-028, REQ-031, REQ-090, REQ-095, REQ-098

## Objective
Connect a real main-process LocalGoalDraft to encrypted storage and authenticated protected authority registration, and prove the resulting original Attempt through native-consent and fake App Server integration without enabling the production route.

## Context Pack
- docs/delivery/tasks/TASK-823.md
- docs/delivery/tasks/TASK-838.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-839.md
- docs/delivery/tasks/TASK-838.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- apps/desktop/src/main/protected-proposal-intake.ts
- apps/desktop/src/main/protected-proposal-registry.ts
- apps/desktop/tests/main/protected-proposal-intake.test.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts

## Forbidden Files
Other repository files, real user projects or credentials, production route activation, migration 033 registration, real Codex, Electron sandbox security validation, merge and release.

## Interfaces / Contracts
The main-only intake accepts a local draft ID, not caller-supplied Proposal content, path, identity or approval. It asks the real LocalGoalDraft for the exact current immutable Proposal, stores it only encrypted, rechecks the same draft after vault work, and registers its authenticated envelope. Registry matching compares the independently authenticated Proposal to the captured draft as an additional rejection constraint; caller-supplied content is never treated as authentication or approval. Identical completed staging is idempotent; duplicate concurrent calls do not create two keys. Uncertain or partial reservation states are preserved and never automatically recreated. A draft discarded while registry authentication is already in flight may leave an encrypted registered identity even though intake returns failure; this is not approval, and no production caller may infer successful staging from the record's existence. Staging does not authorize or dispatch; native confirmation and execution still independently revalidate current authority.

## Data Constraints
Use only disposable SQLite/Git projects, synthetic vaults and fake App Server processes. User goal or criterion must not appear in SQLite plaintext, logs or errors. No secrets are stored in repository files.

## UI Constraints
No UI or IPC wiring and no production execution activation until trusted vault and process ownership are proven.

## Implementation Requirements
Write failing tests first. Reuse LocalGoalDraft, encrypted Proposal storage, reservation journal and TASK-838 registry. Check scope, current draft and exact decrypted Proposal before registration. Cover same-process concurrent staging, retry of an already-linked identical payload, stale draft after key creation and uncertain vault results without retry. Exercise the resulting exact Proposal through the protected native-consent boundary and original Attempt with a fake App Server; preserve UNKNOWN and Lease when process outcome is uncertain.

## Test Requirements
Run targeted real-SQLite/temporary-Git tests, native-consent and fake execution regressions, lint, typecheck, build, full unit and contract tests, and governance. Independent security review is required. Real Codex and sandbox tests remain excluded.

## Acceptance Criteria
An unchanged real LocalGoalDraft stages one exact encrypted Proposal and one protected binding even with repeated requests; stale or uncertain staging cannot create authorization or repeat external key creation. The fake integration retains one original Task/Attempt and the required Lease on uncertainty. No plaintext goal appears in SQLite.

## Done Definition
Record local and remote CI evidence and remaining integration limitations. Do not declare H1, production execution or merge acceptance.

## Risks
The main process and supplied vault remain part of the trust boundary. Asynchronous Git, clock and authority can change after staging; no staged record is authorization or process ownership. Existing ambiguous key writes require separately evidenced recovery.

## Output Required
Protected draft-intake component, real integration and negative tests, synchronized facts and exact evidence.

## Local evidence
A real LocalGoalDraft now stages through encrypted storage and the protected
registry, then a synthetic native-consent boundary and fake App Server reach
the same original Attempt. A lost reply leaves that Attempt UNKNOWN with its
Lease ACTIVE. Repeated and concurrent staging created one key/binding; stale
draft and uncertain vault-write cases did not create a Grant or repeat key
creation. Goal and criterion were absent from serialized SQLite.

Independent review identified a valid-ciphertext replacement between draft
recheck and registration; the new regression failed before authenticated
registry-to-draft matching and passed afterward. It also confirmed that a draft
discarded during registry authentication may leave a binding despite a failed
result; the test asserts this explicitly and confirms no Grant or Attempt.
No production route may infer success from such a binding. A second read-only
review found no remaining confirmed critical or important issue within scope;
the reviewer did not run tests.

After the final code changes: build, lint and typecheck passed; real Electron
tests 2 passed, browser E2E 9 passed, host unit 1137 passed with 9 skipped,
and contract 50 passed. The shared Electron database hash remained unchanged.
Skips are not PASS evidence. The real desktop tests cover discovery and review,
not this unconnected production intake. No real Codex, sandbox security,
process ownership, Lease release, H1 acceptance or merge was verified.
For commit `3d1389fa5d388d587016d46cae39732d202696cc`, GitHub documentation
run 45254342652 passed and application run 45254342539 passed both Windows
and PostgreSQL 16 jobs. These checks do not establish full H1 acceptance.
TASK-840 subsequently addresses the pre-commit invalidation race; post-commit
invalidation remains possible and is not evidence of approval.
