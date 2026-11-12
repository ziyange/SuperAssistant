# Super Assistant data model

Migration 021 adds a Workspace-scoped local Codex registration with one
stable Agent reference, selected canonical executable path and observed
version. It is additive. The linked durable Agent remains UNAVAILABLE/PAUSED:
cached registration is not live health or a Function capability.
An unlinked legacy Agent named Codex is not silently adopted or duplicated:
registration fails closed until its identity can be reconciled explicitly.

Explicit Project-to-Codex assignment updates `default_agent_id` inside one
Workspace-scoped transaction and increments Project snapshot and row versions
only when the assignment changes. Repetition is idempotent; an existing
different Agent is not overwritten by this action.

### Outbox claim fencing

Migration 019 adds a nullable, unique claim token to each Outbox row. Only
the holder of the current token may acknowledge or mark an active claim
uncertain. Interrupted claims move to RECONCILING and their nonterminal
Attempts to UNKNOWN; they are not automatically requeued.

## H1 Project catalog persistence contract

TASK-731 makes the Project catalog list Workspace-scoped and makes registration
idempotent for the existing Workspace/canonical-key uniqueness constraint.
Re-registering an equivalent key returns the unchanged existing Project, not a
new Project or metadata overwrite. Cross-Workspace rows remain isolated. The
caller is still responsible for validating and resolving filesystem paths before
passing them to the repository; this contract does not claim UI integration.

## H1 onboarding persistence

TASK-729 adds SQLite migration 018 with a singleton onboarding state. An absent
row means onboarding is incomplete; a present row contains a constrained 0/1
completion flag. The desktop main process owns reads and writes through the
existing onboarding IPC port. No secrets or user-entered content are stored.
This is an implementation contract under development, not an acceptance claim.

## PHASE-007 Team authority foundation

`team_workspace_records` is the PostgreSQL authority record for a Team
Workspace. `team_workspace_events` is append-oriented and scoped by Workspace
with a unique monotonically assigned sequence per Workspace. The Task-711
repository does not use Team-mode SQLite as a write fallback; authority loss
returns an unavailable state for both protected reads and writes.

`team_sessions` stores an opaque session reference, actor, Workspace, expiry
and optional revocation time; it never stores an OIDC token or PKCE verifier.
`team_memberships` is keyed by Workspace and subject, with a constrained role
projection. Invitations remain short-lived server-side facts and acceptance
creates a scoped membership record exactly once.

TASK-713 adds `team_role_assignments(workspace_id, actor, role)`,
`team_credential_references(credential_ref, owner_actor, workspace_id,
rotation_due_at, revoked_at)`, `team_approval_policies(proposal_digest,
workspace_id, policy_version, requester, eligible_approvers, quorum)`,
`team_approval_records(proposal_digest, approver, approved_at)`, and
`team_grants(grant_ref, workspace_id, requester, proposal_digest, approvers,
issued_at, consumed_at)`. The role and approval records are Workspace-scoped;
the approval-record primary key makes each approver distinct and the Grant's
Proposal-digest uniqueness makes quorum issuance single-shot. No table accepts
a credential value or bearer token.

`team_governed_records` supplies a Workspace-scoped retention/export inventory;
`team_legal_holds` always dominates expiry. `team_retention_dry_runs` preserves
policy evidence, `team_retention_grants` binds one destructive action to an
actor, record, policy and expiry, and `team_retention_audit` appends its result.
The Grant's `consumed_at` compare-and-set prevents a second deletion.

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

### PHASE-001 migration 002 Project slice

`TASK-104` adds forward-only migration `002-project-metadata`: metadata and
its `DISCOVERED | USER` provenance are stored separately from the Project
identity, while managed-worktree records bind Project, Task, canonical path,
branch, baseline commit, resource key, and safe disposition. The migration
does not rewrite migration 001 or introduce execution-attempt records.

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

### PHASE-005 migration 014 monitoring events

