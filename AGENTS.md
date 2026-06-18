# AGENTS.md — Shii‑Edu Autonomous Improvement Protocol

## Mission

Improve this repository through small, measurable, reversible changes. Optimize for verified product value per token, not number of edits.

## Reality constraints

- Never promise zero hallucinations. Enforce **zero unverified claims** instead.
- Never claim a feature, test, build, deployment, metric, route, API, database object, environment variable, or bug exists without direct evidence.
- Never claim remaining Codex quota unless the interface exposes it.
- Automation and subagents consume tokens. Use them only when their expected benefit exceeds their cost.

## Source of truth

Use, in priority order:

1. repository code and Git history;
2. `AGENTS.md` and project documentation;
3. package manifests, schemas, migrations, tests, and configuration;
4. the running app, browser console/network output, CI logs, and deployment logs;
5. current official documentation.

Mark missing or conflicting information as `UNKNOWN`. Inspect or stop; do not guess.

## Default operating mode: LEAN AUTOPILOT

Each scheduled run may complete **one** improvement cycle.

Hard limits per run:

- one primary objective;
- one implementation attempt and one repair attempt;
- no more than six changed files unless strictly necessary;
- no more than one new dependency;
- no more than one preview deployment;
- no broad refactor;
- no unrelated cleanup;
- no direct production-data mutation;
- no production release unless the repository already has a documented, gated auto-release workflow;
- no more than two active agents total, including the coordinator.

If no meaningful, high-confidence improvement is found, make no code change and report `NO_SAFE_IMPROVEMENT`.

## Token-minimization protocol

1. Read this file once.
2. Inspect only:
   - `git status`;
   - package manifest and lockfile identity;
   - framework/deployment configuration;
   - directly relevant routes/components/tests;
   - files found through targeted search.
3. Use `rg`, `git grep`, exact symbol searches, Git diff, and narrow line ranges.
4. Never read the whole repository or produce a full repository summary.
5. Reuse existing components, utilities, design tokens, tests, and patterns.
6. Prefer one small coherent diff over several alternatives.
7. Do not generate multiple mockups or rewrites unless evaluation requires them.
8. Do not install a package when an existing dependency or CSS can solve the task.
9. Run targeted checks first. Run full release checks once after implementation.
10. Return summaries, not raw logs.
11. Do not repeat information already present in the current thread or improvement log.
12. Use subagents only under the policy below.
13. Stop if an observable quota meter is at or below 15%. If it is not visible, write `quota not observable`.
14. Keep the final report below 250 words.

## Multi-agent policy

The coordinator owns decisions, code integration, final verification, and reporting.

Use a subagent only when all conditions are true:

- the task has an independent, bounded read-heavy part;
- parallel work is likely to save more context/time than it costs;
- the subagent can return a short evidence summary;
- the subagent will not edit the same files as another agent.

Maximum:

- coordinator plus one subagent;
- nesting depth one;
- one subagent invocation per run.

Preferred delegation:

- `explorer`: locate relevant files, existing patterns, likely regressions, or official component usage;
- `worker`: run an isolated targeted test or implement a clearly separated file set only when conflict-free.

Do not use subagents for:

- simple one-file edits;
- ordinary component styling;
- repeated repository scanning;
- two agents reviewing the same question;
- parallel write-heavy work;
- brainstorming alternatives.

Every subagent prompt must state:

- exact scope;
- read-only or allowed files;
- maximum commands;
- required concise output;
- instruction not to spawn another agent.

The subagent must return only:

1. verified findings;
2. exact file paths and line ranges;
3. one recommendation;
4. uncertainty.

## Anti-hallucination gate

Before editing:

1. verify the requested behavior exists or establish the exact missing behavior;
2. search for existing implementations;
3. verify real command names from package scripts;
4. verify database/auth/tenant rules from code and migrations;
5. verify current external library syntax from official documentation when needed;
6. identify a reproducible acceptance criterion.

Never invent:

- fake content, fake analytics, fake testimonials, fake users, fake API data;
- routes, tables, columns, permissions, roles, pricing, secrets, or environment variables;
- button behavior;
- deployment success;
- performance improvement without measurement.

Every visible button must either work, be intentionally disabled with explanation, or be omitted.

## Improvement selection

Inspect only enough evidence to rank up to three candidates.

Priority order:

1. security, tenant isolation, authorization, data integrity;
2. broken user journeys and runtime failures;
3. accessibility and mobile usability;
4. confusing UX or missing states;
5. performance;
6. visual polish.

Score each candidate:

`value = user impact + confidence - effort - regression risk`

Select one positive-score candidate. State one measurable acceptance criterion.

Do not change code merely because a different style is possible.

## UI implementation rules

Preserve the app’s existing architecture and branding.

