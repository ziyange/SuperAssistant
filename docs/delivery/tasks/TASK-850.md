# TASK-850: Disposable worker effect-isolation probe

## Status
REJECTED
Execution outcome: BLOCKED (iteration limit exceeded; not accepted).
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authority: the user authorized autonomous work toward a safe merge and requested process ownership and effect confinement; real Codex and Electron sandbox-security validation remain deferred.

## Requirement IDs
REQ-090, REQ-091, REQ-093, REQ-094, REQ-095, REQ-098

## Objective
Implement and test an isolated Windows worker containment probe using an OS AppContainer and an owned Job. Demonstrate that a controlled process can access its explicitly granted disposable fixture while a separate protected fixture and one local loopback connection are denied. This is a worker-boundary experiment, not an Electron sandbox test, proof of general outbound-network control, production authorization or proof of trusted installation.

## Context Pack
- docs/delivery/tasks/TASK-846.md
- docs/delivery/tasks/TASK-849.md
- docs/security.md
- [Windows AppContainer launch](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)

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
- docs/delivery/tasks/TASK-850.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- apps/desktop/native/binding.gyp
- apps/desktop/native/containment-probe.cc
- apps/desktop/tests/native/containment-probe-test.cjs

## Forbidden Files
All other repository files, real Projects or credentials, existing security profiles and user file ACLs, firewall settings, signing certificates or trust stores, production IPC activation, real Codex, Electron sandbox-security testing, release and merge.

## Interfaces / Contracts
The probe is an explicitly invoked test-only native executable. It may create only a unique test-named AppContainer profile and isolated fixture paths owned by this invocation. It must hold and terminate its child using a Job, never arbitrary PIDs, and remove only the profile it created after termination; ambiguous cleanup is a failure with retained evidence. Its stdout contains only fixture result codes, no secrets. DSH capabilities are not disabled; future Attempts must preserve their authorized immutable policy.

## Data Constraints
Only generated temporary files, generated test profile identifiers and loopback fixtures may be used. Do not inspect or modify real user files, real credential material, existing profiles, existing ACLs or global firewall configuration. Reject noncanonical paths and reparse points in fixture-owned paths. No production state may be modified.

## UI Constraints
No user-facing execution, authorization, cancellation or recovery route is enabled by this probe.

## Implementation Requirements
Use test-first development and a native Windows security boundary rather than treating a Job object as a filesystem or network fence. Fail closed if profile creation, controlled fixture grants, atomic Job assignment, process creation, verification or cleanup is uncertain. Preserve existing process-owner behavior and the current application build.

## Test Requirements
Run a disposable controlled child and require proof of AppContainer token, allowed fixture access, protected fixture denial, denied loopback connection, process-tree termination, no effect on unrelated process, and exact test-profile cleanup. Add negative tests for invalid input and failure paths; no silent skips on supported Windows. Run native test, affected build, lint/typecheck, relevant governance and runtime trace. Do not run real Codex or Electron sandbox-security tests.

## Acceptance Criteria
The probe supplies reproducible evidence for its explicitly tested worker boundary, terminates only its own processes and leaves no test profile when cleanup is proven. Any unavailable OS capability fails closed. Do not claim that loopback rejection proves general outbound isolation, or that the probe implements domain-specific network allowlists, Codex compatibility, production worktree ACLs, a protected installation, or production dispatch.

## Done Definition
Record exact commands, OS version, test counts, cleanup evidence, risks, review and actual candidate CI. Production execution remains disabled until a separately approved implementation composes and validates all required boundaries.

## Risks
AppContainer capabilities and Windows ACL inheritance may grant broader access than intended; absence of proof is not proof of denial. Incorrect process or profile cleanup could impact other software. OS isolation alone does not authenticate an unsigned executable or prove the active Proposal.

## Output Required
Test-only worker-containment implementation, deterministic positive/negative tests and truthful security facts, without changing user data or enabling production dispatch.

## Stop record

Seven actual self-test runs were performed, exceeding the `MAX_ITERATIONS: 6`
limit. This is a process violation; no further implementation or retry is
authorized under this pack. Audit transaction entries use iteration index 1
and must not be misread as evidence that only one self-test was run. The last
test observed AppContainer token, authorized fixture read, forbidden fixture
access denial, owned child creation and no listener connection. The network
operation remained `WSAEWOULDBLOCK` after the bounded wait, which is not proof
of denial. The run reported its Job stopped and its own profile deleted; the
exact temporary fixture directory was separately confirmed absent. Earlier
failures also reported their profile cleanup; the first profile's exact
registration and temporary directory were independently checked absent.

The probe is uncommitted experimental work, not a production boundary. A new
explicitly authorized plan and corrected iteration accounting are required
before attempting another run. Real Codex and Electron sandbox-security
validation remain deferred. Candidate `a85907b6c16b2ef88b9bc95470d09a76c7bafa45`
passed documentation run 45691345920 and application run 45691345961 before
these TASK-850 changes; that CI does not cover this experimental work.
