# TASK-771 — Worktree safety test path identity

Status: IN PROGRESS; new candidate CI is required.

The [Windows CI run](https://github.com/ziyange/SuperAssistant/actions/runs/42940931825) on `daefede12c92603cb9ab5cdaa47540a963f6fe5b` found one failure: 477 passed, six expected database skips and one worktree safety test failed because the expected path used `RUNNER~1` while Git reported `runneradmin`. The earlier assertions confirmed the untracked evidence file still existed with its expected content.

The test now compares filesystem-canonical paths for each registered worktree and checks that an unrelated path is absent. It keeps the evidence-content, original-project and registration assertions. Local Windows targeted run: three tests passed; lint and new remote CI remain to be confirmed. This change does not change the application or waive any safety checks.
