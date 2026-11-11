# TASK-775 — Strict notification authorization values

Status: local verification only; candidate CI pending. This is not full
Team notification integration or H3 acceptance.

Three RED assertions reproduced malformed truthy authorization being
accepted: the policy would allow it, the outbox would begin and deliver,
and the deep-link resolver would disclose a target. Only literal boolean
true is now accepted at all three boundaries; malformed values deny before
starting delivery or resolving the target. Existing explicit authorization,
quiet-hours opt-in and claim-generation protections remain in place.

On Windows, targeted notification tests passed 14/14; targeted lint and
team typecheck passed. Production build, full lint and typecheck passed.
Full unit suite passed 488 with six PostgreSQL-dependent skips across 152
files. Contract tests passed 49 across eight files. No real notification
was sent and no user data was used.

The pre-report governance run scanned 312 Markdown files, passed Task Pack,
traceability and five Schema checks, returned anchored runtime Exit 0 and
passed 34 Python tests. Re-run after this report. The previous candidate
`b92917a` passed [application CI](https://github.com/ziyange/SuperAssistant/actions/runs/42949045949)
and [documentation CI](https://github.com/ziyange/SuperAssistant/actions/runs/42949045922);
new candidate CI is required for this change.

The injected authorization port still requires a real current-membership
implementation; the notification worker, settings persistence, aggregation,
delivery channels, reconciliation, durable audit and click E2E are not
established by these policy tests. The separate dirty WIP remains preserved.
