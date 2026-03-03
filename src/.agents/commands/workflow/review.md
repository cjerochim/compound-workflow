---
name: review
invocation: workflow:review
description: Review a PR/branch/diff with structured findings. Does not implement fixes unless explicitly requested.
argument-hint: "[PR number, GitHub URL, branch name, or 'current']"
---

# /workflow:review

Run a structured, evidence-based **code** review. This command produces findings and recommendations; it does not implement fixes by default.

Contract precedence: if this command conflicts with other workflow docs, follow `docs/principles/workflow-baseline-principles.md`, then `src/AGENTS.md`, then this command.

**If the user provides a document path** (e.g. a plan or spec): redirect to the `technical-review` skill for technical correctness (no edits), and/or the `document-review` skill to refine the document. This command does not review documents.

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

If empty, default to `current`.

## Execution Workflow

### Phase 0: Resolve Repo Defaults (ALWAYS FIRST)

1. Read `AGENTS.md` and look for the "Repo Config Block" YAML.
2. Resolve:
   - `default_branch` (fallback: `main`, then `master`)
   - `lint_command` (used in Phase 3)
   - `typecheck_command` (used in Phase 3)

State what you resolved or assumed.

### Phase 1: Determine Target + Checkout Strategy

1. Determine target type from `$ARGUMENTS`: PR/URL, branch name, or `current`.
2. If reviewing a PR and `gh` is available:
   - Fetch title/body/files via `gh pr view --json`
   - Resolve target branch metadata before selecting isolation context
3. If target is a branch (not current):
   - Resolve isolation context before running review passes
4. If you are not on the target branch and user requested that target, do not continue until isolation preflight is complete.

Prefer reviewing the currently checked-out branch. Only switch branches or create worktrees when the user explicitly requests a different target.

### Phase 1.5: Isolation Preflight Gate (HARD GATE for non-current targets)

No diff analysis, lint, or reviewer-agent passes may run before this gate passes for non-current targets.

Policy:

- Target `current`: gate passes immediately on current checkout.
- Target PR/branch not currently checked out:
  - Default path: use `skill: git-worktree` for isolated review context.
  - Opt-out path: explicit user confirmation to review without worktree, then switch to the requested non-default branch context.

Gate completion record (REQUIRED for non-current targets):

- `target_type: pr|branch|current`
- `isolation_mode: worktree|direct-checkout`
- `review_context_path` (worktree path) or `review_branch` (direct checkout)
- `gate_status: passed`

Never run non-current review from the default branch checkout without completing this gate.

### Phase 1.6: Preflight Violation Recovery (REQUIRED)

If review activity started before the isolation gate was complete:

- Disclose the violation.
- Stop analysis immediately.
- Return to Phase 1.5 and complete the gate.
- Resume only after `gate_status: passed`.

Protected artifacts:

- Never suggest deleting or ignoring `docs/plans/` or `docs/solutions/`.

### Phase 2: Compute Review Surface Area

1. Determine changed files using (in order):
   - `@{upstream}...HEAD` when upstream exists
   - `origin/${default_branch}...HEAD`
   - `HEAD~1..HEAD`
2. Summarize surface area (which files, high-risk areas).
3. Infer risk tier for conditional passes:
   - If the branch/PR references a plan file (e.g. in description or linked in changes), and that plan has `fidelity`/`confidence`, use them to decide review depth (high fidelity or low confidence => more scrutiny, more conditional passes).
   - Otherwise infer from scope and domain (security/auth/payments/data migration/infra => higher).

### Phase 3: Parallel Passes

**Always run (in parallel when possible):**

- `Task learnings-researcher(<target context>)` (related prior solutions)
- `Task lint(<changed files context>)` only if `lint_command` is configured in the Repo Config Block
- Run the standards compliance pass using `skill: standards` as mandatory baseline for code/config changes:
  - evaluate declarative flow
  - evaluate immutable transforms
  - evaluate maintainability boundaries
  - evaluate hidden mutable state
- Verify agentic executability from plan/todo artifacts when available:
  - access prerequisites are explicit
  - validation commands are explicit and reproducible
  - success-criteria evidence is traceable in todo Work Logs
- For type-checking coverage:
  - if `typecheck_command` is configured, run it (or verify recent evidence if command execution is not feasible in this context)
  - if not configured, report "typecheck command not configured" as a note and recommend adding it to Repo Config Block

**Conditional passes** (run when they apply):

- If this is a bug report/fix and reproduction steps are available: `Task bug-reproduction-validator(<report>)`
- If changes touch existing behavior and risk is medium/high: `Task git-history-analyzer(<target context>)`
- If changes depend on framework/library behavior and version constraints: `Task framework-docs-researcher(<topic>)`

### Phase 3.5: Independent Reviewer Pass (REQUIRED)

Before final verdict, run an explicit independent pass and record:

- `review_independence_mode: independent|degraded`
- `independence_evidence`: what independent pass ran
- `skipped_passes`: what was skipped and why

Mode rules:

- `independent` (default): run a distinct fresh-context reviewer pass (separate reviewer/agent perspective from the main synthesis).
- `degraded`: only when independent reviewer tooling/path is unavailable. Must include explicit disclosure that confidence is reduced and why fallback was used.

Then perform the main review synthesis across:

- change summary (surface area, high-risk files)
- correctness
- tests/verification adequacy
- agentic validation adequacy (can another agent execute and verify deterministically?)
- risk and failure modes
- operational considerations (monitoring, rollback)
- readability/maintainability
- standards compliance using `skill: standards` (MUST/MUST NOT baseline)

### Phase 4: Synthesis + Verdict

Provide:

- Review recommendation: `pass | pass-with-notes | fail`
- `review_independence_mode: independent|degraded`
- `verdict_confidence: normal|degraded` (use `degraded` only when `review_independence_mode=degraded`)
- `standards_compliance: pass|pass-with-notes|fail`
  - `fail`: one or more standards MUST violations (blocking)
  - `pass-with-notes`: no MUST violations, but SHOULD-level maintainability concerns
  - `pass`: no material standards violations
- Top risks (1–5 bullets)
- Findings list:
  - severity (`critical | high | medium | low`)
  - evidence (file references or commands/output)
  - recommended action (concise)
  - standards classification:
    - standards `MUST` violations => blocking finding and review recommendation `fail`
    - standards `SHOULD` violations => non-blocking finding and review recommendation `pass-with-notes`
- Independence evidence summary:
  - what independent pass ran
  - what was skipped and why
- What ran vs skipped (selected agents/passes)
- Validation coverage summary:
  - tests: pass|fail|not-run
  - lint: pass|fail|not-configured|not-run
  - typecheck: pass|fail|not-configured|not-run

### Phase 5: Handoff Options

Recommend next action:

- **Implement fixes:** `/workflow:work` with the relevant plan (or branch) to address findings
- **Track follow-ups:** use the `file-todos` skill to convert findings into `todos/` items (only if user requests tracked follow-ups)
- **Capture learning:** if a systemic learning emerged, suggest `/workflow:compound`

Optional: If user requests tracked follow-ups, convert findings into `todos/` items using the `file-todos` skill.
