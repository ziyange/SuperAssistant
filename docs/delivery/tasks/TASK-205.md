# TASK-205: Establish desktop runtime package boundaries

## Status

COMPLETED

PHASE: PHASE-002

MAX_ITERATIONS: 4

user_confirmed: true

## Requirement IDs

REQ-090, REQ-092, REQ-093, REQ-095, REQ-096, REQ-097, REQ-099

## Objective

Make the existing local `@super-assistant/domain` and
`@super-assistant/persistence` workspace packages consumable by the Electron
main and preload runtime through emitted JavaScript and declaration artifacts.
This Pack repairs the PHASE-001 build boundary discovered while wiring
TASK-203; it does not change product behavior, database semantics, SAI, or
authorization.

## Context Pack

- `docs/architecture.md`
- `docs/operations.md`
- `docs/security.md`
- `docs/delivery/phase-002.md`
- `docs/delivery/tasks/TASK-203.md`

## Must Read

- `AGENTS.md`
- `docs/architecture.md`
- `docs/security.md`
- `docs/operations.md`
- `docs/delivery/phase-002.md`
- `docs/delivery/tasks/TASK-203.md`
- `docs/verification/quality-gate.md`
- `docs/verification/test-strategy.md`

## Allowed Files

- package.json
- vitest.workspace.ts
- packages/domain/package.json
- packages/domain/tsconfig.json
- packages/domain/tsconfig.build.json
- packages/persistence/package.json
- packages/persistence/tsconfig.json
- packages/persistence/tsconfig.build.json
- apps/desktop/package.json
- apps/desktop/tsconfig.main.json
- apps/desktop/tsconfig.preload.json
- apps/desktop/vite.config.ts
- apps/desktop/tests/main/runtime-package.test.ts
- docs/architecture.md
- docs/operations.md
- docs/security.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-205.md
- docs/verification/reports/phase-002-task-205.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Application domain behavior, persistence schema/migrations, IPC contracts,
  renderer code, adapter behavior, credentials, remote configuration, lockfile
  changes, new third-party dependencies, or Task/Attempt state mutations.

## Interfaces / Contracts

- Workspace package consumers resolve only emitted `dist` JavaScript and
  declarations for production runtime; tests may retain their existing source
  transform path.
- Electron main and preload build separately from renderer output; no renderer
  bundle imports `better-sqlite3` or accesses Node APIs.
- Failure to find a package artifact fails the build closed before Electron can
  start.

## Data Constraints

- This Pack creates build artifacts only; they are ignored output, not product
  records. It must not open SQLite, write migrations, launch an Adapter, or
  create a Proposal, Grant, Task, Work Item, Attempt, Artifact, or lease.

## UI Constraints

- No renderer-facing product UI or preload API changes are permitted.
- Renderer build must continue to be isolated from Node and persistence
  runtime modules.

## Implementation Requirements

- Configure explicit ESM runtime and type entrypoints for domain and
  persistence packages.
- Configure separate emit targets for Electron main and preload; retain Vite
  exclusively for renderer output.
- Make root build order deterministic: domain, persistence, desktop runtime,
  renderer.
- Add a deterministic smoke that imports emitted persistence artifacts from
  the main-process build boundary without launching a worker or opening a
  database.

## Test Requirements

```powershell
npm run lint
npm run typecheck
npm run build
npm run test:unit -- --run apps/desktop/tests/main/runtime-package.test.ts
npm run build
python scripts/check_docs_links.py docs --json
python scripts/check_task_pack.py docs/delivery/tasks/TASK-205.md --schemas references/schemas.md --json
python scripts/verify_runtime_trace.py --mode build --task-pack docs/delivery/tasks/TASK-205.md --schemas references/schemas.md --next-iteration 1 --json
git diff --check
```

## Acceptance Criteria

- Package manifests expose only emitted ESM and declaration entrypoints.
- A clean `npm run build` completes in deterministic dependency order.
- The main and preload artifacts resolve their workspace package imports;
  renderer artifacts contain neither `better-sqlite3` nor Node runtime APIs.
- Missing or stale package artifacts make the package smoke fail closed.
- Existing unit and type suites remain green, and TASK-203 can import
  persistence from Electron main without a relative-source escape.

## Done Definition

The build boundary, isolated artifact smoke, full build, typecheck, lint, and
governance checks pass. Facts state the observed runtime packaging behavior.
TASK-203 resumes only after this Pack has direct PASS evidence.

## Risks

`SECURITY_PERMISSION 0.600` remains active. Accidental renderer inclusion of
native SQLite bindings or Node APIs is a security failure. Native module ABI
drift, stale artifacts, and package export/source divergence are fail-closed;
this Pack must not conceal them with a relative source import.

## Output Required

Return exact package/build configuration files, emitted artifact evidence,
main/preload import-smoke result, renderer isolation evidence, command output,
known limitations, and `docs/verification/reports/phase-002-task-205.md`.
