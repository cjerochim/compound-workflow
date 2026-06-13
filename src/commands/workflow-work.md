---
name: work
invocation: workflow:work
description: Stateless orchestrator that executes approved plans by scheduling isolated agents for build, validation, review, and drift checking — using artifact-based contracts with no context accumulation
argument-hint: "<required: plan file path>"
---

# /workflow:work

Stateless orchestrator for executing an approved plan. This command schedules, delegates, and routes — it does not implement, interpret, or accumulate.

## Introduction

Correctness takes priority over speed.
Do not optimise for momentum if it risks drift, ambiguity, or a weaker solution.

Contract precedence: if this command conflicts with other workflow docs, follow `docs/principles/workflow-baseline-principles.md`, then `src/AGENTS.md` or `AGENTS.md`, then this command.

It is critical that you follow this workflow in order; do not skip or shortcut steps.

## Core Principle

> The orchestrator operates only on structured status and artifact references — never on implementation detail.

This single rule governs all orchestrator behaviour. It does not interpret subagent outputs, accumulate task context, reason over implementation content, or load artifact files into its own context. Every decision the orchestrator makes is based on status fields and artifact IDs.

## Core Shift

This command is a stateless scheduler, not a reasoning engine.

The orchestrator reads the plan, selects the next task, resolves artifact inputs to file path references, delegates to an isolated agent, and collects a structured status result. It never interprets implementation outputs, never accumulates task results in context, and never reasons across tasks.

This command is responsible for:

- reading and validating the approved plan
- extracting task contracts and artifact declarations from the plan
- deriving todo files via `skill: file-todos`
- preserving intent from the plan during task derivation
- determining execution order from artifact-derived dependencies
- identifying which ready todos can run in parallel without conflicting
- resolving artifact inputs to file path references (never content) before delegation
- delegating execution to isolated build agents
- delegating validation to isolated validation agents
- delegating review to isolated review agents
- delegating drift checks to isolated drift agents
- collecting structured results (status + artifact references only)
- updating task state based on structured results
- recomputing downstream readiness after each state change

This command is not responsible for:

- implementing the feature directly
- performing default-build task work itself
- interpreting subagent outputs or reasoning over implementation content
- running validation commands, review assessments, or drift checks inline
- accumulating task outputs in its own context
- redefining the approved plan
- improving or reshaping the approved solution during execution
- self-approving unverified work
- skipping dependency or review gates to move faster
- silently inventing new scope to fill gaps in the plan

**Context discipline:** After delegating a task and collecting its structured result, the orchestrator retains only: task ID, status, and artifact references produced. Everything else stays in the todo file and artifact storage.

## Non-goals (unless explicitly requested)

- Creating commits
- Pushing branches
- Creating pull requests

## DO NOTs

- Do not read the full plan, derive todos, run setup, delegate, or implement before the Opening Sequence is complete
- Do not skip plan validation
- Do not run any implementation, test, lint, typecheck, dependency-install, or source-edit command before isolation preflight passes
- Do not continue in the current checkout unless `current_checkout_approved` was explicitly approved by the user or invocation
- Do not skip registry resolution
- Do not delegate without a valid execution contract
- Do not delegate without passing the intent alignment gate
- Do not treat `default_build` as permission for main-agent implementation
- Do not edit source files or run implementation commands in Phase 5 from the orchestrator context
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
- Do not retry failed tasks with expanded context — mark as `changes_required` and re-queue

## Input Document

<input_document> #$ARGUMENTS </input_document>

The input must be a plan file path.

- If it is empty, ask the user for the plan file path.
- If it does not exist or is not readable, stop and ask for the correct path.
- Do not read the plan completely until the Opening Sequence is complete. Before then, only read the minimum metadata needed to identify the plan path and propose an execution context (for example, the filename slug).

## Opening Sequence

This is the first sequence in `/workflow:work`. It runs before full plan reading, plan validation, todo derivation, dependency installation, tests, source edits, or delegation.

Run this sequence in order:

1. Confirm the plan path is present and readable enough to identify it.
2. Ask the user to choose the execution context and wait for the answer unless the invocation already contains an explicit approved mode.
3. Resolve the selected execution context.
4. Create or verify the selected worktree/current checkout context.
5. Create or update the isolation checkpoint.
6. Run `npx compound-workflow preflight`.
7. Continue to plan validation only after `isolation_preflight.status: passed`.

Use this prompt for step 2:

