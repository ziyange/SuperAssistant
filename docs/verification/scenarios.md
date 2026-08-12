# Verification scenario catalog

Requirement-level `SCN-*` cases in `docs/requirements.md` define focused acceptance. This catalog defines cross-requirement lifecycle scenarios used by the traceability matrix and phase gates. `VS-*` is not a valid scenario prefix in this repository.

## H1 foundation and execution

### SCN-FOUNDATION-OWNERSHIP

Create, close, and reopen the local Workspace; register Project and Agent facts; confirm stable identifiers, canonical scoping, migration version, and no stored secret value.

### SCN-UX-NAVIGATION

Launch the desktop shell, visit the five fixed destinations, exercise H1 onboarding, and verify accessibility, empty/error states, and absence of future-only Template controls.

### SCN-ADAPTER-DISCOVERY

Run fake App Server initialize/health/describe cases for healthy, authentication-required, incompatible, malformed, timeout, and process-exit states; assert execution operations remain unavailable in PHASE-001.

### SCN-DATA-MIGRATION

Create a fresh control plane, reopen it, apply each migration once, inject migration failure, and prove the previous version remains usable and authoritative.

### SCN-AUTH-READONLY

Submit a status or analysis query and prove no ProposalVersion, AuthorizationGrant, resource lease, command, project write, network action, or external side effect is created.

### SCN-AUTH-SIDE-EFFECT

Submit goals that require file, command, network, credential, and external-system effects; prove each produces a reviewable immutable Proposal and that the target remains unchanged before confirmation.

### SCN-PREFLIGHT-INVALIDATE

Approve a Proposal and independently change Project snapshot, branch/baseline, Agent, Function, capability, policy, grant, and resource state; prove every material change invalidates preflight and prevents dispatch until a new version is confirmed.

### SCN-EXEC-IDEMPOTENT

Repeat confirm and dispatch requests and replay outbox delivery; prove one grant, one initial ExecutionAttempt, and one external execution identity exist for the same approved launch.

### SCN-WORKTREE-ISOLATION

Execute a fixture mutation inside its task worktree and compare original repository path, branch, status, and content hashes before and after; all original-workspace facts remain unchanged.

### SCN-RECOVERY-RECONCILE

Crash the desktop, control plane, adapter worker, and fake App Server at each lifecycle boundary; on restart, reconcile external identity and events before dispatch and prove no duplicated effect.

### SCN-CANCEL-TERMINATE

Cancel during startup, running, streaming, and uncertain states; confirm the actual process tree terminates, late events are contained, the lease is fenced/released, and UI reports the truthful terminal outcome.

### SCN-DECISION-IDEMPOTENT

Raise duplicate L3/L4 questions, resolve from both visible projections, and replay the resolution; prove one Decision, one Human History entry, one effective resume, and no automatic L4 approval.

### SCN-AUDIT-EVIDENCE

For a completed and a remediated Task, traverse goal, Proposal, grant, Work Item, Attempt, event, Decision, ArtifactVersion, acceptance, and ProjectChange; every edge is present, checksummed where applicable, and append-only.

## H2 multi-agent and monitoring

### SCN-DAG-QUALITY

Execute a durable acyclic graph with executor, Testing, and Inspector roles; inject test rejection and prove remediation remains under the original Task with independently attributable evidence.

### SCN-RESOURCE-CONFLICT

Declare overlapping and non-overlapping canonical resources across concurrent Work Items; overlapping writes are blocked before dispatch while safe work proceeds, and stale workers cannot write with an old fencing token.

### SCN-MONITOR-BOUNDS

Replay duplicate events and an event storm across collector, webhook, and scheduler sources; prove raw evidence retention, deduplication, aggregation, cooldown, budget, rate, and concurrency limits plus one policy-compliant follow-up.

## H3 domain and enterprise

### SCN-DOMAIN-CONFORMANCE

Run each approved domain adapter through discovery, authorization, execution, error, Artifact, redaction, and recovery fixtures; all stable SAI and data-classification controls pass.

### SCN-TEAM-GOVERNANCE

Execute positive and negative role matrices, separation-of-duty and multi-party approval cases, cross-Workspace credential attempts, audit export integrity, retention expiry, and legal hold; prove isolation and complete evidence.

## Cross-cutting release

### SCN-NFR-QUALITY

Run the supported Windows/Node/Python matrix, performance and scale budgets, secret/redaction checks, degraded-state recovery, accessibility/localization checks, retention/export tests, lint, typecheck, unit, contract, Playwright, build, and the explicitly enabled smoke gate.
