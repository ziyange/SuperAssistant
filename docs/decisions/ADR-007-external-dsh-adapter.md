# ADR-007: External DeepSeek Harness Adapter

- Status: Accepted
- Date: 2026-08-23
- Applies from: PHASE-006

## Context

PHASE-006 requires a second dedicated Adapter without weakening the stable eight-operation SAI contract. The completed Gemini Core `0.55.1` probe established that the public Core surface cannot durably prove `status`, `result`, or reconciliation for an external ExecutionAttempt. Its evidence remains valid, but `TASK-607` cannot be implemented safely.

The user provides DeepSeek Harness (DSH) locally at `E:\Programs\deepseek-harness`. Its public SDK/protocol exposes newline-delimited JSON-RPC over `stdio`, including `initialize`, `session/prompt`, shutdown, and session notifications. DSH observations and session storage are not platform-authoritative, and the current public surface has no durable per-prompt result or cancellation query.

DSH supports Shell, filesystem, network, and plugin capabilities. They are useful product capabilities, but direct model-controlled access would bypass Proposals, Grants, Project snapshots, Lease fences, worktree ownership, and audit evidence.

## Decision

1. Super Assistant will implement its own `packages/dsh-adapter` and invoke, but never modify, vendor, fork, or write into the DSH workspace. The Adapter consumes only DSH's public SDK/protocol boundary.
2. The DSH Adapter runs one supervised DSH process, session root, and managed task worktree per ExecutionAttempt. SQLite and the Super Assistant event journal remain authoritative for SAI `status`, `events`, `result`, Attempt state, sequence, Grant consumption, and reconciliation.
3. A lost process, unreadable session record, protocol/profile drift, sequence gap, or interval with unknown external effect enters `UNKNOWN/RECONCILING`; it never permits redispatch. Process-per-Attempt ownership and journal evidence bridge DSH's missing direct cancel/result semantics. `cancel` uses the documented shutdown, EOF, termination, and kill ladder, and does not report `CANCELLED` before process and Lease evidence is proven.
4. DSH Shell, filesystem, network, and plugin capabilities remain available only through a Super-Assistant-owned Tool Broker. For every Attempt, the control plane creates one immutable, content-addressed policy configuration before process launch. It binds the pinned Function, immutable Proposal, consumed AuthorizationGrant, Project snapshot and baseline, ResourceLease fence, capability allowlist, target/path/host rule, budget, and policy digest. The in-process DSH Guard performs only synchronous local denial against that configuration; it cannot hot-reload, expand, or force-allow policy. It records redacted request and result evidence before the platform projects the outcome.
5. A production DSH profile cannot expose an unbrokered capability. A plugin additionally requires approved identity, version, source digest, declared permissions, and a passing compatibility probe; models cannot install, update, or enable plugins. Probe work uses fixtures only: no credential, provider/model call, network call, plugin installation, or unbrokered filesystem or Shell side effect.
6. The observed DSH commit, public protocol/package identity, server information, profile digest, and Attempt policy digest form the execution evidence. A changed runtime profile is not silently trusted: affected Functions are Disabled until the DSH compatibility probe records a passing result. A changed Grant, snapshot, Lease, budget, or capability rule requires a new Attempt policy and never mutates an active process. This is an update gate, not a requirement to freeze the user's DSH repository forever.
7. `TASK-607` is rejected and superseded by `TASK-610` (DSH compatibility probe). A production `TASK-611` may be approved only after the probe passes. This changes no SAI operation or product-neutral state model.

## Alternatives rejected

- **Gemini Core production Adapter:** rejected because its tested public surface cannot prove durable external Attempt status, result, and reconciliation.
- **Gemini headless CLI parsing:** rejected because terminal text and files cannot establish the required lifecycle truth.
- **Direct changes or extensions inside DSH:** rejected because DSH is independently updated and Super Assistant needs a stable external integration boundary.
- **A shared long-running DSH process:** rejected because Attempt ownership, cancellation, worktree isolation, and recovery evidence would be ambiguous.
- **Disabling DSH Shell, filesystem, network, and plugins entirely:** rejected by product direction. Brokered, narrowly authorized capability use gives users those capabilities without bypassing governance.

## Consequences

- The platform must implement a process host, normalized event journal, Tool Broker, capability policy, and reconciler before DSH Functions are routable.
- DSH upstream language, sessions, and internal identifiers remain adapter evidence, never product-level Task concepts.
- Authorized DSH tool effects are subject to the same Proposal, Grant, snapshot, Lease, worktree, idempotency, cancellation, and audit rules as Codex effects.
- Existing Gemini probe evidence remains available as a completed compatibility block; it is not deleted or rewritten.

## Compatibility

SAI 1.0 retains exactly `describe`, `health`, `start`, `resume`, `cancel`, `status`, `events`, and `result`. DSH-specific request/notification details, process identifiers, and broker mechanics stay behind the Adapter boundary. The H3 actor and workspace context remains additive and backward compatible.
