# TASK-848: Read-only protected Attempt observation

## Status
IN_PROGRESS
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: the user authorized continuous implementation of original-Attempt recovery; real Codex execution and Electron sandbox-security verification remain deferred.

## Requirement IDs
REQ-027, REQ-032, REQ-038, REQ-049, REQ-090, REQ-093, REQ-095, REQ-097

## Objective
Add a main-only read-only recovery coordinator that authenticates a protected receipt, enters RECONCILING on that original Attempt, and queries an existing read-only App Server client for an observation of the original execution. A provider observation is not proof of process-tree termination, terminal completion or permission to release a Lease.

## Context Pack
- docs/delivery/tasks/TASK-846.md
- docs/delivery/tasks/TASK-847.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/decisions/ADR-008-protected-task-content.md

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
- docs/delivery/tasks/TASK-848.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/orchestration.md
- apps/desktop/src/main/protected-attempt-observer.ts
- apps/desktop/src/main/protected-proposal-authority.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts
- packages/codex-adapter/src/index.ts
- .github/workflows/application-gates.yml

## Forbidden Files
All other repository files, real user credentials or Projects, production credential namespace, real Codex, Electron sandbox-security tests, production IPC activation, Lease release, terminal Attempt transitions, merge and release.

## Interfaces / Contracts
The coordinator accepts an authenticated Proposal scope and an already initialized main-owned ReadOnlyAppServerClient, never a renderer-supplied process, thread, turn, account or path. The adapter package exports that internal class so main can require its instance without importing outside the package boundary; instance checking does not attest an untrusted main-process object. The authority supplies a scope-bound synchronous final check of the authenticated receipt, RECONCILING state and active Lease after the observation. The coordinator synchronously rechecks client readiness and the known principal at that boundary. Concurrent requests for the same scope must not cause extra dispatches or Attempts. Output is limited to non-authoritative observed status; upstream IDs and raw upstream payload are never returned to the renderer.

## Data Constraints
No plaintext goals, secrets, receipt internals, raw protocol frames or user credentials are logged or sent to the renderer. Tests use disposable Git Projects, fake App Server and synthetic credentials only. SQLite remains authoritative; no replacement Attempt, new Grant, write dispatch, Lease release or terminal state is created.

## UI Constraints
The coordinator is main-only and is not registered with production IPC in this task. Do not expose upstream Thread/Turn terminology in product UI.

## Implementation Requirements
Use test-first implementation. Validate exact scope and genuine read-only client; revalidate authenticated receipt and principal around asynchronous operations. Missing, malformed, changed, unavailable or unauthenticated evidence returns INDETERMINATE and retains UNKNOWN/RECONCILING. Fail closed if the read-only client is not ready, its account changes, or it cannot observe the original turn. Do not guess terminal state from disconnection or a provider response; do not release the Lease.

## Test Requirements
Use fake App Server with actual read-only client and real protected SQLite authority. Test same-Attempt completion observation, mismatched principal, unknown or malformed status, changed receipt during observation, concurrent calls, unavailable credentials, and no new Attempt or Lease release. Run lint, typecheck, build, full CI-aligned unit and contract suites, desktop functional tests and governance. Real Codex and Electron sandbox security remain deferred.

## Acceptance Criteria
Only an authenticated original protected receipt can be observed through a principal-matched read-only client; the exact original Attempt remains RECONCILING with its Lease active. Stale or uncertain evidence never produces a successful observation and never creates an external execution. Actual process restart, terminal state and production dispatch remain separate gates.

## Done Definition
Record commands, test counts, negative cases, static security review and candidate CI. No product-completion or merge claim is authorized by this task alone.

## Risks
The Codex API's observation is untrusted and may be stale. Client identity, executable provenance, OS confinement, process-tree death and authenticated durable terminal evidence are independent requirements. Returning an observation after authority changes would leak stale or misattributed state.

## Output Required
Main-only read-only recovery coordinator, tests, synchronized engineering facts, actual evidence and explicit remaining production gates.

## Local evidence (candidate CI pending)

- The initial real protected SQLite and fake read-only server test failed
  because the coordinator did not exist; an implementation then returned a
  non-terminal observation for the original Attempt, retaining its Lease.
- Independent security review found stale-result windows after asynchronous
  database and principal checks. The authority now supplies a synchronous
  receipt/snapshot, RECONCILING and ACTIVE-Lease check; the coordinator also
  rechecks client readiness and principal after all asynchronous operations.
- A subsequent red test showed that losing the test vault key during the
  provider query still produced an observation. The coordinator now freshly
  authenticates after the query; the same test then passed. Other cases cover
  account change, unsupported server, concurrent requests, receipt tampering,
  Attempt and Lease changes, unavailable credentials and a closed client. The
  tamper tests bypass triggers only in a disposable in-memory database.
- Lint, typecheck and Windows build passed. Full Windows unit gate: 186 files,
  1,173 passed, nine explicitly allowed skips; both named protected integrations
  passed exactly once. Contract: 50 passed, zero skips. Real Electron functional
  tests passed 2/2 and browser tests 9/9; neither validates sandbox security.
- The observation is point-in-time and non-authoritative. The code is not
  registered with production IPC, does not prove trusted client or installed
  binary provenance, effect confinement, process death or Lease expiry, and
  never marks an Attempt terminal, releases a Lease or creates a replacement.