### shadcn/ui

- Inspect `components.json`, aliases, Tailwind setup, utilities, and existing components first.
- Search current official shadcn/ui documentation or registry only when the needed component is absent.
- Install only the exact component required.
- Review generated code before using it.
- Never overwrite customized components blindly.
- Reuse app design tokens and accessibility behavior.

### Aceternity UI

- Use only free components from the official Aceternity source/registry.
- Verify the exact current installation instructions on the official component page.
- Use Aceternity only where motion or presentation materially improves comprehension.
- Replace demo copy, demo assets, and demo branding with verified app content.
- Review dependencies and generated files.
- Do not copy paid templates or proprietary site designs.

### Animation

- Prefer CSS transitions for simple state changes.
- Use the project’s existing animation library before adding another.
- Use Motion only for coordinated layout, entrance, gesture, or scroll behavior with clear value.
- Respect `prefers-reduced-motion`.
- Prefer `transform` and `opacity`.
- Do not delay navigation, forms, or primary actions.
- Avoid continuous decorative animation, excessive parallax, layout shift, and mobile jank.
- No animation-only communication.

## SaaS and security rules

Shii‑Edu is multi-role and multi-tenant. Never assume permissions are interchangeable among student, teacher, parent, institute admin, and superadmin.

- UI toggles are not authorization.
- Enforce authorization server-side and through database policies where applicable.
- Preserve tenant/institute scoping.
- Never expose service-role keys or private API keys to the client.
- Do not weaken RLS, validation, authentication, audit behavior, or rate limits.
- Do not modify production schema/data without an explicit migration, rollback plan, and authorization.
- Treat subscription entitlements as server-enforced capabilities.
- Preserve loading, empty, error, disabled, success, and permission-denied states.

## One autonomous cycle

### 1. Establish a narrow baseline

Run:

- `git status`;
- exact targeted checks relevant to the candidate;
- local/browser inspection when available;
- current CI/deployment status only if connected.

Separate pre-existing failures from new regressions.

### 2. Choose one objective

Provide internally:

- evidence;
- selected objective;
- acceptance criterion;
- affected files;
- expected risk.

Do not output a long plan.

### 3. Implement minimally

- Make the smallest coherent change.
- Preserve unrelated uncommitted work.
- Do not reformat unrelated files.
- Add or update only directly relevant tests.
- Avoid placeholders, TODO-only controls, dead buttons, and mocked success.

### 4. Verify

Use only real repository commands.

Required where applicable:

- targeted test;
- typecheck;
- lint;
- production build;
- browser verification;
- mobile/tablet/desktop check;
- keyboard/focus/reduced-motion check;
- browser console/network check;
- `git diff --check`;
- final diff review.

A run passes only when the acceptance criterion is demonstrated and no new relevant failure is introduced.

If verification fails:

1. diagnose and attempt one focused repair;
2. rerun the failed check;
3. if still failing, revert only this run’s edits and report `REVERTED_AFTER_FAILED_VERIFICATION`.

### 5. Deploy safely

Use a dedicated Git worktree or automation branch.

- Commit only verified changes.
- Push the branch only when credentials and repository policy allow it.
- Create a Vercel/Git-host preview through the existing workflow.
- Check deployment logs.
- Verify the preview URL and changed flow.
- Never claim deployment without a real URL/status.
- Never force-push.
- Never bypass branch protection.
- Never deploy straight to production merely because the preview passed.

Automatic merge is allowed only when an existing documented repository policy already permits it and all required CI, review, and preview gates pass. Otherwise leave a reviewable branch/PR.

### 6. Record learning

Append a compact entry to `docs/IMPROVEMENT_LOG.md`:

- date/run ID;
- objective and evidence;
- files changed;
- checks and exact outcomes;
- preview/PR reference;
- measurable result;
- next candidate;
- unresolved risk.

Maximum 12 lines per run.

## Self-improvement definition

Self-improvement means using evidence from the previous run to select the next bounded change.

It does not mean:

- endless autonomous redesign;
- inventing user feedback;
- changing stable pages without evidence;
- adding every available library;
- repeatedly deploying failed changes;
- altering the prompt/rules to avoid safeguards;
- starting another run from inside the current run.

The scheduler starts future cycles. This run must terminate.

## Final output format

Return exactly:

### Result
One sentence.

### Evidence
- acceptance criterion: PASS / FAIL / NO_SAFE_IMPROVEMENT
- checks: concise real outcomes
- preview/PR: verified reference or `NOT CREATED`
- quota: observed percentage or `not observable`

### Changes
Maximum six file entries.

### Risk
One concise line.

### Next candidate
One sentence.

### Usage discipline
`agents used: 1` or `agents used: 2`; state why a subagent was or was not worthwhile.
