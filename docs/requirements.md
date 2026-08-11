# Super Assistant requirements

- Status: Baselined
- Baseline date: 2026-08-09
- Product source: [product truth](product.md)
- Evidence source: [Super Assistant V3.0](source/super-assistant-v3.md)
- Traceability: [requirement traceability matrix](requirement-traceability-matrix.md)

## Requirement conventions

- Requirement identifiers are permanent. A superseded requirement remains in history and is replaced through an approved fact change.
- `baselined` means the requirement is approved as product truth but is not yet verified in an application phase.
- Acceptance statements describe observable behavior. The named verification scenario is the minimum proof and may be supplemented by lower-level tests.
- Dependencies list requirement identifiers whose contracts must exist before the requirement can be accepted. `None` means no product-requirement dependency.
- Risks use Low, Medium, High, or Critical and name the principal failure mode.

## Workspace, Project, Agent, Function, and onboarding requirements

## REQ-001: Single-user Workspace ownership

- Statement: H1 shall create one authoritative local Workspace owned by the current user and shall persist stable Workspace and Owner identifiers on every scoped record.
- Acceptance:
  - A fresh installation creates exactly one default Workspace and one Owner.
  - New Projects, Agents, Tasks, and Connections contain the same non-null Workspace and Owner identifiers.
  - Team membership controls are unavailable before PHASE-007.
- Verification: `SCN-WORKSPACE-OWNERSHIP — Workspace ownership persists` — create and reopen a Workspace, then query all seeded entity types and assert stable ownership and scope identifiers.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: None.
- Risk: High — missing ownership fields would force a destructive team-mode migration.

## REQ-002: Fixed primary navigation

- Statement: The desktop application shall expose Super Assistant, Agent Center, Task Center, Project Center, and Settings as the fixed primary navigation, with Super Assistant as the default destination.
- Acceptance:
  - All five destinations are reachable from every primary screen.
  - A fresh launch opens Super Assistant.
  - Adding later capabilities does not add another primary destination.
- Verification: `SCN-NAV-PRIMARY — Primary navigation is stable` — run an Electron navigation test that visits all five destinations and relaunches to the default destination.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: REQ-001.
- Risk: Low — inconsistent navigation would expose internal product complexity.

## REQ-003: Minimal Super Assistant home

- Statement: The Super Assistant home shall contain a goal input, no more than three prioritized work summaries, and a Decision area that occupies no space when no Decision is waiting.
- Acceptance:
  - Empty, active-task, abnormal-task, and waiting-Decision fixtures render the correct sections.
  - No fixture renders more than three summary groups.
  - The Decision area is absent from the layout when its result set is empty.
- Verification: `SCN-HOME-PROJECTION — Assistant home adapts to work state` — execute renderer component tests against the four named projection fixtures.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-035, REQ-043.
- Risk: Medium — an overloaded home would undermine the product's simple entry point.

## REQ-004: Context-aware assistant window

- Statement: Agent, Task, Project, and Settings detail surfaces shall open a global assistant window whose request context contains the current object identifier and type.
- Acceptance:
  - Opening the window from each supported surface sends the visible object's stable identifier.
  - Navigating to another object updates the context before the next request.
  - The user can remove the inferred context before submission.
- Verification: `SCN-CONTEXT-CURRENT-OBJECT — Context follows the visible object` — navigate across four detail fixtures and assert the submitted context envelope after each transition and after explicit removal.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-002, REQ-013, REQ-014, REQ-035.
- Risk: Medium — stale implicit context could direct work at the wrong resource.

## REQ-005: H1 onboarding routes

- Statement: H1 onboarding shall offer connect Codex, add a Project, and start a Task routes plus three to five executable examples, while Agent Template creation remains hidden until PHASE-004.
- Acceptance:
  - Each H1 route resumes from its last durable step after application restart.
  - Every example is valid for the installed H1 capability set.
  - No H1 screen represents Agent Template creation as available.
- Verification: `SCN-ONBOARD-H1 — Onboarding exposes only deliverable routes` — complete and restart each onboarding route, validate example submissions, and assert the Template route is absent.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: REQ-001, REQ-006, REQ-014.
- Risk: Medium — advertising future routes would create an unusable first-run experience.

## REQ-006: Project registration and canonical identity

- Statement: A user shall register a Project from an accessible workspace path, and the control plane shall assign one stable Project identity to the canonical path.
- Acceptance:
  - A valid directory creates one Project with its canonical absolute path.
  - Registering an equivalent normalized path returns the existing Project rather than a duplicate.
  - Missing, unreadable, or unsupported paths fail without creating a partial Project.
- Verification: `SCN-PROJECT-CANONICAL — Project paths are canonical and unique` — register valid, aliased, missing, and denied paths and inspect persisted Project counts and errors.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: REQ-001.
- Risk: High — duplicate or misidentified paths could direct writes to the wrong repository.

## REQ-007: Project metadata discovery and correction

- Statement: Project onboarding shall discover Repository, default branch, technology stack, and workspace metadata when available and shall let the user correct each discovered value.
- Acceptance:
  - A supported Git fixture populates Repository and current default-branch evidence.
  - A non-Git fixture remains registerable and labels unavailable metadata explicitly.
  - A user correction persists and is identified as user-supplied rather than scan-supplied.
- Verification: `SCN-PROJECT-DISCOVERY — Project discovery preserves provenance` — onboard Git and non-Git fixtures, edit one discovered field, reopen the Project, and assert value and provenance.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: REQ-006.
- Risk: Medium — unqualified discovery could be mistaken for authoritative configuration.

## REQ-008: Project and default-Agent routing

- Statement: The platform shall route an explicitly identified Project to its configured Project Agent and default Developer Agent when those relationships are enabled and available.
- Acceptance:
  - Two registered Projects with different defaults resolve to their own configured Agents.
  - A missing or unavailable default produces a routing candidate set instead of silent substitution.
  - User-confirmed routing overrides are stored with the resulting Task.
- Verification: `SCN-ROUTING-EXPLICIT — Explicit Project routing is deterministic` — route goals through two Project fixtures, disable one default Agent, and verify candidate and override behavior.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-006, REQ-014, REQ-015, REQ-017.
- Risk: Critical — incorrect routing can mutate the wrong Project.

## REQ-009: Ambiguous Project clarification

- Statement: The platform shall request user clarification whenever the supplied goal matches more than one Project above the configured routing threshold.
- Acceptance:
  - Duplicate-name and equal-score fixtures never produce an executable Proposal before selection.
  - The clarification lists only accessible candidate Projects with differentiating metadata.
  - The selected Project is bound to the Proposal version.
- Verification: `SCN-ROUTING-AMBIGUOUS — Ambiguity never becomes a guess` — run the twenty-case routing suite and assert clarification for every ambiguous case and zero preselection side effects.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-006, REQ-008, REQ-022.
- Risk: Critical — a guessed Project can cause unauthorized changes.

## REQ-010: Project lifecycle states

- Statement: A Project shall use Initialization, Active, Paused, Archived, and Error states with explicitly validated transitions.
- Acceptance:
  - The transition table rejects every undeclared state change.
  - Initialization reaches Active only after required workspace validation succeeds.
  - Recovering the cause of Error does not bypass the normal transition guard.
- Verification: `SCN-PROJECT-STATE — Project transitions are closed` — exhaustively exercise the Project transition table and assert allowed and rejected edges.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: REQ-006, REQ-007.
- Risk: Medium — permissive transitions could allow work against invalid Projects.

## REQ-011: Paused Project execution policy

- Statement: A Paused Project shall block automatically generated Tasks and require a new explicit user confirmation before any manually initiated side-effecting Task can proceed.
- Acceptance:
  - A monitoring or automatic route cannot create an executable Task for a Paused Project.
  - A manual read-only query remains available.
  - A manual side-effecting goal displays the paused state and cannot reuse an earlier authorization.
- Verification: `SCN-PROJECT-PAUSE — Pause blocks implicit work` — exercise automatic, read-only, and manual side-effect routes against a Paused Project and inspect Task and Grant records.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-010, REQ-020, REQ-025.
- Risk: High — a weak pause contract would violate user control.

## REQ-012: Project archival without hard deletion

- Statement: Archiving a Project shall preserve all history, reject new Tasks, and require every active Task to complete, pause, or cancel before archival is finalized.
- Acceptance:
  - An Active Project with a running Task cannot enter Archived.
  - After all active Tasks reach an allowed non-running state, archival succeeds and new Task creation is rejected.
  - Historical Tasks, Changes, Agents, Decisions, and Artifacts remain queryable.
- Verification: `SCN-PROJECT-ARCHIVE — Archive preserves the historical chain` — attempt archival before and after resolving active Tasks, then query every retained relationship and attempt new Task creation.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-010, REQ-035, REQ-045, REQ-046, REQ-048.
- Risk: High — archive mistakes could either destroy evidence or permit hidden execution.

## REQ-013: Project Center projections

- Statement: Project Center shall provide cards and detail projections for state, current Tasks, participating Agents, resources, recent Changes, anomalies, and last activity.
- Acceptance:
  - Cards default to descending last-activity order, with anomalous Projects eligible for documented priority promotion.
  - Project detail links every displayed Task, Agent, resource, and Change to its authoritative record.
  - Empty and unavailable data is labeled rather than inferred.
- Verification: `SCN-PROJECT-PROJECTION — Project projections retain lineage` — load ordered, anomalous, empty, and linked fixtures and assert ordering, labels, and target identifiers.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-010, REQ-014, REQ-035, REQ-048.
- Risk: Medium — stale projections can misrepresent current project health.

## REQ-014: Agent catalog and detail

