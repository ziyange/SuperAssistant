# TASK-853: Harden audit restoration fixture after TASK-852

## Status
REJECTED
Execution outcome: BLOCKED (three iterations used; required restoration and real-audit safety remain unproven).
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authority: user explicitly authorized replanning and execution of a follow-up isolation task after TASK-852. TASK-852 remains REJECTED with its historical iteration stop and evidence unchanged.

## Requirement IDs
REQ-090, REQ-091, REQ-093, REQ-094, REQ-095, REQ-098

## Objective
Fix and test the identified post-mutation exception path in the disposable restoration fixture; independently review remaining failure paths and establish whether any real audit diagnostic is safe to run.

## Context Pack
- docs/delivery/tasks/TASK-850.md
- docs/delivery/tasks/TASK-851.md
- docs/delivery/tasks/TASK-852.md
- docs/security.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-853.md
- docs/delivery/tasks/TASK-852.md
- docs/delivery/tasks/TASK-851.md
- docs/delivery/tasks/TASK-850.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- apps/desktop/native/binding.gyp
- apps/desktop/native/containment-probe.cc
- apps/desktop/tests/native/containment-probe-test.cjs
- scripts/wfp-audit-diagnostic.ps1
- tests/test_wfp_audit_diagnostic.py

## Forbidden Files
All other repository files, real Projects or credentials, unrelated processes, firewall or loopback exemptions, trust stores, signing keys, production IPC activation, real Codex, Electron sandbox-security validation, merge and release.

## Interfaces / Contracts
Do not alter TASK-852 or earlier evidence or limits. Fixture-only recovery must attempt safe restoration after post-mutation errors; unknown results fail closed. The user allowed temporary Filtering Platform Connection failure auditing, but no actual policy mutation is permitted until recovery, concurrent-administrator coordination, trustworthy privileged inputs and independent security review have passed. Never treat missing event or timeout as denial.

## Data Constraints
Only the two fixture files, this Task Pack and transaction audit/trace may be edited. Other listed paths are inherited dirty state and must not be modified. Do not clear Security logs, alter other audit categories or overwrite an external change. Preserve exact pre-existing worktrees and user data.

## UI Constraints
No production-facing execution, cancellation or recovery route is enabled by this task.

## Implementation Requirements
Use test-first reproductions of post-mutation wait failures and owner death. Refactor fixture cleanup so error handling cannot silently report success or skip attempted restoration. Preserve unrelated files, limit all waits, and record evidence. Evaluate non-atomic file writes, concurrency, hung I/O and simultaneous failures before proposing any privileged action.

## Test Requirements
Run targeted negative tests, all Windows fixture tests, governance tests and task/runtime validation. Real Codex and Electron sandbox validation remain deferred. Obtain independent security review before relying on results.

## Acceptance Criteria
For the controlled wait-failure scenario, original fixture state is restored or explicitly reported unknown without false success; parent termination and unrelated-process safety are tested. No real audit diagnostic is run without proven restoration and scoped coordination; incomplete evidence is BLOCKED.

## Done Definition
Record exact tests, outcomes, limitations and independent review in this task. Only mark PASS for its stated fixture scope when all criteria and governance pass; do not declare product merge readiness.

## Risks
A restoration failure can leave a modified system policy; concurrent administrative changes cannot be attributed from a boolean. A fixture cannot prove privileged Windows audit safety or recovery after simultaneous failure.

## Output Required
Auditable fixture correction and tests or a concrete blocker; preserve the user's original policy and all uncommitted work.

## Evidence and open issues
- Reproduced a post-mutation wait failure after owner death: the initial targeted test failed because the fixture remained temporary. The watchdog exception handler now attempts to restore only an exact temporary value, then records failure rather than reporting success; the targeted test passed.
- The first full Windows Python run found 57 tests with one failure: the fault injection raced pipe EOF against process termination and did not always execute. The injection was corrected to exercise the error on either signal; the subsequent full run passed 57/57 with no skips.
- Independent read-only review identified remaining important risks: non-atomic read/compare/write can overwrite a concurrent value, a truncated or partial write may not be recognized for recovery, and a hung or simultaneously failed watchdog and owner can leave fixture state unresolved. The review did not run its own fault injections. This change does not establish safe real-audit restoration or allow production use.
- No Windows audit setting was modified and no AppContainer diagnostic, real Codex, Electron sandbox-security test, candidate CI, commit, or merge was performed under this pack. TASK-852 and prior evidence remain unchanged.
- Iteration 2 reproduced a lost-update race: an external fixture write between the previous read and restore was overwritten. Fixture comparison and update now hold a Windows file handle denying concurrent write/delete access; a targeted test verifies a competing write is refused while that handle is held and allowed after restoration. This is not a compare-and-swap facility for Windows audit policy.
- A simulated partial write originally left the fixture value `temginal`. The fixture now attempts rollback under the same held handle on a caught write exception; the targeted test passed. An abrupt process termination during the write, an unsuccessful rollback, same-user path substitution, hung I/O, and both processes failing remain unproven and must not be described as recovered.
- The full Windows Python suite passed 59/59 after these changes. This is local fixture/governance evidence, not CI or production-audit acceptance.
- Independent static review confirmed additional Important limits: the file is reopened by path without binding its identity across operations, an abrupt process death during an in-place write bypasses exception rollback, and both processes can die with no surviving restorer. It also identified PowerShell's case-insensitive comparison. A new regression reproduced overwriting an external `TEMPORARY` value; fixture comparisons now use case-sensitive matching and the regression passes. After this change the complete Windows Python suite passed 60/60 with no skips.
- These observations remain limited to a disposable fixture; they do not establish protection against path substitution, simultaneous failure or concurrent audit-policy administration. Actual Windows audit mutation and the controlled AppContainer diagnostic remain unperformed.
- Iteration 3 will first exercise attempted fixture replacement while the owner and watchdog are active. Any protection must preserve the original object identity across the recovery window and fail closed on ambiguity. This remains a disposable-file test, not proof of protection for Windows audit policy or privileged installation.
- Iteration 3 reproduced direct file replacement and parent-junction redirection. Held handles prevent direct replacement; volume/file-ID checks reject a redirected target; on the tested redirection path a reopened pinned handle restores the original object while the replacement is untouched and the result remains failure. The pinned-handle operation is supported by the Windows ReOpenFile API, but this fixture is not privileged audit-policy code.
- Independent review identified a same-value ownership bug before mutation. A failing test showed an external `temporary` value was rolled back even though the watchdog had not written it. A pipe-based mutation-intent/commit exchange now occurs while the file is locked; the new test passed. This does not prove safe attribution after process death and an intervening identical external write.
- Two full-suite runs initially failed because tests began deleting a fixture after its result appeared but before the watchdog closed its pin. Cleanup now waits for release or retains evidence on timeout. The latest complete Windows governance suite passed 63/63 with no skips after all changes.
- Remaining blockers include in-place write interrupted by process death, both processes dying, same-value external change after a writer dies, hung I/O, secure privileged inputs, audit-policy coordination, missing TASK-851 command intents, and candidate CI. No system audit mutation, real Codex, Electron sandbox-security test, commit or merge occurred.
- Independent follow-up review confirmed the specific pre-intent same-value test but found that an intent is not proof a write occurred: after intent and watchdog death, an external identical value or ABA update can still be incorrectly rolled back. The same review confirmed that the caught-exception test does not cover a process killed mid-write. All three iterations are used; no fourth iteration is authorized by this pack.
