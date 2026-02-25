# Compound Workflow (.agents)

Compound Workflow is a portable, command-first workflow for clarifying intent, planning, executing via a persistent todo queue, validating quality, and capturing durable learnings. It reduces delivery failures from unclear intent, weak verification, and lost context. Use it when you want structured clarify → plan → execute → verify → capture cycles without ad-hoc tooling.

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

### Sync from a clone

If you clone compound-workflow **inside** your repo (e.g. `vendor/compound-workflow` or `compound-workflow/`):

1. Open the clone in Cursor (or set `COMPOUND_SYNC_TARGET` to your repo root).
2. Run **`/sync`** to copy `src/.agents` into the host repo and update the host's `opencode.json`. For `AGENTS.md`: if the host doesn't have one, it's copied; if the host already has `AGENTS.md`, the AI merges the template with the host file (preserving Repo Config Block and repo-specific content).
3. In the host repo, run `/setup` once to configure repo defaults (default_branch, test_command, etc.) if you haven't already.

From the terminal (copy only; does not update `opencode.json`):

```bash
./scripts/sync-into-repo.sh           # sync into parent directory
./scripts/sync-into-repo.sh /path/to/repo
```

## What Problem This Solves

Most delivery failures come from:

- **Unclear intent** — building the wrong thing
- **Weak verification** — bugs and regressions
- **Lost context** — fixing the same class of issue repeatedly

This workflow makes those failure modes explicit: plan selects fidelity and confidence, work executes from a persistent queue and keeps the plan accurate, review produces structured findings without mixing in implementation, compound turns solved problems into searchable solution docs, and metrics/assess improve the system over time.

## When to Use Which Command

| Situation | Command | Why |
| --------- | ------- | --- |
| Requirements vague or exploring options | `/workflow:brainstorm <topic>` | Clarify WHAT to build before planning |
| Clear enough to plan | `/workflow:plan <description or brainstorm path>` | Define HOW with fidelity + confidence |
| Plan ready, need to implement | `/workflow:work <plan-path>` | Execute via file-based todos (no auto-ship) |
| Work or review created new pending todos | `/workflow:triage` | Approve and prioritize so work can continue |
| Changes done, need validation | `/workflow:review current` (or PR/branch/doc) | Structured findings; no fixes by default |
| Non-trivial fix or repeatable pattern | `/workflow:compound [context]` | Capture one solution doc for future reference |
| Meaningful session complete | `/metrics` (plan, todo, pr, solution, or label) | Log + assess in one step |
| Review aggregate performance | `/assess weekly 7` or `/assess monthly 30` | Trends and improvement suggestions |

## Canonical Workflow

1. `/workflow:brainstorm` → clarify WHAT to build
2. `/workflow:plan` → define HOW to build it (includes fidelity + confidence)
3. `/workflow:work <plan-path>` → execute via file-based todos (no auto-ship)
4. `/workflow:review <target>` → structured findings (no fixes by default)
5. `/workflow:compound` → capture a durable solution doc

Supporting commands:

- `/workflow:triage` → approve and prioritize pending todo files
- `/test-browser` → optional browser validation using `agent-browser` CLI

Continuous improvement:

- `/metrics` → log + assess a session in one step
- `/assess weekly 7` / `/assess monthly 30` → aggregate performance and propose improvements

## How To Use This (Step-by-Step)

**0) One-time repo setup (recommended)**

- Run `/setup` to configure repo defaults in `AGENTS.md`: default branch, dev server URL (if applicable), test/lint/format commands, issue tracker.
- **When:** After copying `.agents` and `AGENTS.md` into a repo.

**1) Clarify what you are building**

- Run `/workflow:brainstorm <topic>` when requirements are unclear.
- **Intent:** Explore requirements and approaches before planning.
- Output: `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`

**2) Create an implementation plan**

- Run `/workflow:plan <description or brainstorm path>`.
- **Intent:** Produce an execution-ready plan with explicit fidelity and confidence.
- Plan must declare: `fidelity` (low|medium|high), `confidence` (high|medium|low).
- Output: `docs/plans/YYYY-MM-DD-<type>-<slug>-plan.md`

**3) Execute the plan (no auto-ship)**

- Run `/workflow:work <plan-path>`.
- **Intent:** Execute plan items via persistent todos; run tests by risk tier; do not commit/push/PR unless requested.
- Generates todos under `todos/`, executes `*-ready-*.md` items, updates plan as work completes.
- Output: `todos/{id}-{status}-{priority}-{slug}.md`

**4) Triage new work (when it appears)**

- When `/workflow:work` or `/workflow:review` creates `pending` todos, run `/workflow:triage`.
- **Intent:** Turn pending items into an executable queue (priority, dependencies, recommended action).
- Triage promotes `pending` → `ready` so `/workflow:work` can continue.

