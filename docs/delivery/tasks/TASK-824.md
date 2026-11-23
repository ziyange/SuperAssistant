# TASK-824: Owned Windows process-tree lifecycle

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authority: Standing user authorization to implement owned process-tree termination and continue toward merge; TASK-823 is complete only within its explicitly bounded synthetic scope.

## Requirement IDs
REQ-027, REQ-031, REQ-033, REQ-049, REQ-090, REQ-092, REQ-098

## Objective
Implement and test a Windows native owned-process supervisor that creates a child suspended, assigns it to a non-breakaway Job Object before it can execute, and retains the Job handle until termination is observed. This is one prerequisite for the actual desktop execution and cancellation chain, not a claim that the product can dispatch or that a Job Object provides filesystem or network confinement.

## Context Pack
- docs/delivery/tasks/TASK-799.md
- docs/delivery/tasks/TASK-823.md
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
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-824.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/operations.md
- apps/desktop/native/ProcessOwner.cs
- apps/desktop/src/main/windows-process-owner.ts
- apps/desktop/tests/main/windows-process-owner.test.ts
- apps/desktop/tests/native/process-owner-fixture.cjs

## Forbidden Files
Other paths, production credentials or databases, original project workspaces, archived evidence, other worktrees, remote operations, merge, real Codex execution, Electron sandbox verification, production route activation and registering migration 033.

## Interfaces / Contracts
The supervisor owns the Job and its live process handles rather than accepting a PID as proof. It must create the target suspended and fail closed if assignment fails; no breakaway flags or inherited Job handle are permitted. It must close the Job on supervisor termination and report termination only after Job accounting shows zero active processes. The desktop-side client must refuse untrusted helper identity, malformed frames, reused or mismatched owner identity, late replies, unsupported platforms and uncertain status. A closed pipe or PID disappearance is not termination evidence. Neither a synthetic callback nor a returned boolean is proof of OS isolation.

Native test protocol v1 is a bounded line-based control channel: the supervisor receives an absolute executable, absolute working directory and exact argument vector through a bounded startup request; reports READY only after assignment succeeds and the suspended child resumes; accepts INPUT, STATUS and final STOP frames; and returns an explicit terminal response only after OS Job accounting reports zero and the STOP sender closes its input. The native process must not consume caller-provided process IDs. Malformed or excessive input closes the Job and fails closed. Process I/O forwarding required by an App Server is a separate interface gate and cannot be inferred from control messages alone. Desktop API `WindowsProcessOwner` exposes a task-bound `launch`, `status`, and `stop`; it must not accept a fake trust callback as production provenance or expose arbitrary PID termination. If a production-trust path is not available, the API is unavailable outside a test-only harness and cannot be composed into main.

The separate test I/O interface adds an `input` frame with base64 `data` and an `output` frame with `stream` (`stdout` or `stderr`) and base64 `data`. Payloads are raw bytes, with at most 12 KiB decoded per frame and a bounded pending-input queue. Child pipes use a Windows explicit inherited-handle list; the Job handle and unrelated inherited handles never appear in that list. Child output is framed by the owner, so untrusted child bytes cannot impersonate control responses. READY precedes output frames. STOP must remain actionable if a child stops reading input; a blocked or broken pipe, malformed frame, queue overflow or ambiguous owner result fails closed and never releases a Lease. Validate byte ordering, fragmented and multibyte frames, fake App Server handshake, malicious output, backpressure, owner loss and descendant cleanup using only disposable fixtures. This interface is not provenance, authority or confinement evidence and remains inaccessible from the production route.

STOP is the last control frame: the caller closes its input after sending it. The owner must observe control EOF and a completed reader with no error or queued trailing frame before emitting a terminal result; an open or malformed control channel remains UNKNOWN. A dedicated `SA_OWNER_TEST` checkpoint may deterministically race a malformed trailing frame against STOP while still retaining Job cleanup. A client must independently reject responses received after its deadline; native output writes cannot guarantee revocation of a frame already blocked inside the operating system.

Before a production helper identity can be proven, the desktop may implement only an explicitly untrusted protocol session over an already supplied child process. It can start a disposable fixture, frame bounded binary input, expose framed output as untrusted bytes, and report `UNVERIFIED_TERMINATION` or `UNKNOWN` after a deadline-bound STOP. It must reject late frames using a monotonic clock, malformed/oversized/noncanonical frames and invalid state transitions. This session cannot launch a helper itself, certify provenance, grant authority, release a Lease or be composed into the production route. The task remains incomplete until a separate trustworthy launch path exists; do not present the untrusted session as a completed `WindowsProcessOwner`.

