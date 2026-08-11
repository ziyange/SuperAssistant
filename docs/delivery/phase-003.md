# PHASE-003: Decision, audit, and recovery

- State: Planned
- Horizon: H1 completion
- Branch family: `codex/phase-003-*`
- Archive path: `docs/archive/phase-003/`

## Goal

Complete H1 by adding deterministic question routing, unique human Decisions, append-only histories and Changes, evidence-driven acceptance, restart recovery, and degraded read-only operation.

## Requirements

Primary scope is `REQ-040–049`, remaining H1 orchestration requirements, and recovery/security requirements in `REQ-090–099`.

## Dependencies

Durable single-task execution and Attempt reconciliation from PHASE-002, plus approved PHASE-003 Task Packs created during PHASE-002.

## Scope

- L1–L4 Question Router and policy-owned escalation.
- Unique Decision record projected in assistant and Task views.
- Idempotent Decision resolution and resume.
- Human History, Activity, ArtifactVersion, ProjectChange, and rollback-as-new-change records.
- Acceptance evaluation and remediation inside the original Task.
- Control-plane and App Server restart recovery, adapter-unavailable degradation, audit export for one local user.

## Non-goals

No multi-agent DAG, monitoring, domain agents, team roles, or multi-party approval.

## Interface impact

Adds question/decision and acceptance ports, change/artifact evidence schemas, reconciliation administration, and read-only degraded projections. SAI error taxonomy gains explicit decision-required and recovery states without exposing provider-native concepts.

## Risks and controls

- Duplicate Decisions: unique source-question key and optimistic concurrency.
- Unsafe automatic answers: L3/L4 always require a human; L4 never times out into approval.
- False completion: acceptance is a deterministic gate over Work Items, evidence, and open Decisions.
- Corrupt recovery: replayable inbox/outbox and invariant checking before dispatch resumes.

## Test strategy

Question classification tables, duplicate resolution races, Decision replay, acceptance failure/remediation, crash matrices at each state transition, degraded-mode Playwright flows, append-only history and rollback tests, and audit completeness checks.

## Entry conditions

PHASE-002 accepted and archived; H1 recovery matrix approved; Decision and evidence schemas versioned; packs approved.

## Exit conditions

- L3/L4 creates one Decision and idempotently resumes after one resolution.
- Acceptance failure remains in the original Task.
- All H1 state survives application and adapter restart without duplicate execution.
- Model or adapter outage preserves read-only truth and denies unsafe writes.
- Audit links authorization, execution, decision, evidence, and project change.
- PHASE-004 Task Packs are approved.

## Archive evidence

Archive the full H1 acceptance suite, recovery matrix, audit sample/export, remediation histories, pack snapshots, ADR changes, commits, known issues, and H2 entry readiness.
