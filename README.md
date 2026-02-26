# Compound Workflow (.agents)

Compound Workflow is a portable, command-first workflow for clarifying intent, planning, executing via a persistent todo queue, validating quality, and capturing durable learnings. It reduces delivery failures from **unclear intent**, **weak verification**, and **lost context**. Commands are the public API; skills and agents are composable internals. Use it when you want structured clarify → plan → execute → verify → capture cycles without ad-hoc tooling.

This repository is a template. Runtime assets live under `src/.agents/` and `src/AGENTS.md` so you can copy or sync them into any codebase.

## Quick Start (recommended: clone inside host repo)

If you clone compound-workflow **inside** your repo (e.g. `vendor/compound-workflow` or `compound-workflow/`):

1. Open the clone in Cursor (or set `COMPOUND_SYNC_TARGET` to your host repo root).
2. Run **`/sync`** — copies `src/.agents` into the host (no `.agents/.agents` nesting), merges or copies `AGENTS.md` (preserves host Repo Config Block), syncs the host’s `opencode.json`, then runs a post-sync self-check.
   - Preview: **`/sync --dry-run`** (prints resolved target + planned writes)
3. In the host repo, run **`/setup`** once — configures Repo Config Block (default_branch, test/lint/format commands, dev_server_url, project_tracker, worktree options) and syncs OpenCode config.
   - Preview: **`/setup --dry-run`**

**Terminal-only (copy only; does not update `opencode.json`):**

```bash
./scripts/sync-into-repo.sh --dry-run        # preview
./scripts/sync-into-repo.sh                  # sync into parent directory
./scripts/sync-into-repo.sh /path/to/repo    # sync into an explicit target
```

### Copy into any repo (no clone)

From this repo root:

```bash
cp -R src/.agents /path/to/your/repo/.agents
cp src/AGENTS.md /path/to/your/repo/AGENTS.md
```

In the target repo, create `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/metrics/daily/`, `docs/metrics/weekly/`, `docs/metrics/monthly/`, `todos/` as needed. Run `/setup` in the host to configure the Repo Config Block.

## Canonical workflow (suggested order)

1. **`/workflow:brainstorm [topic]`** — Clarify WHAT to build (dialogue only; no code).
2. **`/workflow:plan [description or brainstorm path]`** — Define HOW with fidelity + confidence; output a plan file.
3. **`/workflow:work <plan-path>`** — Execute via file-based todos; tests by risk tier; no auto-ship (no commit/push/PR by default).
4. **`/workflow:triage`** — Convert pending todos into a ready queue (priority, dependencies).
5. **`/workflow:review [PR|branch|current]`** — Structured findings with evidence; no fixes by default.
6. **`/workflow:compound [context]`** — Capture one solution doc in `docs/solutions/` for future reference.
7. **`/metrics`** + **`/assess weekly 7`** (or monthly) — Log session and review aggregate performance.

**Optional QA:** **`/test-browser [PR|branch|current]`** — Browser validation on affected pages using the **agent-browser CLI only** (not MCP browser tooling). Requires `npm install -g agent-browser` and `agent-browser install`.

## Command index (high-level)

**Onboarding**

- **`/sync`** — Copy `.agents` and `AGENTS.md` from this clone into host repo; merge host AGENTS.md; update host `opencode.json`.
- **`/setup`** — Configure Repo Config Block in `AGENTS.md` and sync OpenCode config (commands/agents). Run once after copy or sync.

**Core workflow**

- **`/workflow:brainstorm [topic]`** — Explore requirements and approaches; output `docs/brainstorms/...`. No code.
- **`/workflow:plan [description or brainstorm path]`** — Produce execution-ready plan with fidelity/confidence; output `docs/plans/...`. No code.
- **`/workflow:work <plan-path>`** — Execute plan via `todos/` (ready → complete); risk-based testing; no auto-ship.
- **`/workflow:triage [pending|todo-path]`** — Approve/defer pending todos; set priority and dependencies so work can continue.
- **`/workflow:review [PR|branch|current]`** — Evidence-based code review; pass | pass-with-notes | fail; no code changes by default.
- **`/workflow:compound [context]`** — Document one solved problem into `docs/solutions/<category>/...` (one file; optional post-capture menu).

**QA**

- **`/test-browser [PR|branch|current]`** — Run browser checks on affected routes using **agent-browser CLI only** (see [src/.agents/commands/test-browser.md](src/.agents/commands/test-browser.md)).

**Improvement loop**

- **`/metrics [plan|todo|pr|solution|label]`** — Log one session to `docs/metrics/daily/` and assess (what failed, what to change).
- **`/assess [daily|weekly|monthly] [count]`** — Review aggregate metrics; propose improvements; optional weekly/monthly summary files.

**Experimental**

- **`/workflow:review-v2 [PR|branch|current]`** — Interactive snippet-by-snippet review with consolidated comments; **output-only** (no publishing to GitHub).

Use canonical names (`/workflow:plan`, `/workflow:work`, etc.). This template does not ship aliases.
OpenCode registration preserves namespaces by using command frontmatter `invocation` (e.g. `workflow:brainstorm`).

## Artifacts

- **Brainstorms:** `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`
- **Plans:** `docs/plans/YYYY-MM-DD-<type>-<slug>-plan.md`
- **Todos:** `todos/{id}-{status}-{priority}-{slug}.md`
- **Solutions:** `docs/solutions/<category>/YYYY-MM-DD-<module-slug>-<symptom-slug>.md`
- **Metrics:** `docs/metrics/daily/YYYY-MM-DD.md`, `docs/metrics/weekly/YYYY-WW.md`, `docs/metrics/monthly/YYYY-MM.md`

## How it works (skills and agents)

Commands are the public API. **Skills** and **agents** are invoked by commands; you don’t call them directly.

**Workflow skills (this template):** `brainstorming`, `file-todos`, `compound-docs`, `document-review`, `technical-review`, `git-worktree`, `agent-browser`, `process-metrics`.

**Guardrail standards (reference):** `data-foundations`, `pii-protection-prisma`, `financial-workflow-integrity`, `audit-traceability` — applied when the work touches multi-tenant data, PII, money, or audit.

**Agents (this template):** `repo-research-analyst`, `learnings-researcher`, `git-history-analyzer`, `best-practices-researcher`, `framework-docs-researcher`, `spec-flow-analyzer`, `lint`, `bug-reproduction-validator`, `agent-native-reviewer`. Used by plan, review, and work for research, lint, and validation.

Full “when to use what” and reference-standards policy: [src/AGENTS.md](src/AGENTS.md).

## Guardrails

- **No auto-ship:** `/workflow:work` and `/workflow:review` do not commit, push, or create PRs by default.
- **Brainstorm and plan do not write code.** Output is documents only.
- Add a separate shipping command if you want automated commit/PR and quality gates.

## Repo configuration (AGENTS.md)

Commands read a **Repo Config Block** YAML in `AGENTS.md` for: `default_branch`, `dev_server_url`, `test_command`, `test_fast_command`, `lint_command`, `format_command`, `project_tracker`, and optional `worktree_dir`, `worktree_copy_files`, `worktree_install_command`, `worktree_bootstrap_notes`. Run `/setup` to populate it.

## agent-browser CLI

`/test-browser` uses the **agent-browser** CLI only (no MCP browser tools). Install: `npm install -g agent-browser` then `agent-browser install`.

## Source of truth

- **Workflows and commands:** [src/.agents/](src/.agents/)
- **Principles and skill index:** [src/AGENTS.md](src/AGENTS.md)
