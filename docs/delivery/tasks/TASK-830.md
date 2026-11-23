# TASK-830: Fail closed on ambiguous DSH recovery evidence

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: standing user authorization to fix merge blockers without weakening original-Attempt recovery or the DSH capability policy.

## Requirement IDs
REQ-027, REQ-033, REQ-036, REQ-049, REQ-077, REQ-078, REQ-090, REQ-098

## Objective
Prevent an unauthenticated liveness boolean or conflicting duplicate event from fabricating covered DSH execution evidence.

## Context Pack
- docs/delivery/tasks/TASK-828.md
- docs/delivery/tasks/TASK-829.md
- docs/adapters/dsh.md
- docs/api/sai.md
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
- docs/delivery/tasks/TASK-830.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/adapters/dsh.md
- packages/dsh-adapter/src/dsh-event-journal.ts
- packages/dsh-adapter/src/dsh-reconciler.ts
- packages/dsh-adapter/tests/dsh-event-journal.test.ts
- packages/dsh-adapter/tests/dsh-reconciler.contract.test.ts

## Forbidden Files
Other paths, archive evidence, DSH source checkout, capability broker or policy implementations, production routing, persistence schema, user projects and credentials, other worktrees, real Codex, Electron sandbox verification, external operations and merge.

## Interfaces / Contracts
Keep existing call shapes. Without verified owner and durable journal evidence the legacy boolean reconciler returns `RECONCILING` and never authorizes redispatch. The in-memory journal accepts positive safe-integer sequences and bounded JSON evidence; exact repeats deduplicate, conflicting content for one sequence marks the journal permanently AMBIGUOUS, including conflicts hidden by redaction. Returned evidence cannot mutate retained evidence. Validation or encoding failure yields AMBIGUOUS without retaining the invalid event. Per-instance keyed fingerprints may detect conflicts without storing raw secret-bearing evidence; they are neither durable nor proof of authenticity.

## Data Constraints
Use synthetic evidence only. Do not log or retain raw sensitive event fields. Existing key-name redaction remains in force but is not a complete guarantee that arbitrary free text contains no secret. No SQLite, real DSH process or credentials are accessed.

## UI Constraints
No UI, renderer, IPC or production composition changes. DSH remains a disabled compatibility probe.

## Implementation Requirements
First reproduce the false RUNNING result from a boolean and the falsely covered conflicting sequence. Implement fail-closed recovery and bounded event validation with detached returned evidence, preserving exact duplicate and gap behavior. Do not enable DSH or disable Shell, filesystem, network and plugin capabilities. Mark any unresolved redaction, authenticity and durable reconciliation boundaries explicitly.

## Test Requirements
Observe red regressions before the fix. Test liveness true/false, malformed sequences and JSON, identical and conflicting duplicates, secret-field conflicts, event gaps, mutation of input or returned evidence and bounded oversized/deep inputs. Run affected DSH tests, lint, typecheck, build, full unit and contract, independent review and governance.

## Acceptance Criteria
No boolean or in-memory journal can claim RUNNING or permit redispatch. Conflicting or invalid evidence cannot remain COVERED or alter a retained first event. Legitimate duplicate and key-redaction behavior remain valid; all four DSH capability implementations remain unchanged.

## Done Definition
Commit scoped code, tests and facts with real results; this is not durable DSH recovery or merge readiness.

## Risks
An in-memory fingerprint disappears on restart; it is not a signature or substitute for authenticated platform state. Key-name redaction cannot recognize every secret embedded in text.

## Output Required
Fail-closed legacy DSH reconciliation, defensive in-memory journal, regression tests and precise limitations.

## Work in progress
Two initial regressions showed false RUNNING from a liveness boolean and false COVERED for conflicting duplicate secret fields. Independent review then found getter/array and aggregate-allocation bypasses; additional regressions failed before bounded descriptor-based normalization. A Proxy trap regression also failed before Proxy rejection was added. The journal now fingerprints normalized unredacted evidence using an ephemeral per-instance HMAC key and only retains detached key-redacted evidence; malformed and conflicting input becomes AMBIGUOUS. On the current patch, 39 DSH tests, lint, typecheck and build passed. Independent final static review found no substantiated Critical or Important issue and did not run tests. Full unit, contract and final governance remain pending. An initial patch format error left audit transaction `task-830-write-005` pending; the target was inspected and that same write completed once. Neither this memory journal nor a liveness boolean provides durable authenticated process evidence; free-text secret redaction remains unproven.

A separate common-key regression showed that api_key, privateKey and cookie values were not redacted; those key forms are now redacted and the focused test passed. A 1,078-passed, nine-skipped host full-unit run overlapped this later code change and is intermediate evidence only. The exact final patch requires fresh full validation. The attempted task record update had a context mismatch and was reconciled as the same audited write without repeating any external action.

The final code and tests subsequently passed the Windows host full-unit suite: 1,079 passed and nine skipped across 182 files. The complete fake-service contract suite passed 50/50. Lint, typecheck and build passed. Skips are not passes. The DSH database journal, process identity, authenticated recovery and free-text secret handling remain separate unresolved requirements; this result is not DSH enablement or merge acceptance.
