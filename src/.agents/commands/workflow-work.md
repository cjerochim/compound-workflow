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

Contract precedence: if this command conflicts with other workflow docs, follow `docs/principles/workflow-baseline-principles.md`, then `src/AGENTS.md`, then this command.

It is critical that you follow this workflow in order; do not skip or shortcut steps.

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

   If the plan or implementation involves state-machine or actor
   orchestration, load the selected state-orchestration skill (see Skill
   Index in AGENTS.md) before coding.

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
   - `typecheck_command` (optional)
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

1.6. **Run-Scoped Quality Gate Fallback Setup (PREP STEP)**

   Ask-once fallback policy for missing lint/typecheck config:

   - If `lint_command` and/or `typecheck_command` is missing from `AGENTS.md`, ask once in this run for run-provided commands.
   - Record run-provided commands in the first active todo Work Log entry.
   - Continue only when provided commands run successfully.
   - If commands are not provided or fail, do not mark related todos complete.

   Note: full execution preflight (auto-triage + contract checks + isolation checks) runs after todo creation in Step 3.5.

1.75. **Resolve Plan Scope Contract (REQUIRED)**

   Before any environment setup or implementation, resolve the plan's scope contract:

   - `solution_scope`: `partial_fix | full_remediation | migration`
   - `completion_expectation`: explicit definition of done
   - `non_goals`: explicitly out of scope

   If any scope-contract field is missing:

   - Pause execution and ask the user to update the plan via `/workflow:plan`, or provide explicit values now.
   - Record the resolved values in the first todo Work Log entry before coding.

   Scope implications:

   - `partial_fix`: maintain an explicit remaining-gaps list while executing.
   - `migration`: identify migration verification + rollback checks before executing todos.
   - `full_remediation`: complete all known gaps in the scoped area before completion.

2. **Setup Environment (HARD GATE - WORKTREE FIRST)**

   Determine how to isolate the work for this plan.

   This gate MUST run immediately after Step 1.75.

   No file writes, implementation commands, test/lint/typecheck commands, or dependency-install commands may run before this gate passes.

   Allowed before gate: read-only inspection only (e.g., `ls`, `rg`, `cat`, `git status`, `git branch`).

   Default: use a worktree. Opt-out requires explicit user confirmation.

   1) Resolve your current branch (this is the default worktree base):

   - If you are already on a branch that clearly matches this plan, continue.
   - Otherwise, continue anyway — the current active branch remains the reference/base for a new worktree unless the user explicitly requests a different base.

   2) Resolve the user decision (required prompt/create gate):

   - If the user already gave an explicit instruction in this run:
     - "create a worktree" / "yes use a worktree" => use worktree path
     - "do not use a worktree" / "no worktree" => opt-out path
   - Otherwise, you MUST ask this exact decision before proceeding:
     - "Use a worktree for this work? (Yes/No; default recommendation: Yes)"
   - Options:
     - Yes (worktree)
     - No (stay in current checkout; create/switch to a feature branch)

   Mandatory behavior:

   - Do not infer or assume an answer when the user has not answered.
   - Do not run `skill: git-worktree` until the user has answered Yes (or already explicitly requested worktree creation).
   - If Yes: ask for the new branch name when missing (e.g., `feat/<slug>`, `fix/<slug>`), then continue.
   - If No: require explicit opt-out confirmation, then continue with the non-worktree path.

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

   - Require explicit user confirmation of the opt-out.
   - Create or switch to a feature branch (never work directly on the default branch).
   - Record the execution branch in a visible place.

   Gate completion record (REQUIRED before Phase 2):

   - `worktree_decision: yes|no`
   - `worktree_path: <path>` when yes, else `execution_branch: <branch>`
   - `gate_status: passed`

