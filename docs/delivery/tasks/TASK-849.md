# TASK-849: Isolated Windows package integrity foundation

## Status
IN_PROGRESS
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authority: the user authorized autonomous work toward trusted desktop execution and merge; real Codex and Electron sandbox-security verification remain deferred.

## Requirement IDs
REQ-090, REQ-091, REQ-093, REQ-094, REQ-095, REQ-096

## Objective
Create an isolated, unsigned Windows test-bundle workflow for the existing Electron desktop, with explicitly staged runtime inputs, Electron ASAR integrity metadata and required fuses. Verify it launches using disposable data and fails closed when the packaged ASAR is tampered. This is an internal test artifact, not a release or proof of trusted installation.

## Context Pack
- docs/delivery/tasks/TASK-845.md
- docs/delivery/tasks/TASK-846.md
- docs/delivery/tasks/TASK-848.md
- docs/decisions/ADR-008-protected-task-content.md
- [Electron ASAR integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity)
- [Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-849.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/operations.md
- package.json
- package-lock.json
- apps/desktop/scripts/package-fixture.mjs
- apps/desktop/packaging/runtime-manifest.json
- apps/desktop/tests/main/package-fixture.test.ts
- apps/desktop/tests/native/package-fixture-smoke.cjs
- .github/workflows/application-gates.yml

## Forbidden Files
All other repository files, real user Projects, credentials and databases, signing certificates or trust stores, production IPC activation, real Codex, Electron sandbox-security verification, installer/release publication, merge and unrelated worktrees.

## Interfaces / Contracts
The test-bundle command requires an explicit newly created empty direct child of the OS temporary directory with the task-specific prefix. It stages only the exact individual files in a committed manifest; dependency file hashes are tied to a clean locked install. It rejects symlinks and path escapes rather than recursively copying the repository. This fixture assumes exclusive access to its own temporary directories: it does not attest safety against a hostile same-user process racing path replacement. Use the official Electron download/checksum path rather than an environment-selected executable. ASAR integrity and OnlyLoadAppFromAsar fuses are required. It is always identified as unsigned and untrusted; native addons may be unpacked and are not claimed to be ASAR-integrity protected.

## Data Constraints
Packaging and tests use only disposable directories and app profiles; no real projects, credentials, databases or user documents are read into the package. Never clear or overwrite an existing output path. Pin npm dependencies and install from the lockfile; do not put secrets in scripts, command lines, logs or artifacts.

## UI Constraints
The test bundle preserves existing review-only desktop behavior. No production authorization, execution, terminal recovery or Lease release route is enabled by packaging.

## Implementation Requirements
Use test-first development. Use Node 22-compatible pinned @electron/packager and @electron/fuses, an explicit runtime file staging manifest, no broad repository copy and a validated fresh temporary output. Set embedded ASAR integrity and OnlyLoadAppFromAsar, and verify both fuses. Fail closed when required assets, metadata or integrity checks are absent. Preserve the separate unsigned/native-addon and protected-installation gates.

## Test Requirements
Test invalid or pre-existing output, missing assets, path escape, symlink escape, explicit inclusion/exclusion and required fuses. Build and launch a disposable test bundle, assert a controlled original package can load, mutate only a copied test ASAR, and assert integrity rejects it. Run lint, typecheck, build, full CI-aligned unit and contract suites, functional desktop and governance. No real Codex or Electron sandbox-security validation.

## Acceptance Criteria
The test bundle contains only explicitly staged runtime inputs and launches with isolated user data. An altered test copy fails ASAR integrity verification. The test cannot overwrite existing paths or user data. Reports explicitly state that unsigned executable, unpacked native addons, publisher identity, ACL protection, worker effect confinement and production dispatch remain unverified.

## Done Definition
Record exact dependency versions, commands, output location class, negative test results, audit and candidate CI. This task cannot by itself authorize production execution, claim H1 or declare merge readiness.

## Risks
The test bundle is unsigned; an attacker able to replace the executable or unpacked native addons can bypass ASAR integrity. Packaging may otherwise include unintended local data, resolve a symlink outside the repository, overwrite user files, or bundle Node modules incompatible with Electron. Code signing, protected installation and real worker isolation require separate evidence.

## Output Required
Fail-closed isolated test-packaging workflow, integration and negative evidence, and truthful security/operations facts.

## Local evidence (not acceptance)

- On Windows, eight focused input and path-boundary tests passed outside the
  restricted automation sandbox; that sandbox refused creation of the test
  junctions (EPERM), so its failed run is not treated as a passing run.
- An unsigned disposable bundle contained exactly 440 staged files, including
  three explicitly unpacked native addons. A normal launch reached the fixture
  ready marker; mutating a copied renderer asset produced an Electron ASAR block
  validation failure. Owned fixture processes were confirmed terminated.
- Independent review identified a link-following risk in the initial smoke
  driver; recursive link/hardlink checks, copy identity checks and a narrower
  integrity failure signature were added. Full governance, full application
  gates and candidate CI remain required. CI configuration alone is not CI
  evidence.
- Windows Node 22.23.2 local run: build, lint and typecheck passed; unit suite
  found 187 files with 1,181 passes and nine explicitly scoped skips; contract
  suite passed 50/50; real Electron functional suite passed 2/2; browser suite
  passed 9/9. Synthetic WinCred and owned process-tree/bounded-I/O checks passed.
  These are working-patch results, not candidate CI or H1 acceptance.
- A subsequent focused run added an adversarial linked-bundle regression:
  nine tests passed, including proof that the link target remained unchanged.
  Its first run failed because `mkdtemp` can produce uppercase characters
  outside the fixture output naming policy; the test now creates an exclusive
  lowercase random output directory instead. Full CI must include this change.
- Candidate `c00ded5` documentation CI and packaging step passed, but its
  Windows unit job failed eight package tests: the runner exposed TEMP through
  an 8.3 alias while the fixture requires canonical paths. The error was
  reproduced locally with a disposable TEMP junction. The test setup now
  resolves the temporary directory first; all nine focused cases pass under
  that alias. The production path/link guards were not relaxed. A new candidate
  and its actual CI are required; this failed run is not a pass.
- Follow-up review identified the same possible alias in CI's package-output
  setup; it now resolves the temporary root before creating the output. The
  existing isolated package also passed its startup/tamper smoke with TEMP set
  through a disposable junction. A fresh complete package attempt under that
  alias did not finish: the official Electron download remained at zero bytes,
  and its specifically identified task-owned process was stopped. Its output
  and staging evidence were retained. This is not a passing fresh package run;
  the new candidate CI must verify the complete workflow.