`TASK-501` adds forward-only migration `014-monitoring-events`. A
`RawMonitoringEvent` retains Workspace, Project, source identity, source
idempotency key, occurrence time, type, raw payload, and a lower-case SHA-256
payload digest. `(source_id, source_key)` is unique, so repeated delivery
returns the original immutable raw record. A `NormalizedMonitoringEvent` is
bound to one RawEvent and a positive schema version; a raw event has at most
one normalized record per schema version. Both tables reject updates and
deletes through immutable triggers.

### Workspace

Fields: `workspace_id`, `owner_id`, `name`, `status`, locale, timezone, creation/update timestamps, and `row_version`.

Status is `ACTIVE | LOCKED | ARCHIVED`. H1 has one active local Workspace. `LOCKED` permits recovery/read-only access but no new side effect; `ARCHIVED` is historical. H2 retains the same scope for more Agents. H3 adds memberships and roles without changing existing ownership or identifiers.

### Team authority migration

For a Team Workspace, PostgreSQL records `team_workspaces(workspace_id,
payload)` and append-only `team_audit(audit_id, payload)` under one Team
authority. A local export is backed up, imported with idempotent primary-key
upserts, then validated by record count and deterministic SHA-256 digest before
the authority state may change from `LOCAL` to `TEAM`. A validation failure
retains or restores `LOCAL`; no SQLite/PostgreSQL dual write is permitted. The
service does not expose writable Team commands before `TEAM` cutover proof.

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

### PHASE-002 migration 003 Proposal and authorization slice

`TASK-201` adds forward-only migration `003-proposal-authorization`.
`proposal_versions` persists the Workspace, Project, Agent, Function, snapshot,
capability, baseline, action scope, UTC lifetime and canonical
`sha256:<lowercase-hex>` digest. SQLite rejects updates and deletes through
immutable-record triggers. `authorization_grants` binds one actor plus
idempotency key to one Grant; duplicate confirmation returns that existing
Grant. No Task, WorkItem, Attempt, command, lease, or execution record is
created in this migration.

### Task

Fields: `task_id`, `workspace_id`, approved ProposalVersion, AuthorizationGrant, goal, explicit control state, derived status, status reason, creation/completion timestamps, and `row_version`.

Status is `PENDING_CONFIRMATION | QUEUED | RUNNING | WAITING_USER | PAUSED | BLOCKED | COMPLETED | FAILED | CANCELLED`. Derived status is rebuildable from child records and explicit pause/cancel flags.

### WorkItem

Fields: `work_item_id`, `task_id`, Project, assigned Agent, pinned Function/version, objective, required flag, inputs, expected outputs, acceptance criteria, dependency edges, status, current ExecutionAttempt, and `row_version`.

Status is `WAITING | RUNNING | WAITING_INPUT | WAITING_USER | COMPLETED | ACCEPTANCE_FAILED | BLOCKED | FAILED | CANCELLED`. A retry creates a new ExecutionAttempt. A materially changed objective creates a remediation WorkItem in the same Task.

### Decision

Fields: `decision_id`, `task_id`, source WorkItem/Agent, risk level, facts, options, impact, recommendation and rationale, deadline policy, status, resolution, resolver, resolved time, and `row_version`.

Status is `OPEN | RESOLVED | CANCELLED`. Timeout produces reminders/escalation metadata and does not auto-resolve. Super Assistant and Task Detail read the same row.

PHASE-003 `TASK-301` establishes the first durable slice: Workspace, Project,
Task, WorkItem, question, L3/L4 level, stable fingerprint, immutable first
resolution, resolver, and timestamps. Its resolution transaction reads the
originating Attempt and creates one durable `resume` Outbox command only when
the Attempt is not `UNKNOWN` or `RECONCILING`. The later Decision content and
Human History work adds the remaining presentation and audit fields without
creating a second Decision authority.

### ArtifactVersion

Fields: `artifact_version_id`, `logical_artifact_id`, `task_id`, WorkItem, ExecutionAttempt, logical name, immutable ordinal, type, MIME/format, display mode, storage locator, byte size, SHA-256 digest, inherited policy scope, status, and timestamps.

