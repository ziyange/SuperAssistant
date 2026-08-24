# PHASE-006 TASK-611 verification report

- Status: PASS; DSH remains product-level `DISABLED`.
- Authorized pack: `docs/delivery/tasks/TASK-611.md`
- Preconditions: TASK-610 PASS and ADR-007 Accepted.

## Current verified evidence

- DSH Attempt Journal migration 017 is idempotent; persisted sequence evidence
  is unique by Attempt and sequence.
- Event gaps enter `RECONCILING`; duplicate dispatch and ambiguous state never
  permit redispatch.
- A supervised fixture process has one owner per Attempt and cancellation only
  succeeds after termination evidence; the Desktop service releases a Lease
  only after that evidence.
- Tool Broker rejects stale Grant, snapshot, fence, target, budget, and plugin
  digest. Its Guard maps public DSH ToolRuntime registration to a monotonic
  deny-only decision. Credential-like evidence is redacted before journaling.
- Public Loader mounting, public SDK Server lifecycle, and public ToolRuntime
  dispatch were independently exercised by TASK-613 through TASK-616. They
  establish that the emitted immutable Guard mounts under the public Loader,
  denies unauthorized calls before tool dispatch, and can serve a public
  JSON-RPC `initialize`/`shutdown` lifecycle without a prompt or capability
  effect.
- Full deterministic unit suite: 108 files / 229 tests PASS. Contract suite:
  6 files / 31 tests PASS. Lint, typecheck, production build, and 7 Electron
  Playwright scenarios PASS.

## Completion boundary

The completed adapter boundary is intentionally not product enablement. No
real DSH CLI, provider/model, credential, Shell, filesystem, network, or plugin
effect was invoked during verification. A future authorized product Task must
create a concrete Proposal/Grant/Attempt and may then enable a DSH Function;
it must use the immutable Attempt policy and cannot bypass the broker. Until
then the UI and adapter manifest remain `DISABLED`.

## Acceptance mapping

- Process-host and broker tests prove idempotent ownership, stale-binding
  denial, redacted evidence, termination-before-Lease-release, and
  reconciliation without redispatch.
- TASK-613 proves public Loader composition; TASK-615 proves the public SDK
  Server lifecycle; TASK-616 proves denial occurs before actual ToolRuntime
  dispatch. Their fixtures never call a model or an external capability.
