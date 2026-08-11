# H1–H3 delivery roadmap

## Operating rule

The roadmap designs the full product trajectory now while constraining implementation to one accepted phase at a time. Rolling Task Packs maintain continuity: during phase N, phase N+1 packs are refined against actual evidence and approved before phase N archives. Future phase plans may be revised through requirements and ADR changes, but dependent implementation cannot begin while a decision is unwritten.

## Horizon map

| Horizon | Outcome | Delivery phases | Completion proof |
|---|---|---|---|
| H1 | A trustworthy local Codex development loop | PHASE-001–003 | Side effects are authorized, isolated, recoverable, audited, and accepted with evidence |
| H2 | A multi-agent continuous-operation control plane | PHASE-004–005 | Stable SAI, conflict-safe DAGs, quality agents, bounded monitoring, and policy-controlled relay |
| H3 | A domain and enterprise platform | PHASE-006–007 | More adapters/domains plus team identity, approval, credential, audit, and retention governance |

## Phase sequence

| Phase | Purpose | Primary increment | Task Pack policy |
|---|---|---|---|
| [PHASE-001](phase-001.md) | Platform foundation | Secure desktop shell, SQLite control plane, Project/worktree, Codex discovery | TASK-101–105 approved before opening |
| [PHASE-002](phase-002.md) | Codex single-task loop | Proposal, authorization, execution, progress, cancel, basic Artifact | TASK-201–203 drafted now; approve during PHASE-001 |
| [PHASE-003](phase-003.md) | Decision, audit, and recovery | Question Router, Decision, Change Log, acceptance, restart recovery | Packs authored and approved during PHASE-002 |
| [PHASE-004](phase-004.md) | Multi-agent quality loop | Stable SAI, templates, DAG, Testing/Inspector, resource fencing | Packs authored and approved during PHASE-003 |
| [PHASE-005](phase-005.md) | Continuous monitoring loop | Collectors, triggers, aggregation, cooldown, budget, follow-up Tasks | Packs authored and approved during PHASE-004 |
| [PHASE-006](phase-006.md) | Domain and adapter expansion | Operations/data/HR/enterprise agents, adapters, visual output | Packs authored and approved during PHASE-005 |
| [PHASE-007](phase-007.md) | Team and enterprise governance | Membership, RBAC, multi-party approval, isolation, export, retention | Packs authored and approved during PHASE-006 |

## Cross-phase invariants

- SQLite remains authoritative; adapters reconcile but do not own product state.
- Proposal versions and Authorization Grants are immutable.
- An Attempt is never duplicated by retrying a command.
- Model output never changes deterministic state without a validated application transition.
- Every write is bounded by an approved path/resource scope and resource fencing.
- Evidence is append-only; retries and rollbacks create new versions or Changes.
- Cancellation includes confirmed process termination and lease release.
- Compatibility is tested before an active Agent, Function, protocol, or schema version changes.

## Success checkpoints

H1 is complete after `PHASE-003` proves all single-task safety and recovery scenarios. H2 is complete after `PHASE-005` proves conflict-safe multi-agent execution and bounded monitoring. H3 is complete after `PHASE-007` proves role isolation, multi-party approval, credential separation, audit completeness, and enforceable retention.
