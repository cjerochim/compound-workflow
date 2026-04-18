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

---

## Developer Experience Contract (CRITICAL)

This skill is a config generator, not a survey. The developer interaction budget is **one round-trip**: propose a complete config, let the user accept or override.

**Hard constraints — violating any of these is a skill failure:**

- **At most two prompts per run.** (1) Phase 1b alignment prompt — only if harness skill sets differ. (2) Phase 2 config block — always. No other questions.
- **No numbered question lists.** Never emit `1. … 2. … 3. …` walls. Never split a single decision across multiple messages.
- **Never ask about skill inclusion.** Every skill in any discovered skills directory is included in the Skill Index automatically. Do not ask "keep all four guardrails?" or "which skills to include?".
- **Never ask meta questions.** No "project-specific skills appear elsewhere — flag as a gap?", no "strip extra sections?", no commentary on memory vs. code mismatches. If the template forbids something, silently conform.
- **Never present "ambiguous — need your call" sections.** Ambiguity is resolved by the deterministic rules below and surfaced in the Phase 2 block for the user to override. Pick a value.
- **Never re-confirm.** After the user replies to Phase 2, write the file. No second confirmation pass.

**Ambiguity resolution (apply without asking):**

- **Monorepo with multiple apps:** pick the workspace whose `scripts.dev` / `scripts.test` matches the detected harness target, or the newest one by `package.json` mtime. Record as `[detected]` and let the user override in Phase 2.
- **Multiple candidate commands (e.g. `npm test` vs `npm run test:web2:run`):** prefer the most specific workspace-scoped command over the root alias.
- **Memory or prior config suggests a different target than current code:** treat code as source of truth. Surface the detected value; the user can override.
- **Legacy/deprecated paths visible in code:** ignore for detection. Pick the active target.

---

## Mode Detection

Before doing anything, check whether `AGENTS.md` exists in the repo root.

- **If it does not exist:** run in `init` mode — build from scratch.
- **If it exists:** run in `update` mode — read the current file, preserve what is correct, update what is stale, and prompt for anything missing.

Announce the mode before proceeding.

---

## Phase 1: Detect Harness Directories and Project Stack

### Harness detection

Check which directories exist at the project root. Do not assume any are present — record only what is actually found on disk.

Known harness patterns: `.agents`, `.claude`, `.cursor`. Check all three; others may exist.

For each found harness, check `<harness>/skills/`. Record:

- `$harnesses` — ordered list of harness directories found
- `$skills_dirs` — map of `<harness>` → `<harness>/skills/` for every harness that has a skills subdirectory

If **no harness directories exist**, stop:
> No harness directories found. Run `npx compound-workflow install` first, then re-run this skill.

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
| `default_branch` | `git symbolic-ref refs/remotes/origin/HEAD` → strip `refs/remotes/origin/`; fallback `main` |
| `project_tracker` | `.github/` exists → `github`; else `none` |
| `worktree_dir` | default `.worktrees` |
| `worktree_copy_files` | glob `.env*` in repo root, excluding `.env.example` and `.env.sample` |

For each value, state whether it was detected or defaulted.

---

## Phase 1b: Discover Skills Across Harnesses

For every entry in `$skills_dirs`, list subdirectories and read each `SKILL.md` frontmatter (`name`, `description`).

Build `$skill_matrix`: `<skill name>` → `{harnesses where present, source description}`. The **Skill Index** in AGENTS.md is the union of all skill names across all harnesses.

**If every harness with a skills directory has the same skill set:** proceed silently to Phase 2. No prompt, no table output.

**If harnesses diverge** (a skill is in one harness but missing from another), emit the comparison table and one prompt:

```
Skill presence across harnesses:

| Skill | <harness 1> | <harness 2> | ... |
| --- | --- | --- |
| <name> | ✓ | ✗ | ... |
| <name> | ✓ | ✓ | ... |

Skills differ across harnesses. Align them? Aligning copies each skill's files into every harness so all locations have the same set.

Reply `align` to sync, `skip` to leave them as-is.
```

**If `align`:** for each skill, pick the harness where it lives as the source and copy its directory into every other harness's skills directory (create the directory if missing). Note what was copied in the final summary.

