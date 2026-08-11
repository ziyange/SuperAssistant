# PHASE-002: Codex single-task loop

- State: Planned
- Horizon: H1
- Branch family: `codex/phase-002-*`
- Archive path: `docs/archive/phase-002/`

## Goal

Deliver the first vertical goal-to-result loop for one Project, one Codex Agent, and one required Work Item while enforcing Proposal authorization, preflight invalidation, durable Attempt identity, worktree isolation, cancellation, and basic Artifact evidence.

## Requirements

Primary scope is `REQ-020–039`, with relevant Project foundations, Artifact foundations in `REQ-040–049`, and `REQ-090–099` safeguards.

## Dependencies

Accepted PHASE-001 repositories, secure IPC, Project snapshot/worktree service, Codex discovery, and approved TASK-201–203.

## Scope

- Classify read-only versus side-effecting goals.
- Create immutable ProposalVersion and AuthorizationGrant records.
- Revalidate Project, Agent, Function, policy, grant, and resource snapshot in preflight.
- Atomically create Task, Work Item, Execution Attempt, resource lease, and outbox command.
- Map start/status/events/result/cancel through the Codex adapter.
- Present Task progress, cancellation, result evidence, and basic immutable ArtifactVersion metadata.

## Non-goals

No multi-Work-Item DAG, high-level Question Router, automated acceptance repair, monitoring, templates, extra adapters, remote execution, or team approval.

## Interface impact

Activates the complete SAI ExecutionPort for one Codex Work Item. Establishes request and event envelopes, inbox/outbox, Attempt sequence rules, error mapping, cancellation acknowledgement, and `UNKNOWN/RECONCILING`. Product APIs continue to hide Thread/Turn.

## Risks and controls

- Double confirmation: unique authorization and idempotency constraints.
- TOCTOU after preflight: snapshot version comparison plus lease fencing at dispatch.
- Lost response after start: reconcile external execution identity before any retry.
- Background writes after cancel: adapter process-tree termination and lease-release evidence.
- Artifact ambiguity: bind checksum, repository baseline, Attempt, and authorization.

## Test strategy

Domain state-machine tests, outbox/inbox failure injection, fake App Server duplicate/late/out-of-order event contracts, crash/restart reconciliation tests, cancel process-tree tests, Playwright Proposal-confirm-progress-result flow, and explicit real Codex smoke in a disposable fixture repository.

## Entry conditions

PHASE-001 accepted and archived; TASK-201–203 approved; fake server covers declared upstream versions; migration and security reviews pass.

## Exit conditions

- A read-only query creates no Proposal or grant.
- No side effect occurs before confirmation.
- Repeated confirmation creates exactly one Attempt.
- Project, Agent, Function, or grant changes invalidate preflight.
- Restart reconciliation does not duplicate work.
- Cancel confirms termination and lease release.
- Result and Artifact evidence are durable and attributable.
- PHASE-003 Task Packs are approved.

## Archive evidence

Archive the scenario recordings, contract fixtures, crash/cancel evidence, authorization review, pack snapshots, fact write-backs, commits, known issues, and PHASE-003 readiness proof.