For input delivery, retain the exact root process handle returned during creation and reject input if that handle is signaled or cannot be queried, even when Job accounting still reports active descendants. A PID, cached state or Job membership count alone is not a live App Server root. This check cannot prove later delivery if the root exits after the check; write failure and original-Attempt reconciliation still fail closed.

## Data Constraints
Use only a newly compiled test helper and explicitly created disposable child fixtures. Do not access user projects or credentials. Avoid persisting helper handles, process IDs, command lines, environment values or user goals in SQLite or logs. A supervisor crash or lost response is UNKNOWN, never a completed cancellation or lease release.

## UI Constraints
No UI or renderer API changes; this task must not make execution or cancellation reachable from the desktop product.

## Implementation Requirements
Implement a native Windows Job Object supervisor with an inherited-handle-safe process creation policy, fail-closed assignment and bounded control messages. Test target processes only while the helper's build provenance and durable process identity are not production-proven. The supervisor owns process creation and kills its own entire Job, never arbitrary PIDs. Its operating-system proof concerns process lifetime only: AppContainer or equivalent filesystem/network boundary, executable provenance, protected Attempt/Lease transaction, reconnect policy and production composition require separate implementation and proof. Keep the existing protected Attempt UNKNOWN and Lease held on any uncertain ownership or missing termination observation.

The test owner must not inherit the helper's complete environment into its child: construct a minimal Windows environment rather than forwarding arbitrary variables. A future production Adapter must separately define and approve each required runtime/authentication value; this test profile is not proof that Codex authentication works.

Independent review found that creating a suspended child and assigning it in a later call leaves a supervisor-crash window containing an unowned suspended child. Use Windows `PROC_THREAD_ATTRIBUTE_JOB_LIST` on `CreateProcessW` so Job assignment is part of process creation; do not fall back to a post-create assignment. Windows documentation describes the Job-list attribute but does not establish every crash-during-system-call outcome, so retain UNKNOWN on owner loss and test the actual supported Windows environment. Reject drive-relative and root-relative paths. A Job handle being non-inheritable does not establish an adversarial security boundary against handle duplication or broker-launched processes: this owner is not production confinement proof, and its terminal result cannot yet release a protected Lease.

The create/assignment crash regression may compile a dedicated `SA_OWNER_TEST` variant with an explicitly test-only pre-resume checkpoint and exact owned-root termination operation. The test must run the crash subject and its suspended child inside an outer guardian Job, then terminate the inner supervisor using the guardian's retained process handle; the guardian remains responsible for final cleanup even when the assertion fails. Test-only close-failure and input-write-failure injection may verify that failure never reports success and wakes the controller; cleanup must still close the test Job. The test-only commands and file-backed startup must not exist in the production build. This protects the test environment and does not prove all kernel-level crash interleavings.

## Test Requirements
Use TDD and a temporary helper built by the installed Windows C# compiler; tests may launch only the task-owned fixture with its exact temporary paths. Demonstrate no child code runs before successful assignment; validate a child with a grandchild, graceful and forced termination, Job kill on owner exit, duplicate or late cancellation, assignment failure, malformed control messages, abandoned child pipes, and inability to terminate an unrelated process. Check actual OS process termination rather than mock callbacks. Run focused tests, lint, typecheck, build, full unit and contract suites, and governance gates. Real Codex and Electron sandbox remain deferred.

## Acceptance Criteria
Only a process created and assigned by the current owner can be interrupted or terminated; no child starts after failed assignment. A reported fully terminated tree requires observed zero active Job members and no retained owner capability. Supervisor loss or ambiguous completion remains UNKNOWN. The production execution route remains unavailable until all separate authority, isolation, custody and Lease-release gates pass.

## Done Definition
Record red/green tests, actual process and descendant evidence, scoped independent review, commands and limitations. This task alone cannot establish H1, phase completion or merge readiness.

## Risks
Nested Windows jobs, pipe inheritance and process creation failure may prevent launch; fail closed. Job Objects alone do not restrict filesystem or network access. Test-helper compilation in a writable temporary directory is not a trustworthy production binary provenance mechanism.

## Output Required
Windows owned-process supervisor, bounded desktop client, actual disposable-process tests, synchronized engineering facts and precise verification evidence.

