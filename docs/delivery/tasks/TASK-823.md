# TASK-823: Protected native approval and transactional execution authority

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authority: Standing user authorization to complete the encrypted Proposal, native confirmation, original Attempt and merge prerequisites.

## Requirement IDs
REQ-020, REQ-021, REQ-023, REQ-024, REQ-027, REQ-031, REQ-033, REQ-038, REQ-049, REQ-090, REQ-092, REQ-094, REQ-095, REQ-098, REQ-099

## Objective
Connect the existing complete Proposal review to protected durable authorization and one original Attempt without putting user goal or review plaintext into SQLite. Preserve fail-closed operation when trusted key custody, live authority or process containment is unavailable. Do not claim dispatch, cancellation or merge readiness until their own end-to-end gates are proven.

## Context Pack
- docs/delivery/tasks/TASK-820.md
- docs/delivery/tasks/TASK-821.md
- docs/delivery/tasks/TASK-822.md
- docs/decisions/ADR-008-protected-task-content.md
- docs/api/sai.md
- docs/orchestration.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-823.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/delivery/expansions.json
- .github/workflows/docs-gates.yml
- docs/security.md
- docs/data-model.md
- docs/operations.md
- docs/orchestration.md
- apps/desktop/src/main/protected-proposal-authority.ts
- apps/desktop/src/main/encrypted-proposal-store.ts
- apps/desktop/src/main/reserved-payload-service.ts
- apps/desktop/src/main/local-goal-draft.ts
- apps/desktop/src/main/immutable-proposal-confirmation.ts
- apps/desktop/src/main/protected-native-consent.ts
- apps/desktop/src/main/prompt-gate.ts
- apps/desktop/src/main/main.ts
- apps/desktop/tests/main/protected-proposal-authority.test.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts
- apps/desktop/tests/main/local-goal-draft.test.ts
- apps/desktop/tests/main/immutable-proposal-confirmation.test.ts
- apps/desktop/tests/main/protected-native-consent.test.ts
- apps/desktop/tests/main/prompt-gate.test.ts
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/sqlite/migrations/033-protected-execution.sql
- packages/persistence/src/repositories/execution-repository.ts
- packages/persistence/src/repositories/outbox-repository.ts
- packages/persistence/tests/protected-execution.test.ts
- packages/persistence/tests/migration-runner.test.ts

## Forbidden Files
Other paths, actual user databases or credentials, original project workspaces, archived evidence, other worktrees, real Codex execution, Electron sandbox verification, remote operations and merge.

## Interfaces / Contracts
The full immutable Proposal shown in the native main-owned review must be the one authenticated and authorized. No renderer-supplied success flag, digest alone, injected success callback, informational authority check, or transient UI state is authorization. Validate Workspace owner, exact protected envelope and reservation, Project/Agent/Function versions, baseline and time before presenting and again at the last transaction boundary. Serialize duplicate confirmation and atomically persist one Grant, one Task, one required WorkItem, one Attempt, its fenced Lease and pending Outbox record. Do not redispatch UNKNOWN or RECONCILING. Protect user content and any sensitive content-verification material in SQLite; preserve legacy records and SAI wire SHA-256 compatibility. When a safe persistent verifier or trusted native key custody cannot be proven, fail closed; do not fall back to plaintext.

## Data Constraints
Use disposable databases and synthetic vaults only for tests. Never manipulate existing credentials or user data. Keep all asynchronous decryption, Git and native review outside SQLite transactions; revalidate their exact captured evidence inside an immediate transaction, rolling back all state on mismatch. Maintain idempotence and prevent secret or goal text from appearing in control-plane tables, logs or errors. Failure after an external effect is unknown, never silently retried.

## UI Constraints
Native review remains main-owned, bounded, escaped and shows the entire approved immutable Proposal. A UI success must not claim dispatch or completion when only a Grant/Attempt was recorded. No real Electron sandbox verification in this task.