2.5. **Preflight Violation Recovery (REQUIRED)**

   If implementation starts before the hard gate above is completed:

   - Immediately disclose the violation.
   - Stop all implementation actions.
   - Return to Step 2 and complete the gate record.
   - Resume only after `gate_status: passed`.

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
     - `pending` when plan confidence is low or requires additional triage decisions
   - Default todo `priority`: `p2` unless the plan indicates urgency/risk.

   After creating todos, run an in-command triage pass (same readiness/dependency rules as `/workflow:triage`) before any implementation work:

   - approve/prioritize queue items for this plan
   - make execution order explicit
   - if no unblocked `ready` todos remain, stop and report pending/deferred/blocked items
   - use standalone `/workflow:triage` only when the user explicitly requests manual queue curation

3.5. **Execution Preflight (HARD GATE before Phase 2)**

   Contract checksum (MUST all be true before implementation):

   - auto-triage completed for this plan (or standalone `/workflow:triage` completed)
   - isolation gate recorded (`worktree_decision`, execution context, `gate_status: passed`)
   - blocking spikes execute before dependent build todos

   Before any implementation commands:

   - Verify each `ready` todo has an executable Agentic Execution Contract:
     - access preconditions are explicit
     - validation path is explicit (commands/routes/checks)
     - evidence expectations are explicit
     - quality gate commands are explicit or marked for ask-once fallback
   - If a todo lacks this contract, move it to `pending` and require triage resolution before coding.

### Phase 2: Execute

