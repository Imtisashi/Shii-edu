# AUTOPILOT_SETUP.md

## Recommended setup on Windows

1. Open the native Codex app and add the Git repository as a project.
2. Put `AGENTS.md` at the repository root.
3. Put the automation prompt in `AUTOPILOT_AUTOMATION_PROMPT.md`.
4. Commit these instruction files.
5. First run the prompt manually in a **new worktree**.
6. Review the first result, diff, checks, and preview.
7. Only after the manual run behaves correctly, create a Codex app automation:
   - project: this repository;
   - execution: dedicated worktree;
   - prompt: contents of `AUTOPILOT_AUTOMATION_PROMPT.md`;
   - cadence: once daily at most initially;
   - reasoning effort: low or the lowest option that still passes your checks;
   - sandbox: workspace/project write, not unrestricted machine access.
8. Keep the computer powered on, the Codex app running, and the project available at the scheduled time.
9. Review early automation runs before allowing any repository auto-merge policy.
10. Let GitHub/Vercel perform normal CI and preview deployment. Do not give Codex production secrets it does not require.

## Optional project subagent limits

Save this as `.codex/config.toml`:

```toml
[agents]
max_threads = 2
max_depth = 1
job_max_runtime_seconds = 600

[windows]
sandbox = "elevated"
```

If elevated Windows sandbox setup is unavailable, remove the `[windows]` block and use the safest mode supported by the machine. Do not switch to unrestricted access just to make automation work.

## Suggested cadence

Start with one run every 24 hours. More frequent runs cost more and are likely to produce lower-value cosmetic churn. Increase cadence only when there is a real issue queue, telemetry, failing CI, or verified user feedback to drive selection.

## Why only two agents?

Codex subagents each perform their own model and tool work, so they consume more tokens than a comparable single-agent run. The coordinator-plus-one-explorer design gains context isolation when needed without paying for a large agent swarm.

## Production release policy

Recommended:

`automation branch → tests → preview deployment → automated Codex/GitHub review → human merge`

A fully automatic production merge is only sensible after stable tests, branch protection, preview verification, rollback, and a documented repository policy exist.