```text
Before starting `/workflow:work`, choose the execution context:

1. Dedicated worktree (recommended)
2. Existing worktree
3. Current checkout

I will not read the full plan, derive todos, create files, run installs/tests, edit source, or delegate implementation until this is selected.
```

Selection rules:

- `dedicated_worktree` is recommended, but never silently assumed or created.
- `existing_worktree` requires an explicit path or user-approved resolved path.
- `current_checkout_approved` requires explicit user approval; do not infer it from silence, small scope, current branch, user impatience, or prior model behavior.
- Missing execution-context selection is a hard blocker.

After the user selects a mode, state the resolved mode, approval source, intended path/branch, and next mutation. Wait for confirmation before the first mutation unless the same user response already explicitly approved that mutation.

The selected execution context becomes the only valid command cwd for all subsequent phases after preflight passes.

Until this sequence is complete, only these actions are allowed:

- minimal read-only checks needed to identify the plan and repository
- execution-context selection prompt
- create or verify the selected worktree/current checkout context
- create or update the isolation checkpoint
- run `npx compound-workflow preflight`

If this order is violated, stop. Do not repair automatically. Report what happened using read-only evidence and wait for user direction.

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

**Gate precedence:** ALL gates must pass for a task to reach `complete`. No gate overrides another. A passing review does not compensate for a failing validation. A passing validation does not compensate for a failing review. If any gate returns `fail`, the task moves to `changes_required` regardless of other gate results.

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
- dependencies have been derived from the artifact graph (not manually declared)
- required skills are resolved
- required validation commands are known
- required verification gates are defined
- the intent anchor is present

### Dependency Gate

A task may only move from `ready` to `in_progress` when:

- all derived dependencies are `complete`
- all preconditions are satisfied
- no blocking discussion/spike todo is unresolved
- required access exists

### Intent Alignment Gate

A task may only move from `ready` to `in_progress` when:

- the intent alignment check passes
- no plan drift is detected before delegation

### Execution Gate

A task may only move from `in_progress` to `implemented` when:

- the build agent returned a structured result
- `status` is `pass` or `fail` (not missing)
- expected output artifact was produced (referenced in `artifact_refs`)
- files changed were declared
- the orchestrator recorded the structured result in the todo file without interpreting implementation details

### Validation Gate

A task may only move from `implemented` to `in_review` when:

- a validation agent has been dispatched with artifact refs and validation commands
- the validation agent returned a structured result
- required validation commands were executed by the validation agent
- results were captured in the todo file
- evidence required by the todo contract is present

### Review Gate

A task may only move from `in_review` to `complete` when:

- a review agent has been dispatched with artifact refs, acceptance criteria, and evidence
- the review agent returned a structured result
- every required verification gate passed
- all acceptance criteria are satisfied
- no critical issue remains open
- the result still aligns with the approved plan

A task in `in_review` must move to `changes_required` when:

- the review agent returned `status: fail`
- any required validation fails
- evidence is incomplete
- the result does not satisfy the contract

### Drift Detection Gate

A task may only move from `in_review` to `complete` when:

- a drift agent has been dispatched with intent anchor and artifact refs
- the drift agent returned `status: pass`
- no silent scope, constraint, or intent change was introduced

### Completion Gate

A task is only complete when:

- all prior gates passed
- build, validation, review, and drift agents all returned `status: pass`
- the orchestrator accepts the structured results as satisfying the todo contract
- downstream work can safely rely on it

A subagent saying "done" is not enough. Code existing is not enough. The orchestrator decides based on structured status fields, not by interpreting implementation details.

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
- the plan is missing artifact declarations
- the plan is missing task contracts with explicit inputs/outputs
- the plan's `isolation_validation` is not `passed`
- a todo has no clear responsibility
- a todo has no explicit acceptance criteria
- a todo has no intent anchor
- a todo's execution contract references artifacts not declared in the plan
- required skills cannot be resolved
- the capability registry is missing or ambiguous
- derived dependencies are cyclic or contradict the artifact graph
- required validation commands are missing
- a task attempts to skip a required gate
- a plan conflict is detected that affects dependent work
- a task exceeds safe context boundaries and cannot be split

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

Drift detection runs as an isolated agent, not inline in the orchestrator. After the build agent returns and before final completion, the orchestrator dispatches a drift agent with the intent anchor, expected output artifact, and actual artifact references.

The drift agent checks:

- does the actual output artifact match the expected output artifact?
- does the implemented result still align to the original plan intent?
- did execution introduce new assumptions?
- did scope expand or shift?
- did constraints get bypassed or softened?

