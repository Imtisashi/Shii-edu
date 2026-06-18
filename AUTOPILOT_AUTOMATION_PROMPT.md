# Codex Automation Prompt — One Safe Improvement Per Run

Use the repository's `AGENTS.md` as the controlling instruction.

Run exactly one LEAN AUTOPILOT cycle in a dedicated Git worktree.

Goal: find and complete the single highest-value, lowest-risk verified improvement to Shii‑Edu. Prefer security, tenant isolation, broken flows, accessibility, mobile UX, missing states, performance, then visual polish.

Token discipline:

- inspect narrowly with targeted search;
- do not read the whole repository;
- do not create more than three candidate improvements;
- modify at most six files unless strictly required;
- add at most one dependency;
- make at most one implementation attempt plus one repair;
- stop after this cycle;
- keep the final report below 250 words.

Subagents:

- default to a single coordinator;
- spawn at most one subagent only for a genuinely independent read-heavy task;
- prefer the built-in `explorer`;
- give it a narrow read-only scope and require a summary under 150 words;
- do not use a subagent for a simple edit;
- do not let any subagent spawn another agent;
- never allow parallel edits to overlapping files.

Truth:

- verify before claiming;
- mark unknown facts `UNKNOWN`;
- never invent files, APIs, schema, roles, environment variables, metrics, user feedback, or successful deployments;
- use current official documentation only when external syntax must be verified.

UI:

- reuse existing components first;
- when needed, verify and use exact current official shadcn/ui components;
- use only free official Aceternity components and only when they materially improve the experience;
- preserve app branding and accessibility;
- use restrained transitions/animations and respect reduced motion;
- do not copy proprietary sites, paid templates, demo copy, or demo branding.

Verification:

- establish a baseline;
- define a measurable acceptance criterion;
- implement the smallest coherent diff;
- run targeted tests and applicable typecheck, lint, production build, browser, responsive, keyboard, reduced-motion, console/network, and diff checks;
- separate pre-existing failures from regressions;
- attempt one focused repair;
- revert only this run's changes if verification still fails.

Delivery:

- commit only if verified;
- push an isolated branch and create/verify a preview or PR only through the repository's existing workflow;
- never bypass protections or mutate production data;
- do not directly release to production unless an existing documented auto-release policy authorizes it and every required gate passes;
- append at most 12 lines to `docs/IMPROVEMENT_LOG.md`;
- terminate after reporting the result in the exact `AGENTS.md` format.

If there is no meaningful high-confidence improvement, do nothing and report `NO_SAFE_IMPROVEMENT`.
