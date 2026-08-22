# Gemini Adapter compatibility probe

Status: BLOCKED locally on 2026-08-22.

The required fixed target is `@google/gemini-cli-core` `0.55.1`. The local npm
cache recognizes that version, but it is not in this repository's locked
dependency tree and no `gemini` CLI is installed. TASK-606 forbids temporary
installation and production terminal parsing, so the Core programmatic
interface cannot be inspected or exercised for `resume`, `status`, `events`,
`result`, and reconciliation.

The future Adapter remains DISABLED. A new approved dependency/probe Pack and
an ADR or user decision are required before TASK-607 can begin; SAI is not
weakened and `--yolo` is prohibited.

## Authorized fixed-version amendment

The user subsequently authorized one exact dependency probe. The repository is
now locked to `@google/gemini-cli-core` `0.55.1`, and
`gemini-probe.test.ts` reads that package's public declarations without
credentials, a CLI process, or terminal parsing. The package provides public
`send`, `abort`, event history, and stream replay/reattachment primitives.
It does **not** provide public `status`, `result`, or `reconcile` operations
for a durable external Attempt after a process restart. Those missing queries
are required by SAI and by the UNKNOWN/RECONCILING safety invariant.

Therefore the fixed-version result remains **BLOCKED**: the Gemini Adapter is
DISABLED and TASK-607 cannot start. Implementing an adapter from internal
package state would not constitute the stable, durable Core interface required
by this project and is not authorized by TASK-606.