## Work in progress
On Windows, a real temporary native helper and test-owned processes exercised parent/grandchild termination, owner death with an unrelated process preserved, rejection of a root-relative directory, malformed and duplicate control, bounded or abandoned input, a naturally exiting child, and an allowlisted environment. Independent review found the original create-then-assign crash window; a guardian-protected checkpoint test first demonstrated the stranded suspended child and then passed after assignment was moved into `CreateProcessW` using a Job-list attribute. The test-only checkpoint is compiled out of the ordinary binary and does not prove crashes inside the system call. Simulated Job-attribute and handle-close failures exercise error-handling branches, not actual Windows API failures. Nonstandard serializer keys initially bypassed duplicate checks; two regression cases failed before the schema-specific lexical restriction and passed afterward. A synthetic unrelated environment variable was observed in the child before the minimal environment change and absent afterward; the four permitted variable values still originate from the parent. The current focused suite ran 15/15 tests successfully. An independent reviewer checked the code statically and did not run the test suite.

The native helper is not packaged or connected to the production desktop execution route. Trustworthy helper identity, adversarial handle duplication, external brokers, filesystem/network confinement, real Codex stdio, true termination-to-Lease release and restart reconciliation remain unresolved. No production route, migration 033, real Codex execution or Electron sandbox verification was enabled. A documentation patch context mismatch left transaction `task-824-write-038` pending; the file was inspected, the same write completed once and its result recorded; Goal runtime verification subsequently returned Exit 0. This is working-patch evidence only, not Task acceptance, clean-SHA CI or merge readiness.

Later working-patch integration adds bounded binary input and output frames through an explicit child-handle list. A fake App Server completed initialize and account discovery over the owned process. Tests first reproduced output backpressure blocking STOP; a bounded output queue now prevents the control path from blocking on output and a Job-handle lock serializes cleanup. An injected input failure verifies controller wakeup and owned-child termination; it does not prove a real Windows pipe failure occurred. A separate late-input test waits for observed Job idle because PID disappearance was observed before Job accounting converged. Independent review then identified a control-reader error racing STOP: a guardian-owned checkpoint reproduced a false successful termination, and STOP now requires control EOF, a joined reader, no pending control and no fault before acknowledgement. The focused Windows suite passed 21/21. A previously queued terminal response can still arrive after an output acknowledgement deadline; a future client must reject late frames, and no production Lease release is authorized by the native helper. Native stdio is not proof of process confinement, reliable delivery under all failures, trusted helper provenance or actual Codex compatibility.

An isolated, untrusted transport client now enforces a monotonic deadline, bounded canonical frames and fail-closed stream loss. Its outputs explicitly say `READY_UNTRUSTED` and `UNVERIFIED_TERMINATION`, and it is not wired to authorization or Lease release. The missing client test failed first; a real helper plus fake App Server test then exposed the native CRLF framing mismatch and passed after correction. Independent review exposed an unexpected-close state error and writable public state; a regression first failed and then passed after close handling and a read-only state accessor. These are local working-patch results, not verification of helper origin or production process custody.

Further independent review identified unexpected input closure while READY; a regression reproduced the stale READY state before the client was changed to reject unexpected finish or close. The current focused native/client suite passed 31/31. A host full-unit run on the prior patch passed 1,037 tests with nine explicit skips; a host contract run passed 49/49. Those earlier full results are not final-patch acceptance evidence. The sandbox full-unit run failed 11 tests involving local permissions and Git execution; the corresponding tests passed on the host. All results remain local and do not establish trusted helper provenance, production routing or merge readiness.

A subsequent slow-writable regression demonstrated that a terminal frame could arrive before the final STOP finished writing. The session now fails closed unless the local writable has finished; this is only transport evidence and does not prove helper identity or process termination. Ten focused protocol cases, including an actual temporary native owner and fake App Server, passed after the fix. Independent static re-review identified no further critical or important issue in this specific change; the reviewer did not run tests. A full-unit run overlapped later edits and must not be treated as final-patch evidence.

After the final code and test changes, the Windows host unit suite ran with `node node_modules/vitest/vitest.mjs run --project unit --maxWorkers=1 --reporter=dot`: 182 files, 1,039 passed, nine skipped, exit 0. The nine skips are not acceptance evidence. The host uses local fixture processes, temporary repositories and loopback only; this did not run real Codex or Electron sandbox verification. The final patch remains WIP and is not production or merge acceptance.

After that run, an additional real native-owner test sent a forged terminal frame through a disposable echo child. It arrived only as framed child output and the session remained READY until a separate STOP; the focused case passed. The 1,039-test full result predates this additional test and is not a full-suite result for the amended test set.

The amended test set subsequently passed the same Windows host full-unit command: 182 files, 1,040 passed and nine skipped, exit 0. Skips and production/merge limitations above remain unchanged.
