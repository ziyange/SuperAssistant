# TASK-732 Project registration path service evidence

Status: main-process service verified in isolation; it is not wired to IPC or the UI. Candidate: db83fb926269a66fea1bb3c1332c9b9c5e6526b9 plus uncommitted TASK-721 and TASK-727–732 changes. Windows, Node 22.19.0; verification 2026-11-04.

- Before implementation the new service test failed because the service was absent.
- The service requires an absolute path, resolves the real path, rejects a filesystem root or non-directory and requires readable access before registration. It delegates Workspace-scoped idempotency to TASK-731 and leaves undiscovered metadata null. It does not modify the selected directory or itself expose IPC.
- The real-filesystem and in-memory SQLite test passed 2/2 after allowing test junction creation: an alias returns the same Project, a separate Workspace remains isolated, missing/file/root paths leave no extra rows and the original file is unchanged.
- The first restricted-environment run failed with EPERM creating the test junction; this was an environment limitation, not a passing run. The test was rerun with local permission, without accessing a user Project.
- Desktop typecheck and focused lint passed. Full unit regression with local test permissions and two workers: 146 files passed; 313 tests passed, 6 skipped, 319 discovered; exit 0. Skipped tests are not acceptance evidence.
- Full lint, integration, native folder selection, renderer wiring, execution preflight revalidation, real Electron sandbox and M1 remain separate gates. No merge or push occurred.
