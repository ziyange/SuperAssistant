# Super Assistant security model

SQLite migration must fail closed if another connection commits after the
backup snapshot and before exclusive migration ownership. A backup predating
an intervening write must not be blindly restored over newer data.

Outbox claim tokens fence acknowledgements and uncertain-result transitions.
Only the current message/token pair may mutate a DISPATCHING claim; stale
claimants are rejected. Interrupted delivery is UNKNOWN/RECONCILING, never
an automatic redispatch. A token does not prove a worker has stopped.

Outbox readers must not hand a message to a losing claimant after a
conditional state update. Claim ownership and acknowledgement fencing remain
unproven and block real dispatcher integration.

### Grant action-scope binding

Read-only or malformed action lists cannot issue an execution Grant. Before
creating a new Attempt, the transaction recomputes the persisted Proposal
digest and validates that its nonempty side-effecting actions exactly match
the Grant actions. The Grant expiry must also equal the Proposal expiry.
Scope, expiry or digest mismatch aborts without consuming the
Grant. This database check does not replace executor-level enforcement.

### Atomic execution authority revalidation

Before a new Attempt consumes a Grant, the same database transaction must
compare the approved Proposal against the current active Project snapshot,
Agent version and availability, and Function version and lifecycle. A
mismatch aborts without a partial execution or Grant consumption. Idempotent
receipt replay must not create or dispatch a new Attempt. Capability-version
and Git-baseline authority remain separate, currently unproven gates.

### Fail-closed action and preflight validation

Unknown action names are invalid at both IPC and domain boundaries; they
never represent a read-only operation. Preflight returns STALE for malformed
grant timestamps and for changed grant expiry. Renderer-supplied snapshots
are not authority; production dispatch must derive and validate them from
trusted persisted state and the actual grant.
Empty or sparse action arrays are likewise invalid, not evidence of a
read-only request.
Internal preflight timestamps must be canonical UTC millisecond ISO-8601
values; normalized impossible dates and ambiguous strings fail closed.

### Local Grant/Execution binding correction

For local Workspace mode, Grant issuance, Attempt creation and replay require
the active Workspace owner and Grant actor to equal the principal supplied by
the trusted main/control-plane composition. The default local principal is
`local-owner`; renderer payloads cannot select that provider. This rule is not
Team RBAC and does not by itself authorize a worktree or external action.

Grant issuance and Attempt creation use a trusted control-plane clock, not
timestamps supplied with a request. Legacy time fields are ignored for
authority and persistence; malformed clock/expiry values and elapsed Grants
fail closed. Test-only composition may inject a deterministic clock.

The local authority must reject caller-supplied Proposal content whose canonical
digest differs from the stored immutable Proposal. Grant and execution replay
keys are bound to the original Proposal and execution scope; a key collision
with changed Project, Agent, Function, Grant, resource or fencing identity must
fail closed. Before consuming a Grant, the same transaction verifies the Grant
digest and target identities against the stored Proposal. Rejections cannot
consume a Grant or create Task, Attempt, Lease or Outbox records.

## Preload artifact boundary under integration

TASK-734 changes preload output packaging only. Context isolation and Electron
sandbox stay enabled and renderer Node integration stays disabled. A static
CommonJS syntax check cannot substitute for the deferred real Electron sender,
origin and preload security tests.

## H1 local Project picker integration contract

TASK-733 exposes empty-payload Project list and native chooser operations only
to the trusted application frame. Renderer input cannot supply a path or a
Workspace identity. Main derives the single active local-owner Workspace,
rejects ambiguous ownership, resolves the selected path before registration,
and returns a minimal projection or a generic error. A cancelled chooser or
failed transaction must not create a Workspace or Project. This design is
under integration and is not real-Electron acceptance evidence.
Repository metadata is withheld from the renderer until its provenance and
credential redaction are established; legacy values may contain credentialed
URLs and are never forwarded as display text.

Super Assistant is a local control plane that can execute code, mutate repositories, use credentials, and call external systems. Local-first reduces network exposure but does not make renderer content, Agent output, repositories, plugins, IPC peers, or local processes trusted.

## PHASE-007 recovery constraint

H3 is not accepted from in-memory policy evaluation alone. Every Team command,
query and subscription must derive actor/workspace from a verified OIDC session
and authorize it before protected data access. Credential and Grant references
remain opaque; a durable quorum is atomic with Grant issuance and consumption.
Any failed identity, authorization or Team-authority check fails closed.

