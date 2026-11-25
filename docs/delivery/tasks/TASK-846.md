# TASK-846: In-process Windows execution ownership

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 8
user_confirmed: true
Authority: the user authorized continuously completing the official desktop Proposal, original Attempt, process-tree cancellation and recovery chain; real Codex and Electron sandbox security tests remain deferred.

## Requirement IDs
REQ-027, REQ-028, REQ-031, REQ-033, REQ-038, REQ-049, REQ-090, REQ-093, REQ-095, REQ-097

## Objective
Implement a main-process native Windows Job owner that creates its own App Server process inside the Job atomically, supports bounded stdio and proves its own process tree has stopped before making termination evidence available. Replace reliance on a separately spawned unverified owner in the eventual desktop execution chain.

## Context Pack
- docs/delivery/tasks/TASK-824.md
- docs/delivery/tasks/TASK-843.md
- docs/delivery/tasks/TASK-844.md
- docs/delivery/tasks/TASK-845.md
- docs/api/sai.md
- docs/adapters/codex.md

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
- docs/delivery/tasks/TASK-846.md
- docs/delivery/tasks/TASK-845.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/orchestration.md
- apps/desktop/native/binding.gyp
- apps/desktop/native/process-owner-addon.cc
- apps/desktop/scripts/build-native.cjs
- apps/desktop/src/main/inprocess-owner-transport.ts
- packages/codex-adapter/src/app-server-execution-client.ts
- apps/desktop/tests/main/inprocess-owner-transport.test.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts
- apps/desktop/tests/native/process-owner-addon-test.cjs
- apps/desktop/tests/native/process-owner-stress-test.cjs
- apps/desktop/tests/native/owned-execution-wrapper.mjs
- .github/workflows/application-gates.yml
- package.json

## Forbidden Files
All other repository paths, actual user Projects or credentials during tests, real Codex, Electron sandbox security validation, production IPC activation before trusted packaging and confinement, arbitrary PID termination, merge and release.

## Interfaces / Contracts
The owner is an instance bound to one newly created child and its Job, never a caller-supplied PID. It provides bounded asynchronous input/output and stop. Job membership is assigned atomically with process creation; inherited handles are explicitly limited. Stop evidence requires active Job count zero and successful closure; errors, loss or timeout are UNKNOWN. A Node-API addon is only trusted when the application installation and addon provenance are trusted; test-only observations do not establish that trust.

## Data Constraints
Tests use only disposable Projects and newly created fixture processes. No user Project, credential, arbitrary PID or external network is touched. Commands, environment, keys and user goals must not be logged.

## UI Constraints
No renderer-exposed process control or production execution route is enabled by this task alone. Product state remains controlled by the original durable Attempt and Lease.

## Implementation Requirements
Write failing tests first. Use CreateProcessW with PROC_THREAD_ATTRIBUTE_JOB_LIST and explicit handle list; fail closed on setup, assignment or pipe errors without running an unowned child. Own Job handles in the main process with kill-on-close. Provide bounded input/output and cooperative stop; forcibly terminate only the owned Job when required, observe zero active processes and only then expose proven stop. Keep process ownership separate from filesystem/network confinement and trusted executable provenance. Loss or unknown terminal evidence must not release a Lease or cause redispatch.

The execution client must request best-effort owner cleanup after protocol
failure or timeout through an explicit optional transport hook. This request is
not termination evidence and never releases a Lease. The callback first
persists UNKNOWN when applicable; cleanup failure remains UNKNOWN.

## Test Requirements
Use real disposable parent/grandchild fixtures and fake App Server; check actual process exit, unrelated fixture survival, start failure, shutdown, close/crash, malformed or oversized traffic and duplicate stop. Run native build, focused tests, typecheck, lint, full CI-aligned unit and contract tests, desktop functional tests and governance. Real Codex and Electron sandbox security tests remain deferred.