1. **Task Execution Loop**

   All implementation edits (file reads/writes) and all terminal commands (run tests, install, lint, etc.) MUST use the execution context resolved in Step 2.

   - If `worktree_decision: yes`: use the worktree path for file paths and set terminal cwd to the worktree root. Do not make code changes in the main repo checkout.
   - If `worktree_decision: no`: use the recorded execution branch context only (never default branch).

   Todo selection rules (default):

   - Consider only `todos/*-ready-*.md` items. Do not execute `pending` or `deferred` todos.
   - Skip blocked todos:
     - blocked if `dependencies` is non-empty and any dependency does not have a corresponding `*-complete-*.md` file.
   - Prioritize blocking spikes first:
     - if a ready spike todo unblocks downstream implementation todos, execute that spike before dependent build todos.
     - independent ready spikes may run in parallel when environment/worktree setup supports it.
   - Prioritize by priority then id:
     - `p1` before `p2` before `p3`
     - lower `issue_id` first

   Stop condition:

   - If no unblocked `ready` todos remain:
     - summarize remaining `pending`, `deferred` (parked for reference), and blocked items
     - require re-running triage (auto-triage within `/workflow:work` or standalone `/workflow:triage`) for pending/blocked prioritization
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
      - status context (`ready`, `pending`, `complete`)

    Discovery + scope changes (ask each time):

    - If new, non-critical work is discovered, do NOT silently expand scope.
    - Ask the user to choose one:
      1) Do now (scope increase): only if small + tightly coupled
      2) Create a triage item: create a new `pending` todo (default `p3` unless urgent) to be approved or deferred via triage
      3) Park for reference: create a todo with Problem Statement + Findings + rationale, then mark it **deferred** (`*-deferred-*.md`, `status: deferred`) so it is kept for future reference but not in the executable queue
      4) Compound candidate only: capture as a `/workflow:compound` documentation candidate (no todo by default)
    - Always record the decision in the todo Work Log.

   **Validation Gate (per todo)**

   Before marking a todo complete, you MUST prove acceptance/success criteria are met.

   For each todo:
   - Re-state the acceptance/success criteria being validated (1–3 bullets)
   - Run the smallest verification that proves it (tests, command output, UI check)
   - Run lint/typecheck quality gates for changed scope:
     - `lint_command` when configured, else run the ask-once run-provided lint command
     - `typecheck_command` when configured, else run the ask-once run-provided typecheck command
   - Record evidence in the todo Work Log:
     - commands run + results
     - files changed (paths)
     - if UI: route(s) validated + screenshots/logs when applicable

   If validation fails:
   - stop and fix immediately, or
   - if blocked, follow the Blocker Protocol.

   Scope contract checks:
   - If `solution_scope: partial_fix`, update remaining gaps in todo Work Log as they are discovered.
   - If `solution_scope: migration`, record migration validation evidence and rollback readiness evidence before marking migration todos complete.

   **Blocker Protocol (pause implementation)**

   Trigger: you cannot proceed safely due to ambiguity, missing info, failing approach, or environment/tooling issue.

   **Stuck Guard (auto-research pre-step)**

   When the Blocker Protocol triggers, evaluate whether the guard should fire:

   **Trigger 1 — Unknown territory:** The agent explicitly cannot identify a clear next step after consulting available context and codebase patterns. Requires agent self-declaration (e.g. "required API behavior is not in context," "no codebase pattern exists for this operation").

   **Trigger 2 — Repeated failures:** ≥2 distinct failed approaches on the same todo step, OR ≥3 total failures on the same todo regardless of step or approach variety. Failure = a test, lint, type, or runtime check produces an error the agent cannot resolve within one further attempt.

   **Guard suppression:** The Stuck Guard MUST NOT fire for todos tagged `tags: [spike]`. If a Spike is inconclusive, surface through standard Spike completion flow.

   **When guard fires (steps 1–10, mandatory order):**

   1. Guard trigger detected (unknown_territory OR repeated_failure)
   2. Announce to user: "Pausing to investigate..."
   3. **Immediately** transition todo: `ready` → `pending + tags: [blocker]`
   4. Add placeholder Work Log entry: `"Stuck Guard triggered. Investigation in progress. [stuck_type]. [timestamp]. Partial changes may exist — review working directory before resuming."`
   5. Dispatch sub-agents in **parallel**:
      - **Mandatory (always):** `Task repo-research-analyst(<context>)`, `Task learnings-researcher(<context>)`
      - **Conditional (by signal, not discretion):**
        - If failure mentions external library/package/API → add `Task framework-docs-researcher(<context>)`
        - If stuck on approach/pattern/architecture choice → add `Task best-practices-researcher(<context>)`
        - If modifying existing code (not creating new) → add `Task git-history-analyzer(<context>)`
   6. Collect findings (single-pass; no recursive guard firing)
   7. Synthesize enriched output (format below)
   8. Update Work Log `Blocker Decision` section with full enriched output
   9. Present decision prompt to user
   10. After user decision: apply existing Blocker Protocol after-decision steps (convert to todos; triage re-approval before returning to `ready`)

   **Context payload for each sub-agent:**
   ```
   {
     todo_title: <title>,
     todo_description: <problem statement>,
     stuck_type: "unknown_territory" | "repeated_failure",
     failure_description: <specific error/blocker>,
     working_directory: <worktree path>
   }
   ```

   **Fallback when Task dispatch unavailable:** Announce: "Research sub-agents unavailable — proceeding with agent-reasoned options only." Produce standard Blocker output (no enrichment). Do NOT silently present unresearched options as researched.

   **Enriched output format (replaces standard Blocker output):**

   ```markdown
   ## Stuck Guard Triggered

   **Detected:** [unknown_territory | repeated_failure]
   **Investigating...** Launching: repo-research-analyst, learnings-researcher[, framework-docs-researcher][, best-practices-researcher][, git-history-analyzer]

   ---

   ## Research Findings

   - **repo-research-analyst:** [2–5 sentence summary, or "no findings returned"]
   - **learnings-researcher:** [2–5 sentence summary, or "no findings returned"]
   - **framework-docs-researcher:** [2–5 sentence summary, or "not invoked" | "no findings returned"]
   - **best-practices-researcher:** [2–5 sentence summary, or "not invoked" | "no findings returned"]
   - **git-history-analyzer:** [2–5 sentence summary, or "not invoked" | "no findings returned"]

   **Synthesis confidence:** `high` | `medium` | `low` (low when all agents return empty)

   ---

   ## Blocker Summary

   [1–2 sentences describing what blocked execution]

   ## Constraints Discovered

   - [constraint 1]
   - [constraint 2]

   ## Options

   **Option 1: [Name]** *(source: [agent name(s)] | agent-reasoned)*
   - Pros: ...
   - Cons: ...
   - Risk: ...
   - Effort: ...

   **Option 2: [Name]** *(source: [agent name(s)] | agent-reasoned)*
   - ...

   **Option 3: [Name]** *(source: [agent name(s)] | agent-reasoned)*
   - ...

   ## Recommendation

   [One option + 2–4 bullets citing research findings]

   ---

   *Which option should we take?*
   ```

   **When findings are empty:** Produce ≥3 options marked `*(agent-reasoned — research returned no findings)*`. Set synthesis confidence to `low`. Do not fabricate citations.

   **When a Spike is recommended:** Use standard Spike Candidate format from Spike Protocol (Initial priority, Depends on, Unblocks, Timebox, Deliverable, Parallelizable metadata).

   Rules:
   - Pause implementation. Do not “push through” with guesses.
   - Timebox investigation to reach options (not a full rewrite).
   - Produce at least 3 viable options.
   - Immediately move the active todo back to `pending`, add/ensure `tags: [blocker]`, and record blocker status in Work Log.

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
   - Re-approve the todo through triage before returning it to `ready`.

   **Spike Protocol (allocate a spike)**

   Trigger: the plan includes spike/discussion todos (e.g. `tags: [spike]`), or the Blocker Protocol decision is to run a timeboxed investigation/prototype to de-risk.

   Steps:

   1. **Spike todo:** Create a new `todos/*-pending-*.md` todo tagged `tags: [spike]` (or convert the current blocked todo to a spike todo). Fill Problem Statement, Proposed Solutions (options), and Acceptance Criteria (deliverable). Carry forward any plan metadata (initial priority, depends_on, unblocks, parallelizable). Ensure triage approves the spike and sets timebox + deliverable before treating it as `ready`.
   2. **Isolated execution:** Recommend a dedicated spike worktree. Use `skill: git-worktree` with branch name `spike/<todo_id>-<slug>` (e.g. `spike/003-auth-approach`). Run worktree bootstrap per the git-worktree skill. Execute the spike in that worktree so build work is not mixed with exploration.
   3. **Research subagents (per spike):** Run mandatory baseline research in parallel:
      - Always (when agents exist): Task repo-research-analyst(context), Task learnings-researcher(context)
      - Conditional: Task framework-docs-researcher(topic), Task best-practices-researcher(topic), Task git-history-analyzer(context) when touching existing behavior or framework choices
   4. **Spike deliverable (required in spike todo Work Log):**
      - Options (>=3) with pros/cons, risks, effort
      - Recommendation (one option + why)
      - Concrete next steps: create or update build todos (or plan checkbox to flip) so the main plan can proceed
      - **Should we compound this?** yes/no + one-line why (if yes, recommend `/workflow:compound` with spike context after the spike is complete)
   5. **Multiple spikes:** If there are N approved spike todos and they are independent, create N worktrees (one per spike, under configured `worktree_dir`). Run one spike per worktree; when the environment supports multiple agents, spikes may run in parallel. If spikes have dependency edges, execute them in dependency order.
   6. **After spike completion:** Mark the spike todo complete (`*-complete-*.md`). If the deliverable said "compound: yes", recommend running `/workflow:compound` with the spike context so the learning is captured in `docs/solutions/` with `tags: [..., spike]`.

 2. **Follow Existing Patterns**

   - The plan should reference similar code - read those files first
   - Match naming conventions exactly
   - Reuse existing components where possible
   - Load and follow `skill: standards` as the mandatory baseline for declarative, immutable, maintainable implementation quality
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
   - `typecheck_command` (optional)
   - `format_command` (optional)

   Ask-once fallback:

   - If `test_command` is not configured, ask once for the project's test command and suggest adding it to `AGENTS.md`.
   - If `lint_command` or `typecheck_command` is not configured, ask once for run-provided commands and use them for this run.

