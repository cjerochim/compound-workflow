---
name: work
invocation: workflow:work
description: Orchestrate execution of an approved plan by deriving executable todo contracts, resolving skills from AGENTS.md, sequencing work by dependencies, delegating execution to subagents, enforcing intent alignment, and requiring independent verification before completion
argument-hint: "<required: plan file path>"
---

# /workflow:work

Orchestrate execution of an approved plan. This command plans, delegates, collects, and verifies — it does not implement directly.

## Introduction

Correctness takes priority over speed.
Do not optimise for momentum if it risks drift, ambiguity, or a weaker solution.

Contract precedence: if this command conflicts with other workflow docs, follow `docs/principles/workflow-baseline-principles.md`, then `src/AGENTS.md` or `AGENTS.md`, then this command.

It is critical that you follow this workflow in order; do not skip or shortcut steps.

## Core Shift

This command is an orchestrator, not an implementer.

This command is responsible for:

- reading and validating the approved plan
- deriving executable todo contracts from approved feature requirements
- preserving intent from the plan during task derivation and execution
- resolving required skills from the capability registry
- determining execution order based on dependencies and preconditions
- **delegating execution to subagents**
- **collecting and verifying subagent output**
- routing work through required review gates
- deciding `complete`, `changes_required`, `blocked`, or `plan_conflict`

This command is not responsible for:

- implementing the feature directly
- redefining the approved plan
- improving or reshaping the approved solution during execution
- self-approving unverified work
- skipping dependency or review gates to move faster
- silently inventing new scope to fill gaps in the plan

## Non-goals (unless explicitly requested)

- Creating commits
- Pushing branches
- Creating pull requests

## DO NOTs

- Do not skip plan validation
- Do not skip registry resolution
- Do not delegate without a full todo contract
- Do not delegate without passing the intent alignment gate
- Do not unblock downstream tasks from `implemented`
- Do not mark tasks complete without required review
- Do not silently absorb plan ambiguity
- Do not silently improve the plan during execution
- Do not modify the capability registry in this command
- Do not create commits, push branches, or create PRs unless explicitly asked
- Do not claim feature completion if only implementation exists without verification
- Do not use invalid state transitions
- Do not treat described phases as optional guidance
- Do not prefer speed over correctness

## Input Document

<input_document> #$ARGUMENTS </input_document>

The input must be a plan file path.

- If it is empty, ask the user for the plan file path.
- If it does not exist or is not readable, stop and ask for the correct path.
- Read the plan file completely before starting work.

## Operating Priority

1. Correct solution
2. Alignment to approved intent
3. Clear verification
4. Safe dependency order
5. Execution efficiency

Never trade correctness for speed.

---

## Gate Model

Gates are mandatory. A task MUST NOT advance unless the conditions of the next gate are satisfied.

### Gate Summary

- Contract Gate
- Dependency Gate
- Intent Alignment Gate
- Execution Gate
- Validation Gate
- Review Gate
- Drift Detection Gate
- Completion Gate

### Contract Gate

A task may only move from `drafted` to `ready` when:

- the todo contract is valid
- the objective is clear
- the responsibility is clear
- acceptance criteria are present
- dependencies are defined
- required skills are resolved
- required validation commands are known
- required verification gates are defined
- the intent anchor is present

### Dependency Gate

A task may only move from `ready` to `in_progress` when:

- all dependencies are `complete`
- all preconditions are satisfied
- no blocking discussion/spike todo is unresolved
- required access exists

### Intent Alignment Gate

A task may only move from `ready` to `in_progress` when:

- the intent alignment check passes
- no plan drift is detected before delegation

### Execution Gate

A task may only move from `in_progress` to `implemented` when:

- execution output was returned from the subagent
- expected outputs were produced
- implementation summary was provided
- changed files were declared
- tests run were recorded or explicitly marked not applicable with reason

### Validation Gate

A task may only move from `implemented` to `in_review` when:

- required validation commands were executed
- results were captured
- evidence required by the todo contract is present

### Review Gate

A task may only move from `in_review` to `complete` when:

- every required verification gate passed
- all acceptance criteria are satisfied
- no critical issue remains open
- the result still aligns with the approved plan

