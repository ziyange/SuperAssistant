# TASK-611: Production DSH SAI Adapter
## Status
APPROVED
PHASE: PHASE-006
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-026, REQ-030, REQ-031, REQ-049, REQ-077, REQ-078, REQ-090, REQ-091, REQ-093, REQ-095, REQ-096, REQ-098
## Objective
Implement the production DSH process host, normalized event journal bridge,
Tool Broker, cancellation path, and reconciliation guard while retaining all
DSH Shell, filesystem, network, and approved plugin capability through
per-effect Super Assistant authorization.
## Context Pack
- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/adapters/dsh.md
- docs/verification/reports/phase-006-task-610.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
## Implementation Requirements
- Use one DSH process, controlled session root, and task worktree per Attempt.
- Make SQLite/journal state, not DSH session state, authoritative for lifecycle,
  sequence, result, cancellation, and reconciliation.
- Route every Shell/filesystem/network/plugin request through the Tool Broker;
  validate Function, Proposal, Grant, Project snapshot, Lease fence, worktree,
  target rule, and budget before effect, then journal redacted evidence.
- Require approved plugin identity, version, source digest, and permissions;
  refuse install, update, enable, or direct model-provided plugin settings.
- Fail closed to UNKNOWN/RECONCILING for process loss, event gap, profile drift,
  unreadable session, or ambiguous effect. Never redispatch from either state.
## Done Definition
All SAI lifecycle and broker tests pass: duplicate start is idempotent, stale
Grant/Lease and unauthorized capability effects are denied, cancellation proves
process termination and Lease release, and restart reconciliation cannot
duplicate a DSH effect.
## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/requirement-traceability-matrix.md
- docs/delivery/phase-006.md
- docs/delivery/tasks/TASK-611.md
- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/adapters/dsh.md
- docs/verification/reports/phase-006-task-610.md
- docs/api/sai.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/operations.md
- docs/verification/quality-gate.md
- docs/verification/test-strategy.md
- docs/verification/scenarios.md
## Allowed Files
- packages/dsh-adapter/src/dsh-probe.ts
- packages/dsh-adapter/src/dsh-process-host.ts
- packages/dsh-adapter/src/dsh-event-journal.ts
- packages/dsh-adapter/src/dsh-tool-broker.ts
- packages/dsh-adapter/src/dsh-reconciler.ts
- packages/dsh-adapter/src/index.ts
- packages/dsh-adapter/tests/dsh-process-host.test.ts
- packages/dsh-adapter/tests/dsh-event-journal.test.ts
- packages/dsh-adapter/tests/dsh-tool-broker.test.ts
- packages/dsh-adapter/tests/dsh-reconciler.contract.test.ts
- packages/dsh-adapter/tests/dsh-adapter.contract.test.ts
- packages/dsh-adapter/fixtures/production.cordis.yml
- packages/domain/src/dsh-execution.ts
- packages/domain/tests/dsh-execution.test.ts
- packages/persistence/src/dsh-attempt-journal-repository.ts
- packages/persistence/tests/dsh-attempt-journal-repository.test.ts
- apps/desktop/src/main/dsh-adapter-service.ts
- apps/desktop/tests/main/dsh-adapter-service.test.ts
- docs/adapters/dsh.md
- docs/api/sai.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/operations.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-611.md
- docs/verification/reports/phase-006-task-611.md
## Forbidden Files
Any file not explicitly listed; every file under `E:\Programs\deepseek-harness`; renderer/UI changes; direct DSH CLI or terminal-text parsing; direct credential storage; unbrokered capability calls; plugin installation/update/enable; `--yolo`; auto-approval; remote Git actions.
## Interfaces / Contracts
SAI retains only its eight operations. `DshProcessHost` supplies supervised
process evidence; `DshEventJournal` supplies normalized ordered evidence;
`DshToolBroker` accepts a capability request only with current policy bindings;
`DshReconciler` returns proven state or `INDETERMINATE`. DSH details never enter
product Task state.
## Data Constraints
Journal records are append-only and redacted. No secret, provider response, or
raw environment enters SQLite. Each mutating request includes the current
Grant, Project snapshot, baseline, and fencing token.
## UI Constraints
DSH availability is truthful. Disabled, blocked, and reconciling states never
present an action that can bypass broker approval.
## Test Requirements
Write failing tests first. Run focused tests, unit, contract, lint, typecheck,
build, E2E, migration/restart/cancel/security tests, then the documented Python
governance gate order and `git diff --check`.
## Acceptance Criteria
- Duplicate start causes at most one external effect.
- Stale Grant, snapshot, Lease, capability target, and plugin declaration deny
  before an effect.
- Authorized Shell, filesystem, network, and plugin fixture requests produce
  broker journal evidence.
- Process crash, sequence gap, and restart remain UNKNOWN/RECONCILING until
  proven; no redispatch occurs.
- Cancellation proves process-tree termination and Lease fencing/release.
## Risks
DSH lacks prompt-specific result and cancel queries. Ambiguous evidence must
remain blocked; no timeout or process exit is interpreted as success.
## Output Required
`docs/verification/reports/phase-006-task-611.md` with SAI, broker, crash,
cancel, reconciliation, capability, and full-gate evidence.