2. **Prepare Review Handoff (REQUIRED for code/config changes)**

   If this run changed code or configuration, prepare an explicit `/workflow:review current` handoff summary:

   - files changed
   - validations run and outcomes
   - known risks or unresolved notes

   Docs-only runs may skip this handoff using the docs-only review exemption.

3. **Standards Compliance Gate (REQUIRED for code/config changes)**

   For code/config changes, standards compliance is a hard gate before todo completion:

   - Use `skill: standards` as the source of truth.
   - This gate cannot run until the isolation/worktree gate is passed and recorded (`gate_status: passed`).
   - Record standards evidence in todo Work Log using the standards evidence format:
     - declarative flow
     - immutable transforms
     - maintainability boundaries
     - hidden mutable state check
   - If any mandatory standards line fails:
     - do not rename todo to `*-complete-*.md`
     - move todo back to `pending`
     - add `tags: [blocker]`
     - record blocking rationale + remediation steps in Work Log

   Docs-only runs: mark this gate `not_applicable` and continue.

4. **Final Validation**
   - All todo files created for this plan are marked complete
   - All tests pass
   - Linting/typechecking/formatting checks pass (configured or run-provided via ask-once fallback)
   - Code follows existing patterns and passes the standards compliance gate
   - UI validation completed (if applicable)
   - No console errors or warnings
   - Scope contract satisfied:
     - `partial_fix`: remaining gaps are materialized as `pending` or `deferred` todos before completion
     - `migration`: migration verification and rollback checks are documented as passing
     - `full_remediation`: scoped remediation goals are complete per `completion_expectation`

