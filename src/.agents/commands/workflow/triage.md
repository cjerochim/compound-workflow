---
name: triage
invocation: workflow:triage
description: Triage pending todo files into an executable ready queue (priority, dependencies, recommended action)
argument-hint: "[optional: todo path, issue id, or 'pending' (default)]"
---

# /workflow:triage

Turn `todos/*-pending-*.md` items into an executable queue.

This command does not implement fixes. It approves and organizes work so `/workflow:work` can execute without ambiguity.

## Inputs

- Default: triage all pending todos under `todos/`
- Optional: a specific todo file path or issue id

## Preconditions

- `todos/` directory exists (create it if missing)
- `file-todos` skill is available (template + conventions)

## Workflow

1. Identify the target set:
   - all `todos/*-pending-*.md`, or
   - the requested todo
2. For each pending todo:
   - read Problem Statement + Findings + Proposed Solutions
   - fill **Recommended Action** (make it executable)
   - set `priority` (`p1|p2|p3`)
   - set `dependencies` (issue_ids)
   - ensure Acceptance Criteria is testable
   - add/update tags for searchability
3. Decision:
   - approve now -> rename `*-pending-*` -> `*-ready-*` and set frontmatter `status: ready`
   - defer -> keep `pending`, optionally adjust priority
4. Output:
   - list approved `ready` todos (unblocked first)
   - list remaining pending todos
   - list blocked todos with missing dependencies
5. Next step suggestion:
   - run `/workflow:work <plan-path>` to execute ready items

## Guardrails

- Do not modify code.
- Do not create commits/push/PRs.
- Prefer explicit dependencies over implicit ordering.
