# Agent Operating Principles

<!-- Default template. Structural source of truth: src/skills/setup-agents/SKILL.md Phase 4.
     When changing sections here, keep that template in sync (and vice versa). -->

This `.agents` workspace is portable and command-first.

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

Onboarding:

- `/install` — one action: copies agents/skills/commands, writes opencode.json, merges AGENTS.md, creates docs/todo dirs (run `npx compound-workflow install` in the project)

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

```yaml
default_branch: main
dev_server_url: http://localhost:3000
test_command: npm test
test_fast_command: npm test -- --watch=false
lint_command: npm run lint
typecheck_command: npm run typecheck
format_command: npm run format
project_tracker: github
worktree_dir: .worktrees
worktree_install_command: npm ci
worktree_copy_files:
  - .env
  - .env.local
harnesses: []
```

## Skill Index

<!-- Default rows — reflects skills shipped with this package. Run /setup-agents to regenerate from installed skills. -->

| Skill | Use when |
| --- | --- |
| `brainstorming` | Exploring intent and approaches before planning. |
| `document-review` | Reviewing a document/spec for issues, gaps, and next actions. |
| `technical-review` | Checking a plan for technical correctness before build. |
| `compound-docs` | Capturing a solved problem as durable institutional knowledge. |
| `capture-skill` | Saving conversation learnings as a reusable skill. |
| `file-todos` | Managing a file-backed todo workflow for iterative multi-step changes. |
| `git-worktree` | Isolated parallel work using Git worktrees. |
| `process-metrics` | Logging and assessing session performance. |
| `setup-agents` | Creating or updating AGENTS.md for a project. |
| `agent-browser` | Inspecting available agents/skills and routing deterministically. |
| `data-foundations` | Designing multi-tenant schema/access boundaries (RLS, grants). |
| `pii-protection-prisma` | Storing or processing PII. |
| `financial-workflow-integrity` | Workflows with money or regulatory outcomes. |
| `audit-traceability` | Append-only auditing with actor attribution. |