- Statement: Agent Center shall persist and display each Agent's identity, role, principal state, current Work Item count, Project relationships, recent Activity, Functions, capabilities, Tasks, and settings.
- Acceptance:
  - The card and detail view resolve to the same stable Agent record.
  - Counts and recent Activity are derived from authoritative relationships rather than model text.
  - Capability implementation details are collapsed by default.
- Verification: `SCN-AGENT-PROJECTION — Agent catalog is a faithful projection` — compare card and detail output with seeded Agent, Project, Work Item, Function, and Activity records.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: REQ-001, REQ-015, REQ-017, REQ-018.
- Risk: Medium — divergent Agent views would undermine routing confidence.

## REQ-015: Agent connection and availability semantics

- Statement: Each Agent shall maintain independent Connection and Availability states; a Connection error shall take display precedence, otherwise the principal displayed state shall be Availability.
- Acceptance:
  - The state model rejects combinations declared impossible by policy.
  - Authentication Required, Unavailable, and Disabled Connection states override Availability in card presentation.
  - A healthy Connection displays Available, Full, Paused, or Error Availability without losing Connection detail.
- Verification: `SCN-AGENT-STATE — Composite Agent state has one precedence rule` — exhaustively render all legal state pairs and reject all illegal pairs.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: REQ-014.
- Risk: High — incorrect status can dispatch work to an unusable Agent.

## REQ-016: Agent category and tag filtering

- Statement: An Agent shall have one primary category and any number of user tags for display, filtering, and recommendation, while execution routing shall not rely on category alone.
- Acceptance:
  - Category and tag filters return the correct seeded Agents.
  - An Agent with the matching category but an incompatible Function is excluded from executable routing.
  - User-created tags do not alter Function or authorization contracts.
- Verification: `SCN-AGENT-CLASSIFICATION — Classification cannot impersonate capability` — filter and route a mixed catalog containing category matches with incompatible Functions.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-014, REQ-017, REQ-050.
- Risk: Medium — category-only routing could assign unsupported work.

## REQ-017: Function catalog contract

- Statement: Every executable Agent capability shall be represented by a versioned Function containing a stable identifier, description, input schema, result schema, and availability.
- Acceptance:
  - Registration rejects a Function missing any required field or using an invalid schema.
  - Function identifiers remain stable across compatible description changes.
  - Proposal generation can cite the exact Function version it intends to use.
- Verification: `SCN-FUNCTION-CONTRACT — Function contracts are executable and versioned` — validate complete, incomplete, compatible-update, and incompatible-update fixtures and inspect Proposal references.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: REQ-001.
- Risk: Critical — an underspecified Function cannot be authorized or verified safely.

## REQ-018: Supporting capability catalog

- Statement: The platform shall associate Skills, MCP servers, Apps, Tools, Plugins, and APIs with the Agent, Function, Project, and availability scope in which each capability can be used.
- Acceptance:
  - Capability discovery for a Project returns only enabled and accessible records.
  - Removing a capability invalidates any pending preflight that references it.
  - The primary UI presents Function first and supporting capability detail only on demand.
- Verification: `SCN-CAPABILITY-SCOPE — Capability scope constrains proposals` — discover capabilities across two Projects, disable one record, and verify UI presentation and preflight invalidation.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: REQ-006, REQ-014, REQ-017.
- Risk: High — stale capability scope can authorize an impossible or unsafe execution.

## REQ-019: Agent, Function, and Template version references

- Statement: The catalog shall persist Agent version, Function version, compatibility state, and optional Template identifier and version, without implementing Template creation in PHASE-001.
- Acceptance:
  - H1 records can store and retrieve all version and compatibility fields.
  - The PHASE-001 UI does not expose Template creation.
  - An incompatible active Function version marks affected pending work non-dispatchable.
- Verification: `SCN-CATALOG-VERSION — Forward-compatible catalog does not expose future behavior` — migrate versioned fixtures, assert Template references persist, assert no creation route, and block an incompatible Function.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: REQ-014, REQ-017.
- Risk: High — absent version references would make later Adapter and Template evolution unsafe.

## Proposal, authorization, Codex, Task, Work Item, and Attempt requirements

## REQ-020: Read-only route without Proposal

- Statement: Catalog, status, log, and analysis requests that have no side effect shall execute without creating a Proposal, Authorization Grant, Task, Work Item, or Attempt.
- Acceptance:
  - Each approved read-only request type returns its result with a query trace.
  - Persistence counts for Proposal, Grant, Task, Work Item, and Attempt remain unchanged.
  - A request that cannot be proven read-only is routed to the side-effect policy.
- Verification: `SCN-AUTH-READONLY — Read-only queries bypass authorization safely` — execute every read-only class and an unclassified request, then inspect traces and entity counts.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-017, REQ-018.
- Risk: High — misclassification can either interrupt harmless work or bypass authorization.

## REQ-021: Side effects require exact authorization

- Statement: File mutation, command execution, network action, credential use, external-system write, and every other side effect shall be denied unless an active Authorization Grant covers the exact Proposal version and action scope.
- Acceptance:
  - Each side-effect class is denied before Adapter dispatch when its Grant is absent, expired, revoked, version-mismatched, or out of scope.
  - A matching active Grant permits only the declared resources and action kinds.
  - Every permitted dispatch records Proposal, Grant, Task, Work Item, and Attempt identifiers.
- Verification: `SCN-AUTH-SIDE-EFFECT — Every side effect has exact authorization` — run positive and negative policy cases for all six named side-effect classes and inspect dispatch and audit records.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-022, REQ-025, REQ-037.
- Risk: Critical — a bypass would violate the central human-authority promise.

## REQ-022: Complete Execution Proposal

- Statement: A side-effecting goal shall produce an Execution Proposal containing goal, Project, Agent, Work Items, order and dependencies, Function and supporting capabilities, authorization scope, reconfirmation boundaries, and measurable acceptance conditions.
- Acceptance:
  - Proposal validation rejects any missing required section or unresolved identifier.
  - H1 Proposals contain one Project, one Codex Agent, and one required Work Item.
  - The confirmation view displays the normalized scope and acceptance conditions before its action control.
- Verification: `SCN-PROPOSAL-COMPLETE — Incomplete plans cannot be confirmed` — validate complete and one-field-missing fixtures and inspect the rendered confirmation model.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-008, REQ-017, REQ-018.
- Risk: Critical — omitted scope or acceptance facts make confirmation meaningless.

## REQ-023: Minimal clarification and fast path

- Statement: Proposal planning shall ask only for facts required to resolve Project, Function, scope, authorization, or acceptance, and shall generate a Proposal directly when those facts are already explicit.
- Acceptance:
  - A fully specified reference request produces a Proposal without a follow-up question.
  - Each incomplete fixture asks one grouped clarification containing only its unresolved material facts.
  - Answers update the planning record and are not requested again unless invalidated.
- Verification: `SCN-PROPOSAL-FAST-PATH — Complete intent is not re-interrogated` — execute complete and incomplete intent fixtures and compare questions with the missing-fact oracle.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-009, REQ-022.
- Risk: Medium — excessive questions reduce utility while omitted questions increase execution risk.

## REQ-024: Immutable Proposal versions

- Statement: Every change to a Proposal after it is presented shall create a new immutable Proposal version linked to the prior version.
- Acceptance:
  - Editing any normalized Proposal field creates a new version identifier.
  - Prior versions remain readable and byte-stable.
  - Confirmation controls can target only the currently presented version.
- Verification: `SCN-PROPOSAL-VERSION — Proposal history is immutable` — edit each field class, compare stored versions, and attempt confirmation with a stale version identifier.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-022.
- Risk: Critical — mutable approved content would invalidate authorization evidence.

## REQ-025: Authorization Grant lifecycle

- Statement: User confirmation shall create an Authorization Grant bound to one Proposal version, user, Project snapshot, action scope, validity interval, and revocation state.
- Acceptance:
  - The stored Grant contains all binding fields and a stable identifier.
  - Expiry or revocation prevents new dispatch while preserving prior execution evidence.
  - A Grant cannot be rebound to another Proposal, Project, or user.
- Verification: `SCN-AUTH-GRANT-LIFECYCLE — Grants cannot drift from approval` — confirm, expire, revoke, and attempt to rebind Grants while inspecting policy decisions.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-001, REQ-024.
- Risk: Critical — transferable or stale Grants would enable unauthorized work.

## REQ-026: Preflight invalidation and reconfirmation

- Statement: Before dispatch, preflight shall revalidate Project snapshot, Agent and Function versions, capabilities, policy, and Grant; any material change shall produce a new Proposal version and require confirmation.
- Acceptance:
  - An unchanged fixture passes without altering the confirmed version.
  - Changing each named input invalidates the preflight and produces no Adapter command.
  - The user sees the changed facts before reconfirmation.
- Verification: `SCN-PREFLIGHT-INVALIDATE — Stale approval never dispatches` — mutate each preflight input between confirmation and start and assert invalidation, versioning, zero dispatch, and visible change detail.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-018, REQ-024, REQ-025.
- Risk: Critical — dispatching stale plans could affect a changed environment.

## REQ-027: Idempotent confirmation and launch

- Statement: Repeated confirmation or delivery of the same launch command shall create at most one Authorization Grant, one initial Attempt, and one external start effect for an idempotency key.
- Acceptance:
  - One hundred sequential and concurrent duplicate-confirmation cases each produce one effect.
  - Every duplicate caller receives the same stable outcome identifiers.
  - A genuinely new Proposal version requires a new idempotency key.
- Verification: `SCN-EXEC-IDEMPOTENT — Duplicate confirmation starts once` — run the one-hundred-case duplicate suite across UI, command, and inbox boundaries and compare persisted and fake-Adapter effects.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-024, REQ-025, REQ-037, REQ-093.
- Risk: Critical — duplicate execution can corrupt a Project or spend unbounded resources.

## REQ-028: H1 Codex transport boundary

