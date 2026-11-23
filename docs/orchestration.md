# Task and WorkItem orchestration
# TASK-818 Decision resume boundary

The SQLite Outbox must revalidate its exact claim and stored Decision, current grant, snapshot and lease after the asynchronous guard and immediately before invoking the adapter. The adapter receives the database-stored decision option. This is a fake-adapter integration only: it does not establish native confirmation, per-action confinement, or eliminate changes between validation and an external side effect.

An additional open Decision or another non-acknowledged resume blocks resume. The present conservative quarantine puts the Attempt in UNKNOWN; a complete multi-Decision wait-and-resume policy is not implemented and requires reconciliation before further dispatch. This limitation prevents claiming a complete production recovery loop.

An Outbox winner holds a durable unique claim token. Acknowledgement and
failure require that token. Once prior worker ownership is known to be gone,
startup recovery moves unresolved DISPATCHING messages to RECONCILING and
their nonterminal Attempts to UNKNOWN; this is not permission to resend.

Outbox claim is a conditional PENDING-to-DISPATCHING transition: a contender
that loses the update receives no message. This is not an acknowledgement
fence or crash recovery and does not by itself authorize dispatch.

The currently unwired OutboxDispatcher requires an explicit guard. If absent,
it refuses before claiming; after claim, only literal true from the guard for
the complete message permits start or resume. Refusal or guard failure marks
the claim uncertain and never calls the Adapter or acknowledges it. This is
only a fail-closed interface boundary: an injected guard is not proof of live
Grant, snapshot, lease, ownership or per-write fencing checks. Production
dispatch remains disabled until those independent controls are implemented.
The legacy ExecutionOrchestrator direct-dispatch entry point is disabled for
all states: it must never create execution state or call an Adapter outside
the durable guarded Outbox path. This does not enable the Outbox in production.

Grant issuance rejects invalid or read-only action scopes; new Attempt
creation verifies the persisted Proposal digest and exact Grant action scope
inside the same transaction before consuming authorization.

New Attempt creation revalidates database-owned Project, Agent and Function
facts against the Proposal within the Grant-consumption transaction. These
checks do not establish the current Git baseline or capability version.

Preflight treats invalid grant expiry or check time as STALE (INVALID_TIME);
changing the approved grant expiry is STALE (GRANT_CHANGED). An unknown
action is invalid rather than read-only. These checks are necessary but do
not replace loading the immutable Proposal and Grant from trusted storage.

The orchestrator is a durable, deterministic state machine over ProposalVersion, AuthorizationGrant, Task, WorkItem, ExecutionAttempt, Decision, ResourceLease, Inbox, and Outbox. It is not an LLM loop. AI may propose a graph or recommend a recovery action, but only validated domain commands can change authoritative state.

## Aggregate boundaries

- ProposalVersion freezes the proposed graph, snapshots, risk, authorization scope, and acceptance criteria.
- Task is the user-visible goal and status projection.
- WorkItem is a logical responsibility under a Task.
- ExecutionAttempt is one immutable try to perform a WorkItem.
- Decision is one human-authority question shared by all views.
- ResourceLease fences access to protected write targets.
- Inbox/Outbox make state mutation and message delivery recoverable.

SQLite transactions update one aggregate and its local delivery records. Cross-Project effects are never represented as one ACID transaction; they use explicit dependencies and compensating ProjectChange records.

## ProposalVersion, approval, and preflight

### Candidate validation

TASK-780's H1 candidate parser checks only the structural boundary defined in
the data model and returns a detached copy. It neither loads authoritative
Workspace, Project, Agent, Function, capability or resource facts nor creates
an approvable Proposal. A successful parse must not activate any confirmation
or execution path. Entity verification, canonical persistence, policy scope
and human review remain separate required integration work. TASK-781 adds
structural fields for budget, deadline and validity window. Parsing does not
compare against a trusted current clock, verify currency or enforce limits;
those checks must block presentation, confirmation and execution until
implemented through trusted policy and runtime boundaries.

TASK-782 adds a read-only local catalog comparison for a parsed H1 candidate:
it checks the unique active local-owner Workspace, active assigned Project,
registered non-disabled Codex Agent and active Function, including their
persisted versions and Project snapshot. Even a match returns only
`REQUIRES_LIVE_VERIFICATION`, never READY. It does not establish live health,
current Git baseline, capabilities, resource containment, clock, policy or
authorization; it is not atomic with later Grant or Attempt creation.

