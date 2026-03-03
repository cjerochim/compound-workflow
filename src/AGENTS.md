# Agent Operating Principles

This `.agents` workspace is portable and command-first.

## Contents

- Canonical Workflow
- Non-negotiables (Structure Integrity)
- Planning Fidelity Model
- Routing Rules
- Repo Configuration (Optional)
- Directory Layout
- Implemented Components (Current Scope)
- Skill Index (When to Use What)
- Reference Standards Policy (Anti-Skill-Sprawl)

## Core Principles

1. Commands are the public API. Skills and agents are composable internals.
2. Core workflows stay generic. Domain-specific behavior loads only when context requires it.
3. Planning quality is explicit via fidelity selection.
4. Selection must be deterministic and visible: always state which skills/agents were selected and why.
5. Brainstorm and plan do not write code.

## Canonical Workflow

1. `/workflow:brainstorm` -> clarify what to build
2. `/workflow:plan` -> define how to build it
3. `/workflow:work` -> implement (includes triage gate for todo readiness/prioritization)
4. `/workflow:review` -> validate quality
5. `/workflow:compound` -> capture durable learnings

Optional manual steps:

- `/workflow:triage` -> explicitly curate/prioritize backlog items before execution when needed
- `/workflow:tech-review` -> run technical review on a plan (technical correctness before build); optional plan path

Continuous improvement:

- `/metrics` -> log + assess a session and suggest improvements
- `/assess` -> aggregate daily metrics (weekly/monthly) and propose improvements

Onboarding:

- `/install` -> one action: writes opencode.json, merges AGENTS.md, creates dirs, preserves Repo Config Block (run `npx compound-workflow install` in the project)

This workspace currently implements `brainstorm`, `plan`, `triage`, `work`, `review`, `tech-review`, `compound`, and optional QA utilities.

Use the canonical command names (`/workflow:plan`, `/workflow:work`, `/workflow:review`, `/workflow:tech-review`, etc.). This template does not ship aliases.

## Contract Precedence

If workflow documents conflict, resolve them in this order:

1. `docs/principles/workflow-baseline-principles.md`
2. This file (`src/AGENTS.md`) non-negotiables and repo config
3. Workflow command specs (`src/.agents/commands/workflow/*.md`)
4. Skill docs (`src/.agents/skills/*/SKILL.md`)

## Non-negotiables (Structure Integrity)

- **Commands are the public API.** Keep `/workflow:*` command docs stable; add capability via skills/agents, not new command variants.
- **Brainstorm = WHAT, Plan = HOW.** `/workflow:plan` must not re-litigate decisions already captured in `docs/brainstorms/`.
- **Local grounding is mandatory.** Every plan must cite at least 1–3 internal file path/line refs (existing patterns) and any relevant `docs/solutions/**` learnings.
- **Fidelity + confidence are required declarations** in every plan file: always output the Fidelity/Confidence/Research-mode block; the chosen template must include the required sections for that fidelity (Low/Medium/High).
- **Solution scope contract is mandatory in every plan.** Plans must declare `solution_scope` (`partial_fix|full_remediation|migration`) plus explicit completion expectation and non-goals so `/workflow:work` can enforce intent.
- **SpecFlow is a validation gate, not a rewrite engine.** High fidelity required; Medium recommended; Low optional. Output must translate into acceptance criteria/edge cases, not new scope.
- **Isolation preflight is a hard gate.** `/workflow:work` must complete and record worktree/isolation preflight before any implementation commands. `/workflow:review` must do the same for non-current PR/branch targets before analysis.
- **Triage before execution is mandatory.** `/workflow:work` must run a triage pass before executing todos to prioritize the queue and validate dependencies/ready state for the current plan. `/workflow:triage` remains available as an explicit manual command.
- **Spike governance is explicit and ordered.** Risky plans must evaluate spike need, spike candidates must declare initial priority/dependencies/unblocks/timebox/deliverable, triage confirms those assumptions, and `/workflow:work` executes blocking spikes before dependent build todos.
- **Agentic access/testability is mandatory in planning.** Every plan must include an executable access + validation contract so work/review can run deterministically.
- **Independent review is required for code/config changes.** `/workflow:review` must emit `review_independence_mode: independent|degraded`, plus independence evidence and skipped-pass disclosure.
- **Standards baseline is mandatory for code/config changes.** `/workflow:work` and `/workflow:review` must apply `skill: standards` as a hard gate for declarative flow, immutable transforms, and maintainability boundaries.
- **Todo completion requires evidence.** A todo may move to `complete` only after success criteria evidence and quality gate evidence are recorded in Work Log.
- **Blockers change todo state immediately.** Blocked work must move from `ready` back to `pending` with `tags: [blocker]` and an options+recommendation decision record.
- **Quality gates are enforced with ask-once fallback.** If `lint_command` or `typecheck_command` is missing, ask once per run and continue only when commands are provided and pass.
- **Skills are invoked only by trigger.** `document-review` only when user selects "Review and refine" (or explicit request); guardrail skills (PII/financial/audit/data) only when the feature touches that domain.
- **No ad-hoc artifacts outside canonical outputs** (`docs/plans`, `todos`, `docs/solutions`, `docs/metrics`) unless explicitly requested.
- **Plan file is the artifact.** Post-generation options are actions on the artifact; they do not change the workflow shape.
- **Tighten over expand.** Resolve ambiguity, standardize naming, enforce sections—avoid adding new process steps unless they reduce rework.