- Statement: H1 shall integrate one local Codex runtime exclusively through the stable App Server API over default `stdio`; remote execution is outside the H1 execution path.
- Acceptance:
  - The Adapter starts and initializes a supported local App Server process over `stdio`.
  - H1 configuration contains no remote Codex execution endpoint.
  - Unsupported protocol versions fail closed with an actionable compatibility state.
- Verification: `SCN-CODEX-STDIO — H1 uses one local stable transport` — run supported, unsupported-version, and attempted-remote configurations against the Adapter contract harness.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-015, REQ-019, REQ-090.
- Risk: High — coupling to an unstable or remote surface would change security and recovery design.

## REQ-029: Product-neutral Codex mapping

- Statement: The Codex Adapter shall map App Server initialization, thread, turn, interrupt, and streaming concepts to product-neutral Agent, Function, Attempt, event, cancellation, and Result contracts.
- Acceptance:
  - Product domain records and primary UI contain no Codex Thread or Turn object type.
  - Every supported App Server event maps deterministically to one documented product event or ignored-event reason.
  - Raw upstream identifiers remain available only as Adapter evidence.
- Verification: `SCN-CODEX-MAPPING — Codex internals remain behind the Adapter` — replay the supported protocol corpus and inspect mapped domain records, ignored-event reasons, and UI projections.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-017, REQ-028, REQ-037, REQ-038.
- Risk: High — leaking upstream concepts would prevent Adapter substitution and confuse users.

## REQ-030: Codex execution lifecycle and termination

- Statement: The Codex Adapter shall support initialization, status, start, continue, event streaming, interrupt, terminal result retrieval, and verified process termination through one product-neutral execution lifecycle.
- Acceptance:
  - Contract fixtures cover success, failure, user input, disconnect, interrupt, and process-exit outcomes.
  - Cancellation is incomplete until the Codex process is terminated and its resource lease is released.
  - A late event after a terminal state is deduplicated or recorded as non-state-changing evidence.
- Verification: `SCN-CANCEL-TERMINATE — Cancellation terminates work and releases resources` — cancel at each lifecycle point and assert process exit, terminal Attempt state, lease release, and late-event handling.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-028, REQ-029, REQ-037, REQ-038, REQ-095.
- Risk: Critical — incomplete cancellation can leave hidden side effects running.

## REQ-031: Task worktree isolation

- Statement: Every H1 side-effecting Task shall execute in a dedicated worktree and `codex/phase-00x-*` branch whose canonical paths and protected resources are bound to the Authorization Grant and lease.
- Acceptance:
  - Two concurrent Task fixtures receive different canonical worktree and branch identities.
  - Writes outside the granted worktree or protected resource set are denied and audited.
  - Completion or cancellation follows the documented lease-release and worktree-retention policy.
- Verification: `SCN-WORKTREE-ISOLATION — Task writes remain inside one isolated worktree` — run concurrent and out-of-bound fake executions, then inspect files, branches, Grants, audit events, and leases.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-006, REQ-021, REQ-025, REQ-094.
- Risk: Critical — shared or unbounded writes can corrupt user work and defeat concurrency safety.

## REQ-032: Task represents one user goal

- Statement: A Task shall represent one materially stable user goal and shall preserve the Project, responsible Agent set, acceptance conditions, and resulting evidence for that goal.
- Acceptance:
  - H1 creates one Task for one Goal, one Project, one Codex Agent, and one required Work Item.
  - Frontend, backend, testing, or remediation activity for the same goal remains linked to that Task.
  - A materially unrelated goal cannot be appended to an existing Task.
- Verification: `SCN-TASK-GOAL-BOUNDARY — One goal retains one Task history` — classify same-goal, remediation, and unrelated-goal fixtures and inspect resulting Task identities and links.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-022.
- Risk: High — unstable Task boundaries break status, authorization, and audit meaning.

## REQ-033: Work Item execution contract

- Statement: Every Work Item shall contain stable Task and Project links, responsible Agent, required flag, work description, dependencies, inputs, expected output, status, and accepted result reference.
- Acceptance:
  - Persistence rejects a Work Item missing a required field or pointing outside its Task Workspace.
  - H1 creates exactly one required Work Item for an executable Task.
  - Result acceptance records the accepting actor, evidence, and timestamp.
- Verification: `SCN-WORKITEM-CONTRACT — Work Items are complete execution units` — validate complete, incomplete, cross-Workspace, H1-count, and acceptance fixtures.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-001, REQ-032.
- Risk: High — incomplete Work Items cannot be scheduled or accepted deterministically.

## REQ-034: Simple Task hides Work Item complexity

- Statement: When a Task has one Agent and one Work Item, the primary Task view shall present goal, execution, and acceptance stages without exposing the Work Item as a separate concept.
- Acceptance:
  - The H1 single-Work-Item fixture renders the three-stage simple view.
  - A multi-Work-Item fixture in PHASE-004 renders explicit Work Items and dependencies.
  - Advanced details can reveal stable identifiers without changing the primary flow.
- Verification: `SCN-TASK-SIMPLE-COMPLEX — UI reveals orchestration only when needed` — compare simple and multi-Work-Item renderer fixtures and advanced-detail output.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-032, REQ-033.
- Risk: Low — premature workflow terminology would increase user effort.

## REQ-035: Deterministic Task status derivation

- Statement: Task status shall be derived from user pause, required Work Item states, open Decisions, and terminal conditions using one documented precedence table.
- Acceptance:
  - The supported statuses are Pending Confirmation, Waiting Execution, Running, Waiting User, Paused, Blocked, Completed, Failed, and Canceled.
  - Exhaustive state fixtures produce exactly one Task status.
  - Completed is impossible while a required Work Item is unaccepted, required evidence is absent, or a Decision is open.
- Verification: `SCN-TASK-STATE-DERIVATION — Task state has one deterministic answer` — exhaustively evaluate the precedence table, including conflicting input combinations and completion guards.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-032, REQ-033, REQ-036.
- Risk: Critical — inconsistent status can conceal incomplete or unsafe work.

## REQ-036: Work Item lifecycle states

- Statement: A Work Item shall use Waiting, Running, Waiting Input, Waiting User, Completed, Acceptance Failed, Blocked, Failed, and Canceled states with guarded transitions.
- Acceptance:
  - Every declared transition has an initiating command or event and every undeclared transition is rejected.
  - Completed requires an accepted result reference.
  - An unavailable assigned Agent moves nonterminal work to Blocked unless a documented reconciliation state applies.
- Verification: `SCN-WORKITEM-STATE — Work Item transitions are guarded` — exhaustively exercise the transition table with accepted, unavailable-Agent, and invalid-event fixtures.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-015, REQ-033.
- Risk: High — permissive transitions can mark work complete without an accepted result.

## REQ-037: Immutable execution Attempt identity

- Statement: Every dispatch shall create an immutable Attempt with stable request, idempotency, Task, Work Item, Attempt, trace, Adapter, and authorization identifiers.
- Acceptance:
  - All identifiers are non-null before the external start command is emitted.
  - An Attempt's identity and bindings cannot be updated after creation.
  - Every Result and execution event resolves to exactly one Attempt.
- Verification: `SCN-ATTEMPT-IDENTITY — Every dispatch has immutable lineage` — create, reload, and attempt to mutate Attempts while resolving a corpus of Results and events.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-025, REQ-032, REQ-033.
- Risk: Critical — mutable or incomplete identity makes deduplication and audit impossible.

## REQ-038: Ordered and deduplicated Attempt events

- Statement: Attempt events shall use at-least-once delivery, a stable event identifier, and a monotonic per-Attempt sequence enforced through transactional inbox and outbox records.
- Acceptance:
  - Duplicate events change product state once.
  - Out-of-order events are buffered, reconciled, or rejected according to the documented sequence policy.
  - A committed command or state event survives a forced process crash and is delivered after restart.
- Verification: `SCN-EVENT-ORDERING — Duplicate and reordered events preserve truth` — replay duplicate, gap, reorder, and crash-boundary sequences and compare state and inbox/outbox records.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-037, REQ-092, REQ-093.
- Risk: Critical — lost or repeated events can produce false state and duplicate work.

## REQ-039: Retry and remediation classification

- Statement: Re-executing the same objective and responsibility shall create a new immutable Attempt under the same Work Item, while a material objective or responsibility change shall create a remediation Work Item under the same Task.
- Acceptance:
  - Same-objective retry fixtures preserve Work Item identity and increment Attempt history.
  - Objective-change and assignee-responsibility-change fixtures create linked remediation Work Items.
  - Neither path overwrites prior Attempts, Results, or Artifacts.
- Verification: `SCN-RETRY-REMEDIATION — Retry identity follows material change` — classify unchanged, parameter-only, objective-change, and responsibility-change cases and inspect lineage.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-032, REQ-033, REQ-037.
- Risk: High — wrong classification either fragments history or hides changed scope.

## Decision, Artifact, Change, audit, and recovery requirements

## REQ-040: Four-level Question Router

- Statement: Every Agent question shall be classified as L1 known fact, L2 low-risk execution judgment, L3 important confirmation, or L4 high-risk decision using deterministic policy before a response is issued.
- Acceptance:
  - L1 answers cite current code, configuration, Project data, or an approved Decision.
  - L2 answers remain inside the active objective, authorization, and business rules.
  - Business rules, data structures, third-party services, cross-Project changes, production, budget, permission, security, sensitive data, irreversible actions, and regulated high-risk behavior never resolve through L1 or L2.
- Verification: `SCN-QUESTION-ROUTER — Risk classes control who may answer` — run the policy corpus for all four levels and assert classification, cited facts, and prohibited automatic responses.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-021, REQ-025, REQ-037.
- Risk: Critical — under-classification could let a model make unauthorized consequential choices.

