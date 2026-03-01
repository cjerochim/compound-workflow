---
name: work
invocation: workflow:work
description: Execute a plan file systematically (implementation + verification) without auto-shipping
argument-hint: "<required: plan file path>"
---

# /workflow:work

Execute a work plan efficiently while maintaining quality and finishing features.

## Introduction

This command takes a plan file and executes it systematically. The focus is on completing the work while understanding requirements quickly, following existing patterns, and maintaining quality throughout.

Non-goals (unless explicitly requested):

- Creating commits
- Pushing branches
- Creating pull requests

## Input Document

<input_document> #$ARGUMENTS </input_document>

The input must be a plan file path.

- If it is empty, ask the user for the plan file path.
- If it does not exist or is not readable, stop and ask for the correct path.
- Read the plan file completely before starting work.

## Execution Workflow

### Phase 1: Quick Start

1. **Read Plan and Clarify**

   - Read the work document completely
   - Review any references or links provided in the plan
   - If anything is unclear or ambiguous, ask clarifying questions now
   - Get user approval to proceed
   - **Do not skip this** - better to ask questions now than build the wrong thing

1.1. **Apply state-orchestration trigger (enforcement)**

   If the plan or implementation involves XState/state-machine
   orchestration, load `xstate-actor-orchestration` before coding.

   Trigger examples:

   - React container-as-orchestrator composition for complex UI flows
   - Backend/internal workflow orchestration with hidden complexity
   - Spawned children or receptionist-style actor lookup
   - Retries/timeouts/cancellation/recovery state handling
   - More than one boolean/flag controlling one workflow

1.25. **Resolve Repo Defaults (ALWAYS FIRST)**

   Read `AGENTS.md` and look for the "Repo Config Block" YAML.

   Use it to resolve:

   - `test_command`
   - `test_fast_command` (optional)
   - `lint_command` (optional)
   - `format_command` (optional)

   If not present, ask once for the project's test command and suggest adding it to `AGENTS.md`.

1.5. **Determine Testing Mode (Risk-Based)**

   Infer a testing cadence from the plan's risk.

   Inputs:

   - If the plan file has frontmatter `fidelity` and `confidence`, use them.
   - Otherwise default to `fidelity=medium`, `confidence=medium`.

   Testing modes:

   - Low risk: fast checks per todo, full suite at end
   - Medium risk (default): fast checks per todo, full suite at milestones + end
   - High risk: fast checks per todo, full suite frequently (every 1-2 todos) + end

   Command sources:

   - Prefer `test_command` and optional `test_fast_command` from `AGENTS.md`.
   - If missing, ask once for the repo's test command and suggest adding it to `AGENTS.md`.

2. **Setup Environment**

   Determine how to isolate the work for this plan.

   Default: use a worktree (recommended). The user may opt out.

   1) Resolve your current branch (this is the default worktree base):

   - If you are already on a branch that clearly matches this plan, continue.
   - Otherwise, continue anyway — the current active branch remains the reference/base for a new worktree unless the user explicitly requests a different base.

   2) Ask the user (opt-out prompt):

   - "Use a worktree for this work? (default: Yes; recommended for isolation)"
   - Options:
     - Yes (worktree)
     - No (stay in current checkout; create/switch to a feature branch)

   If Yes: ask for the new branch name (e.g., `feat/<slug>`, `fix/<slug>`).

   3) If worktree is chosen, run:

   ```bash
   skill: git-worktree
   # Provide:
   # - branch-name: <new branch name>
   # - from-branch: <current active branch>   (ALWAYS, unless the user overrides)
   ```

   3.5) Worktree bootstrap (REQUIRED when worktree created)

   Immediately after entering the new worktree, run bootstrap per the `git-worktree` skill (AGENTS keys + autodetect). See `.agents/skills/git-worktree/SKILL.md` for the canonical algorithm (copy env/config, install deps, and `worktree_bootstrap_notes`).

   3.6) Record worktree path (REQUIRED when worktree created)

   When a worktree was created, record the worktree path (e.g. `<worktree_dir>/<sanitized-branch-name>`) in a single visible place (e.g. at the top of the plan frontmatter as `worktree_path: .worktrees/feat-xyz` or in the first Phase 2 step). All subsequent steps assume this path as the implementation root.

   4) If worktree is not chosen (opt-out):

   - Create or switch to a feature branch (never work directly on the default branch).