The drift agent returns a structured result: `{ status: "pass" | "fail", drift_notes: "..." }`.

If `status: fail`: the orchestrator sets the todo to `plan_conflict` and stops further dependent execution. The orchestrator does not interpret drift_notes — it surfaces them for human review.

---

## Execution Workflow

### Opening Sequence Evidence

The Opening Sequence must create or update one todo/work-log entry with this exact section:

Supported isolation modes:

- `dedicated_worktree` — create a new worktree for this plan (recommended)
- `existing_worktree` — use an existing worktree after verifying it matches this plan
- `current_checkout_approved` — use the current checkout only after explicit user approval

Missing isolation selection is a hard blocker. Do not infer `dedicated_worktree`, `existing_worktree`, or `current_checkout_approved` from silence.

For `dedicated_worktree`, derive a branch name from the plan slug when safe, or ask for one if missing/ambiguous (e.g. `feat/<slug>`, `fix/<slug>`), then run `skill: git-worktree`. For `existing_worktree`, ask for/resolve the worktree path, switch command cwd to that path, and verify branch/path before continuing. For `current_checkout_approved`, require explicit opt-out confirmation and record the approval source before continuing.

Before any source edits, create or update the isolation checkpoint:

```markdown
## Isolation Evidence

- Mode: <dedicated_worktree | existing_worktree | current_checkout_approved>
- Approval source: <user_prompt | plan_contract | explicit_argument>
- Worktree: <absolute path or null>
- Branch: <branch>
- Plan copied/read from: <absolute path in execution context>
- All subsequent commands cwd: <absolute path>
- Triage completed: <yes|no>
- Preflight status: <pending|passed>
```

The selected worktree/current checkout verification and this checkpoint are the only allowed mutations before preflight. Source edits, dependency installs, tests, todo derivation, implementation, and delegation are forbidden until this checkpoint exists and preflight has passed.

Run the package-owned preflight script from the resolved execution context before Phase 1:

```bash
npx compound-workflow preflight -- --plan <plan-path-in-execution-context> --mode <mode> --approval-source <source> --todo <isolation-checkpoint-todo> [--expected-branch <branch>]
```

The script output is mandatory command evidence. Record it verbatim or as a referenced log in the isolation checkpoint Work Log.

Gate completion record (required before Phase 1 and in every `/workflow:work` output):

```yaml
isolation_preflight:
  required: true
  mode: dedicated_worktree | existing_worktree | current_checkout_approved
  approval_source: user_prompt | plan_contract | explicit_argument
  worktree_path: <absolute path or null>
  branch: <branch>
  all_subsequent_commands_cwd: <absolute path>
  plan_path_in_execution_context: <absolute path>
  triage_checkpoint_path: <todo path>
  status: passed
```

If this block is missing, implementation has not started. If `status` is not `passed`, implementation is blocked.

---

### Phase 1: Plan Validation

Phase 1 starts only after the Opening Sequence is complete. If `isolation_preflight.status: passed` is not recorded, stop and return to the Opening Sequence.

#### Step 1 — Read and Validate Plan File

- Confirm the file exists and is readable
- Read the plan file completely
- If missing acceptance criteria, scope, or non-goals — stop and return for refinement
- Do not compensate for a weak plan by improvising hidden assumptions

#### Step 2 — Resolve Repo Defaults

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

#### Step 3 — Resolve Plan Contract

Extract from the plan:

- feature objective
- scope contract (`solution_scope`, `completion_expectation`, `non_goals`)
- acceptance criteria
- constraints
- artifact declarations (IDs, types, producers, final_artifacts)
- task contracts (IDs, objectives, inputs, output, execution_route, assigned_agent when specialist-routed, required_skills)
- isolation validation status
- rollout expectations
- risk/fidelity/confidence if present
- `Agentic Access & Validation Contract`
- discussion points and spikes if present

If any of the following are missing, stop and return the plan for refinement:

- clear objective
- explicit acceptance criteria
- explicit scope or non-goals
- actionable access/validation contract
- artifact declarations with IDs and producers
- task contracts with explicit inputs and output
- task contracts with explicit `execution_route` and `agent_selection_rationale`
- specialist-routed task contracts with explicit `assigned_agent`
- final_artifacts with acceptance criteria mapping
- `isolation_validation: passed` in frontmatter

#### Step 4 — Resolve Agent and Skill Assignments