TASK-712 uses generic Authorization Code + PKCE facts: issuer, audience, nonce,
state and expiry must all validate before a session reference is created. A
request supplies only an opaque `session:sha256:` bearer reference; the server
derives actor and Workspace from its session store. Unknown, revoked or expired
references receive no protected projection. JWKS material is cached only until
its declared expiry and refreshes/fails closed on unknown key identifiers.

## Security objectives

- Human authority over every material side effect.
- Least privilege across renderer, main process, adapter, App Server, Project, credentials, and network.
- Deterministic authorization tied to immutable facts.
- Isolation and provenance for repository mutation.
- No silent continuation after ambiguous execution or protocol failure.
- Auditability without storing secrets in logs or model context.

### DSH Attempt policy

DSH capability authority is serialized once before process launch as a
nonsecret, content-addressed Attempt policy. It contains opaque Grant identity,
not a credential or bearer value, and binds the Proposal digest, Project
snapshot/baseline, Lease fence, capability-to-tool binding, target/path/host
rules, plugin digest, budget, and DSH runtime-profile digest. The in-process
Guard may only synchronously deny against this frozen object. It cannot reload,
expand, or force-allow authority. Any change creates a successor Attempt policy
and requires normal Proposal/Grant/preflight checks; it never changes a running
process.

The `SECURITY_PERMISSION` pain-point card is active at score `0.600` with `user_confirmed: true`. Concurrency mitigations remain mandatory because protected resources are also security boundaries.

## Trust boundaries and threats

| Boundary | Treat as untrusted | Principal controls |
|---|---|---|
| Renderer ↔ preload/main | UI input, rendered Markdown, web content | Context isolation, sandbox, no Node integration, typed allowlisted IPC, schema and authorization validation |
| Main ↔ Adapter Worker | compromised/stale worker, malformed events | Authenticated instance channel, protocol version, message limits, correlation, restart isolation |
| Adapter ↔ App Server | upstream drift, event injection, process failure | Stable API only, version negotiation, `stdio`, schema validation, supervision |
| Adapter ↔ Project | repository content and scripts | Task worktree, resource lease/fencing, path containment, command policy |
| Application ↔ credentials | credential disclosure or confused deputy | Windows Credential Manager, opaque references, scoped retrieval, redaction |
| Agent ↔ external services | unauthorized writes, data exfiltration | ProposalVersion scope, explicit network action, per-connection policy, budgets |

## Credential Manager

H1 credentials are stored only in Windows Credential Manager under an application-specific service prefix and random credential ID. SQLite stores the opaque ID, provider, account label, allowed Workspace/Project scope, creation/last-used timestamps, and revocation state; it never stores the secret value.

Only the main process credential broker can retrieve a secret. The renderer receives presence and account labels only. An Adapter receives a credential immediately before an authorized operation, through a one-operation scoped handle or private IPC message, and must erase transient buffers after use. Secrets never enter ProposalVersion text, model prompts, Task Log, Raw Log, crash dumps, command-line arguments, environment snapshots, or ArtifactVersion metadata. Redaction is structural by field name and credential ID, with entropy-based defense in depth.

H2 supports additional OS credential backends behind the same broker contract. H3 adds tenant vaults, rotation policy, service identity, and separation of duties without changing opaque references in domain records.

### PHASE-007 OIDC identity and membership

Team identity begins with Authorization Code plus PKCE. Each pending exchange
binds an HTTPS issuer, audience, random state, nonce and SHA-256 PKCE challenge.
The code exchanger receives the verifier only for that exchange; signature/JWKS
verification is a fail-closed injected boundary. Invalid issuer, audience,
nonce, state, expiry or unavailable verification cannot create a session.
Persisted session identity is an opaque SHA-256 reference, never an ID or access
token. Invitations bind one intended principal, Workspace, role and expiry; an
accepted invitation cannot be replayed.

### PHASE-007 Workspace RBAC

Every Team command is deny-by-default and evaluates actor, actor Workspace,
resource Workspace, role, action and requester. Group membership and roles are
Workspace-scoped. `OPERATOR` alone may write, `APPROVER` alone may approve,
`AUDITOR` alone may export audit, and `ADMIN` alone may manage membership;
there is no administrator cross-Workspace bypass. The requester may not approve
their own action even when otherwise qualified. Unknown role, action, group or
policy state returns an explicit authorization denial.

