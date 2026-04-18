---
name: setup-agents
description: Create or update AGENTS.md for any project. Detects project stack and installed harness directories, prompts for missing config, builds the Skill Index from all installed skills (no manual curation), and writes a clean minimal AGENTS.md. Use when onboarding a new project or refreshing an existing config.
triggers:
  - setting up a new project
  - initialising AGENTS.md for the first time
  - updating or refreshing an existing AGENTS.md
  - onboarding a new repo to the workflow
---

# Setup AGENTS.md

<!-- Structural source of truth for AGENTS.md format. The default template shipped in
     src/AGENTS.md is a populated instance of the Phase 4 template below.
     When changing the template here, update src/AGENTS.md to match (and vice versa). -->

Create or update a minimal, authoritative `AGENTS.md` for any project.

## Mode Detection

Before doing anything, check whether `AGENTS.md` exists in the repo root.

- **If it does not exist:** run in `init` mode — build from scratch.
- **If it exists:** run in `update` mode — read the current file, preserve what is correct, update what is stale, and prompt for anything missing.

Announce the mode before proceeding.

---

## Phase 1: Detect Harness Directories and Project Stack

### Harness detection

Check which directories exist at the project root. Do not assume any are present — record only what is actually found on disk.

Known harness patterns to check: directories named `.agents`, `.claude`, `.cursor`. Check all three; others may exist.

For each found harness, note where its skills live:
- `<harness>/skills/` — if that subdirectory exists
- `.claude/` has no skills directory (agents only, in `.claude/agents/`)

Record detected harnesses as `$harnesses` (ordered list of directories found). This will be written to AGENTS.md.

If **no harness directories exist**, stop and tell the user:
> No harness directories found. Run `npx compound-workflow install` first, then re-run this skill.

Use the **first found skills directory** across `$harnesses` as the canonical source for skill discovery in Phase 3. Record this as `$skills_dir`.

> **Note:** `harnesses` in AGENTS.md Repo Config may become stale if harness directories are added or removed. Re-run `/setup-agents` to refresh it.

### Project stack detection

Read the following files if they exist (do not error if missing):

- `package.json` (scripts, dependencies, devDependencies)
- `vite.config.ts` / `vite.config.js`
- `tsconfig.json`
- `.eslintrc.*` / `eslint.config.*`
- `vitest.config.ts` / `jest.config.*`
- `turbo.json` / `nx.json` (monorepo signals)

From these, infer:

| Config key | Detection signal |
| --- | --- |
| `test_command` | `scripts.test` in package.json; vitest/jest config presence |
| `test_fast_command` | `scripts.test:fast`, `scripts.test:watch`, or vitest equivalent |
| `lint_command` | `scripts.lint` in package.json; eslint config presence |
| `typecheck_command` | `scripts.typecheck` or `scripts.type-check`; tsconfig presence |
| `format_command` | `scripts.format` in package.json; prettier config presence |
| `dev_server_url` | vite config `server.port`; default `http://localhost:5173` for Vite, `http://localhost:3000` for others |
| `worktree_install_command` | `package-lock.json` → `npm ci`; `yarn.lock` → `yarn install`; `pnpm-lock.yaml` → `pnpm install` |

For each value, state whether it was detected or assumed.

---

## Phase 2: Prompt for Missing or Undetectable Values

Ask for any values that could not be detected. Ask one at a time.

Required:

- `default_branch` — cannot be reliably detected; ask (suggest `main`)
- `project_tracker` — ask: `github`, `linear`, or none
- `dev_server_url` — confirm detected value or ask
- `worktree_dir` — suggest `.worktrees`
- `worktree_copy_files` — ask which env/config files should be copied into new worktrees (e.g. `.env.local`)
- `harnesses` — show detected list from Phase 1; confirm or correct

**Update mode only:** Show the current values and ask: "These values are already configured — confirm, update, or skip each?"

---

## Phase 3: Build the Skill Index

List all directories under `$skills_dir` (resolved in Phase 1). For each one, read `SKILL.md` frontmatter to get `name` and `description`. These are the only skills that may appear in the Skill Index — never reference a skill not present on disk.

**Include every discovered skill automatically.** The installed skill set is the source of truth; there is no curation step. Do not prompt the user to pick a subset.

Show the resolved list so the user can see what will be written:

```
Skill Index will include all installed skills from <$skills_dir>:
  - <name> — <description from frontmatter>
  - <name> — <description from frontmatter>
  ...
```

**Update mode:** diff against the existing Skill Index and note additions/removals, then write the refreshed list. If the user wants to exclude a skill, they should uninstall or remove it from `$skills_dir` rather than hand-curate the index.

---

## Phase 4: Write AGENTS.md

Using all resolved values, write a clean `AGENTS.md` following this exact template.

**Init mode:** write the full file.
**Update mode:** preserve any sections the user confirmed as correct; replace only what changed.

