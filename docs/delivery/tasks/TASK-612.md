# TASK-612: DSH external Guard packaging probe
## Status
COMPLETED
PHASE: PHASE-006
MAX_ITERATIONS: 4
user_confirmed: true
## Requirement IDs
REQ-077, REQ-078, REQ-090, REQ-091, REQ-095, REQ-096
## Objective
Package the Super Assistant DSH ToolGuard as a versioned ESM module and prove a
disposable, configuration-relative DSH Profile can resolve the package without
changing the DSH checkout or invoking a model or capability tool.
## Context Pack
- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/adapters/dsh.md
- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
- docs/verification/reports/phase-006-task-611.md
## Must Read
- AGENTS.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
- docs/adapters/dsh.md
- docs/delivery/tasks/TASK-612.md
## Allowed Files
- package.json
- package-lock.json
- packages/dsh-adapter/package.json
- packages/dsh-adapter/tsconfig.build.json
- packages/dsh-adapter/src/dsh-attempt-policy.ts
- packages/dsh-adapter/src/index.ts
- packages/dsh-adapter/src/dsh-tool-guard-plugin.ts
- packages/dsh-adapter/tests/dsh-attempt-policy.test.ts
- packages/dsh-adapter/tests/dsh-tool-guard-plugin.test.ts
- packages/dsh-adapter/fixtures/production.cordis.yml
- packages/dsh-adapter/fixtures/profile/package.json
- packages/dsh-adapter/fixtures/profile/cordis.patch.yml
- docs/adapters/dsh.md
- docs/api/sai.md
- docs/security.md
- docs/operations.md
- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-612.md
- docs/verification/reports/phase-006-task-612.md
## Forbidden Files
Every file under `E:\Programs\deepseek-harness`; any provider/model call;
credential; DSH Shell/filesystem/network/plugin execution; plugin installation
inside DSH; production profile; remote Git action.
## Interfaces / Contracts
The emitted Guard is an ESM module exposing only the public ToolRuntime `guard`
mount seam. Each mount accepts one immutable Attempt-policy object; the
disposable profile may reference it relatively, supplies no tool implementation,
and cannot force-allow a denied operation.
## Data Constraints
No secret, prompt, session, external tool result, or mutable DSH state is
stored. Fixture profile artifacts are nonsecret and disposable.
## UI Constraints
None. DSH stays Disabled.
## Implementation Requirements
- Emit ESM only from `packages/dsh-adapter`.
- Pin public DSH tool package version in the lockfile.
- Canonicalize and SHA-256 digest one nonsecret immutable Attempt policy. It
  binds the Attempt, pinned Function, Proposal digest, Grant reference, Project
  snapshot/baseline, Lease fence, capability target rules, plugin digests,
  budget, and runtime profile digest. A changed bound value changes the digest.
- The policy must be deeply frozen and the Guard must use its static Grant,
  snapshot, and fence values; a tool call without an exact declared binding
  fails closed.
- Fixture profile uses a configuration-relative module reference and contains
  no provider, credential, Shell, filesystem, network, or plugin row.
## Test Requirements
Run focused Guard/package tests, typecheck, build, lint, full deterministic
tests, and governance gates.
## Acceptance Criteria
- Emitted ESM imports through its published path.
- Fixture profile contains no executable DSH capability.
- Profile/package metadata references only the fixed public package version.
- Equal policy facts generate the same lowercase SHA-256 digest with the
  `sha256:` prefix; changed
  authority facts generate a different digest and cannot mutate the mounted
  policy.
- Any resolution failure keeps DSH Disabled.
## Done Definition
Package and fixture profile evidence PASS without a DSH process or effect.
## Risks
DSH Loader/profile semantics can drift; any mismatch blocks production enablement.
## Output Required
`docs/verification/reports/phase-006-task-612.md` with emitted paths, lock
versions, fixture scan, commands, and PASS/BLOCKED conclusion.

## Approved Scope Expansion

- 2026-08-23: the user selected immutable per-Attempt policy configuration.
  ADR-007 and the affected API/security/operations facts require the four
  exact documents above. This adds no DSH repository or capability-effect scope.
