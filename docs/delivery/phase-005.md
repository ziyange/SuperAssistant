# PHASE-005: Continuous monitoring loop

- State: Archived locally
- Horizon: H2 completion
- Branch family: `codex/phase-005-*`
- Archive path: `docs/archive/phase-005/`

## Goal

Add durable, bounded signal-to-follow-up operation: collectors, webhooks and scheduler triggers feed normalized events that are aggregated, cooled down, budgeted, and optionally converted into policy-approved follow-up Tasks.

## Requirements

Primary scope is the monitoring, aggregation, and relay portion of `REQ-050–069`, with security, performance, and retention constraints from `REQ-090–099`.

## Dependencies

Stable SAI and conflict-safe scheduler from PHASE-004; PHASE-005 packs approved before PHASE-004 archive.

## Scope

- Polling collectors, authenticated webhooks, and persistent schedules.
- Immutable raw events and normalized event versions.
- Correlation, deduplication, aggregation windows, cooldown, budget, and concurrency policies.
- Notification records and Program Log Agent summaries.
- Follow-up Proposal or Task creation according to explicit policy; side effects retain authorization requirements.

## Non-goals

No unrestricted autonomous actions, enterprise domain catalog, team governance, or unbounded historical analytics.

## Interface impact

Adds monitoring source and event contracts, trigger identities, aggregation lineage, policy-budget state, and follow-up provenance. SAI execution remains unchanged; monitoring produces goals/Proposals rather than bypassing authorization.

## Risks and controls

- Event storms: bounded queues, aggregation, cooldown, rate, budget, and concurrency limits.
- Duplicate delivery: source idempotency keys and immutable raw-event storage.
- Silent data loss: raw events retained independently of notification aggregation.
- Autonomous scope creep: follow-up policy cannot grant broader authority than its owner configured.

## Test strategy

Replay and duplicate fixtures, clock-controlled window/cooldown tests, webhook authentication tests, queue backpressure and budget stress tests, scheduler restart tests, notification lineage, and follow-up authorization scenarios.

## Entry conditions

PHASE-004 accepted; event retention and budget policy approved; collector threat model complete; packs approved.

## Exit conditions

- Duplicate events do not duplicate follow-up work.
- Similar events aggregate without losing raw evidence.
- Cooldown, budget, and concurrency gates operate under storm load.
- Follow-up side effects still require valid authorization.
- Monitoring survives restart and exposes reconciliation state.
- PHASE-006 Task Packs are approved.

## Archive evidence

Archive event-storm results, retention samples, trigger security review, budget/cooldown proof, lineage examples, pack snapshots, commits, known issues, and H3-domain readiness.
