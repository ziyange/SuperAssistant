# Super Assistant UX contract

The interface hides adapter, protocol, state-machine, and event complexity while keeping every material plan, authorization, decision, failure, and result inspectable. The user supplies goals and key decisions; the product explains who will act, where, with what authority, what changed, and why work is waiting.

## Navigation and persistent assistant

H1 top-level navigation is fixed:

- Super Assistant
- Agent Center
- Task Center
- Project Center
- Settings

Super Assistant is the default home and remains available as a global panel from detail/settings pages. The panel receives only the current product object context—Agent, Project, Task, Decision—not raw renderer state or Codex Thread/Turn identifiers.

## First-run experience

The PHASE-001 shell offers three bounded actions: connect Codex, add a Project,
or start a Task. These controls are onboarding guidance until the corresponding
Project and Codex capabilities arrive in later approved Task Packs. H1 fully
supports adding a local Git Project, connecting the local Codex runtime, and
starting a development Task. Agent templates—including any create-with-
assistance route—are absent until their H2 contract and code exist; unavailable
controls are not interactive promises.

Connection onboarding shows detected Runtime version, compatibility, authentication state, Project path, repository identity, default branch, and a test result. Credential fields write directly through the secure broker; existing secrets are displayed only as present/absent labels.

## Super Assistant home

The default page contains:

1. A goal input with 3–5 examples grounded in installed capabilities.
2. At most three key summaries, initially running Tasks, waiting Decisions, and abnormal Tasks/Projects.
3. A waiting-Decisions region that takes no space when empty.

Conversation responses may embed Agent cards, Project cards, Task boards, Decision cards, tables, metrics, or charts. Each embedded object links to its canonical detail view and displays the same authoritative status.

## ProposalVersion and authorization

Any side-effecting route presents an immutable ProposalVersion, labeled “Execution Proposal” in the UI, before execution. The review surface shows:

- goal and acceptance criteria;
- Projects, Agents, Functions, and pinned versions;
- WorkItems, dependencies, parallel branches, and verifier relationships;
- files/resources expected to be read or written;
- commands, process, network, credential, external-write, and Git permissions;
- budgets, deadline, worktree strategy, and evidence to retain;
- actions covered now and triggers requiring a new confirmation;
- risk level and a plain-language explanation.

Confirm submits an idempotency key. Double-click, refresh, or retry cannot create a second AuthorizationGrant or ExecutionAttempt. A stale preflight never silently updates the approved plan; the UI compares the invalidated and successor ProposalVersions and asks again.

Read-only questions skip ProposalVersion creation while clearly indicating that no side effect occurred.

## Agent UX

Agent cards show name, role, Availability as primary state, WorkItem count, Project count, and recent Activity. Connection warnings override the ordinary Availability presentation. Illegal combinations such as Disabled plus Available never render.

Agent Detail contains overview, Functions, supporting Capabilities, Projects, Tasks/WorkItems, and settings. Skill/MCP/Tool/Plugin/API details are collapsed by default. Function eligibility is Project- and version-specific. Product copy never exposes App Server Thread or Turn.

## Project UX

Project cards show name, lifecycle status, current Tasks, active Agents, latest Change, anomaly, and last activity; abnormal Projects may rank ahead of recent activity. Project Detail contains overview, Tasks, Agents, append-only Change history, resources/capabilities, and settings.

Archive is unavailable while active Tasks exist. The confirmation surface offers wait, pause/cancel then archive, or return. Archived Projects remain readable and cannot receive new Tasks.

## Task and WorkItem UX

Task Detail shows goal/status, phase/progress, Agent assignment, Projects/resources, Decisions, Activity/Raw Log, and ArtifactVersions. A one-Agent/one-WorkItem Task hides the WorkItem layer by default; the durable model remains identical.

Complex Tasks show a compact dependency graph and a list fallback. Every WorkItem shows objective, Agent, Project, dependencies, current ExecutionAttempt, inputs, expected outputs, acceptance, and reason when waiting.

Status uses stable product labels plus precise reasons:

- `RUNNING / RECONCILING` explicitly says the previous execution outcome is being determined and that no duplicate execution will start.
- `WAITING_USER` links to the single blocking Decision.
- `BLOCKED` names the unavailable Agent, capability, dependency, resource, or policy cause.
- `CANCELLING` remains visible until the process stops and leases release.

Acceptance failure remains in the same Task and shows the failed evidence, new ExecutionAttempt or remediation WorkItem, and re-verification route.

## Decision UX

A Decision card always includes title, context, source Task/Agent, risk, current facts, options, impacts, recommendation, and rationale. Deadline, attachments, custom response, and Project are displayed when present.

L3/L4 cards state that the AI recommendation is not authorization. Important Decisions receive configured reminders. Emergency timeout keeps the Task paused/blocked and never preselects or auto-submits an option. Resolving a Decision from Super Assistant or Task Detail updates the same canonical record immediately and disables duplicate submission.

## Activity, Human History, ArtifactVersion, and ProjectChange

Activity answers “what the Agent/system did”; Human History answers “what the user approved or decided.” The UI may cross-link them but never merges their evidence stores.

ArtifactVersions show logical name, version, producer WorkItem/ExecutionAttempt, type, digest, time, status, and preview/download policy. Retries never replace earlier versions. Unknown or active content is download-only or quarantined. Project rollback displays the original and compensating ProjectChanges together; history is never visually erased.

## Data visualization

Use the smallest view that answers the question:

- metric card for one current value;
- line chart for adequate continuous time data;
- bar chart for category comparison/ranking;
- donut only for a small, explicit composition;
- funnel only for genuine ordered stages;
- table for detail, sorting, and filtering.

Insufficient comparison data produces an explicit “insufficient data” state rather than inference. Correlation is never labeled causation. Refresh cadence and observation time are visible for dynamic data.

## Degraded and recovery states

When the Super Assistant model or network is unavailable, the UI remains usable for read-only Agent, Project, Task, Decision, Activity, and ArtifactVersion views. Already authorized independent work may continue. New AI planning, Agent creation, and replanning are disabled with a reason and recovery action.

Connection loss during execution displays `UNKNOWN` then `RECONCILING`; Retry is disabled until reconciliation reaches a terminal result or proves `NOT_STARTED`. Dirty/quarantined worktrees offer inspect, preserve, and explicitly authorized cleanup actions.

## Accessibility and privacy

Every state uses text and iconography, not color alone. Focus order, keyboard activation, semantic headings, chart table alternatives, reduced motion, and screen-reader announcements are required. Destructive/high-risk confirmation names the exact target and consequence. Secrets, raw Authorization headers, private App Server identifiers, and unrestricted local paths never render.

## H1-H3 evolution

- H1 optimizes a single-user Codex development loop and exposes the complete safe ProposalVersion/Task/Decision/evidence model.
- H2 adds Agent templates, parallel multi-Agent graphs, monitoring, event aggregation, cooldown and budget surfaces without adding top-level navigation.
- H3 adds Workspace switcher, membership, RBAC, multi-party approvals, audit export, and retention controls inside the existing five destinations. Existing Task/Decision/ArtifactVersion URLs and product labels remain stable; adapter-specific concepts remain hidden.

Related facts: [architecture](architecture.md), [security](security.md), [orchestration](orchestration.md), and [operations](operations.md).