**5) Validate quality**

- Run `/workflow:review current` (or `/workflow:review <PR|branch|doc>`).
- **Intent:** Structured findings with evidence + recommendation (pass | pass-with-notes | fail); no code changes by default.

**6) Capture learnings (when it mattered)**

- Run `/workflow:compound` for non-trivial fixes or repeatable patterns.
- **Intent:** Write one solution doc so the next occurrence takes minutes.
- Output: `docs/solutions/<category>/YYYY-MM-DD-<module-slug>-<symptom-slug>.md`

**7) Log and improve the process**

- Run `/metrics <plan|todo|pr|solution|label>` after a meaningful session (logs + assesses in one step; can create follow-up improvement todos).
- Run `/assess weekly 7` or `/assess monthly 30` to review aggregate performance.

## Command Reference

Each command: **intent**, **when to use**, **example**.

### Workflow (core)

| Command | Intent | When to use | Example |
| ------- | ------ | ----------- | ------- |
| `/workflow:brainstorm [topic]` | Explore requirements and approaches through dialogue; no code | Requirements unclear or you're exploring options | "We need a payment flow but scope is fuzzy" → brainstorm payment flow |
| `/workflow:plan [description or brainstorm-path]` | Produce a structured plan with fidelity + confidence | You know what to build and want an execution-ready plan | After brainstorm or from a bug report → plan the fix |
| `/workflow:work <plan-path>` | Execute plan via file-based todos; implementation + verification; no auto-ship | You have a plan and want to implement it | Plan file ready → work through todos with tests |
| `/workflow:review [PR\|branch\|current\|doc]` | Structured, evidence-based review; no fixes by default | You have changes to validate before ship | Before PR or after work → review current branch |
| `/workflow:compound [context]` | Document one solved problem into `docs/solutions/` | Non-trivial fix or repeatable pattern worth reusing | Fixed a tricky auth bug → compound the solution |
| `/workflow:triage [pending or todo-path or issue-id]` | Turn pending todos into ready queue (priority, dependencies) | Work or review created new pending todos | New findings from review → triage then continue work |

### QA

| Command | Intent | When to use | Example |
| ------- | ------ | ----------- | ------- |
| `/test-browser [PR\|branch\|current]` | Run browser tests on affected pages | You need UI/flow validation | After front-end work → test-browser current |

### Metrics

| Command | Intent | When to use | Example |
| ------- | ------ | ----------- | ------- |
| `/metrics [plan,todo,pr,solution,label]` | Log + assess session for process improvement | After a meaningful workflow run | Finished a plan and work run → metrics plan |
| `/assess [daily,weekly,monthly] [count]` | Review aggregate metrics and propose improvements | Periodic process review | End of week → assess weekly 7 |

### Onboarding

| Command | Intent | When to use | Example |
| ------- | ------ | ----------- | ------- |
| `/setup` | Configure repo defaults in `AGENTS.md` and sync OpenCode config | First time in a repo after copying `.agents` | New repo → run setup once |

Use the canonical command names (`/workflow:plan`, `/workflow:work`, `/workflow:review`, etc.). This template does not ship aliases.

## When to Use Agents and Skills

Commands invoke **skills** (e.g. `file-todos`, `compound-docs`, `technical-review`) and **agents** (e.g. `git-history-analyzer`, `learnings-researcher`) internally. You don’t call them directly; the workflow command selects them.

- **Planning a high-risk change:** `/workflow:plan` may use `git-history-analyzer` and `best-practices-researcher`.
- **Reviewing a PR:** `/workflow:review` runs `learnings-researcher`, `lint`, and conditionally `bug-reproduction-validator` or `framework-docs-researcher`.
- **Capturing a solution:** `/workflow:compound` uses the `compound-docs` skill for structure and templates.

For the full list and "when to use what" (workflow vs reference-standard skills), see [src/AGENTS.md](src/AGENTS.md) — Skill Index (When to Use What) and Reference Standards Policy.

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

`/workflow:work` and `/workflow:review` are intentionally "no auto-ship" by default:

- no commits
- no pushes
- no PR creation

Add a separate shipping command later if you want to automate that step. A future **shipping command** would define the steps (e.g. commit policy, PR creation, checks) and final quality gates (e.g. review pass, tests, lint) before ship.

## Todo

- Evaluate the verification step during work cycle — needs tightening
- Review overall workflows — require further improvement for conciseness
- Consider incremental commits per task item within work command (verify commit)
- Review the shippit command workflow: what it would look like and what are the final quality gates
- Tighten process for additional findings, additional todos, and triage that come from a review or work command

## Future skills

- Introduce a security check in the process (e.g. part of review step, risk-level based)
- Ensure all Docker-related and other logging items are scoped within the project
- Introduce the skill-creator to refine and sharpen skills

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
