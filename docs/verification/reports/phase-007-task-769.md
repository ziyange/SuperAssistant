# TASK-769 — Cross-platform CI corrections

Status: IN PROGRESS; candidate-SHA CI must pass before acceptance.

The first candidate `70f8d4b396de2da7293608cce5105846d54ba1b6` failed [documentation CI](https://github.com/ziyange/SuperAssistant/actions/runs/42845936870): a runtime verifier fixture used a lowercase task path although the actual pack is uppercase; Linux correctly treated them as distinct. The fixture now uses the exact filename and retains every negative assertion.

[Application CI](https://github.com/ziyange/SuperAssistant/actions/runs/42845937015) passed the PostgreSQL 16 job but failed Windows dependency installation: node-gyp could not discover the newer Visual Studio 18 on `windows-latest`. The Windows runner is pinned to `windows-2022` and the configured Python explicitly selected; this is a proposed correction, not yet a CI PASS.

Local Windows governance before this report: 300 Markdown files scanned, all packs checked, traceability and five schemas passed, task-anchored runtime returned 0 and 34 Python tests passed. The final candidate must rerun these checks and both remote workflows. No real Codex or Electron sandbox acceptance is claimed. A separate clean installation using npm 12 blocked native package scripts and is not valid evidence; use the locked Node/npm requirements for the next attempt.
