# PHASE-001: Platform foundation

- State: Archived; TASK-100 through TASK-106 accepted, with evidence in `docs/archive/phase-001/`
- Horizon: H1
- Branch family: `codex/phase-001-*`
- Archive path: `docs/archive/phase-001/`

## Goal

Create a secure, testable Windows desktop foundation that can persist control-plane facts, onboard a user, register Projects, isolate task worktrees, and discover a local Codex runtime without starting side-effecting Codex work.

## Requirements

Primary scope is `REQ-001–019` plus the foundation portions of `REQ-020–039` and the cross-cutting `REQ-090–099` constraints cited by TASK-101–105.

## Dependencies

- Accepted `TASK-000` facts and local gates.
- Node 22.x, Windows Credential Manager, Git, SQLite, and a locally installed Codex App Server for optional discovery tests.
- ADR-001 through ADR-005.

## Scope

- Repository/package/test scaffolding and dependency policy.
- Secure Electron renderer/main boundary and validated IPC.
- SQLite schema, migration discipline, repositories, and read projections for foundation objects.
- Onboarding, Project registration, repository validation, and task-worktree service.
- Codex App Server worker startup, initialize/health/describe, authentication state, and capability discovery.
- Agent Template fields reserved in the model; no template authoring UI or behavior.

## Non-goals

No Proposal confirmation, command execution, Codex Turn that mutates a project, Task orchestration, Decision, Artifact content capture, multi-agent scheduling, monitoring, remote runtime, or team access.

## Interface impact

Introduces internal Project, Agent Catalog, credential, IPC, migration, worktree, and read-only SAI discovery boundaries. `ExecutionPort.start`, `resume`, and `cancel` remain unavailable and must fail closed. Codex Thread/Turn identifiers may exist only inside adapter persistence.

## Risks and controls

- Renderer privilege escalation: context isolation, no Node integration, typed IPC allowlist, origin checks.
- Credential exposure: only opaque credential references leave the credential service.
- Dirty repository or path aliasing: canonical path checks and explicit worktree preconditions.
- Upstream protocol drift: fake server fixtures and recorded version/capability negotiation.
- Premature H2 coupling: reserve version references without implementing templates.

## Test strategy

Vitest domain and repository tests; SQLite migration forward/rollback tests; IPC negative tests; fake App Server initialize/health/describe contracts; Playwright onboarding and Project registration flows; opt-in real discovery smoke; lint, typecheck, and build.

## Entry conditions

- TASK-000 passes every local documentation gate.
- TASK-100 passes its documentation, schema, traceability, and runtime-trace gates.
- TASK-101–106 pass Task Pack validation and retain `APPROVED` plus `user_confirmed: true`.
- A `codex/phase-001-*` branch and isolated worktree are created from the accepted baseline.

## Exit conditions

- All five Task Packs pass their acceptance criteria.
- No side-effecting Codex operation is reachable.
- Project and Agent discovery survive application restart without secret leakage.
- Worktree isolation is proved against an unchanged original repository.
- Product/engineering facts are written back from implementation evidence.
- TASK-201–204 are revised if needed and approved for PHASE-002.

## Archive evidence

The archive contains phase summary, exact pack snapshots, test and build output, security review, migration evidence, known issues, ADR references, commit hashes, and a signed PHASE-002 readiness statement.