## REQ-041: Unique blocking Decision for L3 and L4

- Statement: An L3 or L4 question shall create or reuse one open Decision for its stable question key and shall place every dependent Work Item in Waiting User or Blocked according to policy.
- Acceptance:
  - Duplicate question deliveries create one open Decision.
  - The Decision links its Task, Work Item, source Agent, source Attempt, and risk class.
  - No dependent execution resumes while the Decision remains open.
- Verification: `SCN-DECISION-UNIQUE — Repeated high-risk questions create one gate` — deliver duplicate L3 and L4 questions concurrently and inspect Decision counts, links, Work Item states, and dispatch attempts.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-033, REQ-036, REQ-040, REQ-093.
- Risk: Critical — duplicate or nonblocking Decisions can cause conflicting human answers or unauthorized continuation.

## REQ-042: Decision content, priority, and timeout

- Statement: A Decision shall contain title, background, source, risk, current facts, options, impacts, assistant recommendation and rationale, priority, and configured timeout behavior.
- Acceptance:
  - Validation rejects a Decision missing any required content or source link.
  - Normal timeout remains waiting, Important timeout renotifies, and Emergency timeout keeps work paused or blocked without accepting a recommendation.
  - Deadline, attachments, custom input, and related Project are optional typed fields.
- Verification: `SCN-DECISION-POLICY — Decision urgency never implies automatic consent` — validate content variants and advance a fake clock across Normal, Important, and Emergency timeout fixtures.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-041.
- Risk: High — incomplete or auto-resolved Decisions would weaken informed human control.

## REQ-043: One Decision across assistant and Task surfaces

- Statement: Super Assistant and Task Detail shall render and update the same authoritative Decision record rather than creating surface-specific copies.
- Acceptance:
  - Both surfaces expose the same Decision identifier, version, state, and options.
  - A state change observed on one surface appears on the other projection after refresh or event delivery.
  - Concurrent stale submissions receive the already-resolved outcome and cannot overwrite it.
- Verification: `SCN-DECISION-SURFACES — Decision views share one record` — open both surfaces, resolve from each side in concurrent variants, and compare versions and outcomes.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-003, REQ-035, REQ-041, REQ-042.
- Risk: High — divergent copies can resume work under conflicting choices.

## REQ-044: Idempotent Decision resolution and resume

- Statement: Resolving a Decision shall atomically record the human actor and answer, update dependent state, and issue at most one resume command for each newly unblocked Attempt.
- Acceptance:
  - Sequential and concurrent duplicate resolutions preserve the first valid terminal answer.
  - Human History contains actor, timestamp, selected or custom answer, impact, and Decision version.
  - Dependent work resumes once when all of its gates are resolved and its authorization remains valid.
- Verification: `SCN-DECISION-IDEMPOTENT — One human answer resumes once` — run duplicate, stale, custom-answer, and multi-gate resolution cases and inspect history, state, and Adapter commands.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-025, REQ-038, REQ-041, REQ-043.
- Risk: Critical — repeated resume can duplicate side effects after a human decision.

## REQ-045: Separate Task Log and Human History

- Statement: The platform shall keep Agent Activity and raw execution logs in Task Log and human choices in Human History, linked by Task and Decision identifiers without duplicating authoritative Decision content.
- Acceptance:
  - Task Activity includes significant start, result, test, failure, and resume events.
  - Human History contains Proposal confirmations, Decision resolutions, cancellations, and other human control actions.
  - An Activity may reference a Decision outcome but cannot replace or mutate its Human History record.
- Verification: `SCN-AUDIT-SEPARATION — Agent work and human authority remain distinct` — execute a task with confirmation, Decision, failure, and resume and inspect both ordered histories and cross-links.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-024, REQ-037, REQ-038, REQ-044.
- Risk: High — mixed history obscures who acted and on what authority.

## REQ-046: Artifact metadata and access inheritance

- Statement: Every Task output shall be registered as Artifact metadata containing stable identity, Work Item and Attempt lineage, name, type, format, location, integrity, display mode, and Task-inherited access scope.
- Acceptance:
  - Code changes, Commit or PR references, documents, data files, test reports, charts, configuration, and generic Agent outputs can be registered.
  - Cross-Workspace access is rejected even when a storage location is guessed.
  - Missing or integrity-mismatched content is reported without changing accepted metadata.
- Verification: `SCN-ARTIFACT-METADATA — Outputs retain lineage and access scope` — register every supported type, attempt cross-scope access, remove and tamper with content, and inspect behavior.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-001, REQ-033, REQ-037.
- Risk: High — detached or weakly scoped outputs can leak data or falsify evidence.

## REQ-047: Immutable Artifact versions and fallback display

- Statement: Re-execution shall create a new immutable Artifact version linked to its prior version, and unsupported formats shall remain available through a safe download or external-reference presentation.
- Acceptance:
  - A failed and passed test report from separate Attempts appear as distinct ordered versions.
  - Prior version metadata and content integrity do not change when a new version is added.
  - A format without a native renderer is never interpreted as executable content by the primary UI.
- Verification: `SCN-ARTIFACT-VERSION — New output never overwrites old evidence` — create multi-Attempt versions for native and unsupported formats and compare ordering, integrity, and presentation.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-039, REQ-046.
- Risk: High — overwritten evidence would erase failure and retry history.

## REQ-048: Append-only Project Change and Rollback history

- Statement: Each material Project change shall append a Change record containing time, type, source Task and Attempt, Agent, modules, Commit or PR, configuration or version impact, and authorization; rollback shall append a Rollback Change referencing the original.
- Acceptance:
  - A supported code or configuration mutation produces one linked Change record.
  - Rollback marks the original Change and related Artifact as rolled back without deleting either.
  - Filters by time, Agent, Task, and change type return the expected append-only records.
- Verification: `SCN-CHANGE-ROLLBACK — Rollback adds history instead of rewriting it` — execute change, filter, rollback, and reload flows while asserting lineage and record immutability.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-025, REQ-037, REQ-046, REQ-047.
- Risk: Critical — mutable change history would defeat accountability and safe recovery.

## REQ-049: Attempt reconciliation and assistant degradation

- Statement: A disconnected nonterminal Attempt shall enter UNKNOWN and then RECONCILING, shall not be redispatched until the Adapter proves its outcome, and shall remain inspectable while AI planning is unavailable.
- Acceptance:
  - Disconnect prevents duplicate dispatch and starts reconciliation after Adapter recovery.
  - Authorized independent work may continue, new Decisions persist waiting, and Task, Agent, and Project surfaces remain read-only when assistant planning is unavailable.
  - Reconciliation reaches the proven prior outcome or a documented terminal failure within 30 seconds after a responsive Adapter returns.
- Verification: `SCN-RECOVERY-RECONCILE — Unknown execution is proven before reuse` — force disconnects before and after external start, disable planning, restore the Adapter, and inspect dispatch counts, read projections, Decisions, and reconciled states.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-030, REQ-035, REQ-037, REQ-038, REQ-045.
- Risk: Critical — guessing an unknown outcome can repeat irreversible work or lose a valid result.

## Multi-Agent, quality-loop, and monitoring requirements

## REQ-050: General SAI Agent contract

- Statement: H2 shall register additional Agents through a versioned SAI contract containing Agent identity and location, Function contracts, status, execution lifecycle, events, and Result retrieval.
- Acceptance:
  - A conforming fake Agent completes registration, discovery, execution, event, cancellation, and result contract tests without product-specific branching.
  - Missing or incompatible required SAI fields fail registration with a compatibility reason.
  - Native SAI and dedicated Adapter fixtures produce the same product-neutral records.
- Verification: `SCN-SAI-CONTRACT — Different runtimes share one Agent contract` — run the SAI conformance suite against native and adapted fake Agents and compare domain output.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-015, REQ-017, REQ-019, REQ-029, REQ-030.
- Risk: Critical — an unstable SAI would multiply orchestration and security behavior per Agent.

## REQ-051: Versioned Agent Template creation

- Statement: Agent creation shall support assistant-guided creation and a versioned Template catalog while keeping dedicated connection flow available for existing Agents.
- Acceptance:
  - H2 exposes Project, Program Log, Developer, Testing, and Inspector Templates with declared Functions and configuration fields.
  - Creating from a Template stores Template and version lineage on the Agent.
  - Updating a Template does not mutate already created Agent configuration without an explicit migration.
- Verification: `SCN-TEMPLATE-VERSION — Template creation preserves origin and independence` — create one Agent from each H2 Template, update the Template, and compare stored lineage and configuration.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-005, REQ-019, REQ-050.
- Risk: High — mutable Template inheritance can silently change executable behavior.

## REQ-052: Project maintenance Agent

- Statement: The Project maintenance Template shall provide query Project, query documents, analyze requirement, analyze bug, query history, and prepare development-task context Functions within declared Project access.
- Acceptance:
  - Each Function validates Project identity, inputs, output schema, and access scope.
  - Prepared development context links its source documents, history, and Project snapshot.
  - A cross-Project query outside the Agent's relationship is denied.
- Verification: `SCN-AGENT-PROJECT-MAINTENANCE — Project context remains scoped and attributable` — run all six Functions against allowed and denied Project fixtures and inspect lineage.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-008, REQ-017, REQ-050, REQ-051.
- Risk: High — unscoped project context can leak data or misdirect development.

## REQ-053: Program Log Agent

- Statement: The Program Log Template shall provide analyze logs, aggregate errors, classify severity, perform initial diagnosis, and propose a follow-up Task Functions for events supplied by monitoring software.
- Acceptance:
  - Equivalent log samples produce one deterministic error-group key.
  - Severity output records the rules and evidence used.
  - Follow-up work remains a recommendation or Proposal and never starts from an unapproved Agent output.
