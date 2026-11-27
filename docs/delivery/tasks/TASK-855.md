# TASK-855: Read-only WFP event correlation feasibility

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authority: standing user authorization to replan and continue independent work toward merge. This is a different read-only approach; it does not reopen or change the exhausted TASK-851 or TASK-854.

## Requirement IDs
REQ-090, REQ-093, REQ-094, REQ-098

## Objective
Develop and validate a bounded read-only WFP event observation and exact fixture-correlation mechanism as a potential diagnostic without changing system audit configuration.

## Context Pack
- docs/delivery/tasks/TASK-851.md
- docs/delivery/tasks/TASK-854.md
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
- docs/delivery/tasks/TASK-855.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- scripts/wfp_readonly_events.py
- tests/test_wfp_readonly_events.py

## Forbidden Files
All other repository files, all existing task evidence, system audit policy, WFP engine settings, firewall rules, network profiles, AppContainer profiles, real Projects, production IPC, real Codex, Electron sandbox security tests, merge and release.

## Interfaces / Contracts
Only query already-existing WFP event collection through documented read-only APIs. Correlate the exact owned fixture identity, network tuple and time bounds; a matching event is evidence only of that event. Missing fields, unavailable event collection, truncation, overflow, unsupported API and absent events are UNKNOWN. Do not report generic egress protection or actual fixture success from synthetic data.

## Data Constraints
Use synthetic event data in tests. Do not output, persist or disclose unrelated network events, credentials, user data or process information. Do not create a network listener, AppContainer or execute the prior probe in this task.

## UI Constraints
No production route or user-facing security status is enabled.

## Implementation Requirements
Write failing tests before implementation. Separate exact pure correlation from bounded event acquisition. Use documented native ABI and fail closed on unavailable privileges, unknown event versions, missing tuple fields and pointer decoding errors. Use owned allocations and release every native handle and buffer.

## Test Requirements
Run targeted positive and negative event matching tests, malformed input and overflow tests, native ABI checks and a read-only Windows capability query. Run the full Python governance suite and runtime validation. No real Codex or Electron sandbox security test.

## Acceptance Criteria
Only complete, unique, exact fixture-matching drop events are reported as observations; all missing, ambiguous or unverifiable cases are UNKNOWN. Querying existing event state must not change policy or collect unrelated details in the output. This task does not claim that a fixture was denied.

## Done Definition
Record test outcomes and any native API or privilege limitation. Obtain independent security review before relying on this mechanism for diagnosis.

## Risks
WFP event logs are circular and may omit events or fields. Matching a network tuple does not prove process ownership or general network isolation. Native ABI mistakes may crash the observing process. No audit-policy concurrency or production recovery issue is resolved by a read-only query.

## Output Required
Bounded, fail-closed read-only event-correlation evidence or a precise blocker with the existing security state unchanged.

## Current evidence
- Iteration 1 added a pure correlation function and synthetic tests for exact tuple, time, direction and filter match, duplicate/incomplete input, field omissions, oversized input and malformed addresses. The address-type regression first produced an incorrect observation and then passed after requiring text addresses.
- A read-only WFP engine collection-option query was added using the documented open/get/free/close APIs. The actual current-process query returned UNKNOWN; this does not establish whether collection is enabled or why the query could not establish it. No option-setting API is called.
- Independent static review found that the existing correlation uses caller-supplied completeness and unauthenticated fixture data; it cannot establish a real observation. It also found an exception during freeing could skip closing the engine. A targeted test reproduced the cleanup failure, then passed after nested cleanup was added. Further ABI and negative-path tests remain required.
- The full Windows Python suite passed 75/75 with no skips after the cleanup fix. These results are synthetic/local evidence only: bounded native event enumeration, decoding, authenticated fixture and collection completeness remain unimplemented. This task is not accepted; no real AppContainer diagnostic, system-policy mutation, desktop production integration, candidate CI or merge was performed.
- Iteration 2 reproduced an unhandled native-query exception; it now returns UNKNOWN and still closes the owned engine handle. The targeted suite passed 9/9, including synthetic enabled/disabled, invalid type and value, null, denied query, failed close and resource-release cases.
- Two audited read-only Windows probes showed engine open/close return 0, but both FwpmEngineGetOption0 and FwpmNetEventCreateEnumHandle0 return 5 (access denied) in this process, even outside the automation sandbox. This is not proof that event collection is disabled or that network traffic is blocked. No permissions or policy were changed.
- The next full Python run failed: 77 tests, two fixture readiness failures and one 20-second fixture-inspection timeout. The same three tests passed individually with unchanged limits; a subsequent system CPU snapshot was 94 percent, which may contribute but does not prove the root cause. The full gate remains NOT PASS; earlier 75/75 does not cover the latest changes. No test threshold was relaxed.
- Iteration 3 added a synthetic native Header3/Event5 and classify-drop decoder. Independent static review found that incomplete fields and unrelated events must never be silently ignored, that IPv6 scope is absent from the correlation contract, and that native pointer/SID lifetime, ABI sizes and IPv4 byte order require independent validation. A regression reproduced an IPv6 false observation; IPv6 now remains UNKNOWN until scope is supported. Decoder results now explicitly distinguish DECODED from UNKNOWN. The targeted suite passed 11/11.
- Actual event enumeration, trustworthy fixture identity, pointer provenance, complete event observation and supported IPv6 remain unimplemented. The machine CPU snapshot reached 100 percent, and a fresh full suite was not run; the prior full run remains failed. Three iterations are exhausted and TASK-855 is not accepted. Do not treat synthetic results, this decoder, or a missing event as proof of isolation. No audit setting, AppContainer profile, real Codex or Electron sandbox-security test was changed or run.