TASK-783 persists only non-authoritative H1 candidate drafts after catalog
comparison within the draft write transaction. Draft checksum verification
protects stored bytes but neither proves live state nor authorizes actions.
Secret-bearing inputs must not be stored. No confirmation or execution entry
point is enabled by draft persistence.

Before presentation, deterministic code verifies:

- referenced Workspace, Project, Agent, Function, Capability, and versions exist;
- WorkItem graph is acyclic and every edge references graph members;
- each WorkItem has one Project, one responsibility, explicit required/optional status, inputs, outputs, and acceptance criteria;
- resource intents are normalized and conflicts are either serialized or isolated;
- every side effect maps to an authorization action and risk level;
- budgets, deadlines, reconfirmation triggers, and required evidence are explicit.

The validated candidate becomes an immutable ProposalVersion with a canonical digest. Editing produces a new version.

### Confirmation

User confirmation is idempotent on actor, ProposalVersion ID, and version. It creates one AuthorizationGrant bound to the exact digest, actions, resources, credentials, budgets, validity window, and approval evidence. Rejecting or expiring a ProposalVersion never creates a Task.

### Preflight

Preflight rereads Project snapshot, Agent Connection/Availability, Function/Adapter versions, Capability availability, policy, credentials, budget, and protected resources. It compares every fact with the approved snapshots and acquires leases with fencing tokens.

Preflight and the transaction that creates executable state share a version check. A mismatch invalidates readiness, releases newly acquired leases, and produces a reasoned successor ProposalVersion path. Approval is never silently stretched to current facts.

### PHASE-002 TASK-201 preflight slice

The implemented deterministic comparison checks Project snapshot, Agent,
Function, capability, baseline commit, policy, Grant state, and Grant expiry.
Any mismatch returns `STALE` with stable reasons and blocks confirmation UI.
The full atomic preflight-plus-Attempt transaction, lease acquisition, Outbox,
and adapter dispatch are deliberately deferred to `TASK-202`.

## WorkItem graph and readiness

Dependency types are:

- `SEQUENCE`: successor waits for predecessor success.
- `ACCEPTANCE`: verifier waits for the subject output and its declared evidence.
- `DATA`: successor waits for a named ArtifactVersion/input contract.

A WorkItem is ready only when it is `WAITING`, all required predecessor conditions hold, its Task is not paused/cancelled/terminal, no blocking Decision exists, Project remains executable, the pinned Agent/Function is compatible, the AuthorizationGrant remains active, ResourceLeases can be acquired, and no prior nonterminal ExecutionAttempt exists.

The ready-set transaction reserves the WorkItem by incrementing `row_version`, creates an ExecutionAttempt in `CREATED`, and writes a dispatch Outbox record. Two schedulers cannot reserve the same WorkItem.

## ExecutionAttempt lifecycle

```text
CREATED → DISPATCH_PENDING → DISPATCHED → RUNNING
RUNNING → WAITING_INPUT | WAITING_USER | SUCCEEDED | FAILED | CANCELLING
DISPATCHED | RUNNING | CANCELLING → UNKNOWN → RECONCILING
RECONCILING → RUNNING | SUCCEEDED | FAILED | CANCELLED | NOT_STARTED
CANCELLING → CANCELLED
```

- `UNKNOWN` means the platform lost a definitive outcome.
- `RECONCILING` means an active reconciliation workflow is gathering proof.
- They are never dispatchable and are ineligible for retry, replacement, or automatic failure conversion.
- `NOT_STARTED` is terminal proof that the accepted command produced no upstream execution; only then may the WorkItem receive a successor ExecutionAttempt.
- `SUCCEEDED` is not WorkItem acceptance until required result and ArtifactVersion evidence validate.

## Command and event delivery

[ADR-003](decisions/ADR-003-authoritative-state-and-delivery.md) defines at-least-once delivery.

### Outbox

The same transaction that records intent inserts a command with `message_id`, `request_id`, `idempotency_key`, payload digest, destination, not-before time, attempts, and state. Dispatch marks acknowledgement separately; deletion follows retention policy, not successful send.

### Inbox

The consumer first inserts `(consumer_id, message_id, payload_digest)`. A duplicate with the same digest returns the stored result; a digest mismatch is a security/integrity incident. Event Inbox insertion, sequence validation, ExecutionAttempt reduction, Activity insertion, and any WorkItem transition commit atomically.

### Event sequence

Sequence is contiguous per ExecutionAttempt. Duplicates are ignored idempotently. A gap pauses reduction beyond the gap and requests replay. If replay is unavailable, the ExecutionAttempt enters reconciliation. Different ExecutionAttempts have no implied order.

## WorkItem outcome, retry, and remediation

