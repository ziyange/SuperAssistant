# PHASE-006 TASK-610 verification report

- Status: PASS — constrained compatibility probe; DSH remains `DISABLED`.
- Authorized pack: `docs/delivery/tasks/TASK-610.md`
- Decision: [ADR-007](../../decisions/ADR-007-external-dsh-adapter.md)
- Date: 2026-08-23

## Runtime evidence

- Observed external DSH Git commit: `141eb6fef83422698aef7a981029e843e8161534`.
- Observed public protocol package: `0.1.0-rc.8`.
- The probe reads only these identities from `E:\Programs\deepseek-harness`.
- Fixture `initialize` reported the expected version. Commit mismatch, protocol
  mismatch, malformed frame, initialize timeout, and termination paths are
  deterministic unit-test cases.

## SAI and capability evidence

`describe` and `health` have public-profile/fixture evidence. `start`,
`resume`, and `events` are explicitly deferred; `cancel` has fixture
shutdown/EOF/terminate/kill evidence; `status` and `result` remain
platform-journal derived. Shell, filesystem, network, and plugin declarations
are all `BROKER_REQUIRED`. No capability was invoked.

## Commands and results

- `npx vitest run --project unit packages/dsh-adapter/tests/dsh-probe.test.ts`: PASS, 4 tests.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS, including `@super-assistant/dsh-adapter`.
- `npm run test:unit`: PASS, including 4 DSH probe tests.
- `npm run test:contract`: PASS, 29 tests.
- `npm run test:e2e`: PASS, 7 tests.
- `npm run build`: PASS.
- Documentation links, traceability, schemas, runtime trace (Exit 0), Python
  governance tests, and `git diff --check`: PASS.

## Non-effect declaration

No `dsh` process, provider/model call, network call, credential, plugin
installation, Shell command, or DSH filesystem capability was invoked. The
only child processes were repository-test Node JSON-RPC fixtures, which were
reaped before their cancellation observation completed.

## Conclusion

The observed public DSH profile is compatible with the constrained probe. This
does not enable DSH. Production process hosting, event normalization, the Tool
Broker, cancellation, and reconciliation require a separate exact Task Pack
and implementation gate.
