# Super Assistant document-first lifecycle design

- Status: Approved
- Approved by: User
- Approved on: 2026-08-09
- Governance: Strict risk profile; Plan autonomy
- Source evidence: `docs/source/super-assistant-v3.md`

## 1. Design intent

Super Assistant is a local-first control plane for assigning goals to specialized agents while preserving human authority, deterministic state, execution isolation, evidence, and recoverability. It does not attempt to create a new foundation model or make conversations authoritative. Its job is to turn an intent into an inspectable Proposal, acquire precise authorization, coordinate durable work, route decisions, and present verifiable results.

The lifecycle is designed in full before application implementation. H1 establishes a trustworthy Codex development loop. H2 generalizes it to multiple agents and continuous monitoring. H3 adds domain breadth and team/enterprise governance. Delivery is incremental, but later contracts and constraints are recorded now so an early shortcut cannot block later phases.

## 2. Product horizons

### H1 — Trustworthy local development assistant

A single user connects local projects and a local Codex runtime, proposes side-effecting work, approves a versioned plan, executes in an isolated worktree, handles important decisions, verifies results, and retains complete audit and recovery evidence.

### H2 — Multi-agent and continuous-operation control plane

The stable SAI contract supports additional agents, DAG scheduling, Testing and Inspector roles, resource conflict fencing, event ingestion, aggregation, cooldown, budgets, and automatic but policy-bound follow-up work.

### H3 — Domain and enterprise platform

Domain agents and more adapters share the control plane. Team Workspaces add membership, RBAC, credential separation, multi-party approval, audit export, and enforceable retention policies.

## 3. Product routes

1. **Goal-to-result route:** goal → routing → Proposal → authorization → preflight → execution → verification → Artifact and Change Log.
2. **Question-to-decision route:** agent question → L1–L4 routing → deterministic response or unique Decision → human resolution → idempotent resume.
3. **Signal-to-follow-up route:** event ingestion → normalization → aggregation → cooldown/budget/policy → recommendation or approved follow-up Task.

## 4. Authority and state

The SQLite control plane is the authoritative state for Project, Proposal, authorization, Task, Work Item, Attempt, Decision, Artifact metadata, Change, and leases. Model context is advisory and disposable. UI state is a projection. Adapter state is reconciled evidence, not the sole truth.

Commands and events use at-least-once delivery. Every execution has stable request, idempotency, task, work-item, attempt, and trace identifiers. Events are ordered per Attempt using a monotonic sequence. Transactional outbox/inbox records prevent loss and deduplicate delivery. A disconnected Attempt enters `UNKNOWN` and then `RECONCILING`; it cannot be redispatched until the adapter proves whether the prior command executed.

## 5. Authorization boundary

Read-only catalog, status, log, and analysis queries do not create a Proposal. Any file mutation, command execution, network action, external system write, credential use, or other side effect requires a versioned Proposal and an Authorization Grant bound to that exact version. Confirmation is idempotent and creates at most one Attempt. Project snapshot, Agent, Function, policy, or grant changes invalidate preflight and require a new Proposal version.

The security pain-point card `SECURITY_PERMISSION` is activated at `0.600` with `user_confirmed: true`. `CONCURRENCY_RACE` scored `0.526` and is excluded by the Top-1 selection rule, but its mitigations remain mandatory engineering gates.

## 6. Domain semantics

- Connection errors take display precedence. Otherwise the Agent card's principal state is Availability.
- A retry of the same objective creates a new immutable Execution Attempt under the same Work Item.
- A materially changed objective or responsibility creates a remediation Work Item under the same Task.
- Acceptance failure never creates a new top-level Task. It reopens or extends the existing Task with explicit remediation.
- A Task completes only when every required Work Item is accepted, required evidence exists, and no Decision remains open.
- Agent Template is not implemented in H1, but Phase 1 catalog and persistence contracts reserve template/version references for H2 compatibility.

## 7. Architecture shape

The application is an Electron desktop application with React and TypeScript in the renderer, Node.js modules in the main process/control plane, SQLite persistence, and an independent Codex Adapter Worker. Node `22.x` is the supported runtime. Python `3.9+` is used only by repository governance tools.

The Codex adapter consumes only the stable App Server API over default `stdio`. It maps initialization, thread, turn, interrupt, and streaming events into product-neutral SAI concepts. Product modules and UI do not expose Codex Thread or Turn as domain objects. Remote execution is outside H1.

Application modules are a modular monolith: workspace/onboarding, project catalog, agent/capability catalog, proposal/policy, orchestration, decisions, artifacts/changes, monitoring, and read projections. The adapter worker is isolated because it controls processes, worktrees, credentials, and an evolving upstream protocol.

## 8. Delivery model

Seven delivery phases realize the three horizons. Each phase has entry and exit conditions, exact requirements, test evidence, and an archive. Task Packs roll forward: the active phase has executable packs; the next phase has complete packs approved before archive; later phases retain phase-level contracts and produce packs during the preceding phase.

Implementation branches use `codex/phase-00x-*`, with one task worktree for each side-effecting Task. The initial documentation baseline is the sole exception and is committed on a newly initialized `main`. After the complete local gate and exactly three reviewable baseline commits, the user-approved remote `https://github.com/ziyange/SuperAssistant.git` is configured as `origin` and `main` is published with upstream tracking. Initialization performs no merge, pull, force-push, history rewrite, or publication to another remote.

## 9. Quality model

Documentation gates check links, Task Pack boundaries, requirement traceability, standalone JSON Schemas, runtime trace consistency, and clean diffs. Application phases additionally require unit/domain tests, fake App Server contract tests, Electron Playwright flows, lint, typecheck, build, and an explicitly enabled real-Codex smoke test. CI is evidence only after execution.

## 10. Archive and evolution

Active facts are continuously corrected. Archives are immutable evidence, not a replacement for current truth. A phase archives only after all packs pass, facts are written back, verification is adequate, decisions and known issues are recorded, and the next phase's packs are approved. Runtime-trace exits `1/3/5/6` stop work; exits `2/4` follow the governance expansion, recovery, or degradation route before continuing.
