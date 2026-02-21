---
name: work
description: Execute a plan file systematically (implementation + verification) without auto-shipping
argument-hint: "<required: plan file path>"
---

# /work

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

   1) Check your current branch:

   - If you are already on a branch that clearly matches this plan, continue.
   - Otherwise, offer a worktree for parallel isolation.

   2) Ask the user:

   - "Do you want to use a worktree for this work? (recommended for isolation)"
   - If yes: "What branch name should I use?" (e.g., `feat/<slug>`, `fix/<slug>`)

   3) If worktree is chosen, run:

   ```bash
   skill: git-worktree
   # Provide the branch name and optional base branch if needed
   ```

   4) If worktree is not chosen:

   - Create or switch to a feature branch (never work directly on the default branch).

3. **Create Todo List**
   - Use the `file-todos` skill to break the plan into actionable, persistent todo files under `todos/`
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

   - If any todos are `pending`, stop and offer `/triage` to approve and prioritize before execution.
   - If all todos are `ready`, proceed to Phase 2.

### Phase 2: Execute

1. **Task Execution Loop**

   Todo selection rules (default):

   - Consider only `todos/*-ready-*.md` items.
   - Skip blocked todos:
     - blocked if `dependencies` is non-empty and any dependency does not have a corresponding `*-complete-*.md` file.
   - Prioritize by priority then id:
     - `p1` before `p2` before `p3`
     - lower `issue_id` first

   Stop condition:

   - If no unblocked `ready` todos remain:
     - summarize remaining `pending` and blocked items
     - recommend running `/triage`
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
      - Update the todo file Work Log and Acceptance Criteria
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

    Scope changes:

    - If new work is discovered:
      - create a new `pending` todo (default priority `p2`), capture context, and link it to the plan.
      - do not silently expand scope inside an existing todo unless it remains small and tightly coupled.

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

   - If the plan fidelity is `high` or confidence is `low`, recommend running `/review current` before considering the work complete.

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
