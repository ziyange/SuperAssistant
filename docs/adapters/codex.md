# Codex Adapter

The Codex Adapter is the H1 anti-corruption layer between product-neutral [SAI](../api/sai.md) and the documented stable Codex App Server API. It owns upstream protocol correlation and local execution mechanics; it does not own Task truth.

## Fixed integration boundary

Under [ADR-002](../decisions/ADR-002-codex-app-server-stdio.md), H1 launches a supervised Codex App Server child process and exchanges newline-delimited JSON-RPC through local `stdio`.

The adapter must not:

- scrape CLI terminal output;
- import or call private Codex modules;
- inspect or mutate Codex internal databases/files;
- use experimental App Server methods in production paths;
- expose App Server Thread or Turn identifiers to SAI, domain records, renderer IPC, UI, user logs, or ArtifactVersion names;
- silently downgrade to another integration surface.

If initialization or compatibility checks fail, Agent Connection becomes `UNAVAILABLE` with a stable reason and no execution is accepted.

## Process topology and lifecycle

```text
Electron main/control plane
↕ authenticated, schema-versioned worker IPC
Codex Adapter Worker
↕ stable JSON-RPC over stdio
Codex App Server child process
↕ approved tools and one Task worktree
Project resources
```

Worker startup creates an instance identity, authenticates IPC, starts App Server with explicit argument arrays, performs initialization and version/capability negotiation, installs stream handlers, and reports Agent status. Standard error is captured as redacted diagnostic evidence, never parsed as the protocol.

The worker supervises process exit, bounds message size and buffering, detects malformed frames, and terminates the child on protocol compromise. App Server exit during a nonterminal ExecutionAttempt emits `CONNECTION_LOST`; the control plane moves the ExecutionAttempt to `UNKNOWN`.

## Private correlation model

The adapter persists a correlation record containing `attempt_id`, worker instance, negotiated protocol version, private upstream thread/turn identifiers, last upstream cursor, last emitted SAI sequence, process identity, and reconciliation evidence. Only adapter code and its persistence port can read this record.

Product identity always remains:

```text
Task → WorkItem → ExecutionAttempt
```

Thread and Turn are implementation details that may be recreated, resumed, or replaced without changing the product identity or UI.

## SAI mapping

### Discovery and status

Codex version, App Server protocol range, configured Skills, MCP/App/Tool connections, authentication state, and capacity are normalized into Agent, Function, Capability, Connection, and Availability. Project-scoped capabilities are recomputed during preflight and carry an observation expiry.

### Starting execution

`start` validates the AuthorizationGrant, ProposalVersion digest, Project snapshot, pinned Function, budgets, and ResourceLease fences. It verifies or creates the Task worktree, records the immutable baseline, then maps the request to stable App Server initialization/thread/turn methods. The idempotency record is persisted before the upstream side effect.

### Resume and input

`resume` maps continuation and optional structured input to the stable methods advertised during negotiation. A Decision resolution includes a unique input ID and expected ExecutionAttempt state. A stale or repeated resolution is acknowledged idempotently and is never applied twice.

### Cancel

`cancel` uses the stable upstream interrupt as an internal Codex action, then terminates every descendant process owned by that ExecutionAttempt after the bounded grace policy, captures final or ambiguous evidence, determines worktree disposition, and releases or fences ResourceLeases. The Adapter Worker remains available for other work unless the worker itself has failed. The adapter reports `CANCELLATION_INCOMPLETE` until every condition holds.

### Events and results

App Server notifications are mapped to normalized SAI events, structurally redacted, assigned a monotonically increasing ExecutionAttempt sequence, durably staged, and then published at least once. Partial text is Activity, not a result. Completion requires a stable upstream terminal observation plus collected ArtifactVersion manifests and process state.

## Reconciliation

Reconciliation runs on application startup, worker restart, App Server exit, IPC loss, sequence gap, cancellation timeout, and an operator request.

1. Load the authoritative ExecutionAttempt and private correlation.
2. Verify worktree, process identity, App Server health, and last event cursor.
3. Query only stable App Server status/history methods negotiated at initialization.
4. Replay missing normalized events without changing prior IDs or sequences.
5. Return `ACTIVE`, a terminal outcome, `NOT_STARTED`, or `INDETERMINATE` with evidence.

`INDETERMINATE` retains `RECONCILING`. `UNKNOWN` and `RECONCILING` are never sent to `start` again. A timeout, absent process, or missing response alone does not prove `NOT_STARTED`.

## Worktree and resource isolation

[ADR-004](../decisions/ADR-004-task-worktrees.md) governs worktrees. The adapter:

- uses one writable worktree per mutating Task and never shares it across Tasks;
- records repository identity, baseline commit, branch, normalized path, owner Task, and fencing token;
- validates resolved paths remain inside the managed worktree;
- refuses mutation when the user's source checkout is dirty or selected as the target;
- presents current resource fencing tokens before each mutation;
- quarantines dirty or ambiguous worktrees instead of deleting them;
- treats Git, database schema, generated assets, shared configuration, and external systems as separately leaseable resources.

## Credentials and authorization

The adapter receives no persistent secret store. It requests an opaque credential handle from the main-process broker only for an action covered by the active AuthorizationGrant. Secret values are not placed in SAI envelopes, App Server prompts, command-line arguments, logs, or ArtifactVersions. A capability discovered in Codex does not imply authorization to use it.

Tool approval prompts are mapped to L1-L4 policy. A prompt that is not already and precisely covered by the Grant creates a Decision; the adapter cannot answer it by widening scope.

## Failure mapping

| Condition | SAI behavior | Product effect |
|---|---|---|
| Unsupported App Server version | `VERSION_UNSUPPORTED` | Agent unavailable; no dispatch |
| Authentication required | `CREDENTIAL_UNAVAILABLE` or status observation | Connection `AUTH_REQUIRED` |
| Malformed/oversized frame | `UPSTREAM_UNAVAILABLE` and worker stop | Active ExecutionAttempt `UNKNOWN` |
| App Server process exits | `CONNECTION_LOST` | `UNKNOWN → RECONCILING` |
| Event sequence gap | `EVENT_GAP` | Replay or reconcile; do not infer completion |
| Resource fence rejected | `RESOURCE_FENCE_REJECTED` | ExecutionAttempt blocked/failed before write |
| Cancel grace exceeded | `CANCELLATION_INCOMPLETE` | Remain `CANCELLING` or reconcile |
| Result output missing | `RESULT_NOT_READY` or reconciliation | No success transition |

## Verification

H1 requires a fake App Server contract suite for initialization, compatible/incompatible versions, start, resume, input, interrupt, cancellation, duplicate commands, duplicate/out-of-order events, malformed frames, process exit, result collection, and reconciliation. Worktree tests cover dirty source trees, symlink/path escapes, stale fencing tokens, crash quarantine, and cleanup. A real-Codex smoke test is opt-in and reports the exact installed version; it is not a substitute for the fake contract suite.

## H1-H3 compatibility

- H1 supports one local Codex adapter type and `stdio` transport.
- H2 supports multiple Codex workers and other SAI adapters. Correlation, ResourceLeases, capacity, and reconciliation are per ExecutionAttempt/worker; no upstream identifier enters the domain.
- H3 may add managed remote workers only after a transport ADR defines mutual authentication, tenant routing, egress, and remote sandbox proof. Stable App Server methods, product-neutral SAI, Grant enforcement, event order, and ambiguous-state rules remain mandatory.