- A transient failure may create a new ExecutionAttempt under the same WorkItem after the prior ExecutionAttempt is terminal and retry policy permits it.
- Repeating the same objective never overwrites an ExecutionAttempt or ArtifactVersion.
- A materially changed objective, assignee, Project, or responsibility creates a remediation WorkItem under the same Task and a new graph version approved through a ProposalVersion.
- Acceptance failure does not create a new top-level Task. If the original objective is unchanged, it creates a new ExecutionAttempt; if the failure requires new work, it creates a remediation WorkItem. This resolves the source proposal's two repair descriptions without losing either valid case.

TASK-303 derives this gate from immutable acceptance evidence. Missing
evidence or open Decisions result in a pending state, never an optimistic
completion. A rejected required WorkItem exposes the original WorkItem as the
remediation parent, preserving the Task identifier and complete history.
- Retry policy specifies maximum ExecutionAttempts, retryable error codes, exponential backoff, budget, and human escalation. A timeout with possible execution is reconciliation, not retry.

## Task status derivation

Task status is a rebuildable projection. The first matching rule wins:

1. Explicit cancel with all active ExecutionAttempts terminal and ResourceLeases released → `CANCELLED`.
2. Explicit cancel with remaining activity → `RUNNING` with reason `CANCELLING`.
3. Explicit user pause → `PAUSED`.
4. Unrecoverable required WorkItem failure → `FAILED`.
5. Any running, dispatching, cancelling, unknown, or reconciling ExecutionAttempt → `RUNNING`, with the precise subreason exposed.
6. Any open blocking Decision or required WorkItem waiting for the user → `WAITING_USER`.
7. Any required WorkItem blocked with no runnable work → `BLOCKED`.
8. Every required WorkItem accepted, required evidence present, and no open Decision → `COMPLETED`.
9. Approved and preflighted but no ExecutionAttempt active → `QUEUED`.
10. Awaiting approval → `PENDING_CONFIRMATION`.

An `UNKNOWN` ExecutionAttempt therefore prevents false completion, failure, and redispatch.

## Question routing and Decision

