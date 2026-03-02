---
name: triage
invocation: workflow:triage
description: Triage and prioritize todo files into an executable ready queue (priority, dependencies, recommended action)
argument-hint: "[optional: todo path, issue id, status filter ('pending'|'ready'|'active')]"
---

# /workflow:triage

Turn todo items into a prioritized executable queue.

This command does not implement fixes. It approves and organizes work so `/workflow:work` can execute without ambiguity.
Output of this command is the only executable queue for `/workflow:work`.

Contract precedence: if this command conflicts with other workflow docs, follow `docs/principles/workflow-baseline-principles.md`, then `src/AGENTS.md`, then this command.

## Inputs

- Default: triage all active todos under `todos/` (`pending` + `ready`)
- Optional: a specific todo file path or issue id

## Preconditions

- `todos/` directory exists (create it if missing)
- `file-todos` skill is available (template + conventions)

## Workflow

1. Identify the target set:
   - all active todos (`todos/*-pending-*.md` + `todos/*-ready-*.md`), or
   - the requested todo
2. For each target todo:
   - read Problem Statement + Findings + Proposed Solutions
   - fill **Recommended Action** (make it executable)
   - set `priority` (`p1|p2|p3`)
   - set `dependencies` (issue_ids)
   - ensure Acceptance Criteria is testable
   - ensure the todo includes an explicit `Agentic Execution Contract`:
     - access preconditions
     - validation commands/routes/checks
     - evidence expectations
     - quality gate commands (`test`, `lint`, `typecheck`)
   - if lint/typecheck commands are missing in repo config, mark Recommended Action with "ask once for run-provided commands before completion"
   - add/update tags for searchability
   - **When multiple todos have `tags: [discussion]`:** (1) List a **concise numbered summary** of the discussion points. (2) Walk through **each point one by one**; for each, discuss and align with the user before approving or deferring; only then move on. Do not resolve all discussion points in one turn.
   - **If the todo has `tags: [discussion]`:** Recommended Action must state the concrete decision task (what info is needed, who decides, done-when). Approve only when the outcome is a clear, executable decision task; otherwise defer.
   - **If the todo has `tags: [spike]`:** Recommended Action must include a timebox and deliverable (e.g. "2–4h spike; deliver: options + recommendation + next build todos"). Confirm or adjust plan-provided spike metadata (initial priority, depends_on, unblocks, parallelizable). Set `dependencies` so that any build todos that depend on this spike's outcome list this todo's `issue_id`; when approving, ensure dependent build todos remain blocked until the spike is complete (they depend on the spike's `issue_id`). Approve only when the spike scope and deliverable are clear; otherwise defer.
   - **Blocking spikes first:** If a spike unblocks downstream build todos, prioritize approving that spike before its dependents. Do not approve dependent build todos as executable ahead of unresolved blocking spikes.
   - **Parallel spike readiness:** If multiple spike todos are independent (no dependency edges between them), they may be approved together for parallel execution.
3. Decision:
   - **approve now** -> if pending, rename `*-pending-*` -> `*-ready-*` and set frontmatter `status: ready`; if already ready, keep `status: ready` and update priority/dependencies as needed
   - **defer** -> rename `*-pending-*` or `*-ready-*` -> `*-deferred-*` and set frontmatter `status: deferred` (keep priority, typically `p3`). Ensure Recommended Action, Findings, and Work Log have enough context for future reference. Deferred items are not executed until re-triaged to `ready`.
   - **needs rework** -> when a `ready` todo is not executable, rename `*-ready-*` -> `*-pending-*`, set `status: pending`, and record what is missing before re-approval.
   - **blocked follow-up** -> when work returns a blocked todo, keep it as `pending` (rename from `*-ready-*` when needed), add `tags: [blocker]`, and require blocker options + recommendation in Work Log before re-approval.
4. Output:
   - list approved `ready` todos (blocking spikes first, then other unblocked items)
   - list remaining pending todos
   - list deferred todos (parked for reference; not in executable queue)
   - list blocked todos with missing dependencies
5. Next step suggestion:
   - run `/workflow:work <plan-path>` to execute ready items

## Guardrails

- Do not modify code.
- Do not create commits/push/PRs.
- Prefer explicit dependencies over implicit ordering.
