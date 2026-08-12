# Super Assistant data model

SQLite is the H1 authoritative store. External identifiers are UUIDv7 strings; timestamps are UTC ISO-8601 with millisecond precision; mutable records use an integer `row_version` for optimistic concurrency. Enumerations are stored as uppercase stable codes. JSON payloads carry a schema version and are validated before persistence.

### PHASE-001 migration 001 foundation slice

`TASK-103` introduces transactional migration `001-foundation` with
`schema_migrations`, `workspaces`, `agents`, `projects`, `functions`, and
`version_references`. Foreign keys are enabled on every SQLite connection. The
Project presentation path is retained as normalized slash-separated text while
a separate lower-cased `canonical_key` enforces one Project identity per
Workspace. `version_references` reserves immutable Agent, Function, Template,
protocol, and snapshot version vocabulary; this phase records Function version
references without implementing Template behavior. Agent rows carry only an
opaque nullable `credential_ref`, never credential material.

## Required core records

The approved model contains twelve named persistent records. Their names are stable engineering vocabulary and must not be replaced with adapter-specific terms:

| Record | Aggregate role |
|---|---|
| `Workspace` | Ownership and future tenant boundary |
| `Project` | Long-lived project context and resource identity |
| `Agent` | Registered executable worker identity and status |
| `ProposalVersion` | Immutable proposed execution and approval subject |
| `AuthorizationGrant` | Immutable authority bound to one ProposalVersion |
| `Task` | User-visible goal aggregate |
| `WorkItem` | Schedulable responsibility inside a Task |
| `ExecutionAttempt` | One immutable execution try for a WorkItem |
| `Decision` | Single authoritative human-decision record |
| `ArtifactVersion` | Immutable version of produced content |
| `ProjectChange` | Append-only record of a Project effect or compensation |
| `ResourceLease` | Fenced ownership of a protected resource |

`Function` is an additional core entity because Agent capability, input/output compatibility, side-effect classification, and version pinning cannot be represented safely as unversioned Agent metadata. `Capability`, dependency, Activity/Human History, Inbox/Outbox, and adapter correlation are supporting records.

### Workspace

Fields: `workspace_id`, `owner_id`, `name`, `status`, locale, timezone, creation/update timestamps, and `row_version`.

Status is `ACTIVE | LOCKED | ARCHIVED`. H1 has one active local Workspace. `LOCKED` permits recovery/read-only access but no new side effect; `ARCHIVED` is historical. H2 retains the same scope for more Agents. H3 adds memberships and roles without changing existing ownership or identifiers.

### Agent

Fields: `agent_id`, `workspace_id`, runtime/adapter reference, name, category, labels, `agent_version`, Connection, Availability, health expiry, enabled flag, and `row_version`.

Connection is `CONNECTED | AUTH_REQUIRED | UNAVAILABLE | DISABLED`. Availability is `AVAILABLE | SATURATED | PAUSED | ERROR`. `DISABLED` or nonconnected Agents cannot be `AVAILABLE`; connection problems have UI precedence.

### Function

Fields: `function_id`, `agent_id`, stable name, description, input/output schema digests, side-effect class, required authorization actions, `function_version`, compatibility range, and enabled flag.

Lifecycle is `ACTIVE | DEPRECATED | DISABLED | INCOMPATIBLE`. An active ExecutionAttempt pins the Function and schema versions. An incompatible Function change blocks affected WorkItems; it never mutates their snapshot.

### Capability

Fields: `capability_id`, type (`SKILL | MCP | TOOL | PLUGIN | API`), provider, version, Project scope, availability, configuration reference, and metadata schema version.

Function-to-Capability is many-to-many and versioned. Capability availability alone never grants permission.

### Project

Fields: `project_id`, `workspace_id`, name, description, normalized workspace/repository identity, default branch, technology metadata, status, default Agent references, snapshot version, and `row_version`.

Status is `INITIALIZING | ACTIVE | PAUSED | ARCHIVED | ERROR`. Only `ACTIVE` permits a new mutating Task. A Project with an active Task cannot be archived; archive preserves all historical relationships.

### ProposalVersion

Fields: `proposal_id`, monotonically increasing `proposal_version`, goal, referenced Project/Agent/Function snapshots, WorkItem graph, resource intents, authorization scope, reconfirmation triggers, acceptance criteria, risk level, status, digest, creator, and timestamps.

Status is `DRAFT | AWAITING_CONFIRMATION | APPROVED | PREFLIGHTING | READY | INVALIDATED | REJECTED | EXPIRED`. Each version is immutable after presentation. Approval applies to one digest only.