- Verification: `SCN-AGENT-PROGRAM-LOG — Log analysis cannot bypass task authorization` — analyze repeated errors, inspect grouping and severity evidence, and attempt authorized and unauthorized follow-up creation.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-017, REQ-050, REQ-051, REQ-021.
- Risk: High — unbounded log-triggered work can cause call storms or unauthorized changes.

## REQ-054: Testing Agent

- Statement: The Testing Template shall provide acceptance-condition analysis, test planning, existing and targeted test execution, failure analysis, test report generation, and pass or fail judgment Functions.
- Acceptance:
  - Test judgment references executed commands, environment, exact results, and acceptance conditions.
  - A report with missing execution evidence cannot produce an accepted pass.
  - Failures identify the affected Work Item and reproducible evidence.
- Verification: `SCN-AGENT-TESTING — Test judgment requires executed evidence` — run pass, fail, skipped, and fabricated-report fixtures and inspect judgment and links.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-017, REQ-046, REQ-050, REQ-051.
- Risk: Critical — false test passes can mark defective work complete.

## REQ-055: Inspector Agent

- Statement: The Inspector Template shall check stalled work, repeated failure, goal deviation, Agent health, and acceptance evidence and shall produce a linked anomaly report.
- Acceptance:
  - Each check records the evaluated policy, evidence window, and affected identifiers.
  - A healthy fixture produces no anomaly and a fixture for each named condition produces the expected severity.
  - Inspector output cannot itself authorize remediation side effects.
- Verification: `SCN-AGENT-INSPECTOR — Inspection is evidence-based and non-authorizing` — evaluate healthy and five anomaly fixtures and attempt direct remediation dispatch.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-035, REQ-036, REQ-045, REQ-050, REQ-051.
- Risk: High — noisy or empowered inspection could disrupt valid work.

## REQ-056: Multi-Agent Task assignment

- Statement: A Task shall assign each Work Item to one responsible Agent and may span multiple Agents or Projects only when the Proposal declares every assignment, Project boundary, and acceptance responsibility.
- Acceptance:
  - The Proposal and Task Detail show each Agent's responsibility and Project.
  - A Work Item cannot dispatch to an undeclared Agent or Project.
  - Reassignment records the actor, reason, new responsibility, and required authorization effect.
- Verification: `SCN-MULTIAGENT-ASSIGNMENT — Dispatch follows declared responsibility` — create multi-Agent and multi-Project fixtures, attempt undeclared dispatch, and perform a reassignment.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-022, REQ-025, REQ-033, REQ-050.
- Risk: Critical — implicit assignment can cross authorization and data boundaries.

## REQ-057: Work Item dependency graph

- Statement: Multi-Work-Item Tasks shall express sequence, parallel, and acceptance dependencies as an acyclic graph validated before Proposal confirmation.
- Acceptance:
  - Valid fixtures preserve all three dependency types.
  - A cycle, missing node, self-edge, or cross-Task edge is rejected.
  - The confirmation view distinguishes order, parallel opportunity, and acceptance gates.
- Verification: `SCN-DAG-VALIDATION — Only valid execution graphs can be approved` — validate positive graphs and each invalid edge class and inspect the rendered graph model.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-022, REQ-033, REQ-056.
- Risk: High — invalid dependencies can deadlock or bypass required acceptance.

## REQ-058: Dependency-aware scheduling and automatic handoff

- Statement: The scheduler shall dispatch a Work Item only when all required predecessor outcomes, acceptance gates, Agent availability, authorization, and resource leases are satisfied.
- Acceptance:
  - Thirty deterministic DAG scenarios dispatch only the oracle's ready set.
  - Parallel ready Work Items may dispatch concurrently when resources do not conflict.
  - Completion or resolution events recalculate readiness idempotently.
- Verification: `SCN-DAG-SCHEDULER — Automatic handoff respects every gate` — run the thirty-scenario DAG suite with duplicate events and compare dispatch order and concurrency with the oracle.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-015, REQ-025, REQ-038, REQ-057, REQ-060.
- Risk: Critical — premature scheduling can violate dependency, acceptance, or authorization constraints.

## REQ-059: Protected-resource conflict detection

- Statement: Before parallel dispatch, the platform shall compare declared Workspace, branch, module, shared configuration, database structure, public dependency, and other protected-resource write scopes.
- Acceptance:
  - Non-overlapping fixtures remain parallel.
  - Every overlapping protected-resource fixture is serialized, isolated, or escalated before dispatch.
  - An unresolved conflict creates a visible blocking reason and no external start effect.
- Verification: `SCN-RESOURCE-CONFLICT — Conflicting writes never start uncoordinated` — evaluate the resource-overlap corpus and inspect schedule, isolation, Decision, and Adapter effects.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-025, REQ-031, REQ-056, REQ-057.
- Risk: Critical — undetected concurrent writes can corrupt Projects and shared infrastructure.

## REQ-060: Resource leases and fencing

- Statement: Every side-effecting Work Item shall acquire expiring resource leases with fencing tokens before dispatch and shall release or safely recover them on completion, cancellation, or owner loss.
- Acceptance:
  - A stale or lower fencing token cannot write after a newer lease holder exists.
  - Cancellation releases leases only after process termination.
  - Owner-loss recovery prevents two live holders for the same exclusive resource.
- Verification: `SCN-RESOURCE-LEASE — Stale workers cannot write after lease transfer` — exercise acquire, renew, expire, steal, cancel, and owner-loss races with a fake resource guard.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-030, REQ-031, REQ-059, REQ-093, REQ-095.
- Risk: Critical — a lease without fencing cannot prevent stale-writer corruption.

## REQ-061: Unavailable Agent resolution

- Statement: When an assigned Agent is disabled, disconnected, unauthenticated, or incompatible, its active Work Item shall become Blocked and shall offer wait for recovery, authorized reassignment, or cancellation.
- Acceptance:
  - Each unavailability cause produces a specific blocking reason.
  - Waiting preserves assignment and resumes only after preflight.
  - Reassignment and cancellation follow their authorization, history, and termination rules without changing completed results.
- Verification: `SCN-AGENT-UNAVAILABLE — Unavailable work has three safe exits` — trigger each cause and complete wait, reassign, and cancel paths while inspecting history and results.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-015, REQ-019, REQ-026, REQ-030, REQ-036, REQ-056.
- Risk: High — automatic substitution or lost blocking state could change responsibility without consent.

## REQ-062: Testing evidence as an acceptance gate

- Statement: A Work Item with a Testing dependency shall remain unaccepted until its Testing Agent returns an evidence-complete passing Result for the declared acceptance conditions.
- Acceptance:
  - Passing evidence unlocks the dependent acceptance edge.
  - Failed, missing, stale, or scope-mismatched evidence keeps acceptance closed.
  - Test evidence is stored as a versioned Artifact linked to the tested Attempt.
- Verification: `SCN-QUALITY-TEST-GATE — Only relevant executed tests unlock acceptance` — attach passing, failing, missing, stale, and wrong-Attempt reports and inspect readiness and Artifact lineage.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-047, REQ-054, REQ-057, REQ-058.
- Risk: Critical — weak evidence binding can accept untested changes.

## REQ-063: Inspector acceptance gate

- Statement: A Work Item with an Inspector dependency shall remain unaccepted until required goal-alignment, health, and evidence checks pass or an authorized human resolves the reported exception.
- Acceptance:
  - A clean report unlocks its acceptance edge.
  - A material anomaly blocks acceptance and creates a linked Decision when human judgment is required.
  - Resolving an exception records the report, human rationale, and affected acceptance condition.
- Verification: `SCN-QUALITY-INSPECT-GATE — Material anomalies cannot be silently accepted` — process clean, blocking, and human-exception reports and inspect graph readiness and audit links.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-041, REQ-044, REQ-055, REQ-057, REQ-058.
- Risk: High — ignored inspection findings can complete a task that deviated from its goal.

## REQ-064: Acceptance failure remediation in the original Task

- Statement: Acceptance failure shall reopen the affected Work Item or create a remediation Work Item under the original Task and shall never create an unlinked replacement top-level Task.
- Acceptance:
  - Reopen is used when objective and responsibility remain materiality-equivalent.
  - A changed objective or responsibility follows the remediation classification rule.
  - All failure evidence, fixes, Attempts, and re-acceptance cycles remain ordered in one Task history.
- Verification: `SCN-QUALITY-REMEDIATION — Failed acceptance retains one Task lineage` — run same-scope and changed-responsibility failure cycles through a second acceptance pass and inspect identities.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-039, REQ-054, REQ-055, REQ-062, REQ-063.
- Risk: High — replacement Tasks would fragment accountability and completion semantics.

## REQ-065: Traceable Agent handoff context

- Statement: An automatic handoff shall provide the receiving Agent only the accepted predecessor outputs, required Project snapshot, applicable Decisions, authorization scope, and declared acceptance conditions, each with source lineage.
- Acceptance:
  - The handoff manifest contains no unrelated Task history or inaccessible Artifact.
  - Every included input resolves to an immutable source identifier and version.
  - A missing required input prevents dispatch with a specific blocking reason.
- Verification: `SCN-HANDOFF-CONTEXT — Agent handoff is minimal and traceable` — build complete, excessive, inaccessible, and missing-input manifests and inspect dispatch and lineage.
- Phase: `PHASE-004`
- Status: `baselined`
- Dependencies: REQ-025, REQ-046, REQ-047, REQ-056, REQ-058.
- Risk: High — oversized or untraceable context can leak data and propagate stale results.

## REQ-066: Monitoring event ingestion and normalization

- Statement: PHASE-005 shall ingest events from scripts, APIs, Webhooks, and Schedulers into a versioned normalized event contract with source, Workspace, Project, type, occurrence time, payload integrity, and deduplication identity.
- Acceptance:
  - Each source fixture maps to the same normalized schema.
  - Duplicate source deliveries create one logical normalized event.
  - Invalid, unscoped, or integrity-failing events are quarantined with a reason and cannot trigger an Agent.
