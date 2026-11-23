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

Native test protocol v1 is a bounded line-based control channel: the supervisor receives an absolute executable, absolute working directory and exact argument vector through a bounded startup request; reports READY only after assignment succeeds and the suspended child resumes; accepts only STOP or STATUS control requests; and returns an explicit terminal response only after OS Job accounting reports zero. The native process must not consume caller-provided process IDs. Malformed or excessive input closes the Job and fails closed. Process I/O forwarding required by an App Server is a separate interface gate and cannot be inferred from this control channel. Desktop API `WindowsProcessOwner` exposes a task-bound `launch`, `status`, and `stop`; it must not accept a fake trust callback as production provenance or expose arbitrary PID termination. If a production-trust path is not available, the API is unavailable outside a test-only harness and cannot be composed into main.

## Data Constraints
Use only a newly compiled test helper and explicitly created disposable child fixtures. Do not access user projects or credentials. Avoid persisting helper handles, process IDs, command lines, environment values or user goals in SQLite or logs. A supervisor crash or lost response is UNKNOWN, never a completed cancellation or lease release.

## UI Constraints
No UI or renderer API changes; this task must not make execution or cancellation reachable from the desktop product.

## Implementation Requirements
Implement a native Windows Job Object supervisor with an inherited-handle-safe process creation policy, fail-closed assignment and bounded control messages. Test target processes only while the helper's build provenance and durable process identity are not production-proven. The supervisor owns process creation and kills its own entire Job, never arbitrary PIDs. Its operating-system proof concerns process lifetime only: AppContainer or equivalent filesystem/network boundary, executable provenance, protected Attempt/Lease transaction, reconnect policy and production composition require separate implementation and proof. Keep the existing protected Attempt UNKNOWN and Lease held on any uncertain ownership or missing termination observation.

The test owner must not inherit the helper's complete environment into its child: construct a minimal Windows environment rather than forwarding arbitrary variables. A future production Adapter must separately define and approve each required runtime/authentication value; this test profile is not proof that Codex authentication works.

Independent review found that creating a suspended child and assigning it in a later call leaves a supervisor-crash window containing an unowned suspended child. Use Windows `PROC_THREAD_ATTRIBUTE_JOB_LIST` on `CreateProcessW` so Job assignment is part of process creation; do not fall back to a post-create assignment. Windows documentation describes the Job-list attribute but does not establish every crash-during-system-call outcome, so retain UNKNOWN on owner loss and test the actual supported Windows environment. Reject drive-relative and root-relative paths. A Job handle being non-inheritable does not establish an adversarial security boundary against handle duplication or broker-launched processes: this owner is not production confinement proof, and its terminal result cannot yet release a protected Lease.

The create/assignment crash regression may compile a dedicated `SA_OWNER_TEST` variant with an explicitly test-only pre-resume checkpoint and exact owned-root termination operation. The test must run the crash subject and its suspended child inside an outer guardian Job, then terminate the inner supervisor using the guardian's retained process handle; the guardian remains responsible for final cleanup even when the assertion fails. A test-only close-failure injection may verify that the owner never reports successful termination if releasing its Job handle fails; its cleanup must still close the test Job. The test-only commands and file-backed startup must not exist in the production build. This protects the test environment and does not prove all kernel-level crash interleavings.

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

The native helper is not packaged or connected to a desktop client. Trustworthy helper identity, adversarial handle duplication, external brokers, filesystem/network confinement, App Server stdio, true termination-to-Lease release and restart reconciliation remain unresolved. No production route, migration 033, real Codex execution or Electron sandbox verification was enabled. A documentation patch context mismatch left transaction `task-824-write-038` pending; the file was inspected, the same write completed once and its result recorded; Goal runtime verification subsequently returned Exit 0. This is working-patch evidence only, not Task acceptance, clean-SHA CI or merge readiness.
