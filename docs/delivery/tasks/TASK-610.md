# TASK-610: DSH compatibility probe
## Status
APPROVED
PHASE: PHASE-006
MAX_ITERATIONS: 4
user_confirmed: true
## Requirement IDs
REQ-077, REQ-078, REQ-090, REQ-091, REQ-096
## Objective
Prove the observed local DeepSeek Harness public profile can be safely identified and rejected on drift before any production DSH Adapter or DSH capability Function is routable.
## Context Pack
- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/superpowers/specs/2026-08-23-dsh-adapter-design.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
## Implementation Requirements
- Read only configured DSH Git identity and public SDK/protocol metadata.
- Spawn only the repository-owned JSON-RPC fixture; never invoke `dsh`, a provider/model, a credential, a network client, a plugin installer, or a Shell/filesystem capability tool.
- Validate JSON-line framing, `initialize` identity, profile/commit/protocol drift rejection, malformed-frame handling, declared brokered capabilities, and the shutdown/EOF/terminate/kill evidence ladder.
- Map every SAI operation to deterministic probe evidence or an explicit unsupported reason; absent proof is a completed BLOCKED report, never authorization for TASK-611.
## Done Definition
The probe identifies the exact compatible public profile, rejects all drift, proves no provider or capability effect occurred, and records deterministic eight-operation mapping evidence. Otherwise it ends BLOCKED and DSH remains Disabled.
## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/requirement-traceability-matrix.md
- docs/delivery/phase-006.md
- docs/delivery/tasks/TASK-610.md
- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/superpowers/specs/2026-08-23-dsh-adapter-design.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
- docs/verification/quality-gate.md
- docs/verification/test-strategy.md
- docs/verification/scenarios.md
## Allowed Files
- package.json
- package-lock.json
- packages/dsh-adapter/package.json
- packages/dsh-adapter/tsconfig.json
- packages/dsh-adapter/src/dsh-probe.ts
- packages/dsh-adapter/tests/dsh-probe.test.ts
- packages/dsh-adapter/fixtures/probe.cordis.yml
- docs/adapters/dsh.md
- docs/delivery/tasks/TASK-610.md
- docs/verification/reports/phase-006-task-610.md
## Forbidden Files
Any file not explicitly listed; every file under `E:\Programs\deepseek-harness`; production DSH process host, broker, reconciler, renderer/UI integration, credential storage, provider/model calls, network calls, plugin installation, unbrokered Shell/filesystem effects, terminal-text lifecycle parsing, `--yolo`, auto-approval, remote Git actions.
## Interfaces / Contracts
Consumes `DshProbeConfig`, whose fields are `repositoryPath`, `expectedCommit`, `expectedProtocolVersion`, `runtimeCommand`, and `runtimeArgs`. Produces asynchronous `probeDsh(config)` evidence named `DshProbeResult`: runtime identity, public protocol identity, feature observations, profile digest, shutdown evidence, and fail-closed reasons. SAI retains exactly its eight operations and no DSH identifier enters product state.
## Data Constraints
Fixtures and reports contain no secret, prompt, credential, provider response, or executable DSH session. DSH observations are evidence only; SQLite is not opened or mutated by this probe.
## UI Constraints
No UI change. DSH remains Disabled during and after this Task unless a later approved production Task Pack enables it.
## Test Requirements
Run the focused Vitest probe, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:contract`, `npm run test:e2e`, `npm run build`, then the documented Python governance gate order and `git diff --check`.
## Acceptance Criteria
- Matching identity and protocol metadata pass; commit, protocol, server, or profile drift fails closed.
- A malformed frame is rejected without a process leak.
- Shutdown evidence proves the fixture process is reaped before cancellation is observed as complete.
- Capability declarations show that Shell, filesystem, network, and plugin operations would require the future broker; no such operation is performed.
- Every eight-operation mapping has deterministic evidence or an explicit blocking reason.
## Risks
DSH's evolving public profile may be incompatible or insufficient. Any missing proof, untrusted output, process ambiguity, or accidental external effect keeps DSH Disabled and blocks TASK-611.
## Output Required
`docs/verification/reports/phase-006-task-610.md` with runtime identity, protocol/profile evidence, command exit codes, eight-operation matrix, capability non-effect declaration, failures, and explicit PASS or BLOCKED conclusion.