### Task

Fields: `task_id`, `workspace_id`, approved ProposalVersion, AuthorizationGrant, goal, explicit control state, derived status, status reason, creation/completion timestamps, and `row_version`.

Status is `PENDING_CONFIRMATION | QUEUED | RUNNING | WAITING_USER | PAUSED | BLOCKED | COMPLETED | FAILED | CANCELLED`. Derived status is rebuildable from child records and explicit pause/cancel flags.

### WorkItem

Fields: `work_item_id`, `task_id`, Project, assigned Agent, pinned Function/version, objective, required flag, inputs, expected outputs, acceptance criteria, dependency edges, status, current ExecutionAttempt, and `row_version`.

Status is `WAITING | RUNNING | WAITING_INPUT | WAITING_USER | COMPLETED | ACCEPTANCE_FAILED | BLOCKED | FAILED | CANCELLED`. A retry creates a new ExecutionAttempt. A materially changed objective creates a remediation WorkItem in the same Task.

### Decision

Fields: `decision_id`, `task_id`, source WorkItem/Agent, risk level, facts, options, impact, recommendation and rationale, deadline policy, status, resolution, resolver, resolved time, and `row_version`.

Status is `OPEN | RESOLVED | CANCELLED`. Timeout produces reminders/escalation metadata and does not auto-resolve. Super Assistant and Task Detail read the same row.

### ArtifactVersion

Fields: `artifact_version_id`, `logical_artifact_id`, `task_id`, WorkItem, ExecutionAttempt, logical name, immutable ordinal, type, MIME/format, display mode, storage locator, byte size, SHA-256 digest, inherited policy scope, status, and timestamps.

Status is `AVAILABLE | QUARANTINED | ROLLED_BACK | RETENTION_HOLD | DELETED_BY_POLICY`. New execution output creates a new version. Policy deletion removes content only after retention rules allow it and retains audit metadata.

### ProjectChange

Fields: `change_id`, Project, Task, WorkItem, ExecutionAttempt, Agent, type, affected resource keys, baseline/result revisions, Commit/PR/config references, AuthorizationGrant, status, original ProjectChange reference, and timestamps.

Status is `APPLIED | ROLLED_BACK | FAILED | UNKNOWN`. Rollback inserts a new compensating Change and marks the original `ROLLED_BACK`; neither record is erased.

## Remaining required execution records

### AuthorizationGrant

Stores `grant_id`, actor, ProposalVersion digest/identity, allowed actions and resource patterns, credential references, budget, validity window, revocation state, and decision evidence. It is immutable; revocation is a separate event. Confirmation uses `(actor_id, proposal_id, proposal_version)` as an idempotency boundary and creates at most one active AuthorizationGrant.

Effective state is `ACTIVE | EXPIRED | REVOKED | CONSUMED`. Expiry and revocation prevent new dispatch but do not erase authority evidence for an already recorded side effect. A single-use Grant becomes `CONSUMED` when its first covered ExecutionAttempt is atomically created.

### ExecutionAttempt

Stores `attempt_id`, WorkItem, ordinal, `request_id`, `idempotency_key`, adapter correlation reference, pinned snapshots, state, last contiguous event sequence, result/error, start/end times, and reconciliation evidence.

State is:

```text
CREATED → DISPATCH_PENDING → DISPATCHED → RUNNING
RUNNING → WAITING_INPUT | WAITING_USER | SUCCEEDED | FAILED | CANCELLING
DISPATCHED | RUNNING | CANCELLING → UNKNOWN → RECONCILING
RECONCILING → RUNNING | SUCCEEDED | FAILED | CANCELLED | NOT_STARTED
CANCELLING → CANCELLED
```

`SUCCEEDED`, `FAILED`, `CANCELLED`, and `NOT_STARTED` are terminal. `UNKNOWN` and `RECONCILING` are never dispatchable. A successor ExecutionAttempt is allowed only after the prior ExecutionAttempt is terminal; `NOT_STARTED` proves that the prior dispatch had no side effect.

### ResourceLease

Stores normalized resource key, owner ExecutionAttempt, fencing token, mode, acquisition/expiry/renewal time, and release reason. An adapter must present the current fencing token before any write. Expiry initiates reconciliation; it is not permission to redispatch.

State is `PROVISIONAL | ACTIVE | RELEASING | RELEASED | EXPIRED | QUARANTINED`. Only `ACTIVE` authorizes a write. A monotonically newer fencing token invalidates all older holders even if a stale process survives.

