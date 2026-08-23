# DeepSeek Harness Adapter

Status: compatibility probe only. DSH is `DISABLED`; this document does not
authorize a routable Function or a production DSH process host.

## Boundary

The Super Assistant-owned `@super-assistant/dsh-adapter` invokes the public DSH
SDK/protocol from the external local workspace, never DSH source internals. The
currently observed profile is commit `141eb6fef83422698aef7a981029e843e8161534`
and protocol package `0.1.0-rc.8`. A changed commit, package/protocol identity,
server information, or profile digest makes DSH unavailable until TASK-610's
fixture-only probe passes again.

The probe reads DSH Git and protocol metadata only. Its JSON-RPC child is a
repository-owned Node fixture, not DSH: no provider/model call, network call,
credential, plugin installation, Shell command, or filesystem capability is
issued.

## Stable SAI mapping

| SAI operation | Current probe evidence | Production authority |
|---|---|---|
| `describe` | Public commit and protocol profile | Adapter manifest after conformance |
| `health` | Fixture liveness and initialize response | Supervised process observation |
| `start` | Explicitly deferred | One process per Attempt after approval |
| `resume` | Explicitly unsupported | Requires proven replay compatibility |
| `cancel` | Fixture shutdown/EOF/terminate/kill evidence | Terminal only after process and Lease proof |
| `status` | Explicitly platform-derived | SQLite reducer and journal |
| `events` | Explicitly deferred | Normalized, sequenced event journal |
| `result` | Explicitly platform-derived | Terminal journal evidence only |

An unreadable record, process loss, event gap, or uncertain interval is
`UNKNOWN/RECONCILING`; it never creates a replacement Attempt.

## Brokered capabilities

DSH Shell, filesystem, network, and plugin capabilities are intentionally not
disabled. A future production profile may release each only through the Super
Assistant Tool Broker, after it validates the pinned Function, immutable
Proposal, current Grant, Project snapshot, Lease fence, worktree containment,
capability target rule, and budget. It records redacted request and result
evidence. Plugins also require approved identity, version, source digest, and
permission declaration; neither model output nor DSH may install, update, or
enable one.

See [ADR-007](../decisions/ADR-007-external-dsh-adapter.md),
[SAI](../api/sai.md), and [operations](../operations.md).