5. **Update Plan Status**

   If the input document has YAML frontmatter with a `status` field, update it to `completed`:
   ```
   status: active  →  status: completed
   ```

6. **Notify User**
     - Summarize what was completed
     - Note any follow-up work needed
     - Suggest next steps if applicable

   Completion policy:

   - If this run changed code or configuration, report status as:
     - `implementation_complete: true`
     - `workflow_complete: false (pending /workflow:review current)`
   - If this run is docs-only (no code/config changes), report status as:
     - `implementation_complete: true`
     - `workflow_complete: true (docs-only review exemption)`

Stop here by default.

If the user wants to ship (commits/PR/screenshots), handle that as a separate explicit request or a separate command.

---

## Key Principles

### Execute with Deterministic Gates

- Resolve unclear requirements early, then execute decisively
- Keep hard gates explicit and non-skippable
- Optimize for correct, verifiable completion

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
- Run linting/typechecking/formatting as configured in `AGENTS.md` (or run-provided via ask-once fallback)
- For code/config changes, require `/workflow:review current` before declaring workflow completion

### Ship Complete Features

- Mark all tasks completed before moving on
- Don't leave features 80% done
- A finished feature that ships beats a perfect feature that doesn't

## Quality Checklist

Before marking work complete, verify:

- [ ] All clarifying questions asked and answered
- [ ] Hard gate completed before implementation (`worktree_decision`, execution context, `gate_status: passed`)
- [ ] All todo files created for this plan are marked complete
- [ ] Tests pass (run `test_command`)
- [ ] Linting/typechecking/formatting passes (run `lint_command` / `typecheck_command` / `format_command`; ask once if lint/typecheck is not configured)
- [ ] Code follows existing patterns
- [ ] UI validation completed (if applicable; use `/test-browser` when useful)
- [ ] Scope contract satisfied (`solution_scope`, `completion_expectation`, `non_goals`)
- [ ] For `partial_fix`, unresolved work is captured as `pending/deferred` todos
- [ ] If shipping is requested, capture any required artifacts (screenshots, release notes) per repo conventions

## Review Completion Gate

For code/config changes, completion of `/workflow:work` is implementation-complete only. Workflow completion requires `/workflow:review current`.

Docs-only exception:

- If no code/config files changed, `/workflow:work` may close as workflow-complete without `/workflow:review`.
- When taking this exemption, explicitly state "docs-only review exemption" in the final summary.

## Common Pitfalls to Avoid

- **Analysis paralysis** - Don't overthink, read the plan and execute
- **Skipping clarifying questions** - Ask now, not after building wrong thing
- **Skipping the worktree hard gate** - No implementation before Step 2 gate passes
- **Starting writes before isolation gate** - no file writes or run commands before Step 2
- **Ignoring plan references** - The plan has links for a reason
- **Testing at the end** - Test continuously or suffer later
- **Forgetting todo updates** - Update todo files and plan checkboxes or lose track of progress
- **80% done syndrome** - Finish the feature, don't move on early
- **Skipping required review on code/config changes** - workflow completion requires `/workflow:review current`
