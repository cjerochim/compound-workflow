---
name: review
description: Review a PR/branch/diff with structured findings. Does not implement fixes unless explicitly requested.
argument-hint: "[PR number, GitHub URL, branch name, 'current', or a doc path]"
---

# /review

Run a structured, evidence-based review. This command produces findings and recommendations; it does not implement fixes by default.

Guardrails (unless explicitly requested):

- Do not modify code or documents
- Do not create commits
- Do not push branches
- Do not create pull requests

## Inputs

- Target: `$ARGUMENTS`
  - PR number / GitHub URL (if `gh` is available)
  - branch name
  - `current` (current branch)
  - a document path (review a plan/spec)

## Setup

1. Determine target type.
2. If reviewing a PR and `gh` is available:
   - fetch title/body/files via `gh pr view --json`
   - checkout the branch (direct checkout or via worktree)
3. If target is a branch/diff:
   - ensure you are on the correct branch
4. If you are not on the target branch, offer a worktree via `skill: git-worktree`.

Defaults:

- Read `AGENTS.md` and look for the "Repo Config Block" YAML.
- Resolve `default_branch` from that block (fallback: `main`, then `master`).
- Determine changed files using (in order):
  1) `@{upstream}...HEAD` when upstream exists
  2) `origin/${default_branch}...HEAD`
  3) `HEAD~1..HEAD`

Prefer reviewing the currently checked-out branch. Only switch branches or create worktrees when the user explicitly requests reviewing a different target.

Protected artifacts:

- Never suggest deleting or ignoring `docs/plans/` or `docs/solutions/`.

If a plan/spec document is provided as context:

- If it includes `fidelity` and `confidence`, use them to decide review depth.
- High fidelity or low confidence should increase scrutiny and increase use of conditional passes.

## Core Review Passes

Always run these (in parallel when possible):

- `Task learnings-researcher(<target context>)` (related prior solutions)
- `Task lint(<changed files context>)` (only if `lint_command` is configured in the Repo Config Block in `AGENTS.md`)

Then perform the main review synthesis:

- change summary (surface area, high-risk files)
- correctness
- tests/verification adequacy
- risk and failure modes
- operational considerations (monitoring, rollback)
- readability/maintainability

## Conditional Passes

Run only when they apply:

- If this is a bug report/fix and reproduction steps are available: `Task bug-reproduction-validator(<report>)`
- If a PR touches existing behavior and risk is medium/high: `Task git-history-analyzer(<target context>)`
- If changes depend on framework/library behavior and version constraints: `Task framework-docs-researcher(<topic>)`

Risk tier inference:

- Prefer plan `fidelity`/`confidence` when a plan doc is provided.
- Otherwise infer from scope and domain (security/auth/payments/data migration/infra => higher).

## Output Format

Provide:

- Review recommendation: `pass | pass-with-notes | fail`
- Top risks (1-5 bullets)
- Findings list:
  - severity (`critical|high|medium|low`)
  - evidence (file references or commands/output)
  - recommended action (concise)
- What ran vs skipped (selected agents/passes)

Also include:

- Next step suggestion: `/work` to implement, or `file-todos` for tracked follow-ups

Optional:

- If user requests tracked follow-ups: convert findings into `todos/` items using the `file-todos` skill.
