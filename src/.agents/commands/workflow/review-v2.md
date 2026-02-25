---
name: review-v2
invocation: workflow:review-v2
description: Experimental PR/branch review with interactive snippet walkthrough (output-only; no publishing)
argument-hint: "[PR number, GitHub URL, branch name, or 'current']"
---

# /workflow:review-v2

Experimental code review flow focused on **interactive, snippet-by-snippet walkthrough** and **collected, consolidated comments**.

Guardrails (unless explicitly requested):

- Do not modify code or documents
- Do not create commits
- Do not push branches
- Do not create pull requests
- Do not publish GitHub PR reviews (output-only)

## Inputs

- Target: `$ARGUMENTS`
  - PR number / GitHub URL (if `gh` is available)
  - branch name
  - `current` (current branch)

If empty, default to `current`.

## Execution Workflow

### Phase 0: Resolve Repo Defaults (ALWAYS FIRST)

1. Read `AGENTS.md` and locate the "Repo Config Block" YAML.
2. Resolve:
   - `default_branch` (fallback: `main`, then `master`)
   - `lint_command` (optional; only run if configured)

State what you resolved or assumed.

### Phase 1: Determine Target + Checkout Strategy

Parse `$ARGUMENTS` to resolve:

- `target_type`: `pr | branch | current`
- `base_branch`
- `head_branch`
- (if PR) `pr_number`, `pr_title`, `pr_url`

Resolution rules:

- If `$ARGUMENTS` contains `/pull/`: treat as PR URL.
  - Extract the PR number and run:
    - `gh pr view <number> --json headRefName,baseRefName,number,title,url`
- If `$ARGUMENTS` is only digits: treat as PR number.
  - Run:
    - `gh pr view <number> --json headRefName,baseRefName,number,title,url`
- Else if `$ARGUMENTS == "current"` (or empty): review current branch.
- Else: treat `$ARGUMENTS` as a branch name; `base_branch = default_branch`.

Checkout strategy:

- Prefer reviewing the **currently checked-out** branch.
- If the user explicitly targeted a PR/branch that differs from current checkout:
  - Prefer an isolated worktree for review via `skill: git-worktree` (recommended).
  - If you cannot/should not switch branches, fall back to `gh pr diff <number>` (PR only) plus local diffing where possible.

### Phase 2: Gather the Diff + Surface Area

1. Determine changed files using (in order):
   - `@{upstream}...HEAD` when upstream exists
   - `origin/${base_branch}...HEAD`
   - `HEAD~1..HEAD`
2. Run:
   - `git diff origin/${base_branch}...HEAD --stat`
   - `git diff origin/${base_branch}...HEAD`
3. If PR and `gh` is available, also run:
   - `gh pr diff <number>`

Summarize surface area (changed files, hot paths, risk notes).

### Phase 3: Load Local Conventions

1. Read repo root `AGENTS.md` (already done in Phase 0) for workflow defaults and constraints.
2. Look for `CLAUDE.md` files:
   - at repo root
   - in directories containing modified files
3. Read any found `CLAUDE.md` files and summarize the applicable conventions you will enforce in this review.

### Phase 4: Interactive Snippet-by-Snippet Walkthrough (V2 Core)

Instead of dumping the full review at once, walk the user through the diff **snippet by snippet**.

Rules:

1. Organize snippets by concern (not file order), usually:
   - foundational types/interfaces/config
   - shared helpers/modules
   - core logic changes
   - integration edges (I/O, DB, network, auth)
   - tests + docs
2. Number each snippet (e.g. `Snippet 3/12`) so the user knows progress.
3. For each snippet, present:
   - a minimal diff/code block (only the essential lines)
   - plain-language explanation (what/why)
   - what’s good
   - what’s concerning (specific issue → consequence)
4. After each snippet, STOP and ask for input:
   - user comment/note → store it as a collected review comment and confirm you noted it
   - user question → answer, then continue
   - user says `next` / `move on` → proceed

Collected comment format (maintain internally as you go):

- `path:line` (approx is fine until final consolidation)
- severity: `Critical | Important | Suggestion | Nitpick`
- comment: rewrite user notes into clear, actionable language

### Phase 5: Common Review Patterns to Watch For

Pay special attention to:

- Consistency (constants vs hardcodes, patterns across similar files, loose return types like `any[]`)
- Architecture (duplication, half-wired integrations, silently removed behavior)
- Naming & types (misleading names, unexplained config values)
- LLM/agent code (tool success vs orchestrator blocks, missing prompt updates, duplicated context, confusing injected messages)
- Maintenance (hardcoded registries that should be co-located)

### Phase 6: Consolidate (Output-Only)

After all snippets, present the **full collected comment list**, organized by severity:

1. Critical / Important (must address before merge)
2. Suggestions (non-blocking improvements)
3. Nitpicks (minor consistency/style)

For each comment include:

- file + line reference (best-effort)
- description
- suggested fix (when applicable)

Then output:

- Summary (1–3 sentences)
- Verdict: `Ship it | Needs changes | Needs discussion`

Do **not** publish to GitHub in V2. If the user wants publishing later, that is a separate command/experiment.

