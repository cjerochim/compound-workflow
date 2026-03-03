---
name: tech-review
invocation: workflow:tech-review
description: Run technical review on a plan (technical correctness before build). Optional plan path or latest in docs/plans/.
argument-hint: "[optional: plan path]"
---

# /workflow:tech-review

Run technical review on a feature approach or plan document. Checks technical alignment with architecture, code standards, and quality before build. Does not edit the plan; use `document-review` after technical review to apply agreed changes.

Contract precedence: if this command conflicts with other workflow docs, follow `docs/principles/workflow-baseline-principles.md`, then `src/AGENTS.md`, then this command.

## Inputs

- **Plan path (optional):** `$ARGUMENTS` — path to the plan file (e.g. `docs/plans/YYYY-MM-DD-<type>-<slug>-plan.md`).
- If not provided: use the plan from context, or discover the most recent plan in `docs/plans/` (e.g. by date prefix) or `docs/brainstorms/`.

## Execution

1. Resolve the plan document (from argument, context, or discovery).
2. **Run technical review as a subagent (mandatory when supported).** Load the `technical-review` skill and run it on that plan. You **must** attempt the independent pass via a subagent first: run **Task planning-technical-reviewer(plan_path)** (e.g. `mcp_task` with subagent_type and the plan path). Do **not** perform the planning-technical-reviewer pass in-context unless the environment cannot run the Task; if you fall back, you **must** state "planning-technical-reviewer unavailable; running direct technical review (degraded bias resistance)". After the subagent (or fallback) pass, synthesize the verdict and findings queue.
3. After technical review, if the user agrees to changes, recommend loading `document-review` to update the plan, then proceed to build when ready.

## Guardrails

- **Subagent mandatory when available.** You must run the planning-technical-reviewer pass as a subagent (Task / mcp_task) when the environment supports it. Do not run in-context unless the environment cannot run the Task; if you do, disclose the degraded mode.
- Do not modify the plan in this command; technical review is read-only. Apply changes via document-review or user edit.
- Do not create commits, push branches, or create pull requests.