At the Team API boundary, a verified session alone is insufficient. Protected
queries and commands derive their specific action and invoke the asynchronous
authorizer before repository access. In particular audit export requires
`EXPORT_AUDIT`, not generic `READ`. The default authorizer denies. The HTTP
adapter accepts only the session-derived actor and Workspace; it never accepts
a role or approval claim from a request body or header. TASK-721 regression
evidence covers the audit-export route; complete Team API and SSE enforcement
remain subject to G2/G6 integrated acceptance.

### PHASE-007 credential namespace isolation

Team credential metadata contains only a `cred:` opaque reference, owner,
Workspace scope and rotation deadline. Lookup requires an exact owner and
Workspace match; a cross-principal or cross-Workspace request returns no
metadata. A Team Grant is immutable and binds the exact requester, Workspace,
Proposal digest and distinct approver evidence. Credential values and
credential references are not copied into the Grant; they remain in their
owning Windows Credential Manager context and never enter PostgreSQL logs or
the UI.

### PHASE-007 multi-party approval

An approval policy is immutable and binds Proposal digest, policy version,
requester, eligible approvers and quorum. The requester is excluded from the
eligible set. Each qualified principal contributes at most once; a quorum can
be satisfied only by distinct eligible principals. Replay and concurrent
approval requests resolve to the same single Grant reference, retaining the
immutable approver evidence rather than issuing another Grant.

The authority records a policy under its immutable Proposal digest, locks that
policy in a single PostgreSQL transaction, inserts approvals with a
`(proposal_digest, approver)` uniqueness boundary, and creates at most one
Grant. Consumption is a compare-and-set update constrained by Grant reference,
Workspace, requester, Proposal digest and an unconsumed state. A failed or
replayed consumption cannot authorize a second effect.

### PHASE-007 retention deletion authority

Retention execution is destructive and therefore never accepts a syntactic
reference as authority. A dedicated immutable retention Grant binds the actor,
Workspace, exact governed record, policy version and expiry. PostgreSQL consumes
that Grant with the delete transaction; a replay, scope mismatch, expiry or
legal hold fails closed. The deletion creates append-only retention audit
evidence and never mutates prior audit history.

## Secure Electron IPC

- `contextIsolation: true`, renderer sandbox enabled, and `nodeIntegration: false` are mandatory.
- Preload exposes named, versioned methods; arbitrary channel send, eval, shell, path, SQL, and generic invoke methods are prohibited.
- Every request is schema-validated in preload and independently in main.
- Main derives the caller/window identity; renderer-supplied actor or Workspace authority is not trusted.
- The packaged desktop IPC handler accepts only its own application window's
  main frame at the exact loaded renderer file URL; missing frames, another
  window and other `file:` URLs fail closed. Development-origin IPC is not
  enabled by this policy. Electron end-to-end negative verification is pending.

For Team notification navigation, the server first reauthorizes the exact
opaque target reference against the current principal and Workspace, and only
then asks an authoritative resolver for the corresponding Task or Decision.
Any optional caller-supplied object identity is only a consistency assertion:
if it differs from the resolved identity, no target is returned. Missing,
malformed, unavailable or cross-Workspace references fail closed. The resolver
is a server-owned port, not a renderer-provided identity. TASK-716's separate
WIP still requires integration against this contract and independent G2 proof.
- Mutations include an idempotency key and expected `row_version`.
- Subscriptions return sanitized domain events, never raw worker/App Server frames.
- Navigation, new windows, permissions, external URL opening, and downloads are deny-by-default and allowlisted.
- Rendered Markdown and ArtifactVersion previews use sanitization and a restrictive Content Security Policy; active HTML is never trusted.
- The renderer build uses an explicit domain-only source alias and has no
  persistence or Node runtime alias. Electron main/preload load emitted ESM
  artifacts; missing package assets fail closed before a privileged process can
  start.

Worker IPC uses an application-start nonce delivered through an inherited private handle, protocol major-version negotiation, maximum frame size, strict message schemas, and immediate disconnect on authentication or framing failure. Local TCP listeners are not used for H1 control IPC.

The frozen H1 maximum Worker and renderer IPC frame is 1 MiB. Large content crosses the boundary only as a validated opaque Artifact handle and checksum. The SAI envelope is validated against [the SAI 1.0 schema](api/sai-envelope.schema.json) before it can affect domain state.

### PHASE-001 desktop shell implementation

`TASK-102` implements the first deny-by-default desktop boundary. Its preload
exposes only `superAssistant.getOnboarding()` and
`superAssistant.setOnboarding({ completed: boolean })`; both map to the
allowlisted `onboarding:get` and `onboarding:set` channels. Main independently
rejects unknown channels, extra fields, malformed values, requests over 1 MiB,
path-like extra payload, and missing or untrusted sender frames. The window
uses context isolation, sandboxing, disabled Node integration, an allowlisted
same-origin/file navigation rule, denied popup/webview creation, and a
restrictive `self` CSP. This shell has no credentials, Project write, Codex
startup, arbitrary process, filesystem, or external-navigation capability.