- Verification: `SCN-MONITOR-INGEST — Heterogeneous signals share one trusted event contract` — ingest valid, duplicate, malformed, cross-scope, and tampered fixtures from every source type.
- Phase: `PHASE-005`
- Status: `baselined`
- Dependencies: REQ-001, REQ-038, REQ-050, REQ-093.
- Risk: Critical — untrusted or duplicated events can cause unsafe automated work.

## REQ-067: Conditional intelligent monitoring

- Statement: Continuous monitoring shall use ordinary software to collect and evaluate deterministic rules and shall invoke an Agent only when a configured condition requires intelligent judgment.
- Acceptance:
  - Normal events continue monitoring with zero Agent invocation.
  - A threshold-crossing fixture invokes the declared Function with its normalized evidence.
  - Changing a rule is versioned and affects only evaluations after activation.
- Verification: `SCN-MONITOR-TRIGGER — Normal signals do not consume Agent work` — replay below-threshold, boundary, above-threshold, and rule-version transition fixtures and count Agent calls.
- Phase: `PHASE-005`
- Status: `baselined`
- Dependencies: REQ-017, REQ-050, REQ-066.
- Risk: High — model-based polling would create unpredictable cost and noise.

## REQ-068: Equivalent-event aggregation

- Statement: Equivalent events inside a configured window shall form one Event Group containing type, count, first and last occurrence, representative samples, and source lineage before Agent analysis.
- Acceptance:
  - One hundred equivalent events inside one window produce one group with count one hundred.
  - Non-equivalent or out-of-window events produce separate groups.
  - Group updates are idempotent under duplicate and reordered delivery.
- Verification: `SCN-MONITOR-AGGREGATE — Repeated signals become one evidence group` — replay equivalent, mixed-key, boundary-time, duplicate, and reordered event sets and inspect groups.
- Phase: `PHASE-005`
- Status: `baselined`
- Dependencies: REQ-066, REQ-067, REQ-093.
- Risk: High — faulty grouping can hide distinct incidents or amplify duplicate calls.

## REQ-069: Monitoring bounds and follow-up policy

- Statement: Monitoring shall enforce per-window Agent-call limits, equivalent-event cooldown, maximum concurrency, and budget before invocation, and any side-effecting follow-up Task shall use the normal Proposal and authorization route.
- Acceptance:
  - Every over-limit fixture follows its configured record-only, defer, summarize, or notify action.
  - One hundred equivalent events produce no more calls than the configured bound.
  - A recommendation may be recorded without authorization, but a side-effecting follow-up produces no dispatch before Proposal confirmation.
- Verification: `SCN-MONITOR-BOUNDS — Bursts and budgets cannot escape policy` — exercise each limit and fallback action plus authorized and unauthorized follow-up creation while inspecting calls, cost ledger, Tasks, and Grants.
- Phase: `PHASE-005`
- Status: `baselined`
- Dependencies: REQ-021, REQ-022, REQ-025, REQ-067, REQ-068.
- Risk: Critical — unbounded monitoring can create cost storms and unauthorized automated actions.

## Domain, Adapter, team, and enterprise requirements

## REQ-070: Domain Template catalog

- Statement: PHASE-006 shall add versioned Operations, HR, Data, and enterprise-internal Agent Templates without adding a new primary navigation destination.
- Acceptance:
  - Each Template declares category, Functions, required Connections, authorization policy, input and result schemas, and version.
  - Created Agents retain Template lineage and independent configuration.
  - All resulting Agents appear through Agent Center and the existing assistant, Project, and Task routes.
- Verification: `SCN-DOMAIN-TEMPLATES — Domain breadth fits the existing product model` — create one Agent per domain Template and inspect navigation, lineage, contracts, and configuration independence.
- Phase: `PHASE-006`
- Status: `baselined`
- Dependencies: REQ-002, REQ-016, REQ-017, REQ-050, REQ-051.
- Risk: High — domain-specific product silos would fracture the common control plane.

## REQ-071: Operations Data Agent

- Statement: The Operations Template shall query metrics, analyze time trends and period comparisons, identify anomalies, rank Top and Bottom entities, summarize results, and recommend actions from declared data Connections.
- Acceptance:
  - Every output cites Connection, query or dataset identity, time range, metric definition, and refresh time.
  - Missing comparison periods report insufficient data instead of estimating a ratio.
  - Recommended external actions remain non-executing until authorized through a Task.
- Verification: `SCN-AGENT-OPERATIONS — Operations claims retain data and action lineage` — run complete, missing-period, stale-source, and action-recommendation fixtures and inspect citations and dispatch counts.
- Phase: `PHASE-006`
- Status: `baselined`
- Dependencies: REQ-017, REQ-021, REQ-050, REQ-069, REQ-070.
- Risk: High — uncited or action-capable analysis can mislead users and bypass control.

## REQ-072: HR Agent

- Statement: The HR Template shall extract resume facts, compare job requirements, organize candidates, summarize candidates, query recruitment status, and recommend follow-up while treating messaging and status changes as side effects.
- Acceptance:
  - Extracted and matched facts cite source locations and distinguish fact from inference.
  - Candidate data follows Workspace access and retention policy.
  - Sending a message or changing recruitment status is denied without exact authorization.
- Verification: `SCN-AGENT-HR — Sensitive recruiting work separates analysis from action` — process fact, inference, access-denied, retention, and unauthorized-action fixtures.
- Phase: `PHASE-006`
- Status: `baselined`
- Dependencies: REQ-021, REQ-050, REQ-070, REQ-096.
- Risk: Critical — HR data is sensitive and erroneous actions can have material consequences.

## REQ-073: Data presentation component selection

- Statement: Data Agents and Super Assistant shall present results through metric cards, line charts, bar charts, donut charts, funnel charts, and data tables only when the supplied data satisfies each component's declared shape.
- Acceptance:
  - Component selection validates required dimensions, measures, time, category, composition, or stage fields.
  - Insufficient trend data falls back to a metric card or table; excessive composition categories fall back to a list or bar chart.
  - Unsupported shapes produce a labeled table or download rather than a fabricated chart.
- Verification: `SCN-DATA-VISUAL-SELECTION — Visualization follows data shape` — run valid and invalid fixtures for every component and compare the selected fallback with the rule oracle.
- Phase: `PHASE-006`
- Status: `baselined`
- Dependencies: REQ-047, REQ-070, REQ-071.
- Risk: Medium — inappropriate charts can distort otherwise correct data.

## REQ-074: Current, trend, and period-comparison analysis

- Statement: Data analysis shall compute current value, historical direction, period-over-period, and year-over-year results only from sufficient, comparable, time-aligned observations.
- Acceptance:
  - Calculations return exact value, delta, percentage, direction, units, and periods used.
  - Missing or incomparable observations return a specific insufficient-data result.
  - Time-zone and calendar rules are applied consistently to period boundaries.
- Verification: `SCN-DATA-PERIOD-ANALYSIS — Comparisons use sufficient aligned evidence` — evaluate exact, missing, incomparable, boundary, and time-zone fixtures against an independent calculation oracle.
- Phase: `PHASE-006`
- Status: `baselined`
- Dependencies: REQ-071, REQ-073, REQ-098.
- Risk: High — incorrect period alignment can reverse business conclusions.

## REQ-075: Anomaly, ranking, and correlation analysis

- Statement: Data analysis shall identify anomalies from declared thresholds, historical intervals, statistical rules, or Agent judgment, shall produce Top and Bottom rankings, and shall never describe correlation alone as causation.
- Acceptance:
  - Every anomaly records its method, parameters, comparison set, severity, and evidence.
  - Ranking ties and missing values follow documented deterministic rules.
  - Correlation output is labeled non-causal unless separate causal evidence is supplied and cited.
- Verification: `SCN-DATA-DIAGNOSTICS — Analytical labels match evidence` — run threshold, interval, statistical, Agent-judgment, tie, missing-value, correlation, and causal-evidence fixtures.
- Phase: `PHASE-006`
- Status: `baselined`
- Dependencies: REQ-071, REQ-074.
- Risk: High — unsupported causal claims or rankings can drive harmful decisions.

## REQ-076: Domain interpretation and regulated-action boundary

- Statement: A domain Agent may produce summaries, hypotheses, risks, and recommendations, but publishing, spending, external messaging, sensitive-state changes, and real-money transactions shall remain side effects governed by policy and authorization; generic automated trading is excluded.
- Acceptance:
  - Each generated statement is labeled fact, hypothesis, risk, or recommendation and cites available evidence.
  - Every listed external action is denied without a matching Grant.
  - No generic Function or Template exposes an automated real-money trading action.
- Verification: `SCN-DOMAIN-ACTION-BOUNDARY — Advice cannot become an unapproved regulated action` — inspect domain outputs and attempt each external action and automated-trading registration.
- Phase: `PHASE-006`
- Status: `baselined`
- Dependencies: REQ-021, REQ-025, REQ-040, REQ-070.
- Risk: Critical — blurred advice and execution boundaries can create legal, financial, and safety harm.

## REQ-077: Additional dedicated Adapters

- Statement: A mature external Agent product shall be integrated through a dedicated Adapter that passes the current SAI conformance, security, idempotency, cancellation, and recovery suites before its Functions become routable.
- Acceptance:
  - A new Adapter remains Disabled until every mandatory suite passes for its declared upstream version.
  - Adapter-specific terms remain behind its boundary.
  - Enabling the Adapter exposes only Functions supported by the compatible upstream version.
