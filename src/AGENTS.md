# Agent Operating Principles

This `.agents` workspace is portable and command-first.

## Contents

- Canonical Workflow
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
3. `/workflow:work` -> implement
4. `/workflow:review` -> validate quality
5. `/workflow:compound` -> capture durable learnings

Supporting command:

- `/workflow:triage` -> approve and prioritize pending todos

Continuous improvement:

- `/metrics` -> log + assess a session and suggest improvements
- `/assess` -> aggregate daily metrics (weekly/monthly) and propose improvements

Onboarding:

- `/setup` -> configure repo defaults in `AGENTS.md` (Repo Config Block)

This workspace currently implements `brainstorm`, `plan`, `work`, `review`, `compound`, and optional QA utilities.

Use the canonical command names (`/workflow:plan`, `/workflow:work`, `/workflow:review`, etc.). This template does not ship aliases.

## Planning Fidelity Model

`/workflow:plan` must always declare:

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

- Commands: `.agents/commands/*.md` and `.agents/commands/workflow/*.md` (workflow namespace)
- Skills: `.agents/skills/*/SKILL.md`
- References: `.agents/references/**`
- Agents: `.agents/agents/**/*.md`

## Implemented Components (Current Scope)

- Commands: `workflow:brainstorm`, `workflow:plan`, `workflow:work`, `workflow:triage`, `workflow:review`, `workflow:compound` (under `.agents/commands/workflow/`), plus `test-browser`, `metrics`, `assess`, `setup` (root commands)
- Skills: `brainstorming`, `document-review`, `technical-review`, `compound-docs`, `file-todos`, `agent-browser`, `git-worktree`, `process-metrics`, `pii-protection-prisma`, `financial-workflow-integrity`, `audit-traceability`, `data-foundations`
- Agents:
  - `repo-research-analyst`
  - `learnings-researcher`
  - `git-history-analyzer`
  - `best-practices-researcher`
  - `framework-docs-researcher`
  - `spec-flow-analyzer`
  - `lint`
  - `bug-reproduction-validator`

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
| `compound-docs` | A non-trivial problem is solved and should be captured as durable institutional knowledge. |
| `file-todos` | You need a file-backed todo workflow for iterative multi-step changes. |
| `agent-browser` | You need to inspect available agents/skills and route deterministically. |
| `git-worktree` | You need isolated parallel work (review/feature) using git worktrees. |
| `process-metrics` | You want to log and assess session performance and process improvements. |

### Reference standards (guardrails)

| Skill | Use when |
| --- | --- |
| `data-foundations` | You are designing multi-tenant schema/access boundaries (views/functions, RLS, grants/revokes). |
| `pii-protection-prisma` | You store/process PII and need table separation + envelope encryption + rotation + logging rules. |
| `financial-workflow-integrity` | A workflow has money/regulatory outcomes and must be correct under retries/concurrency/webhooks/approvals. |
| `audit-traceability` | You need append-only auditing with actor attribution + correlation IDs without leaking PII. |
