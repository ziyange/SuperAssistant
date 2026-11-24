# TASK-843: Connect the App Server client to the native owner transport

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authority: user authorized continuous fake App Server integration and process-tree cancellation work, with real Codex and Electron sandbox security verification deferred.

## Requirement IDs
REQ-027, REQ-028, REQ-031, REQ-033, REQ-038, REQ-049, REQ-090, REQ-093, REQ-095, REQ-097

## Objective
Connect the existing one-shot App Server client to the existing Windows owner protocol using a bounded stream transport, and exercise initialization, start receipt, interruption and owner stop against a disposable fake service under a real Windows Job.

## Context Pack
- docs/delivery/tasks/TASK-823.md
- docs/delivery/tasks/TASK-842.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/security.md
- docs/orchestration.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-843.md
- docs/delivery/tasks/TASK-842.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/orchestration.md
- docs/adapters/codex.md
- apps/desktop/src/main/owner-app-server-transport.ts
- apps/desktop/tests/main/owner-app-server-transport.test.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts
- apps/desktop/tests/native/owned-execution-wrapper.mjs
- packages/codex-adapter/src/app-server-execution-client.ts
- packages/codex-adapter/tests/app-server-execution-client.test.ts

## Forbidden Files
All other repository paths, production route or migration 033 activation, real user projects or credentials, real Codex, Electron sandbox security verification, merge and release.

## Interfaces / Contracts
The transport is explicitly untrusted and carries bounded stdin/stdout bytes through UntrustedOwnerProtocol. It never fabricates process termination proof, authorization, sandbox evidence or Lease release. The App Server client must retain its existing protocol and error semantics; any transport abstraction must accept an actual ChildProcess as before. Owner loss, malformed frames, backpressure failure or channel closure fail closed, preserving the original Attempt as UNKNOWN if execution may have started.

## Data Constraints
Use disposable test directories, fake App Server processes and synthetic correlation IDs only. No secrets, real credentials, or original user projects. Do not alter the native owner binary or shell permissions.

## UI Constraints
No production IPC or renderer route is enabled by this task. Transport readiness and the owner's unverified stop message are not user-facing completion evidence.

## Implementation Requirements
Use failing integration and failure-path tests first. Exercise real owner framing and the actual App Server execution client with a fake service, including bounded fragmented input, response, interruption and fail-closed owner termination. The exact disposable fixture wrapper may start one child and write only its own PIDs in its temporary directory, so the test can independently check both owned processes exit. Verify that process output cannot spoof owner frames. Keep process-tree and sandbox proof separate from the transport.

Integrate the new transport with the existing protected goal, original Attempt
and cancellation fixture in a disposable SQLite/Git environment. After the
real Job is stopped, independently verify both fixture PIDs are absent and
assert that the original Attempt remains UNKNOWN and its Lease ACTIVE, because
this test does not establish production owner provenance.

## Test Requirements
Run focused real Windows owner and fake-service tests, adapter contract tests, build, lint, typecheck, full CI-aligned unit and contract suites, Electron functional and browser E2E, governance and independent security review. Real Codex and sandbox security tests remain deferred.

## Acceptance Criteria
The execution client performs the fake initialize/start/interrupt exchange through the native owner without bypassing its frame parser. No malformed or closed transport can report successful execution or release a Lease. Existing direct ChildProcess adapter tests continue passing.

## Done Definition
Record actual local and remote evidence and the remaining owner provenance and process-tree proof gaps. No H1 or merge acceptance is implied.

## Risks
The protocol's owner is not authenticated; synthetic confinement is test-only. Unverified stop cannot be treated as process-tree proof or authorization to release a Lease.

## Output Required
Bounded owner transport, integration and negative tests, synchronized contract facts and verification evidence.

## Working-candidate evidence
The existing App Server client now accepts a typed bounded transport in addition
to its prior ChildProcess use. The explicit ChildProcess verifier initially
failed typecheck when the transport parameter was widened; a generic preserves
the original type and full project typecheck passed. This type does not prove
confinement. The owner bridge forwards bounded frames, handles backpressure and
closes on input, output, stderr or owner failure.

A disposable Windows Job ran the fake App Server and a child process. The test
used actual initialized/start/interrupt protocol calls and independently saw
both test PIDs become ESRCH after owner stop. Another test connected the real
draft, synthetic native confirmation and protected original Attempt through a
real Git worktree and this Job: after cancellation and stop the same Attempt
became UNKNOWN and its Lease remained ACTIVE. The test orchestrated those steps
manually, using a synthetic vault, mocked consent and synthetic confinement;
it does not prove production cancellation or authorize Lease release.

The owner-output-closed regression failed before loss propagation was added.
A deliberate input-offset mutation caused the backpressure test to lose a
frame and fail; restoring it passed. Independent review found unhandled stderr
errors and a stale READY result after a same-chunk malformed frame. Both tests
failed before the fix and passed afterward. Follow-up static review found no
remaining confirmed Critical/Important issue in scope; it did not run tests.

On the working candidate: build, lint and typecheck passed; CI-aligned unit
tests passed 1158 with 9 allowlisted skips, contract tests passed 50 with no
skips, real Electron functional tests passed 2 and browser E2E passed 9. The
shared Electron database hash remained
`9FD7F1298ED1F7184C11FAD6FB985510A36F08575AC033EA06C8014FC1B85215`.
Remote CI for this uncommitted candidate is not available. Real Codex and
Electron sandbox security remain deferred. Trusted owner provenance, production
vault, automatic cancellation, terminal reconciliation and production IPC
remain open; no H1 or merge acceptance is implied.

Governance on the working candidate scanned 400 Markdown files, checked 190
Task Packs, passed requirement tracing and five schemas, returned TASK-843
Goal runtime Exit 0, and passed 41 governance tests. An initial
`git diff --check` found a blank line at the end of the Codex adapter document;
it was removed and the check must be rerun. Current host versions are Node
22.23.2, Python 3.9.12 and Git 2.56.0.windows.4.

Candidate commit `7133d82441092b5ecf73cf131ff7fd425fedb76a` was pushed.
GitHub Actions governance run 45325222363 and application run 45325222400
completed successfully, including Windows deterministic tests and PostgreSQL
16 compatibility. This evidence applies to that commit only; it does not
establish production ownership or H1 acceptance.
