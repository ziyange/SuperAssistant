# Super Assistant product truth

- Status: Baselined
- Baseline date: 2026-08-09
- Product horizons: H1–H3
- Source evidence: [Super Assistant V3.0](source/super-assistant-v3.md)
- Approved lifecycle: [document-first lifecycle design](superpowers/specs/2026-08-09-super-assistant-lifecycle-design.md)

This document is the authoritative product brief. The source evidence preserves the original proposal; this brief records the approved scope, measurable outcomes, and conflict resolutions that govern implementation.

## Positioning

Super Assistant is a local-first control plane for managing AI work. It turns a user's goal into an inspectable, authorized, durable, and verifiable execution without creating a new foundation model or Coding Agent. The user states goals and makes consequential decisions; Super Assistant routes, plans, authorizes, coordinates, records, and recovers; specialized Agents perform Work Items.

The product solves five connected jobs:

1. Select the right Agent for the requested Function.
2. Select the correct Project and execution environment.
3. Resolve the capabilities, permissions, and constraints needed to act.
4. Coordinate one or more Work Items while exposing progress and conflicts.
5. Escalate only material choices and preserve evidence of every result and human decision.

## Target users

### H1 primary user

A single developer, technical lead, or technically capable product owner who maintains one or more local software projects and wants Codex to perform real development work without losing control of scope, state, or evidence.

### H2 user

An individual operator who coordinates several specialized Agents, quality roles, and continuous signals across long-lived Projects.

### H3 user

Teams and enterprise administrators who require domain Agents, multiple Adapter types, membership, role-based access, credential separation, multi-party approval, retention enforcement, and audit export.

The first release is optimized for a single-user Workspace. Workspace and Owner identities are persisted from the first phase so later team semantics do not require replacing the core model.

## Product principles

- A model conversation is advisory and disposable; durable control-plane data is authoritative.
- Read-only discovery, status, log, and analysis queries do not require a Proposal.
- Every file mutation, command execution, network action, credential use, external write, or other side effect requires confirmation of an exact Proposal version.
- Product concepts remain Super Assistant, Agent, Project, Task, and the internal Work Item. Adapter-specific concepts are not exposed as product objects.
- Simple work hides the Work Item layer; complexity is shown only when it changes what the user must understand or decide.
- Completion requires accepted Work Items, required evidence, and no open Decision.
- History is append-only for Attempts, Decisions, Artifact versions, Changes, and Rollbacks.
- Automation is bounded by explicit policy, authorization, resource isolation, budgets, and recoverability.

## Three product routes

### Goal-to-result

`Goal → Project and Agent routing → versioned Proposal → authorization → preflight → execution → verification → Artifact and Project Change`

The route succeeds when the intended result is accepted and its authorization, execution, tests, outputs, and project impact are traceable.

### Question-to-decision

`Agent question → L1–L4 routing → deterministic response or one Decision → human resolution → idempotent resume`

The route succeeds when known facts and low-risk choices are resolved without unnecessary interruption while important or high-risk choices cannot be answered by the model on the user's behalf.

### Signal-to-follow-up

`Event ingestion → normalization → aggregation → cooldown, budget, and policy evaluation → recommendation or authorized follow-up Task`

The route succeeds when continuous software performs routine observation, an Agent is invoked only when intelligent judgment is warranted, and no repeated signal causes uncontrolled Agent calls or side effects.

## Product horizons and delivery scope

| Phase | Horizon | Product outcome |
|---|---|---|
| PHASE-001 — Platform foundation | H1 | Electron shell, authoritative persistence, single-user Workspace, Project catalog, Agent and Function catalog, onboarding, and read projections. |
| PHASE-002 — Codex single-task loop | H1 | Local Codex App Server Adapter, Proposal and authorization, isolated worktree execution, one required Work Item, Attempts, event streaming, cancellation, and result capture. |
| PHASE-003 — Decision, audit, and recovery | H1 | Question Router, Decision lifecycle, Artifact and Change history, audit separation, reconciliation, degraded operation, and H1 acceptance. |
| PHASE-004 — Multi-Agent quality loop | H2 | General SAI use, Agent Templates, Project, Program Log, Testing, and Inspector Agents, DAG execution, resource fencing, automatic handoff, and acceptance remediation. |
| PHASE-005 — Continuous-monitoring loop | H2 | Event ingestion, normalization, aggregation, rule triggers, cooldown, rate, concurrency, budget controls, and policy-bound follow-up Tasks. |
| PHASE-006 — Domain and Adapter expansion | H3 | Operations, HR, data, and enterprise Agents, visual analysis, additional mature-product Adapters, and configured legacy Agent integration. |
| PHASE-007 — Team and enterprise governance | H3 | Team Workspaces, membership, RBAC, credential separation, multi-party approval, enforceable retention, audit export, notifications, and administration. |

## H1 MVP scope

H1 is the minimum marketable trust loop rather than a reduced mock-up. It includes:

- A single user can register multiple Projects and one local Codex runtime.
- A Task in H1 targets one Project and one Codex Agent and contains one required Work Item; retries create new Attempts.
- The assistant distinguishes read-only questions from side-effecting goals, asks only for material missing facts, and never guesses among ambiguous Projects.
- A side-effecting goal cannot start before the user confirms a complete, versioned Proposal and the preflight remains valid.
- Codex executes in an isolated task worktree through the stable App Server protocol over `stdio`.
- Status, Activity, Decisions, test evidence, Artifacts, Changes, cancellation, failure, restart, and reconciliation are durable and inspectable.
- The user can determine what ran, under which authorization, what changed, whether acceptance passed, and why execution stopped.

