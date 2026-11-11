# TASK-774 — Opt-in emergency quiet-hours bypass

Status: local verification only; new candidate CI pending. This is not
full notification integration or H3 acceptance.

The previously implemented policy unconditionally allowed authorized
Emergency notifications during quiet hours, contrary to the approved G6
requirement. The RED test reproduced delivery with no opt-in. The policy
now requires `emergencyBypassAllowed === true` for this bypass, emits the
existing audit marker on the authorized bypass, and otherwise suppresses
the notification. An enabled bypass never overrides authorization denial.
The tests cover missing, false and non-boolean values, explicit true and
authorization denial.

On Windows, targeted policy and outbox tests passed 13/13; targeted lint
and team typecheck passed. Production build, full lint and typecheck passed;
full unit suite passed 487 with six PostgreSQL-dependent skips across 152
files, and contracts passed 49 across eight files. No notification was sent.

The pre-report ordered governance run scanned 310 Markdown files, passed
Task Packs, traceability, five schemas, anchored runtime Exit 0 and 34
Python tests. Re-run after this report. Previous candidate `f421d04` passed
[application CI](https://github.com/ziyange/SuperAssistant/actions/runs/42947625748)
and [documentation CI](https://github.com/ziyange/SuperAssistant/actions/runs/42947625767);
this change requires new candidate CI.

The boolean must ultimately come from trusted scoped configuration. The
audit marker alone is not a persisted audit event. Preferences, worker,
channel idempotency, aggregation, click reauthorization and end-to-end
notification delivery remain open; the separate WIP is not integrated.
