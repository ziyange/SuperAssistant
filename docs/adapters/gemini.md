# Gemini Adapter compatibility probe

Status: BLOCKED locally on 2026-08-22.

The required fixed target is `@google/gemini-cli-core` `0.55.1`. The local npm
cache recognizes that version, but it is not in this repository's locked
dependency tree and no `gemini` CLI is installed. TASK-606 forbids temporary
installation and production terminal parsing, so the Core programmatic
interface cannot be inspected or exercised for `resume`, `status`, `events`,
`result`, and reconciliation.

The future Adapter remains DISABLED. A new approved dependency/probe Pack and
an ADR or user decision are required before TASK-607 can begin; SAI is not
weakened and `--yolo` is prohibited.