3. **Create Todo List**

   Run:

   ```bash
   skill: file-todos
   # Input: plan file path (the input document)
   # Output: todos/*-ready-*.md and/or todos/*-pending-*.md per skill rules
   ```

   - Break the plan into actionable, persistent todo files under `todos/`
   - Include dependencies between tasks
   - Prioritize based on what needs to be done first
   - Include testing and quality check tasks
   - Keep tasks specific and completable

   Prerequisites:

   - Ensure `todos/` exists.
   - Ensure the todo template exists at `.agents/skills/file-todos/assets/todo-template.md`.

   If `todos/` does not exist, create it and proceed.

   Plan -> todos mapping (default behavior):

   - If the plan contains checkboxes (`- [ ]`), create one todo per checkbox (group only when items are tightly coupled).
   - If the plan has no checkboxes, create 3-7 todos based on the plan's major phases/sections.
   - Each todo MUST include a link back to the plan file in `Resources` and reference the specific section(s) it implements.
   - Default todo `status`:
     - `ready` when the plan is approved and confidence is not low
     - `pending` when plan confidence is low or requires explicit triage
   - Default todo `priority`: `p2` unless the plan indicates urgency/risk.

   After creating todos:

   - If any todos are `pending`, stop and offer `/workflow:triage` to approve and prioritize before execution.
   - If all todos are `ready`, proceed to Phase 2.

### Phase 2: Execute

