# TASK-854: Verify crash and concurrent recovery ownership

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authority: user explicitly authorized replanning after TASK-853. Preserve TASK-850 through TASK-853 and their stop evidence unchanged.

## Requirement IDs
REQ-090, REQ-091, REQ-093, REQ-094, REQ-095, REQ-098

## Objective
Reproduce and address the remaining fixture risks from TASK-853: process death during write, identical concurrent updates after intent, and both processes failing. Determine an evidence-backed recovery model before any real audit change.

## Context Pack
- docs/delivery/tasks/TASK-851.md
- docs/delivery/tasks/TASK-852.md
- docs/delivery/tasks/TASK-853.md
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
- docs/delivery/tasks/TASK-854.md
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
All other repository files, unrelated user data and processes, firewall or loopback configuration, other audit categories, trust stores, signing keys, production IPC activation, real Codex, Electron sandbox security tests, merge and release.

## Interfaces / Contracts
Existing rejected tasks and their limits are immutable historical evidence. Only test-owned files and processes may be changed or terminated. An intent is not proof of an effect. Identical external changes and ABA are not silently overwritten. Missing or partial recovery evidence remains UNKNOWN.

## Data Constraints
Only this task, the two fixture files, and transaction audit/trace may be edited. Listed older tasks and native files are inherited dirty state, not editing permission. No real audit policy mutation is allowed until independent security review, authenticated inputs, scoped concurrent-administrator coordination and a proven recovery mechanism pass.

## UI Constraints
No production-facing execution or recovery route is enabled.

## Implementation Requirements
Use test-first fault injection with exact owned process handles and bounded waits. Establish object identity and ownership without treating a matching value as proof. Preserve external writes, distinguish committed and ambiguous effects, and do not infer automatic recovery after all recovery processes die without a durable independently verified mechanism.

## Test Requirements
Test process termination during write, failure after intent before write, identical external value and ABA, owner and watchdog failure, cleanup safety, full Windows fixture and governance suites. Document all failures and retain ambiguous artifacts. Independent security review is mandatory.

## Acceptance Criteria
No false successful restoration or overwriting of an unowned change in tested cases; abrupt interruption is either recovered with evidence or explicitly UNKNOWN with safe retained state. Real audit and merge remain blocked unless their own prerequisites pass.

## Done Definition
Record commands, exact outcomes, independent review and unresolved limits. The fixture result cannot by itself establish production or merge readiness.

## Risks
An event bit cannot reveal which administrator changed it. Both processes dying or losing power may require a persistent recovery mechanism and an agreed concurrency boundary. Do not install a service or scheduled task without a narrowly reviewed scope.

## Output Required
Tested, auditable recovery evidence or a precise blocker without changing real system audit settings.

## Current evidence
- The targeted test `test_same_value_external_write_after_intent_is_not_rolled_back` reproduced the independent review finding: after the fixture watchdog exits after commit but before writing, an external `temporary` value was incorrectly changed to `original`. The test failed as expected and remains failing; it is not a passing gate.
- Only fixture-only test instrumentation was added to exercise the exact window. No real audit policy, AppContainer profile, user Project, real Codex or Electron sandbox-security setting was changed. TASK-853 and earlier records remain unchanged.
- A mutation intent is insufficient evidence of a committed write. An ownership or fencing design that remains effective across watchdog failure is required; no design or implementation is yet accepted for Windows audit policy or the fixture's simultaneous-process-failure case.
- Iteration 2 tests a narrower file-fixture fence: duplicate the watchdog's already-open, write-exclusive file handle into the owner before acknowledging mutation intent, retain it through the pre-receipt failure window, and release it only after a verified applied receipt or fallback. This must prevent an outside write in that window and verify file identity. It does not cover ABA after releasing the fence, both processes dying, or Windows audit-policy concurrency.
- Independent review identified ABA after the applied receipt. A new failing test verifies that an external write can currently enter that window. The next fixture change retains the shared write-exclusive handle through confirmed restoration and verifies that external writes are refused during the protected interval. This is a local fixture fence, not an audit-policy or double-failure guarantee.
- A targeted self-termination test now reproduces a watchdog being forcibly terminated after a partial write; the original fixture currently remains partially modified. Recovery may only use a force-to-baseline path while the owner proves it retained the exact exclusive duplicate handle continuously since the baseline check. Missing fence or both processes dying must remain UNKNOWN.
- The fixture now retains the same write-exclusive handle and its owner duplicate through restoration. Tests reject external same-value and ABA writes while the fence is held, then verify writing is allowed after release. A controlled watchdog TerminateProcess after a partial write now returns the fixture to its baseline under the surviving owner's verified fence. A no-write failure also leaves the baseline modification time unchanged. These are controlled file tests, not Windows audit policy guarantees.
- Independent static review found no confirmed ordinary-file overwrite within the tested single-survivor fence assumptions; writable mappings, other duplicated file objects, raw-volume writes and simultaneous process failure are not covered. The full Windows Python suite passed 66/66 with no skips; a prior intermediate fixture run had two expected conflicts with the newly exclusive fence and was corrected with tests preserving pre-fence external-value checks and post-release writes.
- The double-process-failure case, persistent recovery or explicit durable UNKNOWN evidence, real audit-policy coordination, privileged trusted inputs, AppContainer diagnostic, Windows candidate CI and desktop integration remain unproven. No actual system audit setting was changed, and real Codex and Electron sandbox security were not run.
- Follow-up review requested proof that the partial-write test actually terminated the watchdog, rather than allowing its catch handler to recover. The owner now records the watched process exit code in this test, which asserted code 26 and recovered the original value. A separate failure-before-write regression checks that fallback does not rewrite the unchanged file or alter its modification time. Both targeted tests passed; the full Windows Python suite subsequently passed 66/66 without skips.
- The reviewer did not run tests and scoped its static conclusion to ordinary file-handle writes while at least one process retains the verified fence. Existing writable mappings, duplicated handles outside this protocol, raw-volume writes, both processes dying, and real Windows audit-policy concurrency remain unproven. TASK-854 is not accepted and no controlled diagnostic or merge is authorized by this evidence.
- Iteration 3 added fixture-only pre-write UNKNOWN intent evidence. A targeted test killed the owned owner and watchdog after a flushed partial write, checked both exit states and exact partial bytes, and observed the same file and retained evidence from a new inspector process without rollback. A replaced fixture identity, missing, malformed, oversized or PASS-like evidence fails closed. The script no longer obtains termination rights for the supplied owner PID; the test driver holds the child handle and checks its parent against the live owner before termination. Targeted tests passed. The complete `python -m unittest discover -s tests -v` suite passed 68/68, no skips, on the final test change.
- Independent static review found that the fixture paths and control artifacts do not establish trusted ownership, the PID-file/parent check does not bind the exact created watchdog handle, and the journal has no authenticated operation provenance and can be forged or replayed. The UNKNOWN marker is an untrusted conservative clue, not proof of an effect, trusted recovery authority, power-loss durability, or evidence about a real audit policy. File identity comparisons alone cannot close these gaps. TASK-854 therefore remains unaccepted; its three iterations are exhausted. Real policy mutation, controlled diagnostic, production recovery activation and merge remain blocked by their outstanding prerequisites. No Windows audit policy was changed.
