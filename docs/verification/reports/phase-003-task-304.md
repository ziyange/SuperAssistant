# PHASE-003 TASK-304 local verification report

Task status: completed locally

## Implemented evidence

- Restart recovery queries Adapter `status`, `events`, and `result`; no missing
  result can authorize redispatch.
- `audit_exports` persists an immutable Workspace/Project-scoped SHA-256
  manifest and redacted governed records.
- IPC exposes only the redacted export projection. The renderer shows degraded
  read-only diagnostics and never presents retry as safe.

## Verification

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm run test:unit -- --reporter=dot`: PASS (62 files, 128 tests).
- `npm run test:contract -- --reporter=dot`: PASS (4 files, 29 tests).
- `npm run test:e2e`: PASS (5 tests).
- Documentation links, traceability, schemas, TASK-304 pack validation, and
  governance unit tests: PASS.
- `verify_runtime_trace.py --mode build ... --next-iteration 4 --json`:
  PASS, exit `0`, no offending files.
- `git diff --check`: PASS.

## Notable correction

The approved exact allowlist was revised to include the existing migration
runner test, which must assert migration `009` and use `010` for its invalid
migration fixture. The revision is bounded to this required regression seam.
