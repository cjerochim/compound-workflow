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
2. Load the `technical-review` skill and run it on that plan. The skill runs **Task planning-technical-reviewer(plan_path)** when the environment can run the Task, then synthesizes the verdict and findings queue.
3. After technical review, if the user agrees to changes, recommend loading `document-review` to update the plan, then proceed to build when ready.

## Guardrails

- Do not modify the plan in this command; technical review is read-only. Apply changes via document-review or user edit.
- Do not create commits, push branches, or create pull requests.