A task in `in_review` must move to `changes_required` when:

- any required validation fails
- any required review fails
- evidence is incomplete
- the result does not satisfy the contract

### Drift Detection Gate

A task may only move from `in_review` to `complete` when:

- the drift detection gate passes
- no silent scope, constraint, or intent change was introduced

### Completion Gate

A task is only complete when:

- all prior gates passed
- the orchestrator accepts the result as satisfying the todo contract
- downstream work can safely rely on it

A subagent saying "done" is not enough. Code existing is not enough.

---

## Enforced State Model

```yaml
task_status_flow:
  drafted:
    can_transition_to:
      - ready
      - blocked
  ready:
    can_transition_to:
      - in_progress
      - blocked
      - plan_conflict
  in_progress:
    can_transition_to:
      - implemented
      - blocked
      - changes_required
      - plan_conflict
  implemented:
    can_transition_to:
      - in_review
      - changes_required
      - plan_conflict
  in_review:
    can_transition_to:
      - complete
      - changes_required
      - plan_conflict
  changes_required:
    can_transition_to:
      - ready
      - in_progress
      - blocked
  blocked:
    can_transition_to:
      - ready
  complete:
    terminal: true
  plan_conflict:
    terminal: true
```

Rules:

- Any invalid transition is a workflow failure — report immediately.
- `implemented -> complete` is not allowed.
- `drafted -> in_progress` is not allowed.
- `ready -> complete` is not allowed.

---

## Hard Stop Conditions

Stop immediately and report when any of the following occur:

- the plan is missing acceptance criteria
- the plan is missing clear scope or non-goals
- a todo has no clear responsibility
- a todo has no explicit acceptance criteria
- a todo has no intent anchor
- required skills cannot be resolved
- the capability registry is missing or ambiguous
- dependencies are cyclic, undefined, or contradictory
- required validation commands are missing
- a task attempts to skip a required gate
- a plan conflict is detected that affects dependent work

Do not continue through ambiguity.

---

## Intent Preservation Rules

Intent from the approved plan is locked for execution. The orchestrator must execute approved intent — not reinterpret, expand, or silently improve it.

### Intent lock

Every todo must carry an explicit intent anchor derived from the plan:

```yaml
intent_anchor:
  objective: <exact or tightly paraphrased objective from plan>
  scope_notes:
    - <relevant scope boundaries from plan>
  constraints:
    - <relevant constraints from plan>
  acceptance_criteria:
    - <relevant acceptance criteria from plan>
  non_goals:
    - <relevant non-goals from plan>
  source_plan_reference:
    file: <plan path>
    section: <heading or anchor>
```

Rules:

- the orchestrator must not modify the intent anchor during execution
- a todo may narrow execution detail, but must not change product intent
- if a better idea is discovered, record it as a follow-up note — do not fold it into execution

### Intent alignment check

Before a todo moves from `ready` to `in_progress`, verify:

- the todo objective still matches the plan objective
- the todo still contributes to plan acceptance criteria
- the todo does not introduce new scope
- the todo does not weaken or bypass plan constraints
- the todo does not conflict with declared non-goals

If any check fails: set the todo to `plan_conflict` and stop dependent execution.

### Drift detection

After subagent output is collected and before final completion, explicitly check:

- does the implemented result still align to the original plan intent?
- did execution introduce new assumptions?
- did scope expand or shift?
- did constraints get bypassed or softened?

If yes: set `status = plan_conflict`, stop further dependent execution, surface the drift for review.

---

## Execution Workflow

### Phase 1: Setup & Validation

#### 1.1 Read and Validate Plan File

- Read the plan file completely
- Confirm the file exists and is readable
- If missing acceptance criteria, scope, or non-goals — stop and return for refinement
- Do not compensate for a weak plan by improvising hidden assumptions

#### 1.2 Resolve Repo Defaults

Read `AGENTS.md` and look for the Repo Config Block. Resolve:

- `test_command`
- `test_fast_command` (optional)
- `lint_command` (optional)
- `typecheck_command` (optional)
- `format_command` (optional)

If any required quality gate command is missing:

- ask once for run-provided commands
- record them in the first active todo work log entry
- do not mark related todos complete unless the commands were run successfully

#### 1.3 Resolve Plan Contract

Extract from the plan:

- feature objective
- scope contract (`solution_scope`, `completion_expectation`, `non_goals`)
- acceptance criteria
- constraints
- rollout expectations
- risk/fidelity/confidence if present
- `Agentic Access & Validation Contract`
- implementation phases, tasks, and checklists
- discussion points and spikes if present

If any of the following are missing, stop and return the plan for refinement:

- clear objective
- explicit acceptance criteria
- explicit scope or non-goals
- actionable access/validation contract
- enough implementation detail to derive executable tasks

#### 1.4 Resolve Skill Assignments

Read the Skill Index from `AGENTS.md`.

For each implementation phase or task in the plan:

- Check if the plan already carries `required_skills` annotations (written during `/workflow:plan`)
- If annotations exist: validate each skill against the registry — confirm it exists and is applicable
- If annotations are missing: resolve skills now by mapping task responsibility, objective, and constraints to the Skill Index
- Record resolved skills per task — these will be attached to todo contracts in Phase 3

If a required skill cannot be resolved from the registry:

- surface it as a capability gap
- do not proceed with that task until resolved

#### 1.5 Resolve Testing Cadence

Infer testing cadence from the plan's risk profile.

- Prefer `fidelity` and `confidence` from plan frontmatter if present
- Otherwise default to `fidelity=medium`, `confidence=medium`

Testing cadence:

- Low risk: fast checks per todo, full suite at milestone and end
- Medium risk: fast checks per todo, full suite at milestones + end
- High risk: fast checks per todo, full suite frequently (every 1–2 build todos) + end

Record the chosen cadence before execution begins.

---

### Phase 2: Environment Setup (Hard Gate)

No file writes, implementation commands, test/lint/typecheck commands, or dependency-install commands may run before this gate passes.

Allowed before gate: read-only inspection only (e.g. `ls`, `git status`, `git branch`).

**Default: use a worktree. Opt-out requires explicit user confirmation.**

Steps:

1. Resolve your current branch (this is the default worktree base)
2. Ask the user: create a worktree for this plan? (Yes / No — explicit opt-out required)
3. If Yes: ask for branch name if missing (e.g. `feat/<slug>`, `fix/<slug>`), then run `skill: git-worktree`
4. If No: require explicit opt-out confirmation, then create or switch to a feature branch (never work directly on the default branch)

Worktree bootstrap (required when worktree created):

- Immediately after entering the new worktree, run bootstrap per the `git-worktree` skill
- Copy env/config, install deps, apply `worktree_bootstrap_notes`
- Record the worktree path (e.g. `.worktrees/feat-xyz`) in a visible place — all subsequent steps use this as the implementation root

Gate completion record (required before Phase 3):

- `worktree_decision: yes|no`
- `worktree_path: <path>` when yes, else `execution_branch: <branch>`
- `gate_status: passed`

**Preflight Violation Recovery:** If implementation starts before this gate is complete — disclose the violation immediately, stop all implementation actions, return to Phase 2, complete the gate record, resume only after `gate_status: passed`.

---

### Phase 3: Derive Todo Contracts

Convert the approved plan into executable todo contracts.

A todo is not a note. A todo is not a loose checklist item. A todo is an executable contract that can be delegated to a subagent, verified, and closed.

#### 3.1 Todo Contract Rules

Every derived todo must be:

- independently understandable
- narrow enough to execute without hidden subprojects
- mapped to a single primary responsibility
- explicit about dependencies
- explicit about verification
- explicit about evidence required for closure
- explicitly anchored to approved intent
- carrying resolved skill assignments from Phase 1.4

If a candidate task is too broad: split it before delegation.
If a candidate task is ambiguous: refine it before delegation.
If a candidate task depends on unresolved decisions: mark it `blocked`.

#### 3.2 Required Todo Contract Schema

Every executable todo MUST contain:

```yaml
id: <stable task id>
title: <short action-oriented title>
status: drafted
type: build | review | qa | docs | spike | discussion
objective: <what this task must achieve>
responsibility: <primary responsibility domain>
required_skills:
  - <resolved from plan annotations or Phase 1.4>
optional_skills:
  - <attached when they materially reduce risk>
intent_anchor:
  objective: <from plan>
  scope_notes:
    - <relevant scope boundary>
  constraints:
    - <relevant constraint>
  acceptance_criteria:
    - <relevant acceptance criterion>
  non_goals:
    - <relevant non-goal>
  source_plan_reference:
    file: <plan path>
    section: <heading or anchor>
depends_on:
  - <task ids or none>
preconditions:
  - <conditions that must be true before execution>
inputs:
  - <required references, docs, plan sections, fixtures, routes>
constraints:
  - <do not change x>
  - <must align to y>
expected_outputs:
  - <artifact or implementation output>
acceptance_criteria:
  - <task-level success condition>
validation_commands:
  - <repo-runnable checks>
verification:
  - type: technical_review | qa_review | integration_check | docs_review | custom
    required: true
    status: pending | approved | changes_required | not_required
    notes: null
evidence_required:
  - <logs, screenshots, test output, file list, notes>
unblocks:
  - <downstream task ids or none>
work_log: []
implementation_summary: null
files_changed: []
tests_run: []
evidence_collected: []
drift_check:
  status: pending | passed | failed
  notes: null
open_issues: []
review_outcome:
  summary: pending
```

#### 3.3 Todo Status Model

- `drafted` — derived but not yet ready to execute
- `ready` — dependencies and preconditions satisfied
- `blocked` — cannot start due to dependency, access, or unresolved decision
- `in_progress` — delegated and being executed by a subagent
- `implemented` — subagent output returned, not yet verified
- `in_review` — undergoing required verification gates
- `changes_required` — failed verification or returned incomplete evidence
- `complete` — all required verification gates passed
- `plan_conflict` — execution exposed a conflict with approved plan intent

Important: `implemented` does not unblock downstream work. Only `complete` unblocks downstream work.

#### 3.4 Responsibility Classification

Every todo must declare one primary responsibility. If a task truly spans multiple major responsibilities, split it.

Recommended values: `frontend`, `backend`, `schema`, `testing`, `playwright`, `infra`, `docs`, `spike`, `discussion`, `technical_review`, `qa_review`

#### 3.5 Blocking Unknowns

When the plan includes unresolved decisions, missing access, risky unknowns, spike candidates, or discussion points — these must become explicit todos before dependent build work begins.

- discussion todos → resolve decisions (no code)
- spike todos → reduce risk with a timebox and deliverable
- build work blocked by them stays `blocked`

#### 3.6 Create Todo Files

Confirm `file-todos` exists in the AGENTS.md registry before running. If missing, surface as a capability gap and stop.

Run:

```
skill: file-todos
# Input: plan file path
# Output: todos/*-ready-*.md and/or todos/*-pending-*.md
```

Prerequisites:

- Ensure `todos/` exists; create it if not
- Ensure the todo template exists at `file-todos/assets/todo-template.md` within the skills directory of the current harness (resolve from `harnesses` in AGENTS.md Repo Config)

Plan → todos mapping:

- implementation phases/tasks → build todos (carrying `required_skills` from plan)
- discussion points → discussion todos (`status: pending`)
- spike candidates → spike todos (`status: pending`)
- review/qa requirements → review/qa todos

#### 3.7 Dependency Rules

Execution order is dependency-driven, not list-order driven.

A todo is `ready` only when all `depends_on` items are `complete` and all `preconditions` are satisfied.

A todo is `blocked` when any dependency is not `complete`, any precondition is unmet, required access is missing, or a blocking spike/discussion task is unresolved.

The orchestrator must:

- recompute readiness after every task completion, rework, or block
- never delegate a blocked task
- never allow `implemented` work to unblock downstream tasks

---

### Phase 4: Triage Pass

Run an in-command triage pass before any implementation work.

- Approve and prioritize the queue for this plan
- Make execution order explicit
- Confirm blocking spikes are front-loaded before dependent build todos
- Verify every `ready` todo has an executable contract (access preconditions, validation path, evidence expectations, quality gate commands all explicit)
- If no unblocked `ready` todos remain: stop and report pending/deferred/blocked items