1. **Task Execution Loop**

   **When a worktree was created for this run:** All implementation edits (file reads/writes) and all terminal commands (run tests, install, lint, etc.) MUST be performed with the worktree directory as the working context: use the worktree path for file paths and set terminal cwd to the worktree root. Do not make code changes in the main repo checkout.

   Todo selection rules (default):

   - Consider only `todos/*-ready-*.md` items. Do not execute `pending` or `deferred` todos.
   - Skip blocked todos:
     - blocked if `dependencies` is non-empty and any dependency does not have a corresponding `*-complete-*.md` file.
   - Prioritize by priority then id:
     - `p1` before `p2` before `p3`
     - lower `issue_id` first

   Stop condition:

   - If no unblocked `ready` todos remain:
     - summarize remaining `pending`, `deferred` (parked for reference), and blocked items
     - recommend running `/workflow:triage` for pending items
     - stop (do not invent work)

   For each task in priority order:

   ```
    while (tasks remain):
      - Select the next `*-ready-*.md` todo that is unblocked
      - Read any referenced files from the plan
      - Look for similar patterns in codebase
      - Implement following existing conventions
      - Write tests for new functionality
      - Run tests after changes according to the selected testing mode
      - REQUIRED: Validation Gate (prove acceptance criteria + record evidence)
      - Update the todo file Work Log and Acceptance Criteria (include evidence)
      - Mark off the corresponding checkbox in the plan file ([ ] → [x])
      - When a todo is complete, rename it to `*-complete-*.md` and update frontmatter
    ```

    Unblocked definition:

    - `dependencies: []`, or
    - all dependency issue_ids have a corresponding `*-complete-*.md` file

    Plan sync rules:

    - If the plan contains checkboxes, each todo should include one of:
      - `Resources -> Plan checkbox:` with the exact checkbox text, or
      - `Resources -> Plan section:` with a heading reference.
    - When a todo completes, update the plan:
      - Prefer matching the exact checkbox line and flipping `[ ]` -> `[x]`.
      - If only a section pointer exists, add a short "Completed" note under that section.
    - If the plan has no checkboxes, do not invent a new checklist in the plan by default.

    IMPORTANT: Keep the plan accurate. It should reflect what is done vs remaining.

    Minimum work log requirement (per todo):

    - At least one Work Log entry per session containing:
      - actions (file references)
      - commands executed
      - tests run
      - results
      - next steps

    Discovery + scope changes (ask each time):

    - If new, non-critical work is discovered, do NOT silently expand scope.
    - Ask the user to choose one:
      1) Do now (scope increase): only if small + tightly coupled
      2) Create a triage item: create a new `pending` todo (default `p3` unless urgent) to be approved or deferred via `/workflow:triage`
      3) Park for reference: create a todo with Problem Statement + Findings + rationale, then mark it **deferred** (`*-deferred-*.md`, `status: deferred`) so it is kept for future reference but not in the executable queue
      4) Compound candidate only: capture as a `/workflow:compound` documentation candidate (no todo by default)
    - Always record the decision in the todo Work Log.

   **Validation Gate (per todo)**

   Before marking a todo complete, you MUST prove the acceptance criteria are met.

   For each todo:
   - Re-state the acceptance criteria being validated (1–3 bullets)
   - Run the smallest verification that proves it (tests, command output, UI check)
   - Record evidence in the todo Work Log:
     - commands run + results
     - files changed (paths)
     - if UI: route(s) validated + screenshots/logs when applicable

   If validation fails:
   - stop and fix immediately, or
   - if blocked, follow the Blocker Protocol.

   **Blocker Protocol (pause implementation)**

   Trigger: you cannot proceed safely due to ambiguity, missing info, failing approach, or environment/tooling issue.

   Rules:
   - Pause implementation. Do not “push through” with guesses.
   - Timebox investigation to reach options (not a full rewrite).
   - Produce at least 3 viable options.

   Output format (always):
   - Blocker summary (1–2 sentences)
   - Constraints discovered (bullets)
   - Options (>=3): each with pros/cons, risks, effort
   - Recommendation: one option + why (2–4 bullets)
   - Decision prompt (single question): “Which option should we take?”

   After decision:
   - Convert the decision into explicit todos (implementation/investigation/deferral).
   - If the chosen option is to run a timeboxed investigation or prototype, follow the **Spike Protocol** below.
   - Record the decision + rationale in the todo Work Log.

   **Spike Protocol (allocate a spike)**

   Trigger: the plan includes spike/discussion todos (e.g. `tags: [spike]`), or the Blocker Protocol decision is to run a timeboxed investigation/prototype to de-risk.

   Steps:

   1. **Spike todo:** Create a new `todos/*-pending-*.md` todo tagged `tags: [spike]` (or convert the current blocked todo to a spike todo). Fill Problem Statement, Proposed Solutions (options), and Acceptance Criteria (deliverable). If triage has not been run, recommend `/workflow:triage` to approve the spike and set timebox + deliverable; then treat the spike as `ready` once approved.
   2. **Isolated execution:** Recommend a dedicated spike worktree. Use `skill: git-worktree` with branch name `spike/<todo_id>-<slug>` (e.g. `spike/003-auth-approach`). Run worktree bootstrap per the git-worktree skill. Execute the spike in that worktree so build work is not mixed with exploration.
   3. **Research subagents (per spike):** Run in parallel when useful:
      - Always (when agents exist): Task repo-research-analyst(context), Task learnings-researcher(context)
      - Conditional: Task framework-docs-researcher(topic), Task best-practices-researcher(topic), Task git-history-analyzer(context) when touching existing behavior or framework choices
   4. **Spike deliverable (required in spike todo Work Log):**
      - Options (>=3) with pros/cons, risks, effort
      - Recommendation (one option + why)
      - Concrete next steps: create or update build todos (or plan checkbox to flip) so the main plan can proceed
      - **Should we compound this?** yes/no + one-line why (if yes, recommend `/workflow:compound` with spike context after the spike is complete)
   5. **Multiple spikes:** If there are N approved spike todos and they are independent, create N worktrees (one per spike, under configured `worktree_dir`). Run one spike per worktree; when the environment supports multiple agents, spikes may run in parallel.
   6. **After spike completion:** Mark the spike todo complete (`*-complete-*.md`). If the deliverable said "compound: yes", recommend running `/workflow:compound` with the spike context so the learning is captured in `docs/solutions/` with `tags: [..., spike]`.

 2. **Follow Existing Patterns**

   - The plan should reference similar code - read those files first
   - Match naming conventions exactly
   - Reuse existing components where possible
   - Follow project coding standards (see AGENTS.md)
   - When in doubt, grep for similar implementations

 3. **Test Continuously**

   - Run relevant tests after each significant change
   - Don't wait until the end to test
   - Fix failures immediately
   - Add new tests for new functionality

 4. **UI Validation (Optional)**

   If the plan includes UI changes:

   - Validate key flows and critical screens.
   - Use `/test-browser` for snapshots and basic interaction checks when applicable.

 5. **Track Progress**
    - Keep todo files updated as you complete work
    - Note any blockers or unexpected discoveries
    - Create new tasks if scope expands
    - Keep user informed of major milestones

