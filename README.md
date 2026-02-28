# Compound Workflow (.agents)

A portable, command-first workflow: **clarify → plan → execute → verify → capture**. Commands are the public API; skills and agents are composable internals.

It reduces delivery failures from **unclear intent**, **weak verification**, and **lost context**. Use it when you want structured cycles without ad-hoc tooling.

*This template and README are continually refined during development.*

Inspired by [Compound Engineering](https://every.to/guides/compound-engineering) (Every) — the AI-native philosophy that each unit of work should compound into the next.

Runtime assets live in `src/.agents/` and `src/AGENTS.md`. Supports **Cursor**, **Claude**, and **OpenCode** via one Install action per project.

---

## Get started

**1. Add the package and run Install** (in the project where you want the workflow):

```bash
npm install compound-workflow
npx compound-workflow install
```

**2. Choose how you use it:**

- **Cursor:** If your project already has a `.cursor` directory, Install will create the correct structure: one symlink per skill under `.cursor/skills/`, plus `.cursor/agents`, `.cursor/commands`, and `.cursor/references` (each symlinked to the package). No plugin needed. Use the plugin from this repo if you need a different loading method.
- **OpenCode:** Install writes `opencode.json` and a symlink at `.agents/compound-workflow-skills`; OpenCode loads from the package. Run `/install` or `npx compound-workflow install` in the project.
- **Claude:** Add the compound-workflow plugin from this repo. In any repo, run `/install` or the CLI above.

**What Install does:** Merges `AGENTS.md` (preserves your Repo Config Block), creates standard dirs (`docs/`, `todos/`), writes `opencode.json` (for OpenCode), and—if the project has a `.cursor` directory—creates `.cursor/skills/<skill>`, `.cursor/agents`, `.cursor/commands`, and `.cursor/references` (symlinks into the package). All paths reference `node_modules/compound-workflow`; no file copying.

**CLI options:** `--dry-run` (preview), `--root /path/to/project`, `--no-config` (skip Repo Config Block reminder).

**Legacy (clone inside repo):** If you cloned this repo inside a host repo and need to copy files without npm, use `./scripts/sync-into-repo.sh` (copy only; does not update opencode.json). Prefer the npm + Install flow above.

To update to a new release, see [Updating compound-workflow](#updating-compound-workflow).

---

## Updating compound-workflow

- **Cursor (plugin):** If you load the plugin from this repo, pull latest and reload the plugin in Cursor.
- **Cursor (npm + .cursor):** Run `npm update compound-workflow`, then run **Install** again (`npx compound-workflow install`) to refresh the `.cursor/skills`, `.cursor/agents`, `.cursor/commands`, and `.cursor/references` symlinks and AGENTS.md.
- **OpenCode / npm:** Run `npm update compound-workflow` (or bump the version in `package.json` and `npm install`), then run **Install** again. This refreshes `opencode.json`, merges the latest `AGENTS.md` template, and ensures dirs exist; Repo Config Block is preserved.
- **Claude (plugin):** Update via the editor’s plugin; if from repo, pull latest and reload.

---

## Workflow at a glance

Clarify what to build → plan how (fidelity + confidence) → execute via todos → triage and review → capture learnings → log and assess.

```mermaid
flowchart LR
  A["brainstorm"] --> B["plan"] --> C["work"] --> D["triage"] --> E["review"] --> F["capture"] --> G["metrics"]
```

---

## Step-by-step: intent and commands

| Step | Intent | Command | Output / note |
|------|--------|---------|---------------|
| Clarify what to build | Dialogue only; no code | `/workflow:brainstorm [topic]` | `docs/brainstorms/` |
| Define how (fidelity + confidence) | Plan only; no code | `/workflow:plan [description or brainstorm path]` | `docs/plans/` |
| Execute | File-based todos; risk-tier testing; no auto-ship | `/workflow:work <plan-path>` | `todos/` |
| Ready the queue | Priority and dependencies for pending todos | `/workflow:triage` | — |
| Validate quality | Evidence-based review; no fixes by default | `/workflow:review [PR, branch, or current]` | pass / pass-with-notes / fail |
| Capture learnings | One solution doc for future use | `/workflow:compound [context]` | `docs/solutions/` |
| Log and improve | Session log + optional aggregate review | `/metrics` + `/assess weekly 7` (or monthly) | `docs/metrics/daily/`, weekly/monthly |

#### 1. Clarify (brainstorm)

**Intent:** Dialogue only; no code. **Command:** `/workflow:brainstorm [topic]`. **Output:** `docs/brainstorms/`.

#### 2. Define how (plan)

**Intent:** Plan only; no code; fidelity + confidence. **Command:** `/workflow:plan [description or brainstorm path]`. **Output:** `docs/plans/`.

#### 3. Execute (work)

**Intent:** File-based todos; risk-tier testing; no auto-ship. **Command:** `/workflow:work <plan-path>`. **Output:** `todos/`.

#### 4. Ready the queue (triage)

**Intent:** Priority and dependencies for pending todos. **Command:** `/workflow:triage`. **Output:** —.

#### 5. Validate quality (review)

**Intent:** Evidence-based review; no fixes by default. **Command:** `/workflow:review [PR|branch|current]`. **Output:** pass / pass-with-notes / fail.

#### 6. Capture learnings (compound)

**Intent:** One solution doc for future use. **Command:** `/workflow:compound [context]`. **Output:** `docs/solutions/`.

#### 7. Log and improve

**Intent:** Session log + optional aggregate review. **Command:** `/metrics` + `/assess weekly 7` (or monthly). **Output:** `docs/metrics/daily/`, weekly/monthly.

**Optional QA:** **`/test-browser [PR|branch|current]`** — Browser validation on affected pages via **agent-browser CLI only** (not MCP). Install: `npm install -g agent-browser` then `agent-browser install`. See [src/.agents/commands/test-browser.md](src/.agents/commands/test-browser.md).

---

## Command reference

**Onboarding:** `/install` — one action: merges AGENTS.md, creates dirs, preserves Repo Config Block; writes opencode.json (OpenCode) and, if present, symlinks into `.cursor/skills/` (Cursor). Run `npx compound-workflow install` in the project (requires `npm install compound-workflow`). Re-run after `npm update compound-workflow` to refresh config; see [Updating compound-workflow](#updating-compound-workflow).

**Core workflow:** See [Step-by-step](#step-by-step-intent-and-commands) above.

**QA:** `/test-browser [PR|branch|current]` — browser checks on affected routes (agent-browser CLI only).

**Improvement:** `/metrics [plan|todo|pr|solution|label]` — log session to `docs/metrics/daily/` and assess. `/assess [daily|weekly|monthly] [count]` — aggregate metrics and optional summary files.

**Experimental:** `/workflow:review-v2 [PR|branch|current]` — interactive snippet review; output-only (no GitHub publish).

Full detail: [src/AGENTS.md](src/AGENTS.md), [src/.agents/commands/](src/.agents/commands/).

---

## Artifacts

- **Brainstorms:** `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`
- **Plans:** `docs/plans/YYYY-MM-DD-<type>-<slug>-plan.md`
- **Todos:** `todos/{id}-{status}-{priority}-{slug}.md`
- **Solutions:** `docs/solutions/<category>/YYYY-MM-DD-<module-slug>-<symptom-slug>.md`
- **Metrics:** `docs/metrics/daily/YYYY-MM-DD.md`, `docs/metrics/weekly/YYYY-WW.md`, `docs/metrics/monthly/YYYY-MM.md`

---

## How it works (internals)

Commands are the public API. Skills and agents are invoked by commands; you don’t call them directly.

- **Workflow skills:** `brainstorming`, `file-todos`, `compound-docs`, `document-review`, `technical-review`, `git-worktree`, `agent-browser`, `process-metrics`.
- **Guardrail standards:** `data-foundations`, `pii-protection-prisma`, `financial-workflow-integrity`, `audit-traceability` — applied when work touches multi-tenant data, PII, money, or audit.
- **Agents:** Used by plan, review, and work for research, lint, and validation (e.g. `repo-research-analyst`, `learnings-researcher`, `git-history-analyzer`, `agent-native-reviewer`).

Full “when to use what” and reference standards: [src/AGENTS.md](src/AGENTS.md).

---

## Guardrails

- **No auto-ship:** `/workflow:work` and `/workflow:review` do not commit, push, or create PRs by default.

- **Brainstorm and plan do not write code.** Output is documents only.

- Add a separate shipping command if you want automated commit/PR and quality gates.

---

## Troubleshooting

**Skills not showing in Cursor?** Cursor discovers skills from (1) the plugin’s `skills/` directory when you load the plugin from this repo, or (2) the project’s `.cursor/skills/` when you use npm: ensure the project has a `.cursor` directory and run `npx compound-workflow install`—Install creates the full structure (`.cursor/skills/<skill>`, `.cursor/agents`, `.cursor/commands`, `.cursor/references`). If skills still don’t appear, check Cursor Settings → Rules and any `permission.skill` settings.

**Skills not showing in OpenCode?** OpenCode uses the `.agents/compound-workflow-skills` symlink and `opencode.json` `skills.paths`. Run Install from the project root (`npx compound-workflow install`).

---

## Configuration and optional bits

**Repo configuration:** Commands read a **Repo Config Block** (YAML) in `AGENTS.md` for `default_branch`, `dev_server_url`, `test_command`, etc. Run **`/install`** once; then edit `AGENTS.md` to set the Repo Config Block.

**agent-browser:** `/test-browser` uses the agent-browser CLI only. Install: `npm install -g agent-browser` then `agent-browser install`. See [src/.agents/commands/test-browser.md](src/.agents/commands/test-browser.md).

**Source of truth**

- Workflows and commands: [src/.agents/](src/.agents/)
- Principles and skill index: [src/AGENTS.md](src/AGENTS.md)