```markdown
# Agent Operating Principles

This workspace is portable and command-first.

## Core Principles

1. Commands are the public API. Skills and agents are composable internals.
2. Core workflows stay generic. Domain-specific behavior loads only when context requires it.
3. Planning quality is explicit via fidelity selection.
4. Selection must be deterministic and visible: always state which skills/agents were selected and why.
5. Brainstorm and plan do not write code.

## Contract Precedence

If workflow documents conflict, resolve in this order:

1. `docs/principles/workflow-baseline-principles.md`
2. This file — non-negotiables and repo config
3. Workflow command specs
4. Skill docs

## Canonical Workflow

1. `/workflow:brainstorm` — clarify what to build
2. `/workflow:plan` — define how to build it
3. `/workflow:work` — implement (includes triage gate)
4. `/workflow:review` — validate quality
5. `/workflow:compound` — capture durable learnings

Optional:

- `/workflow:triage` — manually curate/prioritize queue before execution
- `/workflow:tech-review` — technical correctness check on a plan before build

Continuous improvement:

- `/metrics` — log + assess a session
- `/assess` — aggregate metrics and propose improvements

## Non-negotiables (Structure Integrity)

- **Commands are the public API.** Keep `/workflow:*` command docs stable; add capability via skills/agents, not new command variants.
- **Brainstorm = WHAT, Plan = HOW.** `/workflow:plan` must not re-litigate decisions already captured in `docs/brainstorms/`.
- **Local grounding is mandatory.** Every plan must cite at least 1–3 internal file path/line refs and any relevant `docs/solutions/**` learnings.
- **Fidelity + confidence are required declarations** in every plan file.
- **Solution scope contract is mandatory in every plan.** Plans must declare `solution_scope` (`partial_fix|full_remediation|migration`) plus completion expectation and non-goals.
- **Isolation preflight is a hard gate.** `/workflow:work` must complete and record worktree/isolation preflight before any implementation commands.
- **Triage before execution is mandatory.** `/workflow:work` must run a triage pass before executing todos.
- **Independent review is required for code/config changes.** `/workflow:review` must emit `review_independence_mode: independent|degraded`.
- **Standards baseline is mandatory for code/config changes.** `/workflow:work` and `/workflow:review` must apply `skill: standards` as a hard gate.
- **Todo completion requires evidence.** A todo may move to `complete` only after success criteria and quality gate evidence are recorded.
- **No ad-hoc artifacts outside canonical outputs** (`docs/plans`, `todos`, `docs/solutions`, `docs/metrics`) unless explicitly requested.

## Planning Fidelity Model

`/workflow:plan` must always declare: `Fidelity`, `Confidence`, `solution_scope`, rationale, research mode, and open questions.

- **Low** — problem, constraints, acceptance criteria, implementation outline, verification checklist.
- **Medium** — all Low + alternatives/tradeoffs, dependency/risk table, rollout notes, observability/test notes.
- **High** — all Medium + failure modes, rollback plan, deployment gates, migration/data safety checks, expanded test matrix.

Select `High` if any high-risk trigger exists (security, payments, privacy, data migration, production infra). Default to `Medium` for mixed signals. Otherwise `Low`.

## Routing Rules

- **Centralized skill routing:** Add new domain/reference skill routing in this file (Skill Index) rather than per-command.
- **Default selection order:** (1) safety/guardrail standards, (2) domain architecture/reference skills, (3) workflow execution skills. Minimal set that covers the problem.
- **Explain selection:** Always state which skills were selected and why.
- Run local repo + institutional learnings research first for planning. External research based on fidelity and risk.

## Repo Config Block

\`\`\`yaml
default_branch: <value>
project_tracker: <github|linear|none>
dev_server_url: <value>
test_command: <value>
test_fast_command: <value or omit>
lint_command: <value or omit>
typecheck_command: <value or omit>
format_command: <value or omit>
worktree_dir: <value>
worktree_install_command: <value>
worktree_copy_files:
  - <file1>
harnesses:
  - <detected harness dir 1>
\`\`\`

## Skill Index

| Skill | Use when |
| --- | --- |
[... one row per skill discovered in Phase 3; use the description from each skill's SKILL.md frontmatter ...]
```

Confirm: "AGENTS.md written."

---

## Phase 5: Validation

After writing, verify:

- [ ] All required Repo Config Block keys are present and non-empty
- [ ] `harnesses` lists only directories detected on disk in Phase 1 — no invented entries
- [ ] Every skill in the Skill Index was discovered from `$skills_dir` — no invented entries
- [ ] All skill descriptions come from `SKILL.md` frontmatter — none invented by the agent
- [ ] No hardcoded tool, platform, or directory names
- [ ] File is under 130 lines

If any check fails, fix before confirming completion.

---

## Rules

- Never add sections beyond what the template defines — keep it minimal
- Never hardcode skill names — discover everything from the detected skills directory
- Never hardcode harness paths — detect what exists on disk first; `harnesses` in AGENTS.md reflects reality, not assumptions
- Never invent skill descriptions — always read from the skill's `SKILL.md` frontmatter
- Never hardcode tool or platform names
- Never duplicate content that lives in command or skill docs
- In update mode, never silently overwrite values the user confirmed as correct
- If a detected value looks wrong, surface it and ask — do not assume
- When the Phase 4 template changes, update `src/AGENTS.md` to match (it is the populated default instance)
