# Super Assistant architecture

This document is the engineering source of truth for system shape, ownership, boundaries, and H1-H3 evolution. Product behavior is implemented only through the contracts linked below; accepted decisions are indexed in [architecture decisions](decisions/README.md).

## Architecture principles

1. The control-plane database, never a model conversation, owns durable state.
2. AI proposes, classifies, and summarizes; deterministic code validates authorization, state transitions, dependency readiness, completion, and resource conflicts.
3. Every side effect is bound to an immutable ProposalVersion and AuthorizationGrant.
4. Delivery is at-least-once, so commands, events, approvals, and reducers are idempotent.
5. An ExecutionAttempt in `UNKNOWN` or `RECONCILING` is never redispatched.
6. Codex is isolated behind a product-neutral [SAI contract](api/sai.md); Thread and Turn do not enter the product domain.
7. Histories and ArtifactVersions are append-only. Rollback adds compensating evidence rather than erasing history.

## Approved stack and deployment

H1 is local-first under [ADR-001](decisions/ADR-001-local-first.md):

| Layer | Approved technology | Boundary |
|---|---|---|
| Desktop shell | Electron | Process lifecycle, packaging, secure IPC |
| Renderer | React + TypeScript | Presentation and local projections only |
| Control plane | Node.js `22.x` + TypeScript | Domain services, policy, orchestration, persistence |
| Database | SQLite | Authoritative structured state and transactional Inbox/Outbox |
| Adapter | Independent Node worker | Codex App Server translation and supervised execution |
| Codex transport | Stable App Server JSON-RPC over `stdio` | Local process boundary defined by [ADR-002](decisions/ADR-002-codex-app-server-stdio.md) |
| ArtifactVersion content | Local managed filesystem | Immutable content addressed by metadata and digest |
| Governance tools | Python `3.9+` | Documentation and repository verification only |

The renderer is sandboxed, uses context isolation, has no Node integration, and communicates only through a versioned preload API. The main process owns SQLite and policy. The adapter worker receives scoped commands over authenticated local IPC and never shares renderer privileges.

## Repository foundation

TASK-101 establishes npm workspaces `@super-assistant/desktop`, `@super-assistant/domain`, `@super-assistant/persistence`, and `@super-assistant/codex-adapter`. Desktop may depend on domain and persistence ports; persistence implements domain ports; codex-adapter depends only on product-neutral domain/SAI contracts. Renderer code must never import a main-process, credential, or direct database module.

The root uses Node `22.19.x`, npm `10.7.x`, strict TypeScript, ESLint, Vitest, Playwright, Vite, and a committed npm lockfile. Dependency lifecycle scripts are disabled for the initial lockfile installation. Electron and SQLite native dependencies are declared for later approved packs, but TASK-101 does not execute their lifecycle scripts, create a database, or expose application behavior.

## Modules and ownership

The H1 control plane is a modular monolith. Module boundaries are logical and testable even when deployed in one main process.

### Workspace and onboarding

Owns local owner identity, Workspace configuration, first-run state, language, timezone, and connection onboarding. It does not own credentials; it stores only Credential Manager references.

### Project catalog

Owns Project identity, repository/workspace locations, normalized paths, baseline metadata, lifecycle state, Agent assignments, and resource discovery. It delegates writable workspace creation to the execution sandbox service.

### Agent and capability catalog

Owns Agent identity, Agent/Function versions, Connection, Availability, Function schemas, and Capability bindings. Runtime observations are time-bounded evidence; the catalog decides whether an Agent is eligible at preflight.

### ProposalVersion and policy

Turns an AI-produced candidate into a deterministic ProposalVersion after schema, DAG, resource, risk, and capability validation. It creates AuthorizationGrants after idempotent user confirmation and invalidates stale approvals when referenced facts change.

### Orchestration

Owns Task, WorkItem, ExecutionAttempt, dependency readiness, ResourceLease, Inbox, Outbox, retries, reconciliation, cancellation, and Task status projection. Its complete rules are in [orchestration](orchestration.md).

### Question and decision routing

Classifies Agent questions using the L1-L4 policy in [security](security.md). It resolves L1/L2 through facts and bounded policy; L3/L4 create one durable Decision. Resolution creates Human History and an idempotent resume command.

### Evidence and change

Owns Activity, Raw Log references, immutable ArtifactVersions, ProjectChange, compensating ProjectChange records, digests, retention metadata, and read projections. It never treats raw model text as proof of a filesystem or Git change.

### Monitoring and notification

H1 emits task and decision notifications. H2 adds normalized signals, aggregation windows, cooldowns, concurrency limits, budgets, and policy-bound follow-up Tasks. Aggregation changes delivery volume, not the underlying event evidence.

### Codex Adapter Worker

Implements SAI through the [Codex Adapter](adapters/codex.md). It supervises App Server, creates Task worktrees, translates events, performs reconciliation, enforces cancellation, and publishes normalized evidence. Codex-specific identifiers remain private adapter correlation data.

