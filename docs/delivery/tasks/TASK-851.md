# TASK-851: Diagnose worker network-isolation evidence

## Status
REJECTED
Execution outcome: BLOCKED (network isolation unproven; audit deviation open).
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authority: the user explicitly authorized replanning and continuation after TASK-850 exceeded its limit. TASK-850 remains BLOCKED and its history is not rewritten.

## Requirement IDs
REQ-090, REQ-091, REQ-093, REQ-094, REQ-095, REQ-098

## Objective
Diagnose the existing disposable worker fixture's pending Winsock connection and produce reliable, bounded evidence of the observed outcome. Preserve the distinction between an explicit denial, a successful connection and an unknown pending result. This is not production dispatch, general egress enforcement, or Electron sandbox validation.

## Context Pack
- docs/delivery/tasks/TASK-850.md
- docs/delivery/tasks/TASK-849.md
- [Winsock select semantics](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-select)
- [Winsock connect semantics](https://learn.microsoft.com/windows/win32/api/winsock2/nf-winsock2-connect)
- [Windows AppContainer isolation](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)

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
- docs/delivery/tasks/TASK-851.md
- docs/delivery/tasks/TASK-850.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- apps/desktop/native/binding.gyp
- apps/desktop/native/containment-probe.cc
- apps/desktop/tests/native/containment-probe-test.cjs

## Forbidden Files
All other repository paths, real Projects and credentials, existing user ACLs and security profiles, global firewall or loopback exemptions, trust stores, signing keys, production IPC activation, real Codex, Electron sandbox-security validation, merge and release.

## Interfaces / Contracts
Treat `WSAEWOULDBLOCK`, timeouts, missing events and unverified cleanup as UNKNOWN, never a proven network denial. Any self-test is limited to a generated temporary profile, a self-owned Job and controlled local endpoint. DSH's Shell, filesystem, network and plugin abilities remain available when authorized; this test does not change their policy.

## Data Constraints
Preserve TASK-850's blocked stop record, its existing binding change, existing user work and previous evidence. The only permitted TASK-850 edit is to correct its unsupported structural status label to REJECTED while explicitly retaining execution outcome BLOCKED; no stop evidence or limit may be altered. Do not edit the inherited binding. Only self-created test files, test profiles and loopback fixtures may be accessed or cleaned. Never kill unrelated processes or change user files, firewall configuration or loopback exemptions. Unknown cleanup retains evidence and blocks another attempt.

## UI Constraints
No product-visible execution, cancellation, authorization or recovery is enabled.

## Implementation Requirements
Investigate the current probe and official Windows semantics before changing behavior. Add tests before code changes. Count each run that creates a real test AppContainer as one iteration, record it before the run, and stop before a fourth such run. No automatic repeat after ambiguous effects or uncertain cleanup.

## Test Requirements
Use deterministic tests to distinguish explicitly refused, connected and pending/unknown network outcomes; verify a positive listener control, token and scoped file access, owned process cleanup and exact test-profile cleanup. Run relevant native, build, security and governance checks. Real Codex and Electron sandbox-security tests remain deferred.

## Acceptance Criteria
Evidence identifies the actual observed Winsock state without converting a timeout into denial. No production security guarantee, general outbound isolation or trusted installation may be inferred. A pending outcome can close a diagnosis as inconclusive but cannot satisfy a production isolation gate.

## Done Definition
Record each real profile-creating test and cleanup result, code review, actual command outcomes, remaining gaps and candidate CI. Restore full governance and preserve the historical TASK-850 stop record.

## Risks
An AppContainer loopback-specific drop is not a general network boundary. A child may inherit broader OS access than expected; incorrect cleanup may affect user data. Same-user path races and a compromised installation remain outside this test's proof.

## Output Required
Auditable diagnostic evidence and appropriately fail-closed implementation or a specific unresolved blocker; no claim that the product or merge is complete.

## Preserved TASK-850 snapshot

Before re-planning, exact uncommitted file bytes were recorded as Git blob objects (not commits): probe `5d1d89b968ecffc3645e55e227382ee01aa56cdb`, test `ad51d903aedae9b1a915a3978ef4be65133e21de`, binding `98db352ff69cec61fe5e14ccf50c756866c79428`, stop record `34e034f0db89673291d4f0bf6d037054d538334c`, audit `9ca4b488f29130f1d064a4f165e21748c3030bdf`, trace `d73ec667af15c4a98b0aa4e847150c146fe3abeb`. These loose objects require a durable referenced commit before garbage collection; this record does not imply acceptance.

## Runtime iteration ledger

- Iteration 1 authorized: one disposable profile-creating self-test after the
  deterministic classifier test and native build. Observe select return,
  readiness flags, SO_ERROR availability, result, Job termination and exact
  profile cleanup. Pending remains UNKNOWN; no automatic retry is authorized
  when cleanup or side effects are uncertain. No production execution.
- Iteration 1 completed: the deterministic classifier passed nine cases; the
  native self-test returned exit 1. The controlled positive listener succeeded;
  the AppContainer token, allowed read, denied fixture read, owned child,
  no accepted restricted connection and unrelated-process checks succeeded.
  Winsock returned `select=0`, no ready/exception flags, no SO_ERROR result,
  and initial `WSAEWOULDBLOCK`; classification is UNKNOWN, not DENIED.
  The probe reported owned jobs stopped and profile deleted; a separate exact
  check found the generated profile registration and temporary root absent.
  This result does not establish why the connection remained pending or prove
  general outbound isolation. Do not repeat without a new evidence-based
  hypothesis; at most two profile-creating iterations remain in this pack.
- Audit limitation: the first profile-creating command, earlier local build/test
  commands and the read-only audit-policy queries
  were recorded in this ledger and their results observed, but no separate
  `COMMAND_EXEC` PENDING intent was written before they ran. The file-write
  trace and runtime Exit 0 therefore do not establish a complete command audit.
  This omission must not be retroactively represented as a prior intent or
  hidden; subsequent side-effecting commands require a real prior intent.
- Read-only investigation: requesting the current Windows Filtering Platform
  Connection audit policy by subcategory GUID returned `0x00000522` (required
  privilege not held). No audit policy, firewall rule or loopback exemption
  was changed. Windows documentation describes WFP event 5157 as possible
  evidence of a blocked connection, but availability and correlation to this
  fixture have not been demonstrated; `WSAEWOULDBLOCK` remains UNKNOWN.
- Independent review found that an earlier version incorrectly treated
  `WSAENETUNREACH` and `WSAECONNREFUSED` as proof of a denied operation.
  A deterministic regression first failed, then passed after both errors were
  mapped to UNKNOWN; explicit `WSAEACCES` remains a narrow observed-denial
  result, not attribution to a particular policy or a general egress proof.
  The later build and classifier checks have actual prior `COMMAND_EXEC`
  intents and results; they do not repair the earlier missing command intents.
- A second independent review found socket-creation failure could be mistaken
  for a rejected connection before `connect` was attempted. The corresponding
  deterministic tests failed first and passed after that path was made UNKNOWN.
  A subsequent read-only review found no further Critical or Important false
  denial in the inspected branches. This is not a production-isolation proof.
- Iteration 2 authorized: one disposable profile-creating `--diagnose` run
  after deterministic protocol and diagnostic-exit regressions passed and
  independent review found no remaining Critical or Important issue in those
  branches. The expected exit from the native probe is 10 only for a verified
  UNKNOWN observation after owned Job termination and profile cleanup; it is
  never the isolation PASS. A failure or unexpected state is not retried
  automatically and requires exact cleanup reconciliation.
- Iteration 2 completed: `--diagnose-only` exited 0 only because the fixture
  produced its expected native exit 10 and explicit `UNKNOWN` result with
  `loopbackDenied=false`; that is diagnostic success, not an isolation PASS.
  The observed select result was 0 with no ready flags or SO_ERROR and the
  initial error was 10035. The fixture reported both Jobs stopped and profile
  deleted; an independently executed exact lookup found neither the generated
  profile registration nor temporary root. This command and the cleanup lookup
  have prior `COMMAND_EXEC` intents and results. One profile-creating run
  remains available, but no additional run is justified by the same evidence.
- Subsequent independent review found contradictory pending telemetry could be
  accepted as UNKNOWN (not as DENIED). A regression failed before the fix and
  passed after retaining the original pending error when `SO_ERROR` is absent.
  The exact iteration-2 tuple is included in the deterministic regression.
  No third AppContainer run was performed, and the corrected code has not had
  a new full isolation run or candidate CI. Its status remains unaccepted.
- Reviewed structural correction: the all-packs gate found that the checker
  does not accept BLOCKED as a Task Pack status. TASK-850 remains blocked and
  unaccepted; only its status label may be changed to REJECTED with the
  execution outcome explicitly BLOCKED. Its stop record and iteration limit
  are immutable. This correction does not authorize another TASK-850 run.
- Local governance after the structural correction: 408 Markdown documents,
  198 Task Packs, requirement traceability, five Schemas, 41 governance unit
  tests, `git diff --check`, and the exact changed/untracked path comparison
  passed. The inherited binding hash matches the pre-replan snapshot. Runtime
  trace returned Exit 0 for recorded transactions, but it cannot establish that
  the earlier missing command intents existed; that audit deviation remains
  open. No candidate CI includes TASK-850 or TASK-851 changes.
- Additional local regression on the uncommitted patch: Windows production
  build, lint and typecheck passed; 187 unit files contained 1,182 passing
  tests and the nine explicitly listed skips (the summary validator passed).
  Fake-service contracts passed 50/50 with no skips; real Electron functional
  checks passed 2/2 and browser checks 9/9. Test-namespace WinCred and the
  owned-process and bounded-I/O native checks passed. Reports were written to
  unique local temp files. These checks do not execute real Codex, establish
  Electron sandbox security, run the full AppContainer isolation self-test to
  PASS, resolve the earlier audit omission, or constitute candidate CI. These
  results predate the later native handle-bound cleanup changes and require
  affected checks again before any acceptance.
- A subsequent independent review found name-based cleanup could affect a
  substituted file. The probe now atomically creates a random directory
  relative to its held parent, uses held file identities for ACLs and deletion,
  and fails closed on identity changes. A `--cleanup-only` test initially
  failed with Windows error 87; the exact test directory was confirmed absent.
  After a documented same-directory rename correction, the test passed and an
  independent exact check confirmed its temporary root absent. This fixture
  test did not create an AppContainer and does not prove hostile same-user
  race resistance or production installation security.
- Iteration 3 authorized: one final profile-creating `--diagnose-only` run
  specifically to test whether the AppContainer fixture can still access its
  authorized file and clean up under the new identity-bound handle sharing.
  The only accepted diagnostic result remains explicit UNKNOWN after proven
  process/profile cleanup; it is not an isolation PASS. This consumes the last
  permitted profile-creating run; no fourth run is authorized.
- Iteration 3 completed: the held-identity implementation successfully reached
  AppContainer token, allowed-file read, protected-file denial, owned child,
  non-interference and cleanup checks. Winsock again returned pending
  (`select=0`, error 10035); native exit 10 and `UNKNOWN` were preserved, not
  counted as network denial. The exact generated profile registration and
  temporary root were independently confirmed absent. Both the run and the
  cleanup lookup have prior `COMMAND_EXEC` intents. No further profile-creating
  run is authorized by this pack; production isolation remains unproven.
- Final local state: the full project build passed after the handle-bound
  cleanup changes; the non-profile classifier and identity-cleanup regression
  passed again afterward. The last real AppContainer diagnostic remains
  UNKNOWN. The earlier 1,182/9 unit, 50/0 contract, 2/2 desktop and 9/9 browser
  results preceded the final native cleanup changes and are not a clean-SHA
  acceptance of those changes. No candidate CI covers this pack. The historical
  unrecorded command intents remain an explicit audit deviation, not silently
  backfilled or waived. This pack is not accepted and does not authorize a
  fourth profile-creating run.
