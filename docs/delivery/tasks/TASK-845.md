# TASK-845: In-process Windows protected credential vault

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 8
user_confirmed: true
Authority: the user authorized continuous production credential, execution and recovery integration, with real Codex and Electron sandbox security tests deferred.

## Requirement IDs
REQ-021, REQ-023, REQ-027, REQ-090, REQ-092, REQ-094, REQ-095, REQ-098, REQ-099

## Objective
Replace the external helper transport dependency with a Windows Node-API addon loaded into the trusted main process, implementing the existing ReservedVault contract with real Windows Credential Manager. This is a prerequisite for the requested desktop authorization and execution chain, not a declaration that process ownership or full production integration is solved.

## Context Pack
- docs/delivery/tasks/TASK-808.md
- docs/delivery/tasks/TASK-809.md
- docs/delivery/tasks/TASK-844.md
- docs/decisions/ADR-008-protected-task-content.md

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
- .gitignore
- .github/workflows/application-gates.yml
- docs/delivery/tasks/TASK-845.md
- docs/delivery/tasks/TASK-844.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/operations.md
- apps/desktop/native/wincred-addon.cc
- apps/desktop/native/binding.gyp
- apps/desktop/src/main/windows-native-vault.ts
- apps/desktop/tests/main/windows-native-vault.test.ts
- apps/desktop/tests/native/wincred-addon-test.cjs
- apps/desktop/package.json
- apps/desktop/scripts/build-native.cjs
- package.json
- package-lock.json

## Forbidden Files
All other repository paths, user credentials or production credential namespace during tests, real user databases, real Codex, Electron sandbox security tests, production dispatch activation, merge and release.

## Interfaces / Contracts
The addon exports only create and read for validated protected references. The production vault has no arbitrary target, secret input, path or delete API exposed to renderer. The test-only native build uses a distinct synthetic namespace and exact matching cleanup. The in-process module is part of the trusted application, not a separate replaceable spawned executable. Native-module packaging and integrity, cross-process concurrency, crash recovery and secure installation must be separately verified before production activation.

## Data Constraints
Never store secret values in SQLite, logs, command lines, environment or repository files. Test writes use a uniquely generated synthetic target and cleanup only that target after matching its value. Reject duplicate creation and preserve ambiguous outcomes; never overwrite a confirmed key intentionally.

## UI Constraints
No renderer exposure or confirmation button is enabled by this task alone. The real desktop route must remain unavailable until the full trust and execution gates are established.

## Implementation Requirements
Use tests first. Implement native credential read and random create with bounded inputs, shared cooperative mutex, robust Win32 errors, buffer zeroing and per-user isolation. Bind the implementation to the existing main-process ReservedVault interface and ensure unsupported platforms fail closed. Add deterministic build integration for a Windows Node-API addon without installing or running real Codex.

## Test Requirements
Run test-first invalid, missing, duplicate, buffer ownership and error cases, an opt-in real Windows Credential Manager synthetic create/read/duplicate/exact-cleanup integration, lint, typecheck, build, full unit and contract tests and governance. Verify no real user credential is touched and no secret is emitted. Real Codex and Electron sandbox security remain deferred.

## Acceptance Criteria
The real in-process Windows vault creates and reads a synthetic protected key and rejects duplicate creation; secrets remain out of logs and SQLite; errors fail closed. Tests demonstrate exact-match cleanup for only the test namespace. Native module loading and build use the same artifact as application packaging. This alone cannot authorize production execution or Lease release.

## Done Definition
Record actual commands, test counts, native tool versions, security review, limitations and CI tied to the candidate commit. Keep unresolved package provenance, noncooperating writers and production desktop composition explicit.

## Risks
An addon loaded from an untrusted writable installation is not protected merely by being in-process. CredWrite is not atomic against noncooperating same-user writers. Windows native toolchain and Node/Electron ABI compatibility need explicit verification. A crash can leave only the identified synthetic test credential.

## Output Required
Real Windows in-process credential implementation, build integration, synthetic native integration evidence, updated security facts and precise remaining production gates.

## Work in progress evidence
The Windows Node-API module compiled with Node 22.23.2, node-gyp 11.5.0 and
Visual Studio 2022. A synthetic test used a separate TestAddon namespace and
proved create, read, duplicate rejection and exact-match cleanup. An overlong
native reference initially passed truncated input; the failing regression was
fixed by checking the full UTF-8 length before copying. The real module and
main-process wrapper also ran together under Electron's Node runtime using a
synthetic target. No production credentials or real Codex were used.

Independent review found that the first build did not package or load the
production addon. A deterministic Windows native build and fixed bundled path
are being added; their final end-to-end proof is pending. Neither this path nor
any checksum establishes a trusted installation. Node-gyp 11.5.0 is pinned;
the first lockfile calculation used npm 12.2.0 and was repeated with npm
10.7.0, producing the identical SHA-256. A dependency installation that
started resolving the whole tree without the lock was stopped; the lock hash
was unchanged. Remaining tests, provenance and production composition are
not complete and no merge readiness is claimed.

The main Windows desktop build now compiles and copies the production addon
to its fixed dist path; the bundled loader and both Node and Electron Node
runtimes exercised that artifact without reading or writing production
credentials. The native test build separately performed create/read/duplicate
and exact cleanup against random TestAddon targets. An independent reviewer
flagged a proposed random read in the production namespace; the test was
corrected before it ran to use only invalid-input rejection there.
Mirror and official-registry installation attempts encountered ECONNRESET;
the same node-gyp 11.5.0 already bundled with local Node was used as a
version-checked fallback. The fallback does not establish package provenance.
An initial lint check found an undeclared CommonJS global and was corrected;
final lint and full verification must be rerun.

The built and dist copies of wincred_native.node both had SHA-256
`05e76ae126c707d99c1416e920c51a0d7631a902ea0047c0e504abdc7344bb7b`.
The explicit npm test created and removed only
`SuperAssistant/TestAddon/pkey-419d135de66c7cfe0c78e8c4c7c9e5555e05b4820f2a95153de5a1540895b0e6`.
The built artifact hash proves only this build's byte equality, not signing
or trusted installation. Lint and typecheck passed after the noted fixes.

After adding the loader, the complete Windows build passed. The full unit run
reported 1165 passed and 9 allowlisted skips across 185 files; one additional
input-boundary assertion was added during that run and passed separately.
Contract tests passed 50 without skips; Electron functional tests passed 2
and browser tests passed 9. The shared Electron database SHA-256 was unchanged.
The current Windows Actions workflow also runs the synthetic addon test after
build; this workflow change has not yet run remotely. Security review found no
confirmed credential or N-API lifetime Critical issue; the identified
production-namespace test violation was corrected before that test ran.
The review also noted that rare Node-API allocation or shutdown failures can
leave the underlying promise unresolved; the existing coordinator times out
and preserves uncertainty, but that low-resource edge is not proven.

Candidate commit `8f890396cc0f7abe2e345d22e23dceea713b75cb` passed
GitHub documentation run 45339974044 and application run 45339974027.
The application run passed Windows build, isolated native credential test,
desktop functional tests, deterministic tests and PostgreSQL 16 compatibility.
This closes only TASK-845's scoped implementation; installer provenance,
production routing and full H1 acceptance remain open.
