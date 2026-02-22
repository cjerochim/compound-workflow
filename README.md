# Compound Workflow (.agents)

This is a portable, command-first workflow for:

- clarifying work (brainstorm)
- producing execution-ready plans (plan)
- executing via a persistent queue (work + file-based todos)
- validating quality (review)
- capturing durable learnings (compound)
- measuring and improving the system over time (metrics + assess)

This repository is a template. Runtime assets live under `src/.agents/` and `src/AGENTS.md` so you can copy them into any codebase.

## Quick Start (Copy Into Any Repo)

From this repo root:

```bash
# Copy workflows into another repository
cp -R src/.agents /path/to/your/repo/.agents
cp src/AGENTS.md /path/to/your/repo/AGENTS.md
```

In the target repo, create these directories as needed:

```text
docs/brainstorms/
docs/plans/
docs/solutions/
docs/metrics/daily/
docs/metrics/weekly/
docs/metrics/monthly/
todos/
```

Optional: configure repo defaults in `AGENTS.md` (see "Repo Config Block").

If you prefer interactive onboarding, run `/setup` after copying to populate the Repo Config Block.

## Background and Purpose

Most delivery failures come from:

- unclear intent (building the wrong thing)
- weak verification (bugs/regressions)
- lost context (fixing the same class of issue repeatedly)

This workflow makes those failure modes explicit:

- `/plan` selects fidelity + confidence (how much planning depth you need)
- `/work` executes from a persistent queue (`todos/`) and keeps the plan accurate
- `/review` produces structured findings without mixing in implementation
- `/compound` turns solved problems into searchable solution docs
- `/metrics` logs + assesses the session so the system improves

## How To Use This (Step-by-Step)

0) One-time repo setup (recommended)

- Run `/setup` to configure repo defaults in `AGENTS.md`:
  - default branch
  - dev server URL (if applicable)
  - test/lint/format commands
  - issue tracker

1) Clarify what you are building

- Run `/brainstorm <topic>` when requirements are unclear.
- Output: `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`

2) Create an implementation plan

- Run `/plan <description or brainstorm path>`.
- `/plan` must declare:
  - `fidelity`: low|medium|high
  - `confidence`: high|medium|low
- Output: `docs/plans/YYYY-MM-DD-<type>-<slug>-plan.md`

3) Execute the plan (no auto-ship)

- Run `/work <plan-path>`.
- `/work`:
  - generates persistent todos under `todos/`
  - executes `*-ready-*.md` items
  - updates the plan checkboxes/sections as work completes
  - runs tests based on the risk tier
- Output artifacts:
  - `todos/{id}-{status}-{priority}-{slug}.md` (work log + acceptance criteria)

4) Triage new work (when it appears)

- If `/work` creates `pending` todos, run `/triage`.
- `/triage` approves work by promoting `pending -> ready`, setting priority/dependencies.

5) Validate quality

- Run `/review current` (or `/review <PR|branch|doc>`).
- Output: structured findings with evidence + recommendation:
  - pass | pass-with-notes | fail

6) Capture learnings (when it mattered)

- Run `/compound` for non-trivial fixes or repeatable patterns.
- Output: `docs/solutions/<category>/YYYY-MM-DD-<module-slug>-<symptom-slug>.md`

7) Log and improve the process

- Run `/metrics <plan|todo|pr|solution|label>` after a meaningful session.
  - logs + assesses the session in one step
  - can create follow-up improvement todos
- Run `/assess weekly 7` or `/assess monthly 30` to review aggregate performance.

## Canonical Workflow

1. `/brainstorm` -> clarify WHAT to build
2. `/plan` -> define HOW to build it (includes fidelity + confidence)
3. `/work <plan-path>` -> execute via file-based todos (no auto-ship)
4. `/review <target>` -> structured findings (no fixes by default)
5. `/compound` -> capture a durable solution doc

Supporting commands:

- `/triage` -> approve and prioritize pending todo files
- `/test-browser` -> optional browser validation using `agent-browser` CLI

Continuous improvement:

- `/metrics` -> log + assess a session in one step
- `/assess weekly 7` / `/assess monthly 30` -> aggregate performance and propose improvements

## Commands

Core:

- `/brainstorm [topic]`
- `/plan [description|brainstorm-path]`
- `/work <docs/plans/...-plan.md>`
- `/review [PR|URL|branch|current|doc-path]`
- `/compound [context]`

Queue management:

- `/triage [pending|todo-path|issue-id]`

QA utilities:

- `/test-browser [PR|branch|current]`

Metrics:

- `/metrics [plan|todo|pr|solution|label]`
- `/assess [daily|weekly|monthly] [count]`

Onboarding:

- `/setup` (writes/updates the Repo Config Block in `AGENTS.md`)

Use the canonical command names (`/plan`, `/work`, `/review`, etc.). This template does not ship aliases.

## Artifacts

- Brainstorms: `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`
- Plans: `docs/plans/YYYY-MM-DD-<type>-<slug>-plan.md`
- Todos: `todos/{issue_id}-{status}-{priority}-{description}.md`
- Solutions: `docs/solutions/<category>/YYYY-MM-DD-<module-slug>-<symptom-slug>.md`
- Metrics:
  - Daily: `docs/metrics/daily/YYYY-MM-DD.md`
  - Weekly: `docs/metrics/weekly/YYYY-WW.md`
  - Monthly: `docs/metrics/monthly/YYYY-MM.md`

## Repo Configuration (AGENTS.md)

Commands look for a "Repo Config Block" YAML in `AGENTS.md` to resolve defaults deterministically.

Common keys:

- `default_branch`
- `dev_server_url`
- `test_command`
- `test_fast_command`
- `lint_command`
- `format_command`
- `project_tracker`

Example:

```yaml
default_branch: main
dev_server_url: http://localhost:3000
test_command: npm test
test_fast_command: npm test -- --watch=false
lint_command: npm run lint
format_command: npm run format
project_tracker: github
```

## Notes on Shipping

`/work` and `/review` are intentionally "no auto-ship" by default:

- no commits
- no pushes
- no PR creation

Add a separate shipping command later if you want to automate that step.

## agent-browser CLI

`/test-browser` uses the `agent-browser` CLI for browser automation and snapshots.

Install (if needed):

```bash
npm install -g agent-browser
agent-browser install
```

## Source of Truth

- Workflows: `src/.agents/`
- Principles + optional repo config: `src/AGENTS.md`
