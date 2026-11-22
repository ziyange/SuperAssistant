# TASK-795: Guarded App Server execution transport and original Attempt recovery

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: user requested fake App Server integration, trusted executable Function and original Attempt receipts without real Codex or sandbox smoke.

## Requirement IDs
REQ-021, REQ-027, REQ-031, REQ-032, REQ-033, REQ-049, REQ-090, REQ-098

## Objective
Implement an isolated one-shot App Server transport and original Attempt recovery boundaries without enabling unverified production execution.

## Context Pack
- docs/delivery/tasks/TASK-794.md
- docs/delivery/tasks/TASK-793.md
- docs/delivery/tasks/TASK-789.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-795.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/adapters/codex.md
- docs/data-model.md
- apps/desktop/src/main/codex-attempt-recovery.ts
- apps/desktop/tests/main/codex-attempt-recovery.test.ts
- packages/codex-adapter/src/app-server-execution-client.ts
- packages/codex-adapter/tests/app-server-execution-client.test.ts
- packages/codex-adapter/tests/fixtures/execution-app-server.mjs
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/sqlite/migrations/027-receipt-claim.sql
- packages/persistence/tests/migration-runner.test.ts

## Forbidden Files
Application files outside the allowlist, archived evidence, other worktrees, main, remote operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
App Server 0.121.0 is the sole upstream protocol for this work. Thread and Turn identifiers remain adapter-private. A trusted Function, independently verified executable, effective OS confinement, native Grant and process-tree termination evidence are required before production dispatch.

## Data Constraints
A start attempt is one-shot. Failure after a start request is potentially committed and must return UNKNOWN; never retry automatically. Receipt values must originate in the owned transport. Migration 027 binds a one-way claim fingerprint to newly created receipts; legacy receipts are not backfilled or inferred. Command and event frames are bounded to 1 MiB.

## UI Constraints
No upstream IDs, secret payloads, or provider exceptions are exposed to the renderer. No UI entry is enabled by this pack.

## Implementation Requirements
Implement typed methods with strict state transitions, one outstanding launch, bounded frame parsing, self-reported principal comparison and strict checks of observed protocol fields. These checks are not proof of trusted process identity or effective OS policy. Reject unsupported inbound requests without approving them. A fake App Server tests actual child stdio, not a production fake switch. Add a synchronous, scoped persistence boundary for an original Attempt becoming UNKNOWN before or after receipt acknowledgement, fenced to the matching claim or immutable receipt and without releasing its lease. The transport invokes a synchronous receipt-persistence callback before returning RUNNING; production wiring and proof of process-tree termination remain required before releasing a lease.

Pinned upstream protocol evidence: openai/codex rust-v0.121.0 generated ThreadStartParams, ThreadStartResponse, TurnStartParams, TurnInterruptParams, SandboxPolicy and UserInput schemas; thread/start requires experimentalRawEvents and persistExtendedHistory flags, and a text input includes text_elements. The response's cwd, approvalPolicy and effective sandbox are validated before turn/start. Transport failures after writing a side-effecting command remain indeterminate.

## Test Requirements
First demonstrate failing behavior, then test a real fixture process including fragmented frames, unknown requests, altered principal, wrong cwd, weaker effective policy, duplicate start, process loss after start and exact interrupt correlation. Run build, lint, typecheck, full unit/contract, document links, Task Pack validator, runtime trace and scope checks.

## Acceptance Criteria
An explicitly constructed isolated client uses only pinned API shapes and rejects inconsistent reported runtime or authority fields. It cannot start twice or send a turn when observed protocol fields or the injected confinement check fail. The injected test verifier is not evidence of actual confinement or authorization. The durable UNKNOWN transition matches the original claim before and after acknowledgement, isolates pending or claimed subsequent deliveries, does not modify unrelated or terminal Attempts, survives database reopen, and does not release a lease. It does not claim cancellation or successful execution from a signal or RPC acknowledgment.

## Done Definition
Record actual tests and outstanding dispatcher, native Grant, original Attempt receipt wiring, and OS process-tree evidence. This transport alone is not merge readiness.

## Risks
An App Server may execute before a reply is lost. Upstream approval requests and account identity ambiguity must fail closed; no retries or guessed response identifiers.

## Output Required
This pack contains execution-transport evidence and exact remaining integration work.

### Implementation and independent review — 2026-11-21

The private, unexported one-shot client speaks pinned upstream request shapes
to a real fake App Server child. Focused tests exercise fragmented and
coalesced frames, oversized input, unknown requests, wrong cwd, weaker policy,
account changes, confinement loss, duplicate dispatch, lost Turn response,
terminal event race, late errors and unconfirmed persistence.

Independent review found the original fake thread-level restricted read policy
was not representative of upstream. Pinned source resolves thread workspace
write read access to fullAccess and does not use the result of the Turn
override submission as a precondition for input. The injected confinement
check is a test seam, not an OS proof and cannot authorize production.
Principal comparison is self-reported until bound to the owned executable and
native Grant. Synchronous receipt and claim-fenced UNKNOWN persistence are
tested with a fake child and independent concurrent SQLite connections but
are not connected to production dispatch. Quarantining an already claimed
delivery does not prove that its worker stopped.

The client remains unexported and unconnected to desktop dispatch. The user
objective, real sandbox enforcement, principal binding, production Attempt
persistence wiring, owned process-tree termination and merge gates remain open.
No real Codex, Electron sandbox or remote CI was run.

### Document recovery — 2026-11-22

An erroneous document-edit invocation replaced this untracked pack with patch
text. This reconstruction restores the recorded task intent, known exact file
allowlist, previously observed implementation requirements and approval
reference; it is not an archival copy of the overwritten bytes. Prior audit
entries are retained. Governance and implementation gates must be repeated
against this reconstructed pack before relying on its state.

### Local verification — 2026-11-22

On Windows with Node 22.19.0 and npm 10.9.3, production build, lint and
typecheck completed successfully. The full unit suite had 615 passed and six
PostgreSQL-environment skips; the contract suite had 50 passed. The skipped
tests are not counted as passed. The simultaneous SQLite receipt/UNKNOWN test
passed with two independent connections and the existing thresholds.

The first full unit run inside the restricted sandbox failed nine tests:
loopback connection and junction creation returned EACCES/EPERM, while
process termination and Git fixture tests also failed. A subsequent
unsandboxed targeted run passed all 48 tests in the affected five files, and
the subsequent full unit run above passed without changing test thresholds.
These runs did not execute real Codex or Electron sandbox verification.

Fresh governance checks examined 348 Markdown files, validated 142 Task
Packs, REQ tracing, all five schemas and this task's anchored runtime trace
(Exit 0); 34 governance unit tests and git diff --check passed. Those checks
validate this increment, not H1 end-to-end acceptance, production dispatch,
remote CI or merge readiness.

Independent re-review found no new blocking issue in the scoped claim and
UNKNOWN changes. The multi-connection test consumes built desktop output, so
build:main must run before that test. It checks one real race and does not
prove both possible ordering winners were exercised in the same run. The
reconstructed approval text is not itself original approval evidence.