Status is `AVAILABLE | QUARANTINED | ROLLED_BACK | RETENTION_HOLD | DELETED_BY_POLICY`. New execution output creates a new version. Policy deletion removes content only after retention rules allow it and retains audit metadata.

PHASE-003 `TASK-303` adds immutable acceptance evidence keyed to one Task,
WorkItem, Attempt, ArtifactVersion, evaluator, outcome, and timestamp. An
ArtifactVersion cannot be reused for acceptance under another WorkItem. A
Task reaches completion only when each required WorkItem is accepted with its
own evidence and no Decision remains open; a rejection identifies repair work
under that same Task rather than creating another top-level Task.

### ProjectChange

Fields: `change_id`, Project, Task, WorkItem, ExecutionAttempt, Agent, type, affected resource keys, baseline/result revisions, Commit/PR/config references, AuthorizationGrant, status, original ProjectChange reference, and timestamps.

Status is `APPLIED | ROLLED_BACK | FAILED | UNKNOWN`. Rollback inserts a new compensating Change and marks the original `ROLLED_BACK`; neither record is erased.

## Remaining required execution records

### AuthorizationGrant

Stores `grant_id`, actor, ProposalVersion digest/identity, allowed actions and resource patterns, credential references, budget, validity window, revocation state, and decision evidence. It is immutable; revocation is a separate event. Confirmation uses `(actor_id, proposal_id, proposal_version)` as an idempotency boundary and creates at most one active AuthorizationGrant.

Effective state is `ACTIVE | EXPIRED | REVOKED | CONSUMED`. Expiry and revocation prevent new dispatch but do not erase authority evidence for an already recorded side effect. A single-use Grant becomes `CONSUMED` when its first covered ExecutionAttempt is atomically created.

TASK-779 enforces at most one `ISSUED` Grant for each actor and immutable
ProposalVersion with a SQLite partial unique index. Distinct confirmation
keys for that same authority resolve to the existing issued Grant; conflicting
reuse of a key remains rejected. The transaction persists every accepted key
in `authorization_confirmation_keys`, including alternate keys, and the
migration backfills original keys. Consumed, revoked and explicitly expired
records remain immutable history and permit a separately authorized new Grant.
An expired but still ISSUED record blocks replacement until a lifecycle
operation changes its state. Migration fails without modifying duplicate
historic grants and the existing pre-migration backup remains available.

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

The SQLite H1 lease uses nullable renewed_at and expires_at: new leases
persist canonical UTC timestamps and a 30-second window. Migrated legacy
leases retain null expiry, fail write authorization and remain blocking.
Renewal checks owner, fencing token, ACTIVE state and a non-rollback trusted
clock strictly before expiry. Expiry never automatically releases a lease.
The persisted last_observed_at high-water mark advances on checks, including
an expired observation, so an observed clock rollback after restart fails
closed. Unobserved clock jumps cannot be detected from wall-clock data alone.

State is `PROVISIONAL | ACTIVE | RELEASING | RELEASED | EXPIRED | QUARANTINED`. Only `ACTIVE` authorizes a write. A monotonically newer fencing token invalidates all older holders even if a stale process survives.

PHASE-001 and PHASE-002 implement the H1 foundation slice only: one Task-owned worktree lease, a monotonic token, durable owner/baseline/branch facts, and write-time token verification. PHASE-004 alone accepts hierarchical resource normalization, cross-WorkItem conflict detection, fairness, canonical multi-lease ordering, and deadlock prevention.

## Supporting records

### Connection and Availability

`ConnectionObservation` stores Agent, Adapter/Runtime identity, state (`CONNECTED | AUTH_REQUIRED | UNAVAILABLE | DISABLED`), reason, observed time, expiry, and evidence source. `AvailabilityObservation` stores state (`AVAILABLE | SATURATED | PAUSED | ERROR`), capacity, active count, observed time, expiry, and reason. The Agent row holds their current projections; observations remain append-only for diagnosis.