## Later-horizon scope

H2 adds multiple Agent roles, DAG scheduling, resource conflict fencing, continuous monitoring, aggregation, budgets, and policy-bound follow-up work. H3 adds domain breadth, more Adapter styles, teams, enterprise authorization, retention, and audit controls. Contracts needed to preserve forward compatibility may be stored earlier, but a future capability is not presented as implemented before its delivery phase passes.

## Non-goals

- Creating or training a foundation model or replacing Codex and other mature Agents.
- Remote Codex execution during H1.
- Exposing Codex Thread, Turn, App Server, or transport details as user-facing domain objects.
- Implementing Agent Templates in PHASE-001; only compatible template and version references are reserved.
- Supporting multiple Coding Agent Adapters during H1.
- Treating Task and Work Item coordination as a general-purpose business workflow engine.
- Automatically performing production deployment, irreversible database changes, regulated decisions, or real-money trading as a generic capability.
- Business-level hard deletion of Projects, Changes, Decisions, Attempts, or historical Artifacts.
- Team membership, RBAC, or multi-party approval before PHASE-007.
- Making remote CI, a model assertion, or an unexecuted test plan count as verification evidence.

## Quantitative success criteria

### H1 trust and control

- In the controlled side-effect suite, 100% of file, command, network, credential, and external-write actions reference an active Authorization Grant for the exact Proposal version.
- Across 100 duplicate-confirmation and duplicate-delivery cases, each idempotency key produces exactly one external effect and one Attempt.
- Across 50 forced-disconnect or process-restart cases, every nonterminal Attempt is reconciled without duplicate dispatch; recovery reaches a truthful state within 30 seconds after the Adapter becomes available.
- In the supported real-Codex smoke set, at least 18 of 20 representative tasks reach an intentional terminal state with complete logs and evidence; infrastructure failures are classified rather than reported as task success.
- 100% of completed Tasks have all required Work Items accepted, required verification evidence present, and zero open Decisions.
- For a fully specified goal on an onboarded Project, median time from submission to a confirmable Proposal is at most 10 seconds on the reference development machine.
- In a 20-case routing suite containing duplicate and ambiguous Project names, the assistant selects an explicitly identified Project correctly in every case and requests clarification in every ambiguous case.

### H2 coordination and monitoring

- All 30 deterministic DAG scenarios execute each Work Item only after its declared dependencies and resource leases are satisfied.
- A burst of 100 equivalent events inside one aggregation window produces one event group and no more Agent invocations than the configured limit.
- Cooldown, rate, concurrency, and budget boundaries block or defer 100% of over-limit calls in policy tests.
- Acceptance failure produces remediation in the original Task in every quality-loop scenario and never creates an unlinked replacement Task.

### H3 governance

- In 200 negative authorization tests, no principal reads or changes another Workspace's protected data, credentials, or execution resources.
- Every action configured for multi-party approval remains blocked until the required distinct approvers have recorded valid approvals.
- Retention and audit-export conformance suites account for 100% of governed records, including holds, Rollbacks, and deletion exclusions.

### Usability and evidence

- A new H1 user can connect Codex, add a Project, confirm a Proposal, observe execution, and inspect the result without seeing Adapter-specific terms in the primary flow.
- Core flows have no critical or serious automated accessibility violations and are operable by keyboard.
- Every Activity, Decision, Attempt, Artifact, Change, and verification result is traceable by stable identifiers from its Task detail projection.

## Locked conflict resolutions

1. Read-only queries bypass Proposal creation; all side effects require an exact, confirmed Proposal and Authorization Grant.
2. Connection failure takes display precedence; otherwise an Agent card's principal state is Availability.
3. Repeating the same objective creates a new immutable Attempt under the same Work Item. A material objective or responsibility change creates a remediation Work Item under the same Task.
4. Acceptance failure remains in the original Task and reopens or extends its remediation path.
5. PHASE-001 does not implement Agent Templates, but its persistence and catalog contracts reserve template and version references for H2.
6. SQLite owns durable product state. UI, model context, and Adapter state are projections or evidence.
7. Commands and events are delivered at least once and are made safe through stable identifiers, idempotency, ordered Attempt events, and reconciliation.
8. H1 uses the local Codex App Server API over default `stdio`; remote execution is outside H1.

## Constraints

- H1 is a local-first Electron desktop application using React and TypeScript, Node.js `22.x`, SQLite, and an isolated Codex Adapter Worker.
- Credentials are stored through Windows Credential Manager and are not persisted in repository files or SQLite.
- Each side-effecting application Task uses an isolated worktree and a bounded resource lease.
- Product facts, engineering facts, delivery plans, Task Packs, verification evidence, and phase archives remain separate but traceable.
- A phase archives only after its requirements pass, facts are written back, evidence is recorded, and the next phase's Task Packs are approved.

PHASE-006 domain Templates pin a versioned Function and a data classification.
They can analyze and cite facts; any action remains a separately authorized
Proposal and never becomes an automatic Template mode.

Operations analysis conclusions retain metric, dataset version and observation
time. Correlation is displayed as correlation, never as a causal claim.

HR workflows classify sensitive data before processing. Employment decisions
remain human L4 Decisions and cannot be executed by an Agent recommendation.
