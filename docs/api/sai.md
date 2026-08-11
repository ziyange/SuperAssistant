# SAI — Super Assistant Agent Interface

SAI is the versioned, product-neutral contract between the Super Assistant control plane and an Agent implementation or Adapter. It specifies what the platform can discover, authorize, execute, observe, reconcile, and collect; it does not prescribe Agent internals. Codex-specific behavior is confined to the [Codex Adapter](../adapters/codex.md).

## Protocol model

SAI uses request/response commands plus an at-least-once event stream. H1 carries SAI over authenticated local worker IPC; the Codex worker separately uses App Server `stdio`. Transport does not change operation semantics.

Every schema has a semantic version. A peer accepts the same major version and a negotiated minor version, ignores unknown additive fields, and rejects an unsupported major version before declaring the Agent connected. Payloads are JSON-compatible values validated against versioned schemas. Binary data is an ArtifactVersion reference, never an inline unbounded field.

## ExecutionPort operations

The baseline ExecutionPort has exactly eight mandatory operations. Every H1 Adapter implements these eight names and semantics; SAI 1.x cannot add another mandatory operation.

### 1. `describe`

Returns stable Agent, Adapter, and SAI identities and versions; supported protocol range; Project-eligible Functions; Function input/output schemas and side-effect classes; Capability references; and compatibility metadata. Description results are preflight evidence, not execution authority.

### 2. `health`

Returns Connection, Availability, capacity, active count, observation time, expiry, and stable reason codes. A stale observation is unavailable. Health cannot replace an AuthorizationGrant.

### 3. `start`

Creates or returns the execution identified by `attempt_id` and `idempotency_key`. Input includes the pinned Agent/Function versions, immutable Project snapshot, WorkItem input, acceptance context, AuthorizationGrant reference, budgets, deadline, and ResourceLease fencing tokens.

Repeated calls with the same idempotency key and payload digest return the original receipt. The same key with a different digest returns `IDEMPOTENCY_CONFLICT`. A successful receipt does not prove that work has finished.

### 4. `resume`

Continues an existing nonterminal ExecutionAttempt after a resolved Decision, requested input, recovered capacity, or adapter restart. It includes the expected ExecutionAttempt state/version, resume cause, and optional structured input with a stable `input_id`. Duplicate input IDs with the same digest are acknowledged without reapplication; a different digest is an idempotency conflict. Secrets use opaque credential references or the credential broker. `resume` never creates a new ExecutionAttempt.

### 5. `cancel`

Requests terminal cancellation of the ExecutionAttempt. The adapter interrupts the Attempt's upstream activity as an internal App Server action, terminates that Attempt's descendant processes, captures terminal/ambiguous evidence, and releases or fences its ResourceLeases. The Adapter Worker remains available unless it has independently failed. A repeated `cancel` is idempotent; cancellation remains incomplete while owned execution or descendant processes run, a writable lease remains effective, or worktree disposition is unknown.

### 6. `status`

Returns observed upstream state, adapter correlation health, last emitted sequence, process status, pending-input reason, and proof metadata. Request mode is `OBSERVE | RECONCILE`. `RECONCILE` establishes `NOT_STARTED | ACTIVE | SUCCEEDED | FAILED | CANCELLED | INDETERMINATE`; `INDETERMINATE` keeps the ExecutionAttempt in `RECONCILING` and never permits redispatch. Status evidence feeds the platform reducer but does not directly mutate authoritative Task state.

### 7. `events`

Returns normalized events for one ExecutionAttempt strictly after `after_sequence`, with a bounded limit and next cursor. The request may acknowledge the highest contiguous durably persisted sequence through `acknowledged_sequence`; acknowledgement is monotonic and never authorizes premature retention deletion. A cursor older than retained events returns `EVENT_HISTORY_UNAVAILABLE` and forces `status` with `RECONCILE` mode.

### 8. `result`

Returns a terminal normalized result, structured error, validation evidence, and ArtifactVersion manifests. Before terminal state it returns `RESULT_NOT_READY`. ArtifactVersion content is retrieved through the ArtifactVersion channel and verified by digest.

## Message envelope

Every request, response, command, and event includes:

| Field | Meaning |
|---|---|
| `sai_version` | Negotiated SAI semantic version |
| `message_id` | Globally unique message ID |
| `message_kind` | Request, response, command, event, or acknowledgement |
| `message_type` | Versioned operation or event name |
| `created_at` | UTC creation timestamp |
| `trace_id`, `span_id` | End-to-end observability identifiers |
| `correlation_id`, `causation_id` | Request/response and causal linkage |
| `request_id` | Stable logical command identifier |
| `idempotency_key` | Stable side-effect deduplication key |
| `workspace_id`, `project_id` | Authority and Project scope |
| `task_id`, `work_item_id`, `attempt_id` | Product execution identity |
| `agent_id`, `agent_version` | Pinned Agent identity/version |
| `function_id`, `function_version` | Pinned Function identity/version |
| `adapter_type`, `adapter_version` | Runtime adapter identity/version |
| `authorization_grant_id`, `proposal_digest` | Exact approved authority |
| `project_snapshot_version` | Preflight Project fact version |
| `resource_fences` | Resource key and fencing-token list |
| `deadline_at` | Command deadline; expiry is not proof of non-execution |
| `sequence` | Event sequence within one ExecutionAttempt; absent on non-events |
| `payload_schema`, `payload_digest` | Payload contract and canonical SHA-256 |
| `payload` | Validated operation-specific content |

