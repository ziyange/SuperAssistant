# PHASE-002 TASK-206 local verification report

Date: 2026-08-21

Evidence level: local fake App Server contract
Task status: implementation and local gates passed; not yet committed or
archived.

## Root cause and fix

Windows may emit a child `exit` before Node drains an already-buffered stdout
frame. The previous discovery transport rejected immediately, losing valid
discovery evidence. It now waits for stdout drain before reporting an empty
stream as an exit failure. Timeout, malformed frame, process error, and exit
remain distinct fail-closed outcomes.

Under the full Vitest load, fake Node App Server startup also exceeded the old
500ms test values. These were fixture-only values, not the frozen production
five-second discovery timeout. Fixture operations are bounded at five seconds,
aggregate lifecycle tests at twenty seconds, and each watchdog kills its child.

## Commands and results

| Command | Result |
|---|---|
| focused discovery + execution contract tests | PASS — 4 project/file runs, 50 tests |
| `npm run test:unit -- --reporter=dot` | PASS — 40 files, 91 tests |
| `npm run test:contract -- --reporter=dot` | PASS — 4 files, 29 tests |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| governance checks | PASS |
| `verify_runtime_trace.py --mode build ...TASK-206...` | PASS — exit 0, `SUCCESS` |
