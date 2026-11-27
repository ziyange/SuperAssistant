# TASK-852: Verify independent audit restoration and bounded WFP diagnosis

## Status
REJECTED
Execution outcome: BLOCKED (three iterations used; real-audit safety and diagnostic remain unproven).
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authority: user explicitly authorized implementing and verifying independent restoration and temporarily enabling Windows Filtering Platform failure auditing, restoring the original setting afterwards. TASK-850 and TASK-851 remain blocked historical records; their limits are not reset.

## Requirement IDs
REQ-090, REQ-091, REQ-093, REQ-094, REQ-095, REQ-098

## Objective
Verify an independent watchdog with a harmless fixture before conducting at most one controlled WFP-audited AppContainer diagnostic; restore and independently verify the exact original failure-audit setting.

## Context Pack
- docs/delivery/tasks/TASK-850.md
- docs/delivery/tasks/TASK-851.md
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
- docs/delivery/tasks/TASK-852.md
- docs/delivery/tasks/TASK-850.md
- docs/delivery/tasks/TASK-851.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- apps/desktop/native/binding.gyp
- apps/desktop/native/containment-probe.cc
- apps/desktop/tests/native/containment-probe-test.cjs
- scripts/wfp-audit-diagnostic.ps1
- tests/test_wfp_audit_diagnostic.py

## Forbidden Files
All other repository paths, real Projects and credentials, existing user ACLs and security profiles, firewall or loopback exemptions, other audit subcategories, trust stores, signing keys, production IPC activation, real Codex, Electron sandbox-security validation, merge and release.

## Interfaces / Contracts
Change only failure auditing on Filtering Platform Connection subcategory 0CCE9226-69AE-11D9-BED3-505054503030, leaving the success bit and unrelated categories untouched. Query the actual initial policy immediately before the run and restore its failure bit exactly. A Winsock timeout, absent event, or event lacking exact fixture correlation remains UNKNOWN, not a proven denial.

## Data Constraints
Preserve all inherited changes without editing TASK-850 or TASK-851, the native probe, tests or binding. Do not clear security events. No real credentials, repositories or unrelated processes may be touched. A restore failure or uncertain state blocks all further dependent work.

## UI Constraints
No product-facing authorization, execution or recovery behavior is enabled by this diagnostic.

## Implementation Requirements
Implement a breakaway watchdog that survives owner termination and restores only the baseline failure bit. It must have bounded lifetime, signal readiness before mutation and refuse to change policy if independence or baseline cannot be proven. Verify parent termination and restoration behavior using a disposable fixture before changing audit policy. Keep the audit-enabled interval minimal. Do not implicitly retry a profile-creating diagnostic.

## Test Requirements
Tests must exercise normal completion, unexpected owner termination, timeout, no-ready watchdog and restoration failure without modifying system policy, then one actual controlled AppContainer diagnostic only if all prerequisites pass. Independently query the restored Windows audit state. Run task structure, runtime trace and affected security checks.

## Acceptance Criteria
A verified independent watchdog outlives the owner and restores the exact fixture value; actual audit policy equals its pre-run failure bit after the WFP diagnostic; observed events are correlated only to the fixture and missing evidence remains UNKNOWN. No proof of general network containment or product readiness is inferred.

## Done Definition
Record commands, observed baseline, watchdog tests, audit restoration, controlled diagnostic outcome, cleanup, remaining unknowns and any audit omissions. Obtain independent security review before relying on this mechanism.

## Risks
Abrupt termination could leave failure auditing enabled; concurrent administrator policy changes or incomplete event attribution make diagnosis inconclusive. A watchdog must not overwrite a concurrent change to the success bit. The existing TASK-851 command-audit omission remains open.

## Output Required
Auditable diagnostic evidence or a precise blocker, with the original Windows audit policy verified unchanged and historical records preserved.