## Authorization and L1-L4 routing

### L1: explicit fact lookup

Questions answered from current code, Project facts, configuration, approved Decisions, or immutable evidence. L1 is read-only and cannot execute commands, reveal secrets, expand resource scope, or infer missing business facts.

### L2: low-risk execution judgment

Deterministic choices within an existing Grant that do not change business rules, data schema, external side effects, credentials, budget, Project scope, or acceptance criteria. L2 may choose among already approved safe methods; it cannot enlarge authorization.

### L3: important confirmation

Product rules, data structure, third-party service selection, cross-Project changes, production environment, budget changes, materially changed objectives, or ambiguous acceptance require a Decision. Execution waits until an authorized user resolves it.

### L4: high risk

Permissions, security controls, sensitive information, irreversible action, regulated behavior, credential scope, destructive filesystem/Git actions, production writes, or real-money behavior require explicit user intervention. AI recommendations are advisory. Timeout never accepts the recommendation.

Every side effect—file write, command execution, process launch, network action, external write, credential use, Git mutation, or ArtifactVersion publication—must match an active AuthorizationGrant bound to the exact ProposalVersion digest. A preflight snapshot mismatch invalidates the execution path and requires a successor ProposalVersion.

### PHASE-002 TASK-201 authorization boundary

`TASK-201` classifies `READ` alone as `READ_ONLY`; it produces no Proposal or
Grant. `FILE_WRITE`, `COMMAND`, `NETWORK`, `EXTERNAL_WRITE`, and `CREDENTIAL`
classify the request as `SIDE_EFFECTING`. The desktop IPC surface is limited to
classification and preflight projection. It has no start, resume, cancel,
command, shell, credential, or filesystem operation. A Grant is represented as
`ISSUED` only until the future atomic Attempt-creation transaction consumes it;
this Task does not create Attempts or external effects.

## Worktree and process security

[ADR-004](decisions/ADR-004-task-worktrees.md) requires one writable worktree per mutating Task. The adapter resolves and normalizes every path, rejects traversal and symlink escapes, verifies repository identity and baseline commit, and uses explicit argument arrays rather than shell-composed strings. It never targets the user's home, workspace root, repository root, or unresolved variables for recursive deletion.

Each mutating ExecutionAttempt presents a current ResourceLease fencing token. Cancellation is complete only after the App Server and descendant processes terminate, terminal evidence is recorded, leases are released, and worktree disposition is known. Dirty or ambiguous worktrees are quarantined; automated destructive cleanup is prohibited.

H2 parallel WorkItems use distinct worktrees and explicit merge dependencies. H3 remote workspaces preserve sandbox ownership, immutable baseline, fencing, egress policy, and quarantine semantics.

## Data, ArtifactVersion, and log protection

- Database files, backups, ArtifactVersion content, and logs are stored under application-managed directories with current-user ACLs.
- ArtifactVersion uploads/previews enforce size, MIME, extension, digest, and active-content rules. Unknown formats are download-only.
- Logs use allowlisted structured fields and redact credentials, tokens, Authorization headers, environment values, personal data, and sensitive file content.
- Raw Log access is an advanced local-user action and remains subject to redaction.
- Backups are integrity-checked and never include retrievable Credential Manager secrets.
- Retention deletion is auditable; active investigations, unknown ExecutionAttempts, and referenced change evidence place records on retention hold.

## Security invariants and verification

1. No secret exists in repository files, SQLite, logs, model prompts, or renderer state.
2. UI and Agent claims cannot grant authority; only Policy evaluation over a valid Grant can.
3. Unsupported protocol versions fail closed.
4. `UNKNOWN` or `RECONCILING` work cannot be redispatched.
5. A stale worker or expired lease cannot write with an old fencing token.
6. L3/L4 Decisions are resolved only by an authorized human identity.
7. Product read models never expose Codex Thread/Turn or secret-bearing raw frames.

The PHASE-003 Decision-resume transaction fails closed for an absent,
`UNKNOWN`, or `RECONCILING` originating Attempt. It does not substitute a new
Attempt or re-run a side effect; the single persisted resume command is the
only permitted continuation after an idempotent resolution.