Use standalone `/workflow:triage` only when the user explicitly requests manual queue curation.

Contract checksum (all must be true before proceeding to Phase 5):

- [ ] auto-triage completed
- [ ] isolation gate recorded (`worktree_decision`, `gate_status: passed`)
- [ ] blocking spikes front-loaded
- [ ] every `ready` todo has explicit agentic execution contract

---

### Phase 5: Task Execution Loop

All file writes and terminal commands MUST use the execution context resolved in Phase 2.

- If `worktree_decision: yes`: use the worktree path. Do not make code changes in the main repo checkout.
- If `worktree_decision: no`: use the recorded execution branch only (never default branch).

#### Todo Selection Rules

- Consider only `todos/*-ready-*.md` items
- Skip blocked todos (any dependency without a corresponding `*-complete-*.md`)
- Prioritise blocking spikes first
- Then prioritise by priority (`p1` before `p2` before `p3`), then lower `issue_id` first

Stop condition: if no unblocked `ready` todos remain, summarise pending/deferred/blocked items and stop. Do not invent work.

#### Execution Loop

For each ready todo in priority order:

```
1. SELECT   — next ready, unblocked todo
2. CHECK    — intent alignment gate passes
3. DELEGATE — dispatch to subagent with:
               - todo contract (objective, constraints, acceptance criteria)
               - resolved required_skills
               - intent anchor
               - execution context (worktree path / branch)
               - relevant plan sections and file references
4. COLLECT  — receive subagent output:
               - implementation summary
               - files changed
               - tests run
               - evidence collected
5. VALIDATE — run validation gate:
               - re-state acceptance criteria being validated (1–3 bullets)
               - run required validation commands
               - run lint/typecheck for changed scope
               - record evidence in todo Work Log
6. REVIEW   — assess against todo contract:
               - all acceptance criteria satisfied?
               - evidence complete?
               - no new scope introduced?
7. DRIFT    — verify result aligns to original plan intent
8. ADVANCE  — move to `complete` if all gates pass
             — move to `changes_required` if any gate fails
9. SYNC     — flip corresponding plan checkbox [ ] → [x]
10. RECOMPUTE — update readiness of downstream todos
```

#### Parallel Execution

Allowed only when:

- tasks do not depend on each other
- tasks do not mutate the same fragile surface in conflicting ways
- verification and merge-back can remain clear
- intent alignment can remain clear for each task independently

#### Discovery & Scope Changes

If new, non-critical work is discovered, do NOT silently expand scope. Ask the user to choose:

1. Do now (scope increase): only if small + tightly coupled
2. Create a triage item: new `pending` todo (default `p3` unless urgent)
3. Park for reference: `*-deferred-*.md` with problem statement + findings
4. Compound candidate only: capture as `/workflow:compound` documentation candidate

Always record the decision in the todo Work Log.

#### Scope Contract Checks (per todo)

- If `solution_scope: partial_fix`: update remaining gaps in todo Work Log as discovered
- If `solution_scope: migration`: record migration validation evidence and rollback readiness before marking migration todos complete

#### Stuck Guard

Trigger: cannot identify a clear next step after consulting available context, OR ≥2 distinct failed approaches on the same todo step, OR ≥3 total failures on the same todo.

Guard suppression: MUST NOT fire for todos tagged `tags: [spike]`.

When guard fires (mandatory order):

1. Detect trigger (`unknown_territory` OR `repeated_failure`)
2. Announce: "Pausing to investigate..."
3. Transition todo: `ready` → `pending + tags: [blocker]`
4. Add placeholder Work Log entry with stuck type and timestamp
5. Dispatch subagents in parallel:
   - Always: repo-research-analyst, learnings-researcher
   - If failure mentions external library/API: + framework-docs-researcher
   - If stuck on approach/architecture: + best-practices-researcher
   - If modifying existing code: + git-history-analyzer
6. Collect findings (single-pass; no recursive guard firing)
7. Synthesise enriched output (format below)
8. Update Work Log with full enriched output
9. Present decision prompt to user
10. After decision: convert to todos, re-approve through triage before returning to `ready`

