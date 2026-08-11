# Architecture decision records

This directory is the authoritative index for decisions that constrain Super Assistant implementation. A decision marked `Accepted` remains binding until a later ADR explicitly supersedes it; editing an accepted ADR to reverse its outcome is prohibited.

## Accepted decisions

| ADR | Decision | Status | Applies from |
|---|---|---|---|
| [ADR-001](ADR-001-local-first.md) | Local-first Electron control plane | Accepted | H1 |
| [ADR-002](ADR-002-codex-app-server-stdio.md) | Codex App Server stable API over `stdio` | Accepted | H1 |
| [ADR-003](ADR-003-authoritative-state-and-delivery.md) | Platform-authoritative state and at-least-once delivery | Accepted | H1 |
| [ADR-004](ADR-004-task-worktrees.md) | One isolated worktree per side-effecting Task | Accepted | H1 |
| [ADR-005](ADR-005-rolling-task-packs.md) | Rolling, pre-approved Task Packs | Accepted | PHASE-000 |

## Decision governance

An ADR records context, decision, rejected alternatives, consequences, and H1-H3 compatibility. A change that contradicts an accepted ADR must add a new numbered ADR, identify every superseded decision, and update the affected engineering facts before implementation begins. Product facts live outside this directory; interface and runtime consequences are defined in [architecture](../architecture.md), [SAI](../api/sai.md), [orchestration](../orchestration.md), and [operations](../operations.md).

## Horizon compatibility

- H1 locks the local Electron/SQLite control plane, stable Codex App Server `stdio`, platform-authoritative state, at-least-once delivery, Task worktrees, and rolling Task Packs.
- H2 may add workers, adapters, parallel WorkItems, and monitoring only through the stable SAI, ExecutionAttempt, fencing, and evidence contracts.
- H3 may add hosted tenancy, RBAC, remote workers, and managed storage only through additive contracts or explicit superseding ADRs. Immutable approvals, audit meaning, public IDs, ambiguous-state non-redispatch, and product-neutral Agent/Task concepts remain compatible.