## Implementation Requirements
Design and test a versioned protected authorization binding and trusted issuer; preserve legacy behavior and migration/backup compatibility. Bind exact authenticated Proposal and context to native consent. Enforce current authority at issue and consumption, including one-Grant/one-Attempt and fencing. Connect existing desktop path only when trusted production key custody and process ownership are verifiable; otherwise return truthful unavailable state while keeping approved capability work usable in tests. Review follow-on dispatch and recovery against the same original Attempt, not a new Task or Attempt.

Trusted-composition amendment: the public confirmation operation accepts only the scoped Proposal identity. Native presentation and Git HEAD observation are fixed imports inside the main-process implementation; the renderer and caller cannot supply callbacks, success booleans or a baseline. Native review must be followed by a separate explicit confirmation, attached only to the exact trusted main window. Tests may substitute module boundaries in the test process, never through a production test factory. Record project canonical path and row version before asynchronous work and compare them at the transaction boundary. This does not eliminate Git TOCTOU, prove production sandbox or supply missing WinCred provenance; do not register migration 033 or activate the product route yet.

Prompt-safety amendment: protected approval, Decision, queued cancellation and legacy review use the same main-process gate through the final database transaction. Identical-scope in-flight requests use a canonical field-order key; different instances or scopes fail closed while any prompt is active. The existing prompt-gate implementation and its exact test file are in scope for this integration.

Durable-integrity amendment: after native approval, authenticate the exact Proposal AES-GCM envelope using its reserved key, derive a distinct versioned MAC key via HKDF-SHA256, and authenticate a length-prefixed typed record containing the complete immutable approval and execution identity. Replays and future dispatch must reauthenticate the envelope, recompute the tag and compare in constant time after capturing and transactionally revalidating the same rows. Missing keys, stale snapshots and tag mismatches fail closed. This protects only against modification by an actor without the vault key; it is not proof of human understanding, a trusted clock, process ownership, or whole-database rollback resistance. No production dispatch may be enabled until those separate gates pass.

The internal pre-dispatch verifier must only authenticate an existing pending original Attempt; it must never open a native prompt, issue another Grant, create a Task or infer authority from a missing record. Its success is a point-in-time check, not permission to skip the later fenced dispatch transaction or process-ownership checks.

The isolated pre-dispatch claim must authenticate the protected binding and revalidate the same captured facts, Attempt state, lease and fencing token in the same immediate transaction that claims the pending outbox record. A duplicate claimant, changed authority, expired lease, conflicting resource, UNKNOWN or RECONCILING state must not create an external effect. A successful claim alone does not launch an adapter, prove process ownership, or enable migration 033 in production.

Authorized narrow expansion: the legacy generic Outbox claimant must never claim a message bound to protected execution. Databases upgraded through migration 031 but without migration 033 remain compatible; a database missing the identity registry must fail closed until migrated. Legacy identity must be checked in both selection and conditional mutation so an intervening scope change cannot bypass it. Protected messages remain pending for their authenticated claimant and must not starve eligible legacy messages. Verify using the existing protected authority test file and the existing Outbox regression suite.

When the private owner of a protected outbox claim loses certainty, it may atomically quarantine only that matching original Attempt and claim token: Outbox becomes RECONCILING and Attempt becomes UNKNOWN, while the Lease remains held. Missing, stale or foreign claims must change nothing. This transition is not evidence of process termination or permission to retry; an authenticated recovery observation remains a separate prerequisite.

## Test Requirements
TDD with real SQLite and synthetic vault/native-review doubles: successful end-to-end authenticated approval; denial and dismissal; changed ciphertext, reservation, Project, Agent, Function, baseline, owner or timestamp across asynchronous boundaries; duplicate and concurrent confirmation; crash/reopen; Grant replay; same-id differing content; SQLite plaintext/secret scans; legacy compatibility and migration rollback. Run lint, typecheck, build, full unit/contract, and governance. Real Codex and Electron sandbox remain deferred.

## Acceptance Criteria
One exact native-approved protected Proposal creates at most one original Attempt with a correctly fenced Lease and durable Outbox, and failures create none. Sensitive user text and recoverable keys never appear in SQLite or logs. No unavailable trust boundary is represented as a successful live execution. Record actual evidence and remaining production gaps.

