# Disposable Codex smoke fixture

This directory is the sole working root for the opt-in `npm run smoke:codex`
check. The command uses Codex `read-only` sandboxing and an ephemeral session.
The prompt permits neither tool calls nor file changes and must return exactly
`SMOKE_OK`. It is intentionally not a project workspace and contains no secret
or production material.
