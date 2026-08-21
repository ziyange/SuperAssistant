# PHASE-002 TASK-207 local verification report

Date: 2026-08-21

Evidence level: local
Task status: implementation and local gates passed; not yet committed or
archived.

## Root cause and fix

The unit project's `*.test.ts` glob included `*.contract.test.ts`, while the
root `test:unit` and `test:contract` scripts did not select a named Vitest
project. Contract tests therefore ran twice and overloaded concurrent Windows
fixture processes. The unit project now excludes contract paths and each root
script explicitly selects its corresponding project.

## Commands and results

| Command | Result |
|---|---|
| `npm run test:unit -- --reporter=dot` | PASS — 40 files, 91 tests; no contract project |
| `npm run test:contract -- --reporter=dot` | PASS — 4 files, 29 tests; contract project only |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| governance checks | PASS |
| `verify_runtime_trace.py --mode build ...TASK-207...` | PASS — exit 0, `SUCCESS` |