## Progress and unresolved safety condition
- The Windows audit policy was not changed. A fresh administrator read-only query reported Filtering Platform Connection as no auditing.
- A fixture-only PowerShell watchdog uses CreateProcess with explicit job breakaway, checks that the child is outside any job, opens a synchronization handle to its owner and has a bounded lifetime. It has no mode that changes the Windows audit policy.
- The targeted Windows fixture tests passed 6/6 when run outside the restricted shell: normal owner exit, owner termination, watchdog not ready, timeout, an unexpected concurrent fixture value and watchdog expiry before the attempted fixture mutation. An earlier restricted-shell run failed with AuthorizationManager access denied; a subsequent run identified and corrected an empty current-directory argument. Tests have not been independently security-reviewed.
- Safety limitation: checking watchdog state and then mutating the fixture are separate operations. A watchdog can terminate after the check but before the write, so these tests do not establish a safe real-audit restoration protocol. A synchronization and recovery design must cover that race and be independently reviewed before any system audit mutation.
- No AppContainer profile-creating test was executed under this Task Pack. No WFP event was captured, network containment remains UNKNOWN, and no integrated merge gate has passed.
- Documentation link check passed for 409 Markdown files; Task Pack structure and diff whitespace checks passed. The six fixture tests require an unrestricted Windows child-process environment; this is not full-suite or candidate-CI evidence. Earlier TASK-851 command-audit omissions remain open.
- Independent review identified additional gaps: a watchdog can die after a change, normal owner exit does not await verified restoration, readiness files are not authenticated, wait errors are not handled as failure, and fixture compare/write is non-atomic. Concurrent administrator or policy changes cannot be attributed from a boolean alone. The fixture will first be reworked so the watchdog performs the mutation, the owner acts as its fallback, and normal completion awaits restoration. This is a fixture-only improvement, not authorization to modify audit settings; authenticated handshakes, trusted inputs, concurrent policy coordination and real-audit failure handling remain separate prerequisites.
- The fixture now uses a ready/permit/applied sequence, makes the watchdog the fixture mutation actor, asks it to restore on graceful shutdown, awaits and checks its receipt, and lets a surviving owner restore after a watchdog exit. Win32 wait failures are fail-closed and timeouts use a monotonic stopwatch. The explicitly Windows-only fixture suite passed 11/11 after these changes; the complete Python governance suite passed 52/52 before the platform annotation. On non-Windows systems these fixture tests explicitly skip and cannot count as the mandatory Windows evidence.
- A second independent review found that these changes still do not meet the real-audit safety contract: runtime control files are unauthenticated and can be injected, file read/compare/write is not atomic, double failures and partial writes are not covered, and a concurrent administrator or Group Policy change to the failure bit cannot be attributed reliably from its current value. A hung watchdog and stopping a real diagnostic before restoration also require stronger supervision. The current fixture accepts external paths and test switches, and is not an elevated production tool. No actual WFP audit diagnostic or policy mutation is authorized by this evidence.
- Windows fixture tests need an explicit Windows CI gate before relying on them; the Ubuntu documentation job discovers this suite but must not treat its platform skips as Windows validation. Full application gates and candidate CI for the current uncommitted changes remain unrun.
- A new negative fixture test reproduced an early change by injecting a permit file during the owner pause. The next fixture revision uses inherited anonymous pipes for control; marker files remain observation only. This does not establish protection from a process able to duplicate handles, trusted elevated inputs, atomic policy changes or recovery after simultaneous process failure.
- Iteration 3 fixture results: anonymous pipes now carry control messages, and the previously failing injected-permit test passes. Process creation limits inherited handles to the two pipe clients; a fixture verifies that the owner really holds an unrelated file handle while the watchdog does not identify that file. Two independent-review findings were reproduced and fixed: owner death after mutation but before the applied receipt, and failure to write the applied observation marker. Full Windows Python governance tests passed 56/56 with no skips; this includes 15 fixture tests. No actual audit or AppContainer diagnostic was run.
- Independent review still identifies non-atomic fixture read/compare/write, partial-write and hung-I/O failure, and uncoordinated concurrent administrator or Group Policy updates as unresolved. In particular a temporary failure-bit enable cannot be attributed to this diagnostic versus a concurrent administrator solely by reading the final bit; changing the real policy without an established coordination model would risk overwriting an external change. The current code remains a disposable fixture, not a verified elevated audit mechanism. Earlier command-audit omission, Windows CI evidence, integrated desktop execution and merge gates remain open.
- All three bounded iterations have been used; this pack does not authorize a fourth iteration. Its rejection preserves all actual results and does not accept the real-audit goal or the product merge gate.
- A final independent static review confirmed that the applied-marker write failure now reaches fixture restoration; it did not independently execute the test. It also found that other post-mutation exceptions, including process-wait failure, can still skip restoration. This joins the unresolved partial-write, concurrent-update and double-failure risks above.