- Verification: `SCN-ADAPTER-CONFORMANCE — New runtimes earn routability through the common contract` — register passing, failing, partial-Function, and terminology-leaking Adapter fixtures.
- Phase: `PHASE-006`
- Status: `baselined`
- Dependencies: REQ-019, REQ-030, REQ-049, REQ-050, REQ-093, REQ-095.
- Risk: Critical — a weak Adapter can bypass platform-wide execution guarantees.

## REQ-078: Adapter compatibility and upstream change handling

- Statement: Every Adapter shall record upstream product version, Adapter version, compatible Function versions, and compatibility state and shall re-evaluate active work after a breaking upstream change.
- Acceptance:
  - Compatible upgrades continue using the new declared version after synchronization.
  - New Tasks cannot select incompatible Functions.
  - Active work continues on its bound version when safe or becomes Blocked with a replan requirement when continuation cannot be proven.
- Verification: `SCN-ADAPTER-UPGRADE — Breaking upstream change fails closed` — apply compatible, Function-removal, schema-change, and behavior-change upgrade fixtures to pending and active work.
- Phase: `PHASE-006`
- Status: `baselined`
- Dependencies: REQ-019, REQ-026, REQ-061, REQ-077.
- Risk: Critical — silent upstream drift can change authorized behavior mid-execution.

## REQ-079: Configured legacy Agent integration

- Statement: A script or legacy service may be integrated from validated configuration that declares Functions, start mechanism, input mapping, result mapping, status check, authorization scope, and operational limits.
- Acceptance:
  - Configuration validation rejects unspecified execution, schema, status, or limit behavior.
  - A sandboxed fixture maps input, status, and Result to SAI records without custom product code.
  - Configured integration cannot request broader permissions than its registered scope.
- Verification: `SCN-ADAPTER-CONFIGURED — Legacy integration is declarative and bounded` — validate complete, incomplete, overprivileged, success, failure, and timeout configurations.
- Phase: `PHASE-006`
- Status: `baselined`
- Dependencies: REQ-017, REQ-021, REQ-050, REQ-095.
- Risk: Critical — configuration-driven process launch can become arbitrary code execution.

## REQ-080: Enterprise internal Agent integration

- Statement: An enterprise internal Agent shall integrate through SAI with explicit Workspace, data-classification, Connection, Function, authorization, and audit-export mappings.
- Acceptance:
  - Registration fails when any required enterprise mapping is absent.
  - Requests and Results remain inside the Agent's Workspace and classification scope.
  - Enterprise audit export resolves each invocation to Agent, Function, principal, Grant, Attempt, and Result.
- Verification: `SCN-AGENT-ENTERPRISE — Internal Agents preserve enterprise boundaries` — register complete and incomplete fixtures, attempt cross-scope use, and validate exported lineage.
- Phase: `PHASE-006`
- Status: `baselined`
- Dependencies: REQ-050, REQ-077, REQ-096.
- Risk: Critical — internal Agent access can expose high-value enterprise data.

## REQ-081: Team Workspace membership

- Statement: PHASE-007 shall support multiple users in a Workspace with invitation, acceptance, suspension, removal, and immutable membership-history states while preserving H1 Owner identity.
- Acceptance:
  - Each membership transition records actor, subject, time, prior state, and new state.
  - Suspended or removed members lose new access without deleting their historical authorship.
  - Existing single-user Workspace data migrates with its Owner unchanged.
- Verification: `SCN-TEAM-GOVERNANCE — Team lifecycle preserves identity and history` — migrate an H1 Workspace and exercise invitation through removal while inspecting access and authorship.
- Phase: `PHASE-007`
- Status: `baselined`
- Dependencies: REQ-001, REQ-092, REQ-096.
- Risk: Critical — incorrect membership transition can grant or erase enterprise access.

## REQ-082: Role-based access control

- Statement: Team Workspace access shall be enforced by versioned role and permission assignments evaluated for every protected read, configuration change, authorization, execution, and export action.
- Acceptance:
  - Default-deny applies when no explicit permission grants an action.
  - Role changes affect subsequent decisions and cannot alter prior audit evidence.
  - Two hundred cross-role and cross-Workspace negative cases produce zero protected data exposure or side effects.
- Verification: `SCN-RBAC-ENFORCEMENT — Roles deny every undeclared protected action` — execute the two-hundred-case authorization matrix and inspect policy and audit results.
- Phase: `PHASE-007`
- Status: `baselined`
- Dependencies: REQ-081, REQ-095, REQ-096.
- Risk: Critical — RBAC failure directly compromises tenant security.

## REQ-083: Workspace credential separation

- Statement: Credentials shall be owned by one Workspace, reference an allowed Connection and usage policy, and remain inaccessible to unauthorized users, Agents, renderer code, logs, SQLite, and exports.
- Acceptance:
  - A credential from Workspace A cannot be resolved by any principal or Agent scoped to Workspace B.
  - Renderer, database, logs, and audit export contain only opaque credential references and redacted metadata.
  - Revocation blocks new use and triggers reconciliation for affected active work.
- Verification: `SCN-CREDENTIAL-SEPARATION — Secrets never cross Workspace or process boundaries` — run cross-Workspace, renderer, storage, log, export, revocation, and active-use cases.
- Phase: `PHASE-007`
- Status: `baselined`
- Dependencies: REQ-049, REQ-081, REQ-082, REQ-094.
- Risk: Critical — credential leakage enables direct external compromise.

## REQ-084: Multi-party approval

- Statement: A policy may require a configured number of distinct eligible approvers before a protected Proposal or Decision becomes authorized.
- Acceptance:
  - Repeated approval by one actor counts once.
  - Ineligible, revoked, expired, or same-duty-conflicting approvals do not satisfy the threshold.
  - Dispatch remains blocked until the threshold is met for the exact version.
- Verification: `SCN-MULTIPARTY-APPROVAL — Protected work waits for distinct eligible approvers` — exercise threshold, duplicate, ineligible, revocation, expiry, duty-conflict, and version-change cases.
- Phase: `PHASE-007`
- Status: `baselined`
- Dependencies: REQ-024, REQ-025, REQ-081, REQ-082.
- Risk: Critical — weak quorum semantics can bypass enterprise control.

## REQ-085: Enterprise audit export

- Statement: Authorized users shall export a tamper-evident, scoped audit package containing Proposals, Grants, human actions, Decisions, Tasks, Work Items, Attempts, events, Artifacts, Changes, and retention metadata.
- Acceptance:
  - Export scope is filtered by Workspace, time, entity, and the requesting principal's permission.
  - A manifest lists record counts, integrity digests, schema versions, omissions, and generation identity.
  - Modifying any exported record invalidates package verification.
- Verification: `SCN-AUDIT-EXPORT — Audit packages are complete, scoped, and tamper-evident` — export full, filtered, underprivileged, and modified packages and verify counts, omissions, and digests.
- Phase: `PHASE-007`
- Status: `baselined`
- Dependencies: REQ-045, REQ-046, REQ-048, REQ-082, REQ-096.
- Risk: Critical — incomplete or overbroad export can fail compliance or leak protected data.

## REQ-086: Enforceable retention and legal hold

- Statement: Team administrators shall configure retention by record class while immutable history, legal holds, active authorization evidence, and referenced audit chains prevent unsafe deletion.
- Acceptance:
  - Expired eligible records are deleted or anonymized according to the active versioned policy.
  - Held, active, or transitively required evidence is retained and reported as excluded from deletion.
  - Policy changes affect future enforcement runs and preserve prior run evidence.
- Verification: `SCN-RETENTION-ENFORCEMENT — Retention removes only eligible records` — apply expiry, hold, active-reference, chain-reference, policy-change, and repeated-run fixtures.
- Phase: `PHASE-007`
- Status: `baselined`
- Dependencies: REQ-048, REQ-082, REQ-085, REQ-096.
- Risk: Critical — over-deletion destroys evidence while under-deletion violates policy.

## REQ-087: Notification channels and deep links

- Statement: The platform shall deliver authorized Task, Decision, Agent, and Project notifications through in-app, desktop, Email, and enterprise IM channels with a deep link to the source object.
- Acceptance:
  - Waiting Decision, Emergency Decision, Task completed, Task failed, Agent unavailable, and Project error events map to the configured channels.
  - Each delivered notification resolves to an accessible source object and contains no unauthorized detail.
  - Channel failure is recorded and retried according to operations policy without duplicating an acknowledged delivery.
- Verification: `SCN-NOTIFICATION-DELIVERY — Alerts arrive once with safe source links` — deliver every event type across success, retry, duplicate, inaccessible-source, and redaction fixtures.
- Phase: `PHASE-007`
- Status: `baselined`
- Dependencies: REQ-035, REQ-041, REQ-061, REQ-081, REQ-082, REQ-093.
- Risk: High — notification leakage or duplication can expose data and create alert fatigue.

## REQ-088: Notification priority, aggregation, and quiet hours

- Statement: Notification policy shall support priority filtering, same-kind aggregation, read state, quiet hours, and a user-configurable Emergency bypass rule.
- Acceptance:
  - Eight equivalent events inside one window produce one summary with count eight.
  - Quiet hours suppress or defer non-bypassing notifications according to configuration.
  - Emergency notifications bypass quiet hours only when the active policy explicitly permits it.
- Verification: `SCN-NOTIFICATION-POLICY — Aggregation and quiet hours obey explicit policy` — advance a fake clock across equivalent, mixed-priority, quiet-hour, bypass-enabled, and bypass-disabled fixtures.
- Phase: `PHASE-007`
- Status: `baselined`
- Dependencies: REQ-068, REQ-087.
- Risk: Medium — incorrect notification policy can hide emergencies or overwhelm users.

## REQ-089: Unified administration settings