## Done Definition
Record commands, counts, independent security review and limitations. Do not mark merge-ready unless all applicable merge gates are satisfied.

## Risks
SQLite cannot transact with Windows Credential Manager, native review, Git or process launch. Complete database rollback and hostile same-user compromise are outside ADR-008; expiry, missing keys, uncertain effects and race windows must still fail closed.

## Output Required
Versioned protected authorization and original-Attempt implementation, integration tests, current fact updates and scoped evidence.

## Work in progress
 The isolated real-SQLite prototype now creates the protected Grant, Task, original Attempt, Lease and pending Outbox atomically and checks replay evidence; targeted tests use only synthetic vault/native-review and disposable databases. The public operation now accepts only a scope and fixes its Git and native-consent dependencies in main-process modules. Tests mock the native boundary; a disposable real Git repository independently exercises matching and changed baselines. A shared main-process prompt gate and explicit bound-window identity protect against concurrent or wrong-window consent. Migration 033 is a draft and is not registered or active: its binding is metadata, not proof of native consent, and direct database insertion must not authorize dispatch. Real Electron, WinCred provenance, process ownership, dispatch-time revalidation and integration gates remain unproven. Do not interpret this prototype as a completed or safe authorization path.

Local WIP evidence: the focused SQLite test file passed 38 tests, including 100 concurrent in-instance confirmations, two competing authority objects, reopen with the original Attempt, native-review denial and changed facts, time rollback, expired Lease watermark, Grant scope immutability and multiple replacement attacks. Lint and typecheck passed after correcting test-only lint errors. These are isolated tests, not a production integration, clean-SHA result, full-suite result or merge gate. The reviewer also identified the callback trust boundary, status/replay consistency and protected row replacement gaps; changes address the tested database and replay cases but have not received final independent review. No actual user database or credential was touched.

Earlier WIP regression before the trusted-composition changes: production build, lint and typecheck exited 0; full unit ran 179 files, 899 passed and 9 skipped; fake-service contract ran 49 tests, all passed. Later focused tests additionally cover native-window identity, callback rejection, shared prompt exclusion, sensitive WorkItem IDs in SQLite/WAL, and real disposable Git changes during review. These earlier full-suite results do not cover the latest patch, resolve the remaining provenance finding, or establish product acceptance; skips remain unverified.

Latest WIP evidence: after trusted-composition changes, the full unit suite ran 181 files with 926 passed and 9 skipped before the latest Lease trigger edits. The latest focused regression ran 70 tests and covers explicit native confirmation with simulated Electron, an actual disposable Git baseline and synthetic executable replacement, unchanged/expired Lease handling and rejection of renewal at or after the old expiry. Formatting characters are rejected in the rendered JSON; original control characters may instead be JSON-escaped. Independent review confirmed that SQLite alone cannot prove true time, native human consent, process ownership or a trustworthy database. Protected UNKNOWN/RECONCILING currently remains quarantined and cannot complete recovery; implementing evidence-backed recovery is still required. No real user database, Credential Manager entry, Codex execution or Electron sandbox was used.

Later WIP: the prototype computes a domain-separated HKDF/HMAC tag after authenticating the encrypted Proposal and verifies it before replay. Real-SQLite tests cover matching timestamp tampering, fence tampering, missing keys, asynchronous key read, expired-before-commit, invalid tag and vault failure without Lease-watermark mutation, plus rewritten executable context with a forged unkeyed digest. Independent review found the initial pre-verification watermark mutation; that defect was reproduced and corrected. On the patch before the final additional test, build/lint/typecheck passed, unit ran 181 files with 936 passed and 9 skipped, and fake-service contract ran 49 passed. The tag protects immutable fields against a database-only writer lacking the key; it cannot prove native consent, prevent whole-database rollback, protect mutable state from a writer who removes guards, or secure future dispatch. The draft MAC service is main-process internal and must not be exposed as a signing oracle to the renderer or plugins. Production enablement, actual sandbox, real Codex, WinCred provenance, process ownership and evidence-backed recovery remain unverified.