**If `skip`:** proceed with the union as the Skill Index; record in the summary that harnesses remain out of sync.

Either way, proceed to Phase 2 after this single prompt.

---

## Phase 2: Confirm the Proposed Config

This is the **only** user prompt in the skill. Emit one block and one question. Nothing else.

**Forbidden in this phase:**

- Numbered question lists
- Separate "Ambiguous — need your call" sections
- Any prompt about skills, guardrails, extra sections, or template compliance
- Per-field prompting ("confirm this? confirm that?")
- Commentary about memory, deprecated paths, or detected inconsistencies outside the block itself

**Update mode:** start from the values already in `AGENTS.md`. Only overwrite with a Phase 1 detection when the existing value is empty or clearly stale (references a command that no longer exists). Mark overrides `[updated]` so the user can see what changed.

Output exactly this structure — no preamble, no trailing questions:

```
Proposed AGENTS.md config (update|init mode):

  default_branch: <value>            [detected|default|existing|updated]
  project_tracker: <value>           [detected|default|existing|updated]
  dev_server_url: <value>            [detected|default|existing|updated]
  test_command: <value>              [detected|existing|updated]
  test_fast_command: <value>         [detected|existing|updated|omit]
  lint_command: <value>              [detected|existing|updated|omit]
  typecheck_command: <value>         [detected|existing|updated|omit]
  format_command: <value>            [detected|existing|updated|omit]
  worktree_dir: <value>              [default|existing]
  worktree_install_command: <value>  [detected|existing|updated]
  worktree_copy_files: [<files>]     [detected|existing|updated]
  harnesses: [<dirs>]                [detected]

Reply `ok` to accept, or send `<key>: <value>` lines to override. Anything else cancels.
```

On reply: apply overrides (if any), proceed to Phase 3 and Phase 4. Do not re-confirm.

---

## Phase 3: Build the Skill Index

Use `$skill_matrix` from Phase 1b. The Skill Index is the union of skill names across all harnesses. For each skill, use the `description` from that skill's `SKILL.md` frontmatter.

Never reference a skill not present on disk. Never invent a description.

**Include every discovered skill automatically. No user prompt.** If the user wants to exclude a skill, they remove it from the skills directories — this skill does not curate.

**Update mode:** diff against the existing Skill Index silently and write the refreshed list. Do not surface the diff as a question.

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

## Orchestration Model

The main agent stays lean. Context lives where it's needed, not at the top.

- **Plan** selects the minimal skill set for the work and names each selection explicitly. Unused skills never load.
- **Work** allocates tasks to subagents and passes only what each task needs: the problem statement, relevant file refs, success criteria. Not conversation history, not unrelated context.
- **Subagents** run in isolation, return evidence and results. The main agent orchestrates, records outcomes, and moves to the next task.
- **Skills load on demand.** Commands pull a skill into context only when a gate or step requires it — not as a precautionary baseline.

Context budget rule: if a task can be done with less context, pass less. If a subagent can handle it, delegate.

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
- [ ] File is under 160 lines

If any check fails, fix before confirming completion.

---

## Rules

**Developer experience (non-negotiable):**

- One user prompt per run — the Phase 2 block. No other questions.
- No numbered question lists, no "ambiguous — need your call" sections, no skill curation prompts, no meta-observations about the codebase.
- Resolve ambiguity deterministically using the rules in the Developer Experience Contract. Surface the pick in the block; let the user override.

**Content integrity:**

- Never add sections beyond what the template defines — keep it minimal. Silently conform; do not ask.
- Never hardcode skill names — discover everything from the detected skills directory.
- Never hardcode harness paths — detect what exists on disk first; `harnesses` in AGENTS.md reflects reality, not assumptions.
- Never invent skill descriptions — always read from the skill's `SKILL.md` frontmatter.
- Never hardcode tool or platform names.
- Never duplicate content that lives in command or skill docs.
- In update mode, preserve values that are still valid; only replace stale or empty ones.
- When the Phase 4 template changes, update `src/AGENTS.md` to match (it is the populated default instance).