## Planning Fidelity Model

`/workflow:plan` must always declare:

- `Fidelity selected`: `Low | Medium | High`
- `Confidence`: `High | Medium | Low`
- `solution_scope`: `partial_fix | full_remediation | migration`
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

- **Capability-first in commands:** Core workflow command docs should name capabilities (problem shape), not specific libraries. Concrete skill resolution comes from the Skill Index.
- **Centralized skill routing:** Add new domain/reference skill routing in this file (Skill Index + rules) rather than hard-coding per-skill logic into each workflow command, except for rare high-criticality cases.
- **Default skill selection order:** (1) safety/guardrail standards when applicable, (2) domain architecture/reference skills, (3) workflow execution skills. Choose the minimal set that covers the problem.
- **Explain selection:** When selecting skills, state which skills were selected and why.
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
- `typecheck_command: npm run typecheck`
- `format_command: npm run format`
- `project_tracker: github` (or `linear`)
- `worktree_dir: .worktrees` (optional; where worktrees are created)
- `worktree_copy_files: [...]` (optional; env/config files to copy into new worktrees; non-overwriting)
- `worktree_install_command: <cmd>` (optional; deps install command to run in new worktrees)
- `worktree_bootstrap_notes: [...]` (optional; prerequisites per worktree: system deps/services/tooling; documented only)

### Repo Config Block (Optional)

If you want commands to read these values deterministically, add a small YAML block under this section:

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
worktree_copy_files:
  - .env
  - .env.local
worktree_install_command: npm ci
worktree_bootstrap_notes:
  - Ensure required system deps are installed (e.g. via brew/apt)
  - Ensure local services are running (e.g. postgres/redis)
  - If using direnv: run `direnv allow`