- Statement: Settings shall manage Agent runtimes, external Connections, permissions and authorization defaults, notifications, model policy, storage, language, time zone, theme, data export, and account configuration through typed, auditable records.
- Acceptance:
  - Each settings area reads and writes only its declared schema and access scope.
  - Connection settings show authentication, state, last use, and an explicit test-connection result.
  - A consequential setting change records actor, prior and new versions, and invalidates affected preflights or policies.
- Verification: `SCN-SETTINGS-AUDIT — Configuration changes are typed and consequential` — update each settings area, test valid and invalid Connections, and inspect audit and invalidation effects.
- Phase: `PHASE-007`
- Status: `baselined`
- Dependencies: REQ-026, REQ-078, REQ-082, REQ-083, REQ-086, REQ-087, REQ-088.
- Risk: High — untyped or unaudited settings can silently change execution authority.

## Non-functional requirements

## REQ-090: Supported local application platform

- Statement: H1 shall run as a local-first Electron desktop application with a React and TypeScript renderer, Node.js `22.x` main-process modules, SQLite persistence, and a separately supervised Codex Adapter Worker; Python `3.9+` is limited to repository governance tools.
- Acceptance:
  - The supported Windows x64 build installs, launches, persists data, starts the Worker, and exits without orphaning it.
  - Application runtime does not require Python.
  - Runtime-version checks fail early with the supported-version message.
- Verification: `SCN-RUNTIME-SUPPORTED — The declared stack runs as one local product` — build and smoke-test the supported runtime, remove Python from the application path, test wrong versions, and inspect child-process cleanup.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: None.
- Risk: High — platform ambiguity would invalidate Adapter, credential, and process-control assumptions.

## REQ-091: Local performance and scale budgets

- Statement: On the documented reference machine and a dataset of 100 Projects, 100 Agents, 10,000 Tasks, and 100,000 Activity records, the application shall meet defined launch, read-projection, event-visibility, and Proposal-response budgets.
- Acceptance:
  - Warm launch reaches interactive Super Assistant in at most 3 seconds and cold launch in at most 5 seconds.
  - Local catalog and detail read projections complete at p95 at or below 200 milliseconds.
  - A committed execution event appears in an open Task projection within 1 second.
  - A fully specified goal returns a confirmable Proposal within 10 seconds median, excluding a separately reported external-model outage.
- Verification: `SCN-PERFORMANCE-BUDGET — Reference workload stays interactive` — run the versioned benchmark fixture for launch, reads, event projection, and planning and publish percentiles with machine metadata.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-003, REQ-013, REQ-014, REQ-022, REQ-038, REQ-090.
- Risk: Medium — local hardware and model variability can obscure product regressions without a fixed fixture.

## REQ-092: Durable authoritative persistence

- Statement: SQLite shall be the authoritative store for durable product state, and every state transition that publishes a command or event shall commit its domain change and outbox record atomically.
- Acceptance:
  - UI state, model context, and Adapter observations cannot overwrite authoritative records outside validated commands.
  - Fifty forced-crash transaction-boundary cases retain all committed changes, expose no partial transition, and pass SQLite integrity checks.
  - Schema migrations are versioned, transactional where supported, backed up, and reversible or explicitly forward-only with recovery evidence.
- Verification: `SCN-PERSISTENCE-DURABILITY — Crash boundaries preserve one authoritative truth` — execute the fifty-case fault-injection and migration suite and inspect integrity, state, outbox, and backup evidence.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: REQ-001, REQ-090.
- Risk: Critical — corrupt or competing authority would make execution state untrustworthy.

## REQ-093: At-least-once reliability and idempotency

- Statement: Commands and events shall be safe under at-least-once delivery through stable idempotency keys, transactional inbox and outbox records, monotonic Attempt sequencing, and deterministic duplicate outcomes.
- Acceptance:
  - One hundred duplicate-command and duplicate-event cases produce exactly one domain transition and one permitted external effect.
  - Crash after commit and before delivery resumes from the outbox without losing the command.
  - Duplicate delivery returns the original outcome identifiers and does not fabricate a second success.
- Verification: `SCN-DELIVERY-AT-LEAST-ONCE — Repetition changes state once` — run concurrent duplicates and both sides of every commit-delivery crash boundary against the fake Adapter.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-037, REQ-038, REQ-092.
- Risk: Critical — unreliable delivery can duplicate side effects or lose authorized work.

## REQ-094: Secret storage and redaction

- Statement: Credentials and secret values shall be stored in Windows Credential Manager and shall never be persisted in repository files, SQLite, renderer state, logs, Artifacts, diagnostics, or exports.
- Acceptance:
  - Persisted records contain opaque credential references only.
  - Renderer and Agent processes receive no secret unless the active policy and Function require it for that exact invocation.
  - Secret-scanning fixtures find zero plaintext seeded secrets across every prohibited location and crash report.
- Verification: `SCN-SECRET-STORAGE — Secrets exist only in the credential provider and bounded use` — seed canary secrets, exercise use and failure paths, scan all stores and outputs, and inspect process payloads.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: REQ-001, REQ-090.
- Risk: Critical — local secret leakage can compromise source code and external systems.

## REQ-095: Least privilege and execution containment

- Statement: Every process, file, network, credential, Connection, and external-resource access shall default deny and shall be constrained to the active Function, Project, Grant, worktree, and resource lease.
- Acceptance:
  - Positive cases access exactly the declared resource set.
  - Negative cases for path traversal, symlink escape, undeclared process, undeclared host, credential mismatch, and stale fencing token are denied before effect and audited.
  - Renderer compromise does not provide direct process-control, filesystem-write, database-write, or credential APIs.
- Verification: `SCN-LEAST-PRIVILEGE — Execution cannot escape its declared envelope` — run the containment and renderer-boundary attack corpus and inspect effects and audit decisions.
- Phase: `PHASE-002`
- Status: `baselined`
- Dependencies: REQ-021, REQ-025, REQ-031, REQ-094.
- Risk: Critical — containment failure turns Agent execution into arbitrary local compromise.

## REQ-096: Data lifecycle, privacy, and export

- Statement: Logs, Artifact content, audit records, and user data shall follow versioned storage, retention, cleanup, access, and export policies while protected history and active references prevent unsafe deletion.
- Acceptance:
  - Default retention and size policies are explicit before the first record is stored.
  - A cleanup dry run and execution report list eligible, deleted, retained, and excluded records with reasons.
  - User export is scoped, integrity-manifested, secret-redacted, and complete for all permitted product records.
- Verification: `SCN-DATA-LIFECYCLE — Data retention and export are explicit and accountable` — exercise default policy, expiry, protected reference, size boundary, dry run, cleanup, export, and secret-redaction fixtures.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-045, REQ-046, REQ-047, REQ-048, REQ-094.
- Risk: Critical — incorrect lifecycle policy can destroy evidence or retain and expose data improperly.

## REQ-097: Degraded availability and truthful recovery

- Statement: Failure of the planning model, Codex Adapter, notification channel, or application process shall preserve durable state, expose a truthful degraded condition, and recover without duplicate execution.
- Acceptance:
  - Planning-model failure leaves existing authorized independent work running and current records readable but blocks new AI planning.
  - Adapter failure uses UNKNOWN and RECONCILING and reaches a proven state within 30 seconds after responsiveness returns.
  - Application restart loses no committed command, event, Decision, Artifact metadata, or Change and creates no duplicate Attempt.
- Verification: `SCN-AVAILABILITY-DEGRADE — Component failure degrades capability, not truth` — independently fail each component, restart the application, restore dependencies, and compare state, dispatch counts, and recovery time.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-038, REQ-049, REQ-092, REQ-093.
- Risk: Critical — optimistic recovery can repeat work or misreport a failed system as healthy.

## REQ-098: Accessible and localizable interaction

- Statement: Core onboarding, navigation, Proposal, Task, Decision, and result flows shall be keyboard operable, expose accessible names and state, meet WCAG 2.2 AA visual requirements, and use externalized locale, time-zone, and theme settings.
- Acceptance:
  - Automated accessibility scans report zero critical or serious violations on core screens.
  - A keyboard-only test completes the H1 goal-to-result and Decision routes without a pointer.
  - `zh-CN` strings, dates, times, status text, and errors are complete; an unsupported locale falls back consistently without exposing message keys.
- Verification: `SCN-UX-ACCESSIBILITY — Core control is usable without hidden interaction assumptions` — run automated scans, keyboard E2E routes, locale fallback, time-zone, and theme contrast cases.
- Phase: `PHASE-003`
- Status: `baselined`
- Dependencies: REQ-002, REQ-003, REQ-005, REQ-022, REQ-035, REQ-043.
- Risk: High — inaccessible controls can prevent users from reviewing or stopping consequential work.

## REQ-099: Evidence-based release quality gate

- Statement: A delivery phase shall pass only when requirement traceability, documentation links, schemas, runtime trace, unit and domain tests, fake-App-Server contract tests, Electron Playwright flows, lint, typecheck, build, and applicable security and recovery checks have executed successfully or an approved exception names the missing evidence and risk.
- Acceptance:
  - Planned commands are labeled planned and never counted as executed evidence.
  - Tests contain behavior assertions and cover success, boundary, permission, cancellation, failure, and recovery paths for changed logic.
  - A real-Codex smoke test is explicitly enabled, isolated, and reported separately from deterministic fake-Adapter gates.
  - Phase archive is blocked until current facts, verification report, known issues, and next-phase approved Task Packs are present.
- Verification: `SCN-RELEASE-QUALITY-GATE — A phase cannot pass on intention or weak tests` — run the gate against passing, skipped, assertion-free, failed, exception-approved, and missing-next-pack fixtures.
- Phase: `PHASE-001`
- Status: `baselined`
- Dependencies: REQ-090, REQ-092, REQ-094.
- Risk: Critical — unexecuted or weak evidence can certify unsafe application behavior.
