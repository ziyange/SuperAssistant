# ADR-004: One isolated worktree per side-effecting Task

- Status: Accepted
- Date: 2026-08-09
- Decision owners: Project execution and security engineering

## Context

Codex tasks modify repositories and may run concurrently. Reusing the user's working tree risks overwriting uncommitted changes, mixing Task artifacts, bypassing resource-conflict detection, and making rollback or provenance ambiguous.

## Decision

Every H1 Task that can change a Git project receives a dedicated worktree and branch before its first mutating ExecutionAttempt. Branches use `codex/phase-00x-*` for repository delivery work and a stable Task-specific suffix for application Tasks. The Project's source working tree is read-only to the adapter unless the user explicitly selects it for a read-only operation.

The control plane records repository identity, baseline commit, worktree path, branch name, owning Task, lease token, creation time, and cleanup disposition. A ResourceLease with a fencing token is required before creation and before every mutating command. Worktree reuse across Tasks is prohibited. Cleanup occurs only after process termination, lease release, ArtifactVersion capture, and a clean/dirty disposition check; dirty or ambiguous worktrees are quarantined for user review rather than deleted.

Non-Git Projects use an equivalent Task sandbox copy or a read-only mode. H1 does not permit direct mutation of an unversioned source directory.

## Rejected alternatives

- A shared checkout cannot make concurrent writes or provenance deterministic.
- Branch-only isolation still shares the same index and working files.
- Deleting a worktree immediately on cancellation can destroy unrecorded evidence.

## Consequences

- Disk capacity, stale worktree detection, quarantine, and cleanup are operational concerns.
- Cross-Task resource conflicts still require logical leases for shared services, generated assets, database schema, and external resources.
- Cancellation is incomplete until upstream App Server activity and every descendant process owned by the ExecutionAttempt terminate, terminal evidence is recorded, and its ResourceLease is released. The Adapter Worker may remain running to serve other work.

## H1-H3 compatibility

- H1 provides one local worktree per mutating Task.
- H2 supports parallel WorkItems using separate worktrees and explicit merge/acceptance dependencies; two active ExecutionAttempts never share a writable worktree.
- H3 may provision remote ephemeral workspaces, but preserves one execution-sandbox owner, immutable baseline identity, fencing, quarantine, and provenance.

## Related facts

- [Security](../security.md)
- [Orchestration](../orchestration.md)
- [Codex Adapter](../adapters/codex.md)
