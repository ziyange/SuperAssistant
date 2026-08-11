# ADR-002: Codex App Server stable API over stdio

- Status: Accepted
- Date: 2026-08-09
- Decision owners: Agent integration and runtime engineering

## Context

Codex is the only deeply integrated Coding Agent in H1. Its upstream execution model includes App Server concepts such as initialization, threads, turns, interrupts, and streamed notifications, while the product model exposes Agent, Function, Task, WorkItem, ExecutionAttempt, Decision, Activity, and ArtifactVersion.

## Decision

The Codex Adapter consumes only the documented stable Codex App Server API. H1 launches one supervised App Server child process per active adapter worker and communicates through newline-delimited JSON-RPC on local `stdio`. Experimental methods, private modules, CLI screen scraping, database inspection, and direct mutation of Codex internal files are prohibited.

The adapter is an anti-corruption layer. It maps App Server thread and turn identifiers to private adapter correlation records. SAI, the database outside adapter correlation tables, application services, renderer IPC, UI copy, logs intended for users, and ArtifactVersion names never expose Thread or Turn as product concepts.

Every startup performs protocol initialization, version/capability negotiation, and compatibility validation before the Agent becomes available. An unsupported App Server version sets Connection to `UNAVAILABLE`; it never falls back silently to an unstable API.

## Rejected alternatives

- Driving the interactive Codex CLI through terminal scraping is nondeterministic and cannot provide a stable event contract.
- Importing Codex private implementation modules would couple releases at compile time.
- Exposing Thread and Turn in the product would make Task recovery and future adapters depend on one upstream model.

## Consequences

- A fake App Server implementing the same stable JSON-RPC surface is mandatory for contract and recovery tests.
- Adapter correlation data must survive worker restart.
- Upstream streaming notifications require per-ExecutionAttempt sequencing, deduplication, normalization, and redaction before entering SAI.
- App Server process exit creates an `UNKNOWN` ExecutionAttempt until reconciliation proves the upstream outcome.

## H1-H3 compatibility

- H1 uses local `stdio` and one Codex adapter type.
- H2 may run multiple adapter workers and additional SAI implementations; Codex-specific correlation remains private.
- H3 may add authenticated remote transports through a new transport ADR. The product-neutral SAI envelope and operation semantics remain unchanged, and remote support cannot weaken version negotiation or event ordering.

## Related facts

- [SAI contract](../api/sai.md)
- [Codex Adapter](../adapters/codex.md)
- [Authoritative state and delivery](ADR-003-authoritative-state-and-delivery.md)
