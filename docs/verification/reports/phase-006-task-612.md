# PHASE-006 TASK-612 verification report

- Status: PASS for packaging and non-executing Profile evidence.
- DSH remains `DISABLED`; this Task did not start DSH, load a DSH Profile, call
  a model/provider, or invoke a Shell, filesystem, network, or plugin tool.

## Immutable Attempt policy

- `createDshAttemptPolicy` creates a nonsecret, deep-frozen policy and a stable
  `sha256:<lowercase-hex>` digest over canonical JSON.
- The policy binds Attempt, Function/version, Proposal digest, opaque Grant
  reference, Project snapshot/baseline, Lease fence, exact capability/tool and
  target bindings, plugin digests, budget, and runtime Profile digest.
- `mountImmutableDshToolGuard` supplies Grant, snapshot, and fence only from
  the frozen policy. A caller cannot forge those values, and an undeclared tool
  is denied. A changed authority fact produces a different policy digest and
  needs a successor Attempt.

## Packaging evidence

- `@super-assistant/dsh-adapter` now exports ESM from `dist/index.js` and its
  public ToolRuntime Guard seam resolves through that emitted entry.
- The public dependency is pinned as `@deepseek-ai/dsh-tools@0.1.0-rc.8` in
  both package and lock metadata.
- The disposable configuration-relative fixtures reference only the emitted
  Guard module. They declare no provider, credential, or capability plugin.

## Commands and results

- `npm run test:unit -- --run packages/dsh-adapter/tests/dsh-attempt-policy.test.ts packages/dsh-adapter/tests/dsh-tool-guard-plugin.test.ts` — PASS, 5 tests.
- `npm run lint` — PASS.
- `npm run typecheck` — PASS for all workspaces.
- `npm run test:contract` — PASS, 6 files / 31 tests.
- `npm run build` — PASS.
- `npm run build --workspace @super-assistant/dsh-adapter` — PASS.
- Local emitted-ESM import check — PASS.
- `python scripts/check_docs_links.py docs --json` and
  `python scripts/check_task_pack.py docs/delivery/tasks/TASK-612.md --schemas references/schemas.md --json` — PASS.
- `git diff --check` — PASS.

## Residual risk and next gate

DSH Loader/Profile composition can still drift. A subsequent exact-scope Task
must validate an out-of-tree Loader mount against the fixed public dependency
graph with no provider/model or capability effect. Until that evidence exists,
DSH must stay Disabled.