The envelope contains no secret value, bearer token, raw Authorization header, Codex Thread/Turn identifier, local credential content, or unrestricted filesystem path.

## Event contract and ordering

Core events are `EXECUTION_ACCEPTED`, `EXECUTION_STARTED`, `ACTIVITY_RECORDED`, `INPUT_REQUESTED`, `DECISION_REQUESTED`, `ARTIFACT_DECLARED`, `EXECUTION_INTERRUPTED`, `CANCELLATION_STARTED`, `EXECUTION_SUCCEEDED`, `EXECUTION_FAILED`, `EXECUTION_CANCELLED`, `CONNECTION_LOST`, and `RECONCILIATION_OBSERVED`.

- Sequence starts at 1 and increases by exactly 1 within an ExecutionAttempt.
- Retransmission preserves `message_id`, sequence, event type, and payload digest.
- The consumer persists an Inbox key before applying an event.
- A lower/equal applied sequence is a duplicate; a higher noncontiguous sequence is a gap and is buffered or replayed.
- Events from different ExecutionAttempts have no global ordering guarantee.
- Terminal events are immutable. A contradictory later event raises `EVENT_CONTRADICTION` and requires operator-visible reconciliation.
- Event acknowledgement means durable receipt, not business acceptance.

## ExecutionAttempt and redispatch rules

The platform owns the authoritative [ExecutionAttempt](../data-model.md#executionattempt) state. Transport loss or App Server exit while outcome is uncertain moves it to `UNKNOWN`, then `RECONCILING`. `start` for that WorkItem is prohibited until `status` in `RECONCILE` mode establishes a terminal outcome or `NOT_STARTED`. Reusing the previous `attempt_id` for a new execution is prohibited.

## Errors

Errors use this structure:

```json
{
  "code": "VERSION_UNSUPPORTED",
  "category": "PROTOCOL",
  "message": "The peer does not support the requested SAI major version.",
  "retryable": false,
  "execution_may_have_started": false,
  "details_schema": "sai.error.version-unsupported.v1",
  "details": {"supported_range": ">=1.2.0 <2.0.0"}
}
```

Stable codes include `INVALID_REQUEST`, `SCHEMA_VALIDATION_FAILED`, `VERSION_UNSUPPORTED`, `CAPABILITY_UNAVAILABLE`, `AUTHORIZATION_DENIED`, `AUTHORIZATION_STALE`, `CREDENTIAL_UNAVAILABLE`, `PROJECT_SNAPSHOT_STALE`, `RESOURCE_FENCE_REJECTED`, `IDEMPOTENCY_CONFLICT`, `ATTEMPT_STATE_CONFLICT`, `INPUT_NOT_EXPECTED`, `RESULT_NOT_READY`, `EVENT_GAP`, `EVENT_HISTORY_UNAVAILABLE`, `EVENT_CONTRADICTION`, `UPSTREAM_UNAVAILABLE`, `DEADLINE_EXCEEDED`, `CANCELLATION_INCOMPLETE`, and `RECONCILIATION_REQUIRED`.

If `execution_may_have_started` is true, the platform must enter `UNKNOWN` regardless of `retryable`. A retryable transport error never authorizes automatic redispatch of a side-effecting command.

## Versioning and compatibility

- Major: incompatible envelope or operation semantic change; negotiation must fail closed.
- Minor: additive field, enum capability, or event; older readers ignore unknown fields and events only when declared noncritical. SAI 1.x retains exactly the eight baseline operations.
- Patch: clarification or bug fix with identical wire semantics.
- Function schemas version independently and are pinned by ProposalVersion and ExecutionAttempt.
- Removal uses advertise-deprecation, dual support, minimum-supported-version advance, then removal in a new major version.
- Capability negotiation returns operation support, event types, limits, maximum payload size, reconciliation support, and ArtifactVersion mechanisms.

## Security and policy

The adapter verifies that command identity, AuthorizationGrant reference, ProposalVersion digest, Project snapshot, Function version, and ResourceLease fences match the prepared execution. Failure is closed and auditable. Adapter output is untrusted until schema validation, redaction, and Inbox application complete. See [security](../security.md).

## H1-H3 evolution

- H1 uses SAI 1.x over authenticated local IPC and Codex App Server `stdio` behind the adapter.
- H2 adds more adapters, parallel ExecutionAttempts, monitoring events, and richer capabilities through additive minor versions.
- H3 adds remote authenticated transports, tenant identity, RBAC decision context, and audit signatures. The eight operation meanings, idempotency, per-ExecutionAttempt sequence, error ambiguity flag, and non-redispatch rule remain invariant.