### Phase 3: Quality Check

1. **Run Core Quality Checks**

   Always run before declaring the work complete:

   ```bash
    # Run full test suite (use project's test command)
    # Examples: bin/rails test, npm test, pytest, go test, etc.

     # Run linting (per AGENTS.md)
   ```

   Prefer running the configured commands from `AGENTS.md`:

   - `test_command` (required when available)
   - `test_fast_command` (optional)
   - `lint_command` (optional)
   - `format_command` (optional)

   If `test_command` is not configured, ask once for the project's test command and suggest adding it to `AGENTS.md`.

2. **Consider Reviewer Agents** (Optional)

   Use for complex, risky, or large changes.

   If this repo defines preferred review agents in `AGENTS.md`, follow that.

   If not configured, skip specialist reviewers by default.

3. **Final Validation**
   - All todo files created for this plan are marked complete
   - All tests pass
   - Linting/formatting checks pass (if configured)
   - Code follows existing patterns
   - UI validation completed (if applicable)
   - No console errors or warnings

4. **Update Plan Status**

   If the input document has YAML frontmatter with a `status` field, update it to `completed`:
   ```
   status: active  →  status: completed
   ```

5. **Notify User**
     - Summarize what was completed
     - Note any follow-up work needed
     - Suggest next steps if applicable

   Risk-based recommendation:

   - If the plan fidelity is `high` or confidence is `low`, recommend running `/workflow:review current` before considering the work complete.

Stop here by default.

If the user wants to ship (commits/PR/screenshots), handle that as a separate explicit request or a separate command.

---

## Key Principles

### Start Fast, Execute Faster

- Get clarification once at the start, then execute
- Don't wait for perfect understanding - ask questions and move
- The goal is to **finish the feature**, not create perfect process

### The Plan is Your Guide

- Work documents should reference similar code and patterns
- Load those references and follow them
- Don't reinvent - match what exists

### Test As You Go

- Run tests after each change, not at the end
- Fix failures immediately
- Continuous testing prevents big surprises

### Quality is Built In

- Follow existing patterns
- Write tests for new code
- Run linting/formatting as configured in `AGENTS.md`
- Use reviewer agents for complex/risky changes only

### Ship Complete Features

- Mark all tasks completed before moving on
- Don't leave features 80% done
- A finished feature that ships beats a perfect feature that doesn't

## Quality Checklist

Before marking work complete, verify:

- [ ] All clarifying questions asked and answered
- [ ] All todo files created for this plan are marked complete
- [ ] Tests pass (run `test_command`)
- [ ] Linting/formatting passes (run `lint_command` / `format_command` if configured)
- [ ] Code follows existing patterns
- [ ] UI validation completed (if applicable; use `/test-browser` when useful)
- [ ] If shipping is requested, capture any required artifacts (screenshots, release notes) per repo conventions

## When to Use Reviewer Agents

**Don't use by default.** Use reviewer agents only when:

- Large refactor affecting many files (10+)
- Security-sensitive changes (authentication, permissions, data access)
- Performance-critical code paths
- Complex algorithms or business logic
- User explicitly requests thorough review

For most features: tests + linting + following patterns is sufficient.

## Common Pitfalls to Avoid

- **Analysis paralysis** - Don't overthink, read the plan and execute
- **Skipping clarifying questions** - Ask now, not after building wrong thing
- **Ignoring plan references** - The plan has links for a reason
- **Testing at the end** - Test continuously or suffer later
- **Forgetting todo updates** - Update todo files and plan checkboxes or lose track of progress
- **80% done syndrome** - Finish the feature, don't move on early
- **Over-reviewing simple changes** - Save reviewer agents for complex work