A stale Connection is treated as `UNAVAILABLE`, never optimistically connected. `DISABLED`, `AUTH_REQUIRED`, and `UNAVAILABLE` cannot combine with effective `AVAILABLE`. Connection failure has presentation and scheduling precedence over Availability.

### Activity and Human History

Activity stores normalized Agent and system events keyed by ExecutionAttempt and sequence. Human History stores ProposalVersion confirmations and Decision resolutions keyed by actor and source version. They remain distinct, append-only, and cross-referenceable by Task/Decision IDs.

PHASE-003 `TASK-302` persists both streams separately with append-only SQLite
triggers. Activity ordering is unique by `(attempt_id, sequence)`; Human
History preserves actor, action, source version, and timestamp. ProjectChange
uses the same append-only rule: compensation inserts a linked successor that
references the original Change and never rewrites historical revision lineage.

### WorkItemDependency

Stores `predecessor_id`, `successor_id`, type (`SEQUENCE | ACCEPTANCE | DATA`), required outcome, and graph version. A transaction validates acyclicity before activating a ProposalVersion.

### Inbox and Outbox

Outbox stores durable commands in the same transaction as domain intent. Inbox stores consumer, message ID, payload digest, processing result, and applied time. Uniqueness on `(consumer_id, message_id)` enforces deduplication. ExecutionAttempt events additionally enforce uniqueness on `(attempt_id, sequence)`.

### AdapterCorrelation

Stores private upstream identifiers, protocol version, worker instance, and reconciliation cursor. It is inaccessible to UI/product modules and never changes product identity.

## H1 recovery and local audit export

`audit_exports` is an immutable local record containing the Workspace and
Project scope, generation time, governed-record count, SHA-256 checksum, and
redacted serialized records. It contains no credential value, token, password,
or secret. Recovery observations are not permissions: a missing durable result
keeps an ExecutionAttempt in `RECONCILING` and never creates a replacement
Attempt or dispatch authorization.

## Agent Template version

An Agent Template version is an immutable `(template_id, version)` record with
its name and pinned Function-version references. Active Work Items retain the
versions already approved for them; a later Template version is additive and
cannot rewrite H1 history.

## Work Item graph

A Task may own one immutable DAG snapshot of Work Item node identifiers and
directed dependency edges. Graph persistence rejects unknown nodes and cycles;
only nodes whose incoming dependencies are accepted are schedulable. A restart
reloads the same snapshot rather than inferring a new execution order.

## PHASE-004 resource scheduler

The scheduler records one active canonical resource owner and fencing token per
resource. It grants resources in canonical lexical order, blocks overlapping
writes before Adapter dispatch, permits disjoint claims concurrently, and
rejects writes carrying an old token.

## Quality evidence

Quality evidence is immutable and records Task, Work Item, executor Agent,
evaluator Agent, quality role and outcome. A database constraint and domain
validation require evaluator and executor to differ. Rejection references a
remediation Work Item under the original Task.

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

PHASE-006 DomainTemplate versions are immutable records of Template identifier,
Function version and data classification. They do not grant execution authority.

OperationsAnalysis projections retain the metric, numeric result, dataset
version and observed timestamp needed to trace every displayed conclusion.

Internal Agent access records bind an Agent data domain to its requested domain
and an opaque credential reference; the reference is not a secret value.
TASK-713 adds `team_role_assignments(workspace_id, actor, role)`,
`team_credential_references(credential_ref, owner_actor, workspace_id,
rotation_due_at, revoked_at)`, `team_approval_policies(proposal_digest,
workspace_id, requester, eligible_approvers, quorum)`,
`team_approval_records(proposal_digest, approver, approved_at)`, and
`team_grants(grant_ref, workspace_id, requester, proposal_digest, approvers,
issued_at, consumed_at)`. The role and approval records are Workspace-scoped;
the approval-record primary key makes each approver distinct and the Grant's
Proposal-digest uniqueness makes quorum issuance single-shot. No table accepts
a credential value or bearer token.
