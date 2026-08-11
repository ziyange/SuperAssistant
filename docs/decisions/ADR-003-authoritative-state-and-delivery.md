# ADR-003: Platform-authoritative state and at-least-once delivery

- Status: Accepted
- Date: 2026-08-09
- Decision owners: Control-plane and orchestration engineering

## Context

Tasks outlive model conversations and adapter processes. Commands or events may be lost, duplicated, delayed, or observed out of order across database commits, worker crashes, App Server exits, and application restarts. Claiming exactly-once execution would hide rather than solve ambiguous external side effects.

## Decision

SQLite is authoritative for ProposalVersion, AuthorizationGrant, Task, WorkItem, ExecutionAttempt, Decision, ArtifactVersion metadata, ProjectChange, ResourceLease, Inbox, and Outbox state. Model context, renderer state, and adapter memory are disposable projections or evidence.

Commands and events use at-least-once delivery. The transaction that changes domain state also inserts an Outbox record. Consumers insert an Inbox deduplication record before applying an event. Every command has a stable `request_id` and `idempotency_key`; every execution has a stable `attempt_id`; every ExecutionAttempt event has a monotonically increasing `sequence`.

Loss of a definitive adapter outcome moves an ExecutionAttempt to `UNKNOWN`, then `RECONCILING`. Neither state is dispatchable. The same WorkItem may receive a new ExecutionAttempt only after reconciliation establishes that the previous command did not execute, or after the previous ExecutionAttempt reaches a terminal state. A timeout alone is not proof of non-execution.

## Rejected alternatives

- Exactly-once claims cannot cover filesystem, Git, process, and external service side effects.
- Making the adapter authoritative prevents deterministic recovery when its process or local state is lost.
- Redispatching on timeout can duplicate source changes, messages, payments, or other external effects.

## Consequences

- All reducers and handlers must be idempotent.
- Reconciliation and operator-visible ambiguous-state handling are core behavior.
- Task status is a rebuildable projection derived from authoritative child state and explicit control flags.
- Retention cannot delete Inbox/Outbox or ExecutionAttempt evidence while referenced audit and reconciliation windows remain open.

## H1-H3 compatibility

- H1 uses SQLite transactions and a local durable dispatcher.
- H2 may replace the local dispatcher with a broker, but preserves IDs, Inbox/Outbox semantics, ExecutionAttempt sequencing, and non-redispatch of ambiguous executions.
- H3 may place the authority service on a server and use tenant-partitioned storage. Per-tenant ordering and authorization become stricter; the at-least-once contract remains.

## Related facts

- [Data model](../data-model.md)
- [Orchestration](../orchestration.md)
- [Operations](../operations.md)