## Acceptance Criteria
The actual main-process owner launches only its own assigned process, exchanges a fake App Server lifecycle and proves its owned child and descendants exit without signalling another process. Ambiguous outcomes do not report proven termination. The transport is usable by the existing App Server client without renderer-supplied approval or process identity.

## Done Definition
Record commands, versions, process evidence, CI and independent security review. Do not claim production activation, H1 or merge acceptance until trusted package provenance, filesystem/network authorization, transactionally bound Lease release, restart reconciliation and the actual desktop route are verified.

## Risks
A Windows Job is not a filesystem or network sandbox. A compromised or substituted native addon cannot be trusted. Job handle duplication, broker-launched processes, crash races, output backpressure and Windows command-line quoting require explicit tests and documented residual limits.

## Output Required
In-process owner implementation, bounded App Server transport, OS-level tests, synchronized facts, actual evidence and precise remaining gates.

## Current evidence (not completion)

- Candidate parent `8f890396cc0f7abe2e345d22e23dceea713b75cb` had successful
  documentation CI run 45339974044 and application CI run 45339974027; those
  runs do not cover this task's uncommitted changes.
- Local serial production build, lint, typecheck, governance (including 41
  Python tests), the 50-case zero-skip contract suite, the five focused owner
  transport tests and disposable native Job stress tests passed. The original
  Attempt fixture also passed in isolation. These are not production or
  whole-system acceptance.
- Protocol-error cleanup had a failing real-Job regression (zero stop calls)
  before the implementation. The corrected focused suite passed; independent
  static review found no remaining confirmed critical or important findings.
- A build run concurrently with tests failed because Windows held the native
  module open, and concurrent dist cleanup also made Git baseline worker inputs
  unavailable. A serial build passed. Full unit attempts were not successful:
  one had two protected-execution timeouts; a second had two worktree-test
  timeouts. Both runs were stopped after failure and are not PASS. The first
  two cases subsequently passed individually under the same timeout. CPU usage
  during the failed runs was above 90%, with an unrelated project process
  consuming substantial CPU; no unrelated process was modified. This is
  contributing evidence, not proof that all other failure causes are absent.
- Full unit and desktop functional gates, final clean-SHA CI, installation
  provenance, effect confinement, actual production IPC, transactionally bound
  Lease release and restart reconciliation remain required. Real Codex and
  Electron sandbox-security validation remain deferred as instructed.

Further local evidence: the two worktree cases that timed out passed
individually with their original 15/30 second thresholds after load dropped.
A third full-unit attempt nevertheless failed a different 45 second fixture
timeout and was stopped; full unit remains NOT PASS. Real Electron functional
tests (isolated profile, real IPC, fake App Server) passed 2/2. The existing
default Electron database SHA-256 remained
`9FD7F1298ED1F7184C11FAD6FB985510A36F08575AC033EA06C8014FC1B85215`
before and after. This is not Electron sandbox-security validation.

After the competing process exited, the unchanged full unit suite completed:
186 files, 1,171 passed and nine explicitly allowed skips; its summary gate
passed. A fresh serial build then passed, followed by 69/69 impacted unit tests,
50/50 contract tests, both real Electron functional tests, nine browser tests,
native Job and synthetic WinCred tests. The default Electron database hash
remained unchanged. A separate regression showed all three npm test entry
points previously returned zero for zero tests; removing their permissive flags
made each empty-input check fail and normal focused unit, 50 contract and nine
browser tests pass. These are local results for an uncommitted working patch;
current-task CI and production activation remain unverified.

Candidate `bb85e88a3934d23efa8587487fd93689a37b7e01` subsequently passed
GitHub documentation run 45655716456 and application run 45655716056. The
application run's Windows build, synthetic native credential, owned process
tree, desktop functional, lint, typecheck, unit and contract gates passed;
PostgreSQL 16 compatibility passed separately. This closes only this
fixture-level Task Pack. It does not validate PostgreSQL 17, production
installation provenance, effect confinement, production IPC, Lease release,
real Codex or Electron sandbox security.