TASK-302 history and ProjectChange read ports require the caller's Workspace,
Project, and Task scope as query predicates. Renderer projections contain only
safe event, actor, revision, and compensation metadata; they omit credentials,
Grant identifiers, storage references, raw logs, and provider-native fields.

H1 verification includes IPC negative tests, Credential Manager integration tests, path/symlink containment tests, Grant scope tests, fake App Server malformed-frame tests, redaction tests, and worktree cancellation/quarantine tests. H2 adds multi-worker race and event-ingestion abuse tests. H3 adds tenant-isolation, RBAC, quorum approval, audit export, retention, and vault rotation tests.

H1 local audit export is scoped to an authorized local Workspace and Project,
is checksummed, and recursively redacts credential-like fields before storage
or renderer projection. Adapter/model failure changes the application to
truthful read-only diagnostics; it does not grant an alternate write channel.

PHASE-004 resource scheduling treats canonical resource keys and fencing tokens
as security boundaries. Conflicting writers are blocked before Adapter dispatch
and a stale token cannot regain write authority after another owner is granted.

PHASE-004 quality evidence rejects self-verification. Executor identity and
quality evaluator identity are durable provenance fields, so an Agent cannot
forge its own required Inspector acceptance.

PHASE-005 raw monitoring evidence is immutable and idempotent by source
identity. Monitoring payloads are stored with a SHA-256 digest for integrity;
collectors and later viewers must continue to apply the repository redaction,
size, MIME, and access controls before rendering any payload content.

PHASE-005 automated follow-up evaluates cooldown, active-concurrency, and
budget limits before it can create a Proposal. A blocked decision is immutable
audit evidence; an allowed decision remains subject to the ordinary
ProposalVersion and AuthorizationGrant boundary and is never an authorization.

The PHASE-005 monitoring-status IPC channel is read-only and schema-bounded to
a Project identifier. Its renderer projection contains counts and collector
availability only; it cannot disclose raw payloads or create a Proposal, Grant,
Task, or external effect.

Related contracts: [architecture](architecture.md), [SAI](api/sai.md), [Codex Adapter](adapters/codex.md), and [operations](operations.md).

PHASE-006 Adapter manifests contain opaque credential references only. Invalid
or incomplete capability metadata cannot enable an Adapter.

Domain Template classification is mandatory. `ANALYSIS` may create a cited
recommendation; it cannot produce an automatic side effect or bypass a Grant.

HR data is sensitive by default. An unclassified record is rejected, and an
employment action requires an explicit L4 human Decision in addition to any
ordinary authorization boundary.

Internal Agent authorization intersects declared Agent and requested data
domains. Cross-domain access and non-opaque credential material fail closed
before an Adapter can receive a command.

Artifact viewers never execute untrusted content. Malicious HTML is displayed
only as escaped metadata under Download-only or Quarantined policy.

For pending migrations, no disk database is exempted from the pre-migration
backup based on a pre-open existence check. A fresh database also receives a
backup, and a detected intervening SQLite commit blocks migration. This is
not a defense against out-of-band file replacement or concurrent old
application instances.

An outbox message is not authority to execute. A claimed message must be
strictly decoded and bound to its Attempt before any dispatcher can consume
it; malformed or mismatched payloads are quarantined. A production execution
boundary must independently verify the current Grant, snapshot, lease,
fencing token and full Adapter contract before any external effect.

The internal queue must not issue a claim for an already UNKNOWN or
RECONCILING Attempt. That claim-time check is necessary but not sufficient:
the state, authority and resource fences may change before an external call.

Only state-appropriate start and resume messages may be claimed. Resume data
must match a resolved Decision belonging to the same WorkItem and its exact
resolution identifier. This evidence check does not authorize a later
external effect or replace revalidation at the execution boundary.

Lease validity requires a matching owner, fencing token and ACTIVE record
with a canonical, unexpired 30-second renewal window. Null legacy expiry or
clock rollback fails closed; expiry cannot release or reassign resources.
This database check cannot stop a stale process unless the Adapter enforces
the fence before each write.
Rollback detection compares the trusted clock to the last persisted
observation; time jumps with no intervening observation are not detectable.

Renewal depends on a trusted ownership check. Loss, a thrown check or failed
renewal stops the supervisor; it cannot establish process termination and
must never release the Lease or permit redispatch on that basis alone.

The production Electron window loads the bundled renderer file and permits
file navigation only to that exact URL. Other local files, hosts, query
strings and fragments are denied. Exact IPC sender and main-frame checks
remain independent; an untrusted environment variable cannot change the
production navigation authority.
