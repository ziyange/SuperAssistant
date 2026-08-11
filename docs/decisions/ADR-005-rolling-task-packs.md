# ADR-005: Rolling, pre-approved Task Packs

- Status: Accepted
- Date: 2026-08-09
- Decision owners: Delivery governance

## Context

Document-first delivery requires bounded, reviewable implementation authority without designing every future code edit before evidence exists. A phase also needs a safe handoff so implementation never starts from an unapproved or mutable scope.

## Decision

The active phase contains executable, approved Task Packs with exact file allowlists, requirements, verification commands, risk classification, and iteration bounds. Before the active phase archives, the next phase's Task Packs must be complete, reviewed, and approved. Later phases retain approved phase-level contracts and receive executable packs during the preceding phase.

An approved Task Pack is immutable during execution. A required file or behavior outside its boundary uses the formal expansion flow; implementation does not broaden scope by interpretation. New evidence updates product or engineering facts first, then produces a revised pack and approval. Runtime trace and permission audit records bind each write to the active pack.

## Rejected alternatives

- Generating all implementation packs up front would encode guesses as authority.
- Generating a pack only when coding starts leaves no reviewed handoff.
- Broad directory allowlists defeat bounded autonomy and review.

## Consequences

- Phase archive depends on both current acceptance evidence and next-phase readiness.
- Changes discovered during implementation may pause work while facts and packs are revised.
- Packs, phase plans, traceability, runtime traces, and archives form one delivery chain.

## H1-H3 compatibility

- H1 uses rolling packs for the local Codex implementation and records exact repository paths.
- H2 adds multi-Agent ownership, resource leases, dependency edges, and per-Agent acceptance evidence to each pack.
- H3 adds Workspace policy, role approval, separation of duties, and exportable audit signatures without weakening immutable approval or exact scope.

## Related facts

- [Architecture](../architecture.md)
- [Operations](../operations.md)
- [ADR index](README.md)
