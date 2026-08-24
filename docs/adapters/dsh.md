# DeepSeek Harness Adapter

Status: compatibility probe only. DSH is `DISABLED`; this document does not
authorize a routable Function or a production DSH process host.

## Boundary

The Super Assistant-owned `@super-assistant/dsh-adapter` invokes the public DSH
SDK/protocol from the external local workspace, never DSH source internals. The
currently observed profile is commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`
and protocol package `0.1.1-rc.2`. TASK-614 refreshed this identity after the
previous `0.1.0-rc.8` profile drifted. A changed commit, package/protocol
identity, server information, or profile digest makes DSH unavailable until a
new fixture-only compatibility probe passes again.

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

The selected production policy is immutable per Attempt. Before launching a
DSH process, Super Assistant serializes the complete bound policy, stores its
digest with the Attempt, and gives the Guard a read-only copy. The Guard may
only deny synchronously. Grant, snapshot, Lease, target, budget, or runtime
profile changes require a successor Attempt policy; they never alter a running
process or retroactively authorize a tool call.

## Public interception seam

The inspected DSH public documentation exposes a scope-aware `ToolGuard` as a
final pre-dispatch policy that can only reduce permission, together with
`tools/pre-execute`, `tools/execute`, and `tools/post-execute` interception
events. The production Super Assistant profile will mount an external
Super-Assistant-owned Guard plugin at this seam. It will send every candidate
Shell, filesystem, network, and plugin call to the local Tool Broker before the
underlying DSH provider receives it, and will journal the redacted decision and
result. This is the required implementation route; profile text alone is not
treated as enforcement.

The current package remains disabled while the out-of-tree Guard plugin's
public package dependency, loader composition, and full crash/reconciliation
contract are implemented and tested under TASK-611's exact scope.

The observed DSH App Boot contract resolves relative plugin specifiers from the
Cordis configuration directory, while a DSH Profile may carry out-of-tree npm
dependencies. Super Assistant can therefore ship a versioned ESM Guard package
and a dedicated disposable Profile that references it relatively, without
modifying the DSH checkout. Building that package and executing the disposable
Profile remain separate enablement evidence; their absence keeps DSH Disabled.

See [ADR-007](../decisions/ADR-007-external-dsh-adapter.md),
[SAI](../api/sai.md), and [operations](../operations.md).