Enriched output format:

```markdown
## Stuck Guard Triggered

**Detected:** [unknown_territory | repeated_failure]
**Investigating...** Launching: [subagents dispatched]

---

## Research Findings

- **repo-research-analyst:** [summary or "no findings returned"]
- **learnings-researcher:** [summary or "no findings returned"]
- **framework-docs-researcher:** [summary or "not invoked" | "no findings returned"]
- **best-practices-researcher:** [summary or "not invoked" | "no findings returned"]
- **git-history-analyzer:** [summary or "not invoked" | "no findings returned"]

**Synthesis confidence:** `high` | `medium` | `low`

---

## Blocker Summary

[1–2 sentences]

## Constraints Discovered

- [constraint 1]

## Options

**Option 1: [Name]** _(source: [agent(s)] | agent-reasoned)_
- Pros / Cons / Risk / Effort

**Option 2: [Name]**
...

**Option 3: [Name]**
...

## Recommendation

[One option + 2–4 bullets citing research findings]

_Which option should we take?_
```

When findings are empty: produce ≥3 options marked `*(agent-reasoned — research returned no findings)*`. Set synthesis confidence to `low`. Do not fabricate citations.

#### Blocker Protocol

Trigger: cannot proceed safely due to ambiguity, missing info, failing approach, or environment/tooling issue.

Output format (always):

- Blocker summary (1–2 sentences)
- Constraints discovered (bullets)
- Options (≥3): each with pros/cons, risks, effort
- Recommendation: one option + why (2–4 bullets)
- Decision prompt: "Which option should we take?"

After decision:

- Convert to explicit todos
- If chosen option is a timeboxed investigation: follow Spike Protocol
- Record decision in todo Work Log
- Re-approve through triage before returning to `ready`

#### Spike Protocol

Trigger: plan includes spike/discussion todos, or Blocker Protocol decision is to run a timeboxed investigation.

Steps:

1. Create or convert todo to a spike todo tagged `tags: [spike]`. Fill Problem Statement, Proposed Solutions, Acceptance Criteria. Carry forward plan metadata (initial priority, depends_on, unblocks, parallelizable).
2. Recommend a dedicated spike worktree using `skill: git-worktree` with branch `spike/<todo_id>-<slug>`. Run worktree bootstrap.
3. Dispatch research subagents in parallel:
   - Always: repo-research-analyst, learnings-researcher
   - Conditional: framework-docs-researcher, best-practices-researcher, git-history-analyzer
4. Spike deliverable (required in Work Log):
   - Options (≥3) with pros/cons, risks, effort
   - Recommendation (one option + why)
   - Concrete next steps: build todos to create/update so the main plan can proceed
   - Should we compound this? yes/no + one-line why
5. Multiple independent spikes: create one worktree per spike. Run in dependency order; parallel when environment supports it.
6. After completion: mark spike todo `*-complete-*.md`. If compound: yes, recommend `/workflow:compound` with the spike context.

---

### Phase 6: Quality Check

Run before declaring work complete:

- Run full test suite using `test_command` from AGENTS.md
- Run `lint_command` if configured
- Run `typecheck_command` if configured
- Run `format_command` if configured

Ask-once fallback: if commands are not configured, ask once for run-provided commands and record them in the active Work Log entry.

---

### Phase 7: Completion

#### 7.1 Final Drift Check

Verify the complete implementation still aligns to original plan intent:

- Does the result satisfy all plan acceptance criteria?
- Did execution introduce any new assumptions?
- Did scope expand or shift?
- Did constraints get bypassed or softened?

If drift detected: set `status = plan_conflict`, stop, surface for review before claiming completion.

#### 7.2 Completion Summary

Provide:

- Todos completed this cycle
- Ready queue remaining
- Blocked queue with reasons
- Pending / deferred items
- Capability gaps discovered
- Plan conflicts / drift detected
- Next execution step

#### 7.3 Handoff Options

- `/workflow:review` — validate quality of implemented work
- `/workflow:compound` — capture durable learnings from this execution
- `/workflow:triage` — re-prioritise remaining pending/blocked items