The new internal `verifyQueued` prototype authenticates an existing pending original Attempt without opening a prompt or creating authorization. Focused tests reject missing authorization and UNKNOWN state, and check the original ID is retained. This is not yet connected to a dispatcher, does not lock external files or processes, and does not authorize side effects; the most recent 78-test focused run includes these cases and disposable Git integration. Full-suite evidence above predates the new verifier and one additional test.

Later WIP adds an isolated atomic protected claim: MAC and authority are rechecked against the captured rows, the current Lease and fencing token are checked, unreleased overlapping project/worktree leases are rejected, and one pending outbox message is claimed inside the same immediate transaction. A new test first reproduced the failure to reject an expired but unreleased overlapping lease; the predicate was corrected to match the existing lease acquisition rule. The focused authority suite passed 74 tests. On Windows, a parallel sandboxed run failed 11 unit tests and one contract test: loopback and symlink access were denied, taskkill reported credential failure, and Git worktree tests timed out. After isolation and using the normal host environment, the six affected unit files passed 50 tests with one skipped; the full unit suite passed 944 with 9 skipped across 181 files, and the contract suite passed 49 across 8 files. Lint, typecheck and build also passed; these are WIP evidence, not clean-SHA acceptance. The protected claim is not wired to an adapter or main-process route and does not prove external process ownership, cancellation, recovery or production key custody. Migration 033 remains unregistered.

A subsequent focused run passed 75 authority tests, including a new test that changes the Project snapshot during the final asynchronous key read and verifies that no Outbox claim is made. The full-suite count above predates this additional test.

Subsequent isolated work adds claim-token-scoped UNKNOWN/RECONCILING quarantine without Lease release, and fixes several time-observation races discovered in independent review. Tests first reproduced clock rollback across claim transactions, expired conflicting leases, expiring Proposal issuance, and temporary Agent/WorkItem/Git/runtime changes; the focused SQLite suite passed 89 tests after the fixes. A host full unit run with default worker count failed 7 timeout tests and had one Vitest worker communication error under load; without changing timeouts or assertions, a two-worker full run passed 951 tests with 9 skipped before later source and test edits. A two-worker fake-service contract run passed 49 tests before those later edits. Latest typecheck passed, while full regression and final independent review remain pending. The quarantine covers only a claimed DISPATCH_PENDING Attempt: it does not prove that a process stopped, recover a running Attempt, or enable dispatch. The generic Outbox claimant does not enforce the protected MAC and must be isolated before migration 033 or protected dispatch can be activated. No merge readiness is claimed.

After a narrow audited scope expansion, the generic Outbox claimant now selects and mutates only records with matching LEGACY authority identities from migration 031. Tests reproduce the former protected-message bypass, verify that a protected queue head does not starve a Legacy message, and simulate a scope change between selection and mutation. Independent source review found no new issue in this filtering path; it did not execute tests. On the latest application patch, host unit tests with two workers passed 961 and skipped 9 across 181 files, and fake-service contracts passed 49 across 8 files. Lint, typecheck and build passed. The earlier default-worker timeout failure remains recorded above. These are working-tree results, not clean-commit or CI evidence. The protected native flow, worker containment, execution, cancellation and original-Attempt recovery remain unconnected; 033 remains unregistered.

Governance on this working patch: documentation link scan passed for 379 Markdown files; all 170 Task Packs passed structure checks; requirement traceability and all five Schemas passed; Goal-mode runtime verification with the TASK-823 start anchor returned Exit 0 with both permitted expansions in use; 38 governance unit tests passed; `git diff --check` passed and all 18 changed/untracked paths were in the exact allowlist. These checks do not establish integrated application acceptance or remote CI. Later edits require affected checks to be repeated.

An independent read-only review of the TASK-823 working patch found no substantiated Critical or Important defects within the isolated prototype scope; it did not run tests. The existing generic startup `recoverInterrupted` performs workspace-wide quarantine without establishing protected claim ownership; it is not an authenticated protected recovery mechanism and must be addressed before integrating protected dispatch. This record and any local WIP commit are preservation only, not Task/Phase acceptance, a clean-SHA validation, or merge authorization.
