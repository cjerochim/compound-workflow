# Agent Operating Principles

This `.agents` workspace is portable and command-first.

## Core Principles

1. Commands are the public API. Skills and agents are composable internals.
2. Core workflows stay generic. Domain-specific behavior loads only when context requires it.
3. Planning quality is explicit via fidelity selection.
4. Selection must be deterministic and visible: always state which skills/agents were selected and why.
5. Brainstorm and plan do not write code.

## Canonical Workflow

1. `/brainstorm` -> clarify what to build
2. `/plan` -> define how to build it
3. `/work` -> implement
4. `/review` -> validate quality
5. `/compound` -> capture durable learnings

Supporting command:

- `/triage` -> approve and prioritize pending todos

Continuous improvement:

- `/metrics` -> log + assess a session and suggest improvements
- `/assess` -> aggregate daily metrics (weekly/monthly) and propose improvements

Onboarding:

- `/setup` -> configure repo defaults in `AGENTS.md` (Repo Config Block)

This workspace currently implements `brainstorm`, `plan`, `work`, `review`, `compound`, and optional QA utilities.

Use the canonical command names (`/plan`, `/work`, `/review`, etc.). This template does not ship aliases.

## Planning Fidelity Model

`/plan` must always declare:

- `Fidelity selected`: `Low | Medium | High`
- `Confidence`: `High | Medium | Low`
- Why this fidelity (2-4 reasons)
- Research mode used (`local only` or `local + external`)
- Open questions (if any)

### Selection Rules

- If any high-risk trigger exists, select `High`.
- If signals are mixed or unclear, default to `Medium`.
- Otherwise select `Low`.

High-risk triggers include: security, payments, privacy, data migration/backfills, production infra/deployment, or hard rollback.

### Required Output by Fidelity

- `Low`: problem, constraints, acceptance criteria, implementation outline, verification checklist.
- `Medium`: all Low + alternatives/tradeoffs, dependency/risk table, rollout notes, observability/test notes.
- `High`: all Medium + failure modes, rollback plan, deployment gates, migration/data safety checks, expanded test matrix.

## Routing Rules

- Prefer existing project patterns before introducing new ones.
- Always run local repo + institutional learnings research first for planning.
- Run external best-practice/framework research based on fidelity and risk.
- For medium/high fidelity plans that touch existing behavior, consider `git-history-analyzer` to understand why the current code is the way it is.
- Use generic fallback behavior if domain-specific skills are unavailable.

## Repo Configuration (Optional)

To keep this `.agents` bundle portable, prefer configuring repo-specific commands and defaults in this file.

Suggested keys (examples):

- `default_branch: main`
- `dev_server_url: http://localhost:3000`
- `test_command: npm test`
- `test_fast_command: npm test -- --watch=false --runInBand`
- `lint_command: npm run lint`
- `format_command: npm run format`
- `project_tracker: github` (or `linear`)

### Repo Config Block (Optional)

If you want commands to read these values deterministically, add a small YAML block under this section:

```yaml
default_branch: main
dev_server_url: http://localhost:3000
test_command: npm test
test_fast_command: npm test -- --watch=false
lint_command: npm run lint
format_command: npm run format
project_tracker: github
```

## Directory Layout

- Commands: `.agents/commands/*.md`
- Skills: `.agents/skills/*/SKILL.md`
- Agents: `.agents/agents/**/*.md`

## Implemented Components (Current Scope)

- Commands: `brainstorm`, `plan`, `work`, `triage`, `review`, `compound`, `test-browser`, `metrics`, `assess`, `setup`
- Skills: `brainstorming`, `document-review`, `compound-docs`, `file-todos`, `agent-browser`, `git-worktree`, `process-metrics`
- Agents:
  - `repo-research-analyst`
  - `learnings-researcher`
  - `git-history-analyzer`
  - `best-practices-researcher`
  - `framework-docs-researcher`
  - `spec-flow-analyzer`
  - `lint`
  - `bug-reproduction-validator`