The plan selects the execution route, assigned specialist agent when applicable, and required skills per task. Work validates them against the Agent Registry and Skill Index, then attaches them to todo contracts at delegation — it does not re-decide agents/skills or add universal baselines.

Read the Skill Index and Agent Index from `AGENTS.md`. Resolve agent definitions from the active harness directories listed in the Repo Config Block `harnesses` value; use `.agents/agents/` only as a fallback when no harness list is available.

For each implementation phase or task in the plan:

- Check if the plan carries `execution_route` and `agent_selection_rationale` annotations (written during `/workflow:plan`)
- If `execution_route: specialist`, check that the plan carries `assigned_agent`, validate `assigned_agent` against the Agent Registry, and validate that the task fits the assigned agent boundary and permissions
- If `execution_route: default_build`, check that `assigned_agent` is omitted or `null`, validate that the rationale explains why no specialist applies, and preserve the task for isolated default build delegation
- Reject invented fallback agent IDs. `assigned_agent` must name a real Agent Registry entry whenever it is set.
- Check if the plan already carries `required_skills` annotations (written during `/workflow:plan`)
- If annotations exist: validate each skill against the registry — confirm it exists and is applicable
- If execution route or agent annotations are missing, invalid, or boundary-incompatible: treat as a plan defect and stop — return to `/workflow:plan` for refinement
- If skill annotations are missing on a task that needs skills: treat as a plan defect and stop — return to `/workflow:plan` for refinement
- Record resolved agent and skills per task — these will be attached to todo contracts in Phase 3

If a required skill cannot be resolved from the registry:

- surface it as a capability gap
- do not proceed with that task until resolved

If an assigned specialist agent cannot be resolved from the registry:

- surface it as a capability gap
- do not silently substitute another agent
- do not proceed with that task until the plan is refined or the agent is installed

Default build route:

- `default_build` means no specialist agent is selected; it does not mean the orchestrator becomes the build agent.
- `default_build` tasks must still be delegated to an isolated build agent using the same execution contract boundaries as specialist tasks.
- If the runtime cannot dispatch an isolated build agent for a `default_build` task, stop before implementation and report `execution_blocked.reason: subagent_dispatch_unavailable`.

#### Step 5 — Resolve Testing Cadence

Infer testing cadence from the plan's risk profile.

- Prefer `fidelity` and `confidence` from plan frontmatter if present
- Otherwise default to `fidelity=medium`, `confidence=medium`

Testing cadence:

- Low risk: fast checks per todo, full suite at milestone and end
- Medium risk: fast checks per todo, full suite at milestones + end
- High risk: fast checks per todo, full suite frequently (every 1–2 build todos) + end

Record the chosen cadence before execution begins.

---

### Phase 2: Post-Preflight Environment Setup

Phase 2 starts only after `isolation_preflight.status: passed`.

All commands in this phase must use `isolation_preflight.all_subsequent_commands_cwd`.

If a worktree was created or selected, run worktree bootstrap now:

- Copy env/config files per the `git-worktree` skill.
- Install dependencies using `worktree_install_command` or the detected package-manager command.
- Apply `worktree_bootstrap_notes`.
- Record the worktree path (e.g. `.worktrees/feat-xyz`) in the isolation checkpoint or first active Work Log entry.

Do not derive todos, run tests, edit source, or delegate implementation until this setup is complete or explicitly recorded as not required.

---

### Phase 3: Derive Todo Contracts

Convert the approved plan's task contracts and artifacts into executable todo files.

A todo is not a note. A todo is not a loose checklist item. A todo is a pair: an **execution contract** (what the subagent receives) and **control metadata** (what the orchestrator tracks). The subagent never sees the control metadata. The orchestrator never interprets the execution output.

#### Step 1 — Todo Contract Rules

Every derived todo must be:

- independently understandable by a stateless subagent
- narrow enough to execute without hidden subprojects
- mapped to a single primary responsibility
- explicit about inputs (artifact IDs from the plan's artifact model)
- explicit about the single output artifact it produces
- explicit about verification
- explicitly anchored to approved intent
- carrying resolved agent assignment from Phase 1 Step 4
- carrying resolved skill assignments from Phase 1 Step 4

If a candidate task is too broad: split it before delegation.
If a candidate task is ambiguous: refine it before delegation.
If a candidate task depends on unresolved decisions: mark it `blocked`.

#### Step 2 — Execution Contract (agent-facing)

The execution contract is what the build agent receives. It contains only what is needed to execute in isolation. Nothing else.

```yaml
execution_contract:
  id: <stable task id>
  objective: <what this task must achieve — one sentence>
  inputs:
    - artifact: <artifact ID resolved to file path — reference only, never inlined content>
      scope:
        type: <file | function | lines | section — omit for full artifact>
        value: <targeting hint — function name, line range, section heading>
  output: <single artifact ID — what this task produces>
  constraints:
    - <boundaries this task must respect>
  acceptance_criteria:
    - <measurable conditions for this task to be complete>
  execution_route: <specialist | default_build>
  assigned_agent: <resolved specialist agent from plan annotations or Phase 1 Step 4; null/omitted when execution_route=default_build>
  agent_selection_rationale: <why this agent owns the task; if default_build, why no specialist applies>
  required_skills:
    - <resolved from plan annotations or Phase 1 Step 4>
  execution_context:
    worktree_path: <path or null>
    branch: <branch name>
```

Rules:

- **No plan access**: the execution contract must not include or reference the full plan.
- **No prior task outputs**: inputs are artifact IDs resolved to paths, not prior task reasoning or summaries.
- **No control metadata**: the subagent does not see dependencies, status, intent anchors, or review gates.
- **Single output**: every task produces exactly one artifact.
- **No formal completion validation commands**: the build agent may run scoped implementation diagnostics when its prompt allows terminal access, but formal completion validation commands are held in the todo file and passed only to the validation agent.
- **Execution route is contractual**: when `execution_route: specialist`, the build phase must dispatch to `assigned_agent`. When `execution_route: default_build`, the build phase must dispatch to an isolated default build agent and no `assigned_agent` is set. The orchestrator may not substitute a different implementation route unless the task is returned to planning/triage as a plan defect.
- **No main-agent implementation fallback**: if no isolated build agent can be dispatched for either route, stop and report `execution_blocked.reason: subagent_dispatch_unavailable`; do not edit files or run implementation commands from the orchestrator context.
- **Boundary enforcement**: if the execution contract violates the assigned agent's prompt boundary or permissions, mark the todo `blocked` or `plan_conflict`; do not ask the agent to work outside its remit.
- **Scope is a hint**: when scope is present on an input, it tells the agent where to focus. The agent attempts to resolve the scope target; if the target has moved or changed, the agent resolves to the closest match; if unresolvable, the agent reads the full artifact and continues.

**Artifact resolution principle:** The orchestrator resolves artifact IDs to file paths or references before delegation. It carries scope through from the plan's task contract — it does not interpret or validate scope, just passes it. Subagents decide what to read from the referenced paths using the scope hint. Large artifacts are handled lazily — the agent reads what it needs from the path, not from context.

#### Step 3 — Control Metadata (orchestrator-facing)

Control metadata is what the orchestrator uses to schedule, gate, and track the task. It is never passed to subagents.

```yaml
control_metadata:
  id: <stable task id>
  title: <short action-oriented title>
  status: drafted
  type: build | review | qa | docs | spike | discussion
  responsibility: <primary responsibility domain>
  execution_route: <specialist | default_build>
  assigned_agent: <execution agent from plan when specialist-routed; null/omitted when default_build>
  agent_selection_rationale: <why this route/agent owns the task>
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
  derived_dependencies:
    - <task IDs — automatically derived from artifact producers, never manually declared>
  preconditions:
    - <conditions that must be true before execution>
  unblocks:
    - <downstream task IDs — automatically derived from artifact consumers>
  expected_output_artifact: <artifact ID this task must produce>
  verification:
    - type: technical_review | qa_review | integration_check | docs_review | custom
      required: true
      status: pending | approved | changes_required | not_required
  evidence_required:
    - <logs, test output, file list>
  result:
    status: null
    artifact_refs: []
    build_agent_status: null
    validation_agent_status: null
    review_agent_status: null
    drift_agent_status: null
```

Rules:

- **No manual dependencies**: `derived_dependencies` and `unblocks` are computed from the artifact graph. If a task consumes an artifact, it depends on the task that produces it. If a mismatch is found between declared dependencies and the artifact graph, this is a hard stop.
- The orchestrator reads `result.status` to decide state transitions. It does not interpret implementation details.
- `artifact_refs` are external references (file paths, artifact IDs). The orchestrator does not load or reason over artifact content.
- `execution_route` and `assigned_agent` are used only for routing/build delegation. Review, validation, and drift gates remain independent.

#### Step 4 — Context Boundary Check

Before creating a todo, validate that the execution contract respects context boundaries. This is a hard constraint, not a suggestion.

Rules:

- A task must consume no more than 5 input artifacts. If it exceeds this, it MUST be split — do not proceed.
- Inputs must fit within a safe execution context. If inputs reference large files, scope the task to specific sections or functions — do not pass entire large files as context.
- The orchestrator resolves artifact IDs to file paths only. It never loads artifact content into its own context.

If a task exceeds safe context boundaries:

- Split it into smaller tasks with narrower input sets.
- Do not proceed with oversized tasks. This is a hard stop, not advisory.

#### Step 5 — Todo Status Model

- `drafted` — derived but not yet ready to execute
- `ready` — dependencies and preconditions satisfied
- `blocked` — cannot start due to dependency, access, or unresolved decision
- `in_progress` — delegated and being executed by a subagent
- `implemented` — build agent output returned, not yet verified
- `in_review` — undergoing verification by isolated agents
- `changes_required` — failed verification or returned incomplete evidence
- `complete` — all required verification gates passed
- `plan_conflict` — execution exposed a conflict with approved plan intent

Important: `implemented` does not unblock downstream work. Only `complete` unblocks downstream work.

#### Step 6 — Responsibility Classification

Every todo must declare one primary responsibility. If a task truly spans multiple major responsibilities, split it.

Recommended values: `frontend`, `backend`, `schema`, `testing`, `playwright`, `infra`, `docs`, `spike`, `discussion`, `technical_review`, `qa_review`

#### Step 7 — Blocking Unknowns

When the plan includes unresolved decisions, missing access, risky unknowns, spike candidates, or discussion points — these must become explicit todos before dependent build work begins.

- discussion todos → resolve decisions (no code)
- spike todos → reduce risk with a timebox and deliverable
- build work blocked by them stays `blocked`

#### Step 8 — Create Todo Files

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

- task contracts → build todos (carrying execution contract + control metadata as separate sections)
- discussion points → discussion todos (`status: pending`)
- spike candidates → spike todos (`status: pending`)
- review/qa requirements → review/qa todos

**Validation command transfer (required):** Extract validation commands from the plan's `## Agentic Access & Validation Contract` (specifically: `Validation Path` and `Quality Gates` — test, lint, typecheck commands) and write them into each todo file as `validation_commands`. These are the plan-level baseline commands that apply to all build tasks. They must not be placed in the execution contract (the build agent does not see them) or in control metadata (they are not scheduling logic). They exist in the todo file solely as input for the validation agent at execution step 6. Task-specific validation requirements are expressed through each task's `constraints` and `acceptance_criteria`, which the review agent evaluates — not through per-task validation commands.

#### Step 9 — Dependency Rules

Execution order is driven by artifact-derived dependencies, not list order or manual declaration.

Dependencies are computed from the artifact graph: if task B consumes an artifact produced by task A, then task B depends on task A. These are recorded as `derived_dependencies` in control metadata. Manual dependency overrides are not allowed — if a manual dependency contradicts the artifact graph, this is a hard stop.

A todo is `ready` only when all `derived_dependencies` are `complete` and all `preconditions` are satisfied.

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
- [ ] isolation checkpoint exists and was the first mutation before source edits
- [ ] isolation preflight recorded (`isolation_preflight.status: passed`)
- [ ] blocking spikes front-loaded
- [ ] every `ready` todo has a valid execution contract (objective, inputs as artifact IDs, output, constraints, acceptance criteria)
- [ ] every `ready` todo has a valid `execution_route` and boundary-compatible `agent_selection_rationale`
- [ ] every specialist-routed `ready` todo has a valid `assigned_agent`
- [ ] every `ready` todo has validation commands recorded in the todo file (for the validation agent)
- [ ] every `ready` todo has control metadata (intent anchor, derived dependencies, verification requirements)

---

### Phase 5: Task Execution Loop

All file writes and terminal commands MUST use the execution context resolved in Phase 2.

- If `isolation_preflight.mode` is `dedicated_worktree` or `existing_worktree`: use `isolation_preflight.worktree_path` as the implementation root. Do not make code changes in the main repo checkout.
- If `isolation_preflight.mode` is `current_checkout_approved`: use `isolation_preflight.all_subsequent_commands_cwd` and recorded branch only. Do not switch cwd or branch without repeating Phase 2.
- Every delegated execution contract must carry `isolation_preflight.all_subsequent_commands_cwd` as the command cwd.

#### Orchestrator Implementation Boundary

Phase 5 is delegation-only for the orchestrator. The orchestrator may select todos, check metadata, resolve artifact references, dispatch agents, record structured results, and transition states. It must not edit source files, run implementation commands, or complete task work directly.

This boundary applies to both execution routes:

- `specialist` dispatches the assigned specialist agent from the execution contract.
- `default_build` dispatches an isolated default build agent with no specialist assignment.

`default_build` is not a main-agent fallback. If isolated build-agent dispatch is unavailable for any ready todo, stop before implementation and report:

```yaml
execution_blocked:
  reason: subagent_dispatch_unavailable
  task: <todo id>
  route: <specialist | default_build>
```

#### Orchestrator Context Rule

The orchestrator must not accumulate task outputs across iterations of this loop. After each task completes (or fails), the orchestrator retains only:

```yaml
task_result:
  id: <task id>
  status: complete | changes_required | blocked | plan_conflict
  artifact_refs: [<artifact IDs produced>]
```

Implementation details, logs, reasoning, and evidence stay in the todo file and artifact storage — not in the orchestrator's context.

#### Todo Selection Rules

- Consider only `todos/*-ready-*.md` items
- Skip blocked todos (any dependency without a corresponding `*-complete-*.md`)
- Prioritise blocking spikes first
- Then prioritise by priority (`p1` before `p2` before `p3`), then lower `issue_id` first

Stop condition: if no unblocked `ready` todos remain, summarise pending/deferred/blocked items and stop. Do not invent work.

#### Execution Loop

For each ready todo in priority order:

```
1. SELECT    — next ready, unblocked todo
2. CHECK     — intent alignment gate (orchestrator reads intent_anchor from control metadata,
                verifies objective still matches plan — this is a metadata check, not output interpretation)
3. RESOLVE   — resolve artifact inputs to file paths / references.
                Pass references only. Never inline file contents into agent context.
                Carry scope hints through from the plan's task contract — do not interpret them.
                Resolution is best-effort:
                  Path resolution: if an artifact path has changed since planning
                  (file renamed, function moved, lines shifted), resolve to the best-match
                  path using available context (file search, symbol search). If the artifact
                  cannot be located at all, mark the task `blocked` with reason
                  "artifact unresolvable" — do not fail silently or guess.
                  Scope resolution: scope is resolved by the build agent, not the orchestrator.
                  The orchestrator passes scope through unchanged.
4. DELEGATE  — dispatch to isolated build agent with execution contract only:
                 - objective
                 - inputs (resolved artifact paths + scope hints — references only)
                 - output (expected artifact ID)
                 - constraints
                 - acceptance criteria
                 - assigned agent
                 - agent selection rationale
                 - required skills
                 - execution context (worktree path / branch)
                 The build agent does NOT receive formal completion validation commands.
                 If isolated dispatch is unavailable, stop with
                 execution_blocked.reason: subagent_dispatch_unavailable.
5. COLLECT   — receive structured result from build agent:
                 { status: "pass" | "fail", artifact_refs: [...], files_changed: [...] }
                 Do NOT receive or retain implementation reasoning, logs, or summaries.
                 Record result in todo file.
6. VALIDATE  — dispatch to isolated validation agent with:
                 - artifact refs from step 5
                 - validation commands from todo file
                 - files changed from step 5
                 The validation agent runs commands only (tests, lint, typecheck).
                 It does NOT interpret acceptance criteria.
                 Receive: { status: "pass" | "fail", evidence: [...] }
                 Record result in todo file.
7. REVIEW    — dispatch to isolated review agent with:
                 - artifact refs from step 5
                 - acceptance criteria from execution contract
                 - evidence from step 6
                 - files changed from step 5
                 The review agent evaluates product correctness against acceptance criteria.
                 It does NOT run commands.
                 Receive: { status: "pass" | "fail", issues: [...] }
                 Record result in todo file.
8. DRIFT     — dispatch to isolated drift agent with:
                 - intent anchor from control metadata
                 - expected output artifact (from control metadata)
                 - actual artifact refs from step 5
                 - files changed from step 5
                 The drift agent compares expected vs actual outputs and checks intent alignment.
                 Receive: { status: "pass" | "fail", drift_notes: "..." }
                 Record result in todo file.
9. ADVANCE   — read structured results from steps 5–8:
                 if ALL pass → move to `complete`
                 if ANY fail → move to `changes_required`
                 Gate precedence: ALL gates (build, validation, review, drift) must pass.
                 No gate overrides another. A passing review does not override a failing
                 validation. A passing validation does not override a failing review.
                 The orchestrator decides based on status fields only, not by interpreting outputs.
10. SYNC     — flip corresponding plan checkbox [ ] → [x]
11. RECOMPUTE — update readiness of downstream todos
12. DISCARD  — drop all task-specific context from orchestrator memory.
                Retain only: task_result (id, status, artifact_refs).
```

#### Agent Isolation Rules

Each agent in the execution loop runs with fresh context:

- **Build agent**: is selected from `execution_contract.execution_route`. For `specialist`, dispatch the assigned specialist from `execution_contract.assigned_agent`. For `default_build`, dispatch an isolated default build agent with no specialist assignment. `default_build` does not authorize the orchestrator to implement the task. The build agent receives execution contract only (objective, inputs as paths with scope hints, output, constraints, acceptance criteria, execution route, assigned agent when present, agent selection rationale, skills, execution context). Does NOT receive formal completion validation commands. It may run scoped implementation diagnostics only when its prompt/tool permissions allow them, and those diagnostics do not replace the validation gate. Resolves scope hints best-effort — if the target has moved, resolves to closest match; if unresolvable, reads full artifact. Produces implementation + artifact. Returns structured status.
- **Validation agent**: receives artifact refs, validation commands (from todo file), files changed. Runs commands only (tests, lint, typecheck). Does NOT interpret acceptance criteria or assess product correctness. Returns structured status + evidence.
- **Review agent**: receives artifact refs, acceptance criteria, evidence from validation, files changed. Evaluates product correctness against acceptance criteria. Does NOT run commands. Returns structured status + issues.
- **Drift agent**: receives intent anchor, expected output artifact, actual artifact refs, files changed. Compares expected vs actual outputs and checks intent alignment. Returns structured status + drift notes.

No agent receives the full plan, prior task outputs, or orchestrator reasoning. Each agent is stateless and scoped.

#### Parallel Execution

Parallel execution is allowed only when ALL of the following are true:

- no shared input artifacts between the tasks
- no shared output artifacts between the tasks
- no overlapping file paths in expected outputs or known mutation targets
- no dependency relationship (neither task consumes an artifact produced by the other)

If any condition is false: enforce sequential execution. Do not attempt parallel execution with conflict mitigation — sequential is always safer.

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

**Hard limit: the stuck guard may fire at most once per todo.** If a todo triggers the stuck guard, gets investigated, returns to `ready`, and triggers the guard again — do not re-investigate. Instead, mark the todo `blocked` with reason "stuck guard exhausted" and escalate to the user. This prevents investigation loops and ensures bounded execution.

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
6. Collect findings (single-pass; this is the only investigation attempt — see hard limit above)
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

1. Create or convert todo to a spike todo tagged `tags: [spike]`. Fill Problem Statement, Proposed Solutions, Acceptance Criteria. Carry forward plan metadata (initial priority, derived_dependencies, unblocks, parallelizable).
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

#### Step 1 — Final Drift Check

Dispatch an isolated drift agent with the full plan intent anchor, the plan's `final_artifacts` list, and the complete list of artifact references produced across all completed tasks. This is a plan-level drift check, not a per-task check.

The drift agent checks:

- Does every declared `final_artifact` have a corresponding actual artifact produced?
- Does the result satisfy all plan acceptance criteria?
- Did execution introduce any new assumptions?
- Did scope expand or shift?
- Did constraints get bypassed or softened?

The agent returns: `{ status: "pass" | "fail", drift_notes: "..." }`.

If `status: fail`: set `status = plan_conflict`, stop, surface drift_notes for human review before claiming completion.

#### Step 2 — Final Artifact Completion Check

Before declaring the plan complete, verify that all `final_artifacts` declared in the plan are accounted for:

- Every artifact listed in `final_artifacts` must have been produced by a completed task.
- Every final artifact must have passed validation (validation agent returned `status: pass`).
- Every final artifact must have passed review (review agent returned `status: pass`).

If any final artifact is missing, unvalidated, or unreviewed: the plan is not complete. Report the gaps and stop.

#### Step 3 — Completion Summary

Provide:

- Todos completed this cycle
- Ready queue remaining
- Blocked queue with reasons
- Pending / deferred items
- Capability gaps discovered
- Plan conflicts / drift detected
- Next execution step

#### Step 4 — Handoff Options

- `/workflow:review` — validate quality of implemented work
- `/workflow:compound` — capture durable learnings from this execution
- `/workflow:triage` — re-prioritise remaining pending/blocked items
