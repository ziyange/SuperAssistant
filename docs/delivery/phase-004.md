# PHASE-004: Multi-Agent quality loop

- State: Planned
- Horizon: H2
- Branch family: `codex/phase-004-*`
- Archive path: `docs/archive/phase-004/`

## Goal

Generalize H1 into a versioned SAI ecosystem with Agent Templates, durable multi-Work-Item DAGs, Testing and Inspector roles, bounded parallelism, resource-conflict detection, and acceptance repair within one Task.

## Requirements

Primary scope is the multi-agent and quality portion of `REQ-050–069`, plus compatibility and performance controls in `REQ-090–099`.

## Dependencies

H1's trusted execution, Decision, evidence, and recovery semantics; approved stable SAI version; PHASE-004 packs approved before PHASE-003 archive.

## Scope

- Stable SAI version negotiation and adapter conformance kit.
- Versioned Agent Template and Function contracts.
- Durable acyclic Work Item graph with required/optional nodes.
- Testing and Inspector Agent roles with independent evidence.
- Canonical resource keys, hierarchical leases, fencing tokens, and deadlock prevention.
- Acceptance rejection that reopens or adds remediation Work Items within the same Task.

## Non-goals

No continuous collectors, automatic signal-triggered Tasks, general domain agents, team Workspace, or cross-organization federation.

## Interface impact

SAI becomes an externally implementable stable contract. Execution envelopes gain graph and capacity context without breaking H1 fields. Template versions and resource claims are immutable per active Work Item. Result aggregation distinguishes executor, tester, inspector, and user evidence.

## Risks and controls

- Overlapping writes: normalize resources and reject conflicting leases before dispatch.
- Cyclic or mutable DAG: validate and version graph changes.
- Colluding self-verification: separate roles and provenance for quality evidence.
- Adapter incompatibility: conformance suite and negotiated version ranges.
- Starvation/deadlock: global lock order, time-bounded leases, fencing, and fairness tests.

## Test strategy

Property tests for DAGs, scheduler crash/replay tests, concurrent lease and fencing tests, fake multi-adapter conformance, quality-rejection remediation flows, deterministic aggregate status tests, and multi-agent Playwright evidence views.

## Entry conditions

H1 accepted; SAI version and compatibility policy approved; canonical resource model documented; Task Packs approved.

## Exit conditions

- Conflicting writes are detected and blocked before execution.
- Non-conflicting Work Items run concurrently and recover deterministically.
- Testing/Inspector rejection remains in the original Task and produces remediation.
- Every result is attributable to an Agent, Function, version, Attempt, and authorization.
- PHASE-005 Task Packs are approved.

## Archive evidence

Archive conformance results, concurrency/fencing stress evidence, DAG recovery recordings, quality-role evidence, pack snapshots, performance baseline, commits, known issues, and PHASE-005 readiness.