## Ports and trust boundaries

- Renderer IPC: typed request/response and subscription methods; main process revalidates identity, schema, state version, and authorization.
- `AgentCatalogPort`: describe, synchronize Functions, read health, and negotiate versions.
- `ExecutionPort`: exactly eight mandatory operations—`describe`, `health`, `start`, `resume`, `cancel`, `status`, `events`, and `result`—defined in [SAI](api/sai.md).
- `ProjectResourcePort`: resolve immutable Project snapshots and normalized resource keys.
- `PolicyPort`: evaluate actor, action, resource, risk level, grant, and current snapshot.
- `ArtifactPort`: stage, digest, commit, authorize, and retrieve immutable content.
- `EventPort`: transactional Outbox publication and Inbox deduplication.
- Worker IPC: authenticated per application instance, schema-versioned, length-limited, redacted, and closed on protocol mismatch.

## Authoritative data flow

### Goal to approved Task

```text
User goal
→ read Project, Agent, Function and policy facts
→ AI proposes a candidate graph
→ deterministic schema/DAG/risk/resource validation
→ persist immutable ProposalVersion
→ user confirms exact version
→ persist AuthorizationGrant idempotently
→ preflight current snapshots and acquire leases
→ atomically create Task, WorkItems, initial ExecutionAttempt intents and Outbox
```

Preflight failure does not mutate the approved ProposalVersion. It creates an invalidation reason and a successor ProposalVersion for review.

### ExecutionAttempt execution

```text
Outbox command
→ adapter Inbox deduplication
→ App Server operation
→ normalized ExecutionAttempt events with monotonic sequence
→ control-plane Inbox deduplication
→ ExecutionAttempt reducer + Activity/ArtifactVersion metadata transaction
→ WorkItem reducer
→ dependency readiness and Task projection
```

Timeout or transport loss produces `UNKNOWN`, followed by `RECONCILING`; it never creates a replacement ExecutionAttempt by itself. The exact delivery contract is locked by [ADR-003](decisions/ADR-003-authoritative-state-and-delivery.md).

### Question and decision

```text
Agent question
→ L1-L4 router
→ L1/L2 bounded answer or L3/L4 Decision
→ idempotent human resolution
→ Human History + resume Outbox transaction
→ affected WorkItem resumes after preflight
```

## Failure and recovery model

- Renderer crash: reopen projections from SQLite; no domain transition depends on renderer memory.
- Main-process crash: SQLite transaction atomicity prevents partial state/outbox writes; startup runs integrity and reconciliation scans.
- Adapter crash or App Server exit: active ExecutionAttempt becomes `UNKNOWN`; worker restart negotiates compatibility and reconciles before any redispatch.
- Duplicate or out-of-order event: Inbox key and per-ExecutionAttempt sequence reject duplicates and hold gaps for reconciliation.
- Database busy or disk full: fail closed before side effects, surface an operational incident, and preserve the last committed state.
- Cancellation: remains `CANCELLING` until the process is terminated, terminal evidence is recorded, and leases are released.
- Super Assistant model/network outage: already authorized independent ExecutionAttempts may continue; new AI planning and automatic replanning are unavailable; read-only views remain usable.

## H1-H3 evolution contract

| Concern | H1 | H2 | H3 | Compatibility invariant |
|---|---|---|---|---|
| Users | One local owner | One owner with more agents | Team Workspace | Every record carries stable Workspace/owner scope from H1 |
| Adapters | Codex only | Multiple SAI adapters | Enterprise adapters | SAI envelopes and product states remain adapter-neutral |
| Scheduling | Primarily one Codex Task; DAG-ready core | Parallel multi-Agent DAG | Policy/tenant-aware scheduling | WorkItem and ExecutionAttempt identities never collapse into upstream IDs |
| Runtime | Local worker, `stdio` | Multiple workers; optional approved transports | Managed remote workers | Transport changes cannot alter operation semantics |
| Authorization | One approver, L1-L4 | Policy-bound automation | RBAC and multi-party approval | Grants remain versioned, immutable, scoped, and auditable |
| Monitoring | Task/Decision events | Aggregation, cooldown, budgets | Tenant and regulatory controls | Raw event evidence remains available beneath aggregation |
| Storage | SQLite + local ArtifactVersion content | Same logical schema with higher volume | Self-hosted Team Service with PostgreSQL authority; Electron SQLite is cache-only | Public IDs, state enums, event versions, and audit meaning remain stable |

Breaking changes require additive-read/dual-read migration, explicit deprecation, compatibility tests, and a superseding ADR. H1 code must ignore unknown additive fields and reject unsupported major protocol versions.

## Engineering fact map

- [Data model](data-model.md)
- [Security](security.md)
- [SAI](api/sai.md)
- [Codex Adapter](adapters/codex.md)
- [Orchestration](orchestration.md)
- [UX](ux.md)
- [Operations](operations.md)
