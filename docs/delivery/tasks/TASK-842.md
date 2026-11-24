# TASK-842: Bind goal staging to protected native confirmation

## Status
IN_PROGRESS
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authority: user authorized continuous implementation of immutable Proposal confirmation and original Attempt with fake App Server, with real Codex and Electron sandbox security verification deferred.

## Requirement IDs
REQ-020, REQ-021, REQ-022, REQ-024, REQ-025, REQ-027, REQ-031, REQ-090, REQ-092, REQ-093, REQ-095, REQ-098

## Objective
Compose a real main-owned goal draft, encrypted staging and native protected confirmation into one bounded command that returns the original queued Attempt. Invalidation of the draft before authorization commits must prevent a new Grant or Attempt.

## Context Pack
- docs/delivery/tasks/TASK-823.md
- docs/delivery/tasks/TASK-839.md
- docs/delivery/tasks/TASK-840.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/api/sai.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-842.md
- docs/delivery/tasks/TASK-840.md
- docs/delivery/tasks/TASK-841.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- apps/desktop/src/main/protected-goal-authorization.ts
- apps/desktop/src/main/protected-proposal-authority.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts
- apps/desktop/tests/main/protected-proposal-authority.test.ts

## Forbidden Files
All other repository paths, production route or migration 033 activation, real user databases or credentials, real Codex, Electron sandbox security verification, merge and release.

## Interfaces / Contracts
The composed main-only command accepts only a draft ID. It derives the exact scoped encrypted Proposal through the existing intake and invokes fixed native consent through the existing authority. A genuine main-owned LocalGoalDraft must still contain the identical live Proposal inside the authorization transaction and during replay. The guard is an additional rejection condition, never authentication or approval. An unguarded existing authority API cannot satisfy a guarded pending request. No dispatch, renderer-supplied consent, or Lease release is introduced.

## Data Constraints
Use only disposable Git Projects, synthetic vault keys and SQLite databases. Never persist plaintext goals or secrets in control-plane records. Preserve uncertain key reservations and the original Attempt.

## UI Constraints
No production IPC or renderer route is enabled before trusted production vault and process ownership are proven. Native consent remains the fixed main-owned implementation; tests may substitute its module boundary only.

## Implementation Requirements
Write failing integration tests first for exact staging and native confirmation, duplicate concurrent requests, rejection when a draft is discarded during review, and stale or invalid input. Reuse existing authenticated authority and keep duplicate or competing calls fail-closed. Never infer authorization from the mere existence of a protected binding.

## Test Requirements
Run targeted SQLite/Git/fake-server tests, build, lint, typecheck, full CI-aligned unit and contract suites, real Electron functional and browser E2E, governance and security review. Real Codex and sandbox-security validation remain deferred.

## Acceptance Criteria
A live exact draft receives native confirmation and creates exactly one queued original Attempt and Grant; dismissing or invalidating it before the final transaction creates neither. Repeated concurrent requests cannot create duplicate Attempts. No renderer-controlled scope, approval callback, or fabricated process-ownership evidence is accepted.

## Done Definition
Record actual verification and review results, skipped tests, CI and remaining production blockers. No claim of integrated H1 or merge acceptance.

## Risks
This prepares but does not activate production execution. Same-process compromise, trusted vault provenance, process ownership, worktree confinement, cancellation and terminal recovery remain separate gates.

## Output Required
Composed protected goal authorization, tests, synchronized facts, and verification evidence.

## Working-candidate verification
The composed goal command uses a real LocalGoalDraft, encrypted staging,
synthetic vault and fixed native-consent module boundary. Concurrent requests
produce one Grant and original Attempt. The fake App Server test begins with
this command and retains the same Attempt as UNKNOWN and Lease ACTIVE after a
lost reply. Native review is substituted in this test, and neither production
dispatch nor trusted custody is asserted.

The initial guarded command created an Attempt when the draft was discarded
during consent. The regression failed before the transaction guard and passed
after it. Independent review found that completed unguarded approvals could be
replayed as guarded and that a lease-update trigger could invalidate a draft
during guarded replay. Both real-SQLite regressions failed first and passed
after requiring bounded, same-instance guarded-origin evidence and rechecking
the draft after lease observation. The independent reviewer found no remaining
confirmed Critical/Important issue in scope. This memory-only evidence is
limited to eight entries and is lost on instance restart; rejection preserves
the existing Attempt and is not durable recovery.

A first attempted reentrancy test incorrectly assumed Lease acquisition called
the injected clock; it failed both before and after the guard. It was replaced
by an actual SQLite trigger that discards the draft during Grant insertion;
removing the final guard made that test fail, and restoring it passed.

On this working candidate, build, lint and typecheck passed; the full CI-aligned
unit run passed 1150 tests with 9 explicitly allowlisted skips; contract passed
50 with zero skips; real Electron functional tests passed 2, and browser E2E
passed 9. Shared Electron database SHA-256 remained
`9FD7F1298ED1F7184C11FAD6FB985510A36F08575AC033EA06C8014FC1B85215`.
Remote CI for this uncommitted candidate is not yet available. Native sandbox
security and real Codex are deferred; trusted production vault and process
ownership, running cancellation, production IPC and H1 acceptance remain open.

Governance on the working candidate: links passed for 399 Markdown files,
all 189 Task Packs passed, traceability and five schemas passed, TASK-842
Goal runtime returned Exit 0, 41 governance unit tests passed and
`git diff --check` returned 0. The changed and untracked paths were compared
with the explicit allowlist. Host versions include Node 22.23.2, Python 3.9.12
and Git 2.56.0.windows.4. CI evidence remains tied to candidate commit only
after that commit is pushed and its own runs complete.
