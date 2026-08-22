# Super Assistant security model

Super Assistant is a local control plane that can execute code, mutate repositories, use credentials, and call external systems. Local-first reduces network exposure but does not make renderer content, Agent output, repositories, plugins, IPC peers, or local processes trusted.

## Security objectives

- Human authority over every material side effect.
- Least privilege across renderer, main process, adapter, App Server, Project, credentials, and network.
- Deterministic authorization tied to immutable facts.
- Isolation and provenance for repository mutation.
- No silent continuation after ambiguous execution or protocol failure.
- Auditability without storing secrets in logs or model context.

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

## Secure Electron IPC

- `contextIsolation: true`, renderer sandbox enabled, and `nodeIntegration: false` are mandatory.
- Preload exposes named, versioned methods; arbitrary channel send, eval, shell, path, SQL, and generic invoke methods are prohibited.
- Every request is schema-validated in preload and independently in main.
- Main derives the caller/window identity; renderer-supplied actor or Workspace authority is not trusted.
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