PHASE-001 and PHASE-002 implement the H1 foundation slice only: one Task-owned worktree lease, a monotonic token, durable owner/baseline/branch facts, and write-time token verification. PHASE-004 alone accepts hierarchical resource normalization, cross-WorkItem conflict detection, fairness, canonical multi-lease ordering, and deadlock prevention.

## Supporting records

### Connection and Availability

`ConnectionObservation` stores Agent, Adapter/Runtime identity, state (`CONNECTED | AUTH_REQUIRED | UNAVAILABLE | DISABLED`), reason, observed time, expiry, and evidence source. `AvailabilityObservation` stores state (`AVAILABLE | SATURATED | PAUSED | ERROR`), capacity, active count, observed time, expiry, and reason. The Agent row holds their current projections; observations remain append-only for diagnosis.

A stale Connection is treated as `UNAVAILABLE`, never optimistically connected. `DISABLED`, `AUTH_REQUIRED`, and `UNAVAILABLE` cannot combine with effective `AVAILABLE`. Connection failure has presentation and scheduling precedence over Availability.

### Activity and Human History

Activity stores normalized Agent and system events keyed by ExecutionAttempt and sequence. Human History stores ProposalVersion confirmations and Decision resolutions keyed by actor and source version. They remain distinct, append-only, and cross-referenceable by Task/Decision IDs.

### WorkItemDependency

Stores `predecessor_id`, `successor_id`, type (`SEQUENCE | ACCEPTANCE | DATA`), required outcome, and graph version. A transaction validates acyclicity before activating a ProposalVersion.

### Inbox and Outbox

Outbox stores durable commands in the same transaction as domain intent. Inbox stores consumer, message ID, payload digest, processing result, and applied time. Uniqueness on `(consumer_id, message_id)` enforces deduplication. ExecutionAttempt events additionally enforce uniqueness on `(attempt_id, sequence)`.

### AdapterCorrelation

Stores private upstream identifiers, protocol version, worker instance, and reconciliation cursor. It is inaccessible to UI/product modules and never changes product identity.

## Relationships

```text
Workspace ─┬─ Project ── ProjectChange
           ├─ Task ─┬─ WorkItem ─┬─ ExecutionAttempt
           │        │            ├─ ArtifactVersion
           │        │            └─ Activity
           │        ├─ Decision
           │        └─ AuthorizationGrant → ProposalVersion
           └─ Agent ── Function ── Capability

WorkItem ── Project
```

A Task may span Projects through WorkItems. Every WorkItem belongs to exactly one Task and one Project. Every ExecutionAttempt belongs to exactly one WorkItem. Every mutating ExecutionAttempt references exactly one valid AuthorizationGrant and ResourceLease set.

## State and consistency invariants

1. Task completion requires every required WorkItem accepted, required evidence present, and no open Decision.
2. Dependency graphs are acyclic and immutable per approved ProposalVersion.
3. A WorkItem has at most one nonterminal ExecutionAttempt.
4. `UNKNOWN` and `RECONCILING` ExecutionAttempts cannot be redispatched or replaced.
5. Inbox application, ExecutionAttempt reduction, Activity insertion, and derived child transition occur in one SQLite transaction.
6. Task status precedence is explicit cancel, explicit pause, unrecoverable failure, running, waiting user, blocked, complete, queued/pending.
7. Completed evidence is immutable; corrections append successor records.
8. Project archive requires no active Task and rejects new Tasks afterward.
9. Agent/Function/Project snapshot changes after approval invalidate preflight; they do not edit the approved ProposalVersion.
10. Authorization and Capability are independent: both must permit execution.
11. ArtifactVersion content must match its recorded digest before it becomes `AVAILABLE`.
12. Resource fencing protects writes even after a stale process survives lease expiry.

## Schema evolution and H1-H3 compatibility

- H1 migrations are transactional, numbered, forward-only in production data, and backed up before application. Rollback uses restore or a compensating migration, never ad hoc column deletion.
- Additive fields are nullable or have deterministic backfill defaults. Readers ignore unknown JSON fields and reject unsupported major versions.
- Renames use add, dual-write, backfill, dual-read, then deprecate. A field is removed only after all supported readers stop using it.
- H2 adds adapter types, monitoring records, and parallel scheduling without changing H1 public IDs or ExecutionAttempt semantics.
- H3 adds Workspace membership, RBAC, tenant keys, approval quorum, and retention policy tables. Every H1 row already carries Workspace scope or inherits it through a mandatory parent.
- SQLite-specific row IDs, paths, and SQL expressions are not present in SAI or renderer contracts, preserving a future service database migration.

See [architecture](architecture.md), [security](security.md), and [orchestration](orchestration.md) for ownership and enforcement.
