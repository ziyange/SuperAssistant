# Super Assistant operations

This document defines H1 local runtime lifecycle, persistence, health, observability, recovery, retention, upgrade, and support behavior. Operational automation never widens authorization or treats missing evidence as successful execution.

## Repository validation commands

TASK-101 establishes these root commands: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:contract`, `npm run test:e2e`, `npm run build`, and `npm run smoke:codex`. The default smoke command exits successfully only with an explicit skipped reason unless `SUPER_ASSISTANT_ENABLE_CODEX_SMOKE=1`; TASK-101 does not implement that real smoke path. A clean dependency install uses `npm ci --ignore-scripts` until an owning Task Pack authorizes and reviews required native lifecycle scripts.

TASK-205 makes `npm run build` deterministic: domain, persistence, then
desktop main, preload, and renderer. The persistence build copies numbered SQL
migrations to its emitted package assets. A runtime smoke imports the emitted
persistence ESM entry without opening SQLite; a missing migration asset is a
build failure, not a deferred startup surprise.

Vitest workspaces provide mutually exclusive unit and contract discovery boundaries: the unit project excludes `*.contract.test.ts`, and the contract project owns those files. Vitest 3 emits a framework deprecation warning for the approved `vitest.workspace.ts` filename; replacement requires an explicit Task Pack scope change because the current Pack does not authorize a new root configuration file.

## Managed local layout

H1 stores application data under a current-user application directory selected by Electron. Logical subdirectories are:

- `database/` for SQLite and migration metadata;
- `artifacts/` for immutable content addressed by ArtifactVersion metadata;
- `logs/` for structured redacted application/worker logs;
- `worktrees/active/` for Task-owned worktrees;
- `worktrees/quarantine/` for dirty, orphaned, or ambiguous worktrees;
- `backups/` for integrity-checked local database backups;
- `runtime/` for nonsecret instance locks and ephemeral IPC metadata.

The paths are resolved through platform APIs and normalized. Repository files never store application secrets or mutable runtime state. Windows Credential Manager stores secret values; only opaque references enter SQLite.

## TASK-304 local recovery evidence

The local recovery service reads `status`, `events`, and `result` for every
ambiguous Attempt. A durable terminal result is recorded as truth; a missing
result remains `RECONCILING` with dispatch disabled and puts the desktop in
degraded read-only mode. Local audit export stores an immutable, checksummed,
redacted scope manifest; it is diagnostic evidence, not a credential export.

## Startup sequence

1. Acquire a per-user application instance lock.
2. Verify directory ownership, permissions, available disk, and path containment.
3. Open SQLite with foreign keys and busy timeout enabled; run integrity and migration-state checks.
4. Create a pre-migration backup, apply numbered migrations transactionally, and verify the resulting schema version.
5. Start the authenticated Adapter Worker and negotiate SAI/App Server compatibility.
6. Recover Outbox delivery without changing message IDs.
7. Scan nonterminal ExecutionAttempts, active ResourceLeases, event gaps, and worker correlation.
8. Move ambiguous ExecutionAttempts through `UNKNOWN → RECONCILING`; do not dispatch replacements.
9. Rebuild Task projections and compare them with stored projections.
10. Inventory managed worktrees; attach known owners and quarantine ambiguous directories.
11. Enable new dispatch only after recovery gates pass.

Failure before step 11 permits read-only diagnostics and backup/repair actions but no new side effect.

## Shutdown sequence

A normal application exit stops accepting dispatch and requests `cancel` for every active local ExecutionAttempt. Before closing SQLite, the main process confirms that each Attempt's upstream activity and descendant processes terminated, or records the Attempt as `UNKNOWN` with ambiguous evidence; it then releases or invalidates the corresponding ResourceLeases and stops the Adapter Worker. An abnormal exit cannot make those confirmations, so startup moves every affected Attempt to `RECONCILING` before any dispatch. H1 has no orphan, background, or independent headless worker after the Electron main process exits.

## SQLite operations

- WAL mode and foreign keys are enabled for normal operation.
- Each migration has a unique integer version, checksum, forward script, compatibility note, and backup requirement.
- Migrations never delete or rename a live field in one step; they add, dual-write, backfill, dual-read, then deprecate.
- Backup occurs before migration and at configurable successful-operation intervals.
- A backup includes database/checksum/manifest but excludes retrievable credentials.
- Restore is an explicit user operation while dispatch is disabled; restored nonterminal ExecutionAttempts enter reconciliation.
- `SQLITE_BUSY`, corruption, disk-full, and read-only filesystem conditions fail closed and emit an incident.

### PHASE-001 foundation persistence implementation

Migration `001-foundation` is applied in a SQLite transaction and recorded
only after its schema statements complete. Repeated startup reads the recorded
version and does not replay it. A migration error rolls its transaction back,
leaving the previous schema and version usable. The foundation connection
enables foreign keys, WAL mode, and a five-second busy timeout before applying
migrations. Repository reopen tests cover Workspace-scoped Agent, Function,
Project, and immutable version-reference persistence.

`TASK-104` validates Project paths before registration and uses noninteractive
native Git argument arrays for disposable task worktrees. Each generated
worktree has a distinct `codex/phase-001-<task>` branch and baseline commit;
source checkouts are never modified. Unknown/stale paths reconcile to
quarantine rather than deletion.

## Adapter and App Server supervision

The main process supervises one H1 Codex Adapter Worker. The worker supervises App Server. Health includes worker process identity, negotiated versions, protocol heartbeat/observation age, App Server exit status, event backlog, and active ExecutionAttempt correlations. On discovery, a child exit is not actionable until its stdout stream has drained, because an already-buffered discovery frame remains valid evidence; an empty drained stream remains a distinct exit failure.

Restart uses bounded exponential backoff and a circuit breaker. Reaching the breaker sets Agent Connection `UNAVAILABLE` and preserves Tasks. A worker restart never clears an ExecutionAttempt or idempotency record. Unsupported versions require an explicit compatible application/Codex upgrade; silent fallback is prohibited.

## Frozen H1 operating limits

| Control | Value |
|---|---:|
| Renderer/Main and Worker IPC frame | 1 MiB; large Artifacts use a handle and checksum |
| Adapter heartbeat / stale health | 5 seconds / 15 seconds |
| H1 worktree lease TTL / renewal | 30 seconds / 10 seconds |
| Graceful cancellation / process-tree deadline | 5 seconds / 15 seconds |
| Reconciliation poll / responsive-adapter truth deadline | 2 seconds / 30 seconds |
| Transport retry schedule | 1, 2, 4, 8, 16, then 30 seconds with ±20% jitter |
| Circuit breaker | five consecutive infrastructure failures; open for 30 seconds |
| Storage warning / mutation pause | 80% budget warning; 95% or less than 2 GiB free pauses new mutating work |
| H1 control-plane and audit retention | no automatic deletion |
| Clean terminal worktree | eligible for review after 7 days; never auto-deleted without clean preconditions |

An expired deadline, lease, or health observation is not proof of non-execution. It creates or retains `UNKNOWN/RECONCILING` until `status`, `events`, and `result` establish a terminal outcome or `NOT_STARTED`.

## Worktree operations

Each mutating Task owns one managed worktree under [ADR-004](decisions/ADR-004-task-worktrees.md). Operations record baseline, branch, owner, fencing token, byte estimate, state, and disposition.

- Active: owner Task exists and lease is current.
- Retained: terminal Task with user-configured evidence retention.
- Quarantined: dirty, orphaned, path mismatch, process ambiguity, or failed cleanup precondition.
- Cleanable: terminal evidence captured, no process uses the path, leases released, repository identity matches, and retention permits removal.

Cleanup is bounded, path-validated, nonrecursive outside the exact managed target, and auditable. Quarantine is the default for uncertainty. Disk-pressure handling notifies the user and pauses new mutating Tasks before considering retained cleanup.

## Observability

Structured logs contain timestamp, severity, component, event code, trace/task/work-item/attempt IDs where applicable, protocol version, duration, result category, and redacted details. They exclude secret values, prompt content by default, raw Authorization headers, full environment, and unrestricted source content.

H1 operational metrics include:

- active/queued/waiting/blocked/reconciling Tasks;
- ExecutionAttempt duration, terminal outcomes, retries, unknown/reconciliation age;
- Outbox backlog/age and Inbox duplicates/gaps;
- worker/App Server restarts and protocol failures;
- lease contention/stale fencing attempts;
- database size/busy time/integrity result;
- ArtifactVersion/worktree/quarantine bytes;
- Decision age and notification delivery.

Metrics remain local in H1. Export or telemetry requires an explicit later policy and opt-in authorization.

History and ProjectChange records are retained as local audit evidence. A
rollback is represented as an additional compensating record with both prior
and result revisions; operations must never mutate or delete the original
evidence to represent restoration.

## Incident classes and runbooks

### Ambiguous execution

Freeze redispatch, mark `UNKNOWN`, start reconciliation, inspect adapter/process/worktree/event evidence, and return a proven terminal/active/`NOT_STARTED` result or retain `RECONCILING`. Manual override cannot assert success without evidence; abandoning an indeterminate ExecutionAttempt requires an explicit L4 Decision and preserves the ambiguity record.

### Database integrity failure

Disable writes and dispatch, preserve the affected files, validate recent backups, offer read-only diagnostics, and restore only after explicit confirmation. All restored nonterminal work is reconciled.

### Protocol incompatibility

Set Agent Connection unavailable, record installed and supported version ranges, stop App Server interaction, retain Tasks, and guide the user to a compatible upgrade. Do not switch to CLI scraping or experimental methods.

### Credential failure

Set the connection to `AUTH_REQUIRED`, block affected WorkItems, retain completed evidence, and request reauthentication through Credential Manager. Do not log or echo the rejected credential.

### Disk pressure

Pause new ArtifactVersion-heavy or mutating dispatch, report database/ArtifactVersion/worktree usage, clean only records in `Cleanable` state under retention policy, and quarantine uncertainty. Database commits take priority over new model work.

### Cancellation incomplete

Keep the ExecutionAttempt `CANCELLING`, show remaining process/lease/worktree blockers, retry bounded termination, then reconcile. Never release a fencing lease while a surviving process may still write without first fencing it out.

## Retention and audit

H1 retention values are user-configurable system settings with safe defaults supplied by the application release. Active Tasks, open Decisions, nonterminal/ambiguous ExecutionAttempts, retained Authorization evidence, referenced ProjectChanges, and quarantined worktrees cannot be automatically deleted.

ArtifactVersion content may be deleted by policy only after its hold expires; ArtifactVersion metadata and audit digest remain. Inbox/Outbox evidence remains at least through the longest retry, reconciliation, audit, and backup window. Project and Task history use archive rather than business hard delete.

## Upgrade and rollback

Application upgrade checks Node/Electron bundle integrity, database migration compatibility, SAI range, Codex App Server range, and available disk before changing state. The pre-upgrade database backup and installed application package provide rollback. After rollback, the older application may open the database only if its declared schema compatibility includes the current version; otherwise it remains read-only and offers restore.

Function or Adapter breaking changes block new affected ExecutionAttempts and move active incompatible WorkItems to `BLOCKED` or reconciliation. They never silently reinterpret an approved ProposalVersion.

## Verification and release evidence

A release gate includes documentation links, schema/migration tests, domain state-machine tests, fake App Server contract tests, secure IPC tests, worktree isolation/cancellation tests, SQLite crash/recovery tests, redaction tests, Electron Playwright critical flows, lint, typecheck, build, and an opt-in real-Codex smoke test. Remote CI is labeled planned until it has actually produced evidence.

Repository delivery follows [ADR-005](decisions/ADR-005-rolling-task-packs.md): the active Task Pack is immutable, exact-path bounded, and verified; the next phase's packs are approved before archive.

## H1-H3 evolution

- H1 is one local owner, SQLite, local Credential Manager, local ArtifactVersion content/worktrees, one Codex worker, and local-only metrics.
- H2 adds multiple workers/adapters, monitoring ingestion, aggregation, budgets, and higher-volume retention. Durable IDs, Inbox/Outbox, per-ExecutionAttempt ordering, fencing, and recovery scans remain.
- H3 adds tenant-partitioned services, managed queues/object storage/vault, RBAC operations, approval quorum, audit export, backup regions, and retention enforcement. Migration preserves H1 public IDs and audit meaning; remote operation cannot weaken ambiguous-state, credential, or authorization controls.

Related facts: [architecture](architecture.md), [data model](data-model.md), [security](security.md), and [Codex Adapter](adapters/codex.md).
## PHASE-005 monitoring retention baseline

Raw monitoring events are immutable evidence. The default retention policy is
30 days for raw events, 90 days for normalized events, and 365 days for
aggregates. Audit records, referenced evidence and legal-hold records are
excluded from automatic cleanup. TASK-501 persists evidence only; it does not
implement a deletion worker or override these retention protections.

## PHASE-005 follow-up protection baseline

Monitoring follow-up denials are retained as immutable audit decisions. The
runtime checks cooldown, concurrency, and budget before Proposal creation, and
operators must investigate sustained denials as a signal of event storms or
capacity pressure; no operator override may create a Task or side effect
without the normal Proposal and Grant evidence.

The local Project Center records a bounded health projection for support:
evidence, aggregate, and denied-follow-up counts plus collector availability.
`UNAVAILABLE` requires operator diagnosis and never causes an automatic retry
or any substitution of UI cache for control-plane truth.

Adapter onboarding is fail-closed: only a valid manifest and complete SAI
conformance may mark an Adapter enabled.

Legacy compatibility is a pre-dispatch safety gate. A changed upstream version
or missing stable operation blocks affected work instead of falling back to
terminal parsing or provider-specific UI text.

Unsafe Artifact output remains quarantined or download-only during support and
incident review; a viewer never expands it into active renderer content.

HR support operations preserve classification and human-decision evidence;
no automated retry or retention process may convert an HR recommendation into
an employment action.

## PHASE-006 external DSH Adapter profile

Gemini Core `0.55.1` remains a completed compatibility block: its public
surface does not prove durable external `status`, `result`, or reconciliation,
so Gemini remains Disabled. [ADR-007](decisions/ADR-007-external-dsh-adapter.md)
adopts DSH as the replacement dedicated Adapter path.

DSH runs one supervised process and session root per ExecutionAttempt. Its
public `stdio` JSON-RPC frames and local session observations are evidence, not
control-plane truth. The Adapter journals normalized frames and derives the
only routable lifecycle result from platform records; a missing frame, process,
session record, or profile mismatch retains `UNKNOWN/RECONCILING` and blocks
redispatch. The process shutdown ladder is JSON-RPC shutdown, EOF, terminate,
then kill, with Lease fencing and evidence before terminal cancellation.

DSH Shell, filesystem, network, and plugin operations remain available only
through the Super Assistant Tool Broker. It validates the bound Proposal,
Grant, Project snapshot, worktree/Lease fence, capability target rule, and
budget, then records redacted request and result evidence. Plugin execution
also requires an approved identity, version, source digest, permission
declaration, and passing compatibility profile; DSH cannot self-install,
update, or enable plugins. Changed DSH commit, protocol/package identity,
server information, or profile digest disables affected Functions until a
fixture-only compatibility probe passes.

Before each DSH launch, operations persist a nonsecret immutable Attempt-policy
digest with the Attempt evidence. The launched Guard receives only that frozen
policy and can deny a call when its tool binding, target rule, budget, Grant,
snapshot, fence, plugin digest, or profile digest does not match. Policy changes
are not live updates: they require a successor Attempt and normal authorization.