Agent questions enter the [L1-L4 policy](security.md#authorization-and-l1-l4-routing). L1/L2 answers cite authoritative facts and the active AuthorizationGrant. L3/L4 create one Decision using an idempotency key derived from Task, WorkItem, ExecutionAttempt, upstream question identity, and payload digest.

Resolving a Decision uses optimistic concurrency and records one Human History entry. The resolution transaction closes the Decision and emits at most one resume Outbox command. Deadline processing may notify or escalate but never auto-accept an option.

The initial PHASE-003 Decision repository enforces this command boundary in
one SQLite transaction: it rejects a missing, `UNKNOWN`, or `RECONCILING`
originating Attempt before writing a resolution; a repeated resolution key
returns the persisted outcome without another Outbox row only for the same
actor and choice. Because the legacy Decision record does not identify the
originating Attempt, first resolution with more than one Attempt for its
WorkItem is ambiguous and must not be resumed; an unambiguous Attempt must
be waiting for input. A same-key read of an already-resolved Decision may
return matching existing evidence without redispatch, even with multiple Attempts.
An Outbox insertion conflict rolls back the Decision change. A dispatcher invokes
the stable Adapter `resume` operation only after that row has been claimed.

The local H1 resolution boundary must additionally verify the Decision's exact
Workspace, Project, Task and WorkItem against an independently supplied active
owner principal and the
consumed Grant. A duplicate can return the stored outcome only when its matching
durable resume evidence exists. The legacy direct write is unavailable; it
cannot bypass this transaction. Team authorization and actual delivery of a
decision option remain separate integration requirements.

Before the first resolution queues a resume, the same transaction must check
the current clock, Proposal digest and Grant scope/expiry, Project snapshot,
Agent and Function versions, and the original Attempt's live Project Lease and
fencing history. A duplicate read after expiry does not issue another command.
The Lease observation watermark is committed on expiration or failed
Decision/Outbox savepoints; a caller-owned outer transaction is rejected so
it cannot roll that observation back. This detects rollback only relative to
durably observed Lease timestamps, not a global trusted-clock history.
The dispatcher still needs independent checks immediately before side effects;
this transaction cannot prove Git baseline, process ownership or confinement.

## Resource conflict and fencing

For the current H1 local integration, the coarse Project lease key is exactly
`project:<projectId>`, as returned by GitWorktreeService. Acquisition rejects
nonpositive or non-increasing fences and blocks while any prior lease for that
key is not RELEASED. Grant consumption, Attempt creation and lease acquisition
are one SQLite transaction. This conservative Project lock does not substitute
for task-worktree verification or write-time enforcement. Older noncanonical
lease records need explicit reconciliation rather than silent migration.
For known legacy worktree-prefixed keys of the same Project, acquisition checks
both key histories: an unreleased legacy lease blocks and its last fence remains
the lower bound for any successor Project lease.

Trusted provisioning supplies the approved full commit to the worktree port.
The port rejects a missing or stale Project HEAD before creation and pins Git
checkout to that object. It verifies the source and resulting checkout before
returning ACTIVE. A mismatch does not update the Proposal; a later launch
still requires fresh preflight and Lease evidence.

Resource keys are normalized hierarchical identifiers such as repository, worktree, branch, module, database schema, generated asset, credential scope, and external service object. A ProposalVersion declares read/write intent. Conflicting writes are serialized or assigned isolated workspaces.

Each lease has a monotonically increasing fencing token. Adapters verify the token immediately before a write. Lease expiry triggers reconciliation; a surviving stale process cannot write using the old token. Multi-resource acquisition uses canonical sorted order to prevent deadlock and releases all provisional leases on failure.

The H1 implementation slice is deliberately narrower: before worktree creation and each mutating command, it acquires and verifies one Task worktree lease with a monotonically increasing fence. Hierarchical resource keys, concurrent conflict analysis, fairness, and deadlock acceptance are PHASE-004 behavior; H1 stores forward-compatible lease facts but does not claim multi-Agent scheduling.

## Pause, cancellation, and rollback

An H1 Task with affirmative evidence that its only start was never claimed
can be cancelled without a process interrupt: the same SQLite writer
transaction withdraws the Outbox entry and releases the exact local Lease.
This does not authorize cancelling a running or unknown Attempt. The
application must obtain process-tree proof for those cases.

- Pause prevents new dispatch and requests cooperative interruption where the Function supports it; active irreversible operations are reported, not assumed stopped.
- Cancel prevents new dispatch, sends idempotent cancel commands, waits for processes to end, captures evidence, and releases leases.
- Rollback is a separately authorized compensating WorkItem. It creates a new ProjectChange that references the original; it is not a database rollback of Task history.
- Cross-Project rollback is independently accepted per Project because partial compensation is possible.

## Recovery scans

Desktop startup conservatively quarantines abandoned local Outbox claims
and changes persisted in-flight local Attempts to UNKNOWN before the
existing Task read projection is served. Acknowledged messages are kept as
evidence; terminal and undispatched records, other Workspaces, and leases
are left unchanged. This startup transaction does not attest live outcomes
or grant permission to redispatch.

The [offline H1 integration fixture](verification/reports/phase-007-task-788.md) negotiates only a scoped fixture
Function, confirms the exact full Proposal digest, then consumes the Grant
and creates one Attempt and Outbox row. It starts only that claimed Attempt
against a worktree at the approved commit. On restart a read of the exact
bound Thread and Turn can establish Attempt terminal state only. It does not
establish Task acceptance, process termination or a safe Lease release.
Desktop production startup does not install the fixture transport.

Startup performs, in order:

1. SQLite integrity and migration-state validation.
2. Outbox records left in dispatching state reset to deliverable without changing message IDs.
3. Nonterminal ExecutionAttempts compared with worker/process/correlation evidence.
4. Active but unproven ExecutionAttempts moved to `UNKNOWN`, then `RECONCILING`.
5. Expired leases fenced and reconciled before release.
6. Event sequence gaps replayed or reconciled.
7. Task projections rebuilt and compared with stored projections.
8. Orphan worktrees quarantined and surfaced; never automatically deleted while ownership is ambiguous.

## H1-H3 evolution

- H1 runs one local durable scheduler and Codex worker, while using the complete ExecutionAttempt, Inbox/Outbox, ResourceLease, and DAG contracts.
- H2 enables parallel multi-Agent scheduling, Testing/Inspector acceptance nodes, monitoring-triggered Tasks, cooldowns, and budgets. It reuses the same readiness, fencing, and Decision machinery.
- H3 partitions scheduling by Workspace/tenant, adds RBAC and approval quorum, and may use a broker/database service. IDs, at-least-once delivery, per-ExecutionAttempt sequence, immutable approvals, and ambiguous-state non-redispatch remain unchanged.

See [data model](data-model.md), [SAI](api/sai.md), and [operations](operations.md).
# PHASE-004 Work Item DAG

The scheduler reads the durable Task-scoped graph before dispatch. It blocks an
unmet dependency and rejects cyclic graphs before any Adapter command. Graph
recovery uses the persisted snapshot, so a restart cannot reorder work or
create a new top-level remediation Task.

## PHASE-004 resource conflict control

Before dispatch, every claim is canonicalized and acquired in one lexical lock
order. An overlap is blocked rather than queued as a hidden write; disjoint
claims may progress concurrently. Persisted fence checks reject stale owners,
and release/recovery remains auditable.

## PHASE-004 independent quality gate

Testing and Inspector evidence must originate from an Agent distinct from the
executor. A rejection cannot complete or replace the Task: it creates or
reopens remediation inside the original Task graph and remains attributable to
the evaluator.

## PHASE-005 bounded monitoring follow-up

Before creating a monitoring-derived Proposal, the orchestrator checks the
correlation key's cooldown, active follow-up concurrency, and Workspace budget
in that order. `COOLDOWN`, `CONCURRENCY`, and `BUDGET` denials are durable,
immutable audit decisions. Passing this gate only permits Proposal creation;
the normal ProposalVersion, preflight, and AuthorizationGrant path remains
mandatory before any Task or external effect.

Monitoring health is an observational projection of immutable evidence. A
missing collector is reported as `UNAVAILABLE`, not treated as an empty or
healthy queue; this read-only status query has no transition authority.

The internal SQLite outbox claim exposes a validated start or resume message
to the dispatcher only after its claim token is acquired. Payload identifiers
must match the claimed Attempt, and unknown message types, malformed JSON,
missing fields and extra fields are quarantined for reconciliation, never
delivered. A matching token is required to acknowledge or mark uncertainty.
This internal message is not the complete SAI authorization envelope and
does not enable a production Adapter dispatch.

A claim must atomically reject an Attempt already UNKNOWN or RECONCILING;
its pending message moves to RECONCILING without changing the Attempt. This
claim-time guard does not fence a later state change before Adapter invocation.

For internal queue claims, start is eligible only in DISPATCH_PENDING and
resume only in WAITING_USER or WAITING_INPUT. A resume must reference a
resolved Decision and its exact resolution on the Attempt's WorkItem.
Noneligible known commands are quarantined, not executed or silently retried.
Recovery must preserve NOT_STARTED as a terminal Attempt.
The Decision must also match the Task, Project, Workspace and queued
idempotency key. These checks are made at claim time, not at external effect.

H1 lease persistence records a 30-second expiry, with renewal normally
scheduled every 10 seconds by a future supervisor. A missed deadline or
legacy null deadline denies write authority without requeueing or releasing;
the production renewal scheduler and per-write Adapter fence remain open.

An explicitly started lease supervisor checks the supplied ownership predicate
and lease validity, then renews every 10 seconds. A failed check or renewal
stops the timer and emits one loss notification; stop and loss do not release,
retry or reassign. The supervisor is not yet connected to real worker
ownership or durable recovery transitions.

Fixture-stage protected claims can return a frozen execution context sourced
from the same authenticated Proposal, bound identity and original-Attempt
claim. The fake App Server tests use its objective and baseline, not caller
copies. The snapshot itself does not attest a worktree, prevent later Project
or executable changes, authorize dispatch, stop a process or release a Lease.
Production claim-to-launch composition remains disabled.

The TASK-827 fixture-only composition claims the authenticated Task identity,
creates its worktree at the approved baseline, prepares the original Attempt's
receipt and starts a supplied fake transport. A receipt must persist and match
the returned value; an ambiguous result is quarantined without Lease release.
If quarantine persistence fails the caller must observe `PERSISTENCE_FAILED`;
this is not an automatic recovery notification. This fixture composition is
not registered with the desktop, cannot establish process ownership or
confinement, and cannot authorize production execution.

TASK-832 adds original-claim revalidation before creating the fake transport
and after its initialization. A stale claim is quarantined without starting
or replacing the Attempt. Receipt recording independently rejects stale
database authority and Lease state transactionally; rejection after an external
start is an unknown outcome, not proof that no side effect occurred. The Lease
remains active and no production transport is enabled.

TASK-833 snapshots the fixture request identity before asynchronous claim and
uses that same immutable scope for subsequent receipt checks and quarantine.
Changing the caller's object cannot redirect recovery to another Proposal; this
does not provide process ownership or make the fixture production-safe.

TASK-838 supplies a reusable registry between encrypted Proposal storage and
protected authorization. It authenticates the exact stored envelope and
atomically links its identity; a later confirmation must still independently
check current authority and obtain native consent. Its current scope is the H1
built-in Codex Function, and it is not yet wired to desktop production intake.