```

## Directory Layout

- Commands: `.agents/commands/*.md` and `.agents/commands/workflow/*.md` (workflow namespace)
- Skills: `.agents/skills/*/SKILL.md`
- Skills may optionally include tool-specific agent metadata under `.agents/skills/*/agents/` (for example `openai.yaml`) when required by that skill's validator/runtime.
- References: `.agents/references/**`
- Agents: `.agents/agents/**/*.md`

## Implemented Components (Current Scope)

- Commands: `workflow:brainstorm`, `workflow:plan`, `workflow:triage`, `workflow:work`, `workflow:review`, `workflow:tech-review`, `workflow:compound` (under `.agents/commands/workflow/`), plus `test-browser`, `metrics`, `assess`, `install` (root commands)
- Skills: `brainstorming`, `document-review`, `technical-review`, `compound-docs` (alias: `compound_doc`), `capture-skill`, `file-todos`, `agent-browser`, `git-worktree`, `process-metrics`, `react-ddd-mvc-frontend`, `xstate-actor-orchestration`, `standards`, `pii-protection-prisma`, `financial-workflow-integrity`, `audit-traceability`, `data-foundations`
- Agents:
  - `repo-research-analyst`
  - `learnings-researcher`
  - `git-history-analyzer`
  - `best-practices-researcher`
  - `framework-docs-researcher`
  - `spec-flow-analyzer`
  - `lint`
  - `bug-reproduction-validator`
  - `agent-native-reviewer`
  - `planning-technical-reviewer`

## Skill Index (When to Use What)

Skills fall into two buckets:

1. Workflow skills: invoked by commands to do work (e.g. `/workflow:review`, `/workflow:compound`).
2. Reference standards: enforce design/build guardrails when the work touches security, privacy, money, or multi-tenant data.

Use reference standards proactively during `/workflow:plan`, `/workflow:work`, and PR review.

## Reference Standards Policy (Anti-Skill-Sprawl)

To keep this workspace usable and portable, reference standards are intentionally limited.

Rules:

- Cap: MAX 12 reference standards skills under `.agents/skills/`.
- Promotion: create a new reference standard skill only if it meets at least 2 criteria:
  - introduces MUST/MUST NOT rules that change build decisions
  - includes required schema/contracts/checklists that can be enforced in review
  - has operational failure modes/runbooks
  - applies across multiple features (not one-off project trivia)
  - prevents a high-cost incident if followed
- Overlap: each domain has a single "owner" skill; overlapping material MUST be added to the owner skill (as a new section) or demoted to a non-skill reference doc.
- References location: non-skill references live in `.agents/references/` (this repo: `src/.agents/references/`) and are linked from `src/AGENTS.md` or the owning skill.

Owner skills:

- `data-foundations`: multi-tenant boundaries (views/functions), RLS, grants/revokes, tenant context.
- `pii-protection-prisma`: PII placement, envelope encryption, key rotation, logging restrictions.
- `financial-workflow-integrity`: idempotency, concurrency, webhooks, approvals for money-adjacent workflows.
- `audit-traceability`: append-only audit logs, actor attribution, correlation IDs, privileged access audit.

Maintenance:

- If a reference standard becomes mostly examples/links, demote it into `.agents/references/` (this repo: `src/.agents/references/`) and keep the skill as the enforceable rules/checklists only.

### Workflow skills

| Skill | Use when |
| --- | --- |
| `brainstorming` | You need structured idea exploration and clarification without writing code. |
| `document-review` | You need to review a document/spec and extract issues, gaps, and concrete next actions. |
| `technical-review` | A plan or feature approach has passed document review and must be checked for technical correctness before build. |
| `compound-docs` (alias: `compound_doc`) | A durable learning (solved problem or implementation insight) should be captured as institutional knowledge. |
| `capture-skill` | You want to capture conversation learnings as a reusable skill, while defaulting to project-overlay refinement and avoiding implicit edits to repo-provided base skills. |
| `file-todos` | You need a file-backed todo workflow for iterative multi-step changes. |
| `agent-browser` | You need to inspect available agents/skills and route deterministically. |
| `git-worktree` | You need isolated parallel work (review/feature) using git worktrees. |
| `process-metrics` | You want to log and assess session performance and process improvements. |
| `react-ddd-mvc-frontend` | You need React frontend architecture guidance (DDD + MVC hybrid) during planning or review to enforce feature structure, layer boundaries, composable pure components, container/controller responsibilities, and maintainable patterns. |
| `xstate-actor-orchestration` | You are evaluating complexity and need explicit state orchestration: React container-as-orchestrator for UI flows, or actor/state-machine orchestration for backend/internal workflows (especially multi-step async branching, retries/timeouts/cancellation, receptionist/child-actor coordination, or boolean-flag sprawl). |
| `standards` | You need Altai coding standards for implementation and refactoring, including domain entity patterns, XState conventions, type usage, and feature code organization. |

### Reference standards (guardrails)

| Skill | Use when |
| --- | --- |
| `data-foundations` | You are designing multi-tenant schema/access boundaries (views/functions, RLS, grants/revokes). |
| `pii-protection-prisma` | You store/process PII and need table separation + envelope encryption + rotation + logging rules. |
| `financial-workflow-integrity` | A workflow has money/regulatory outcomes and must be correct under retries/concurrency/webhooks/approvals. |
| `audit-traceability` | You need append-only auditing with actor attribution + correlation IDs without leaking PII. |
