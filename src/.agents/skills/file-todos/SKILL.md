---
name: file-todos
description: Manage a file-based todo tracking system in the todos/ directory. Use to create, triage, and execute persistent work items with status, priority, dependencies, and work logs.
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
---

# File-Based Todo Tracking

## Overview

The `todos/` directory is a persistent tracking system for:

- work items derived from plans
- code review feedback
- technical debt
- feature follow-ups

Each todo is a markdown file with YAML frontmatter and structured sections.

Use this skill when:

- creating new todo files
- triaging and approving pending work
- executing todos while maintaining a work log
- managing dependencies

## File Naming Convention

Todo files follow this pattern:

```
{issue_id}-{status}-{priority}-{description}.md
```

Components:

- `issue_id`: sequential (001, 002, 003...) - never reused
- `status`: `pending` (needs triage), `ready` (approved), `complete` (done), `deferred` (not this cycle; keep as reference)
- `priority`: `p1` (critical), `p2` (important), `p3` (nice-to-have)
- `description`: kebab-case, brief

Examples:

```
001-pending-p1-fix-auth-redirect.md
002-ready-p2-add-pagination.md
003-deferred-p3-follow-up-refactor.md
005-complete-p3-update-docs.md
```

## File Structure

Use the template at [todo-template.md](./assets/todo-template.md).

Required sections:

- Problem Statement
- Findings
- Proposed Solutions
- Recommended Action
- Acceptance Criteria
- Work Log

Frontmatter fields:

```yaml
---
status: ready              # pending | ready | complete | deferred
priority: p1               # p1 | p2 | p3
issue_id: "002"
tags: [backend, testing]
dependencies: ["001"]     # issue_ids this is blocked by
---
```

**Deferred:** Items with `status: deferred` are not planned for the current development cycle. Keep Problem Statement, Findings, and Work Log so the item can be re-triaged or picked up later. Only `*-ready-*.md` todos are executed; `pending` and `deferred` are non-executable.

## Common Workflows

### Create a New Todo

1. Ensure `todos/` exists.
2. Determine next issue id (001-based, zero-padded).
3. Copy the template into `todos/<id>-pending-<priority>-<description>.md`.
4. Fill:
   - Problem Statement
   - Proposed Solutions (at least 2 if non-trivial)
   - Acceptance Criteria
   - Initial Work Log entry
5. Tag for searchability.

Create a todo when it is non-trivial (>15-20 min), needs research, has dependencies, or should persist across sessions.

### Create Todos From a Plan (Recommended for /workflow:work)

When executing a plan, create persistent todos so progress is trackable across sessions.

Inputs:

- plan file path (required)

Default mapping rules:

1. Read the plan file completely.
2. Detect whether the plan contains task checkboxes (`- [ ]`).
3. If checkboxes exist:
   - create one todo per checkbox by default
   - group only when tasks are inseparable (e.g., schema change + required migration)
4. If checkboxes do not exist:
   - create 3-7 todos based on major plan phases/sections
5. For every created todo:
   - include the plan path in `Resources`
   - include a "Plan checkbox" pointer when derived from a checkbox (exact text)
   - otherwise include a short "Plan section" pointer (heading name or anchor)
   - write Acceptance Criteria that is testable
6. **Discussion Points and Spike Candidates:** If the plan has sections `## Discussion Points (resolve/decide)` or `## Spike Candidates (timeboxed)`:
   - Checkboxes under **Discussion Points** → create `todos/*-pending-*.md` with `tags: [discussion]` and `status: pending`.
   - Checkboxes under **Spike Candidates** (including items like `- [ ] Spike: ...`) → create `todos/*-pending-*.md` with `tags: [spike]` and `status: pending`.
   - For each spike candidate, carry plan metadata into the todo when present:
     - `Initial priority` -> todo `priority` (initial value; triage may adjust)
     - `Depends on` -> todo `dependencies` when issue ids are known; otherwise keep as a note in `Recommended Action`
     - `Unblocks` -> include in `Recommended Action` so triage/work can front-load blocking spikes
     - `Timebox`, `Deliverable`, `Parallelizable` -> copy into `Recommended Action` or `Findings`
   - These items require triage before execution; do not default them to `ready` unless the plan is explicitly approved and triage has been run.

Status and priority defaults:

- `status`: `ready` when the plan is approved and the todo is not from Discussion Points or Spike Candidates; otherwise `pending`. Todos with `tags: [discussion]` or `tags: [spike]` default to `pending`.
- `priority`: `p2` unless clearly urgent/high-risk
- If a spike is marked as unblocking implementation work, default initial priority to `p1` when no explicit priority is provided.

Dependencies:

- Use `dependencies:` to model sequencing.
- Only mark a todo ready when all dependencies are complete.

Plan sync expectations:

- When a todo is complete, the executor should update the corresponding plan checkbox when possible.

### Triage Pending Todos

1. List pending todos.
2. For each todo:
   - read Problem Statement + Findings
   - choose a recommended action
   - set priority and dependencies
   - for `tags: [spike]`, confirm/adjust carried plan metadata (`Initial priority`, `Depends on`, `Unblocks`, `Timebox`, `Deliverable`, `Parallelizable`)
3. Decision:
   - **Approve:** rename `*-pending-*` -> `*-ready-*`, set frontmatter `status: ready`
   - **Defer:** rename `*-pending-*` -> `*-deferred-*`, set frontmatter `status: deferred` (typically `p3`). Keep Work Log/Findings so the item is referenceable later; it will not appear in the executable queue until re-triaged to `ready`.
4. Only `*-ready-*.md` items are executable; `pending` and `deferred` are excluded from the work loop.

If this repo has a `/workflow:triage` command, it may be used. Otherwise, perform triage directly in the todo files.

### Execute a Ready Todo

Consider only `*-ready-*.md` todos. Ignore `pending` and `deferred`.

1. Verify dependencies are complete.
2. Work in small milestones.
3. Update the Work Log each session with:
   - actions (file references + commands)
   - tests run
   - results
   - learnings
4. Check off Acceptance Criteria as you complete items.

### Complete a Todo

1. Verify all acceptance criteria are checked.
2. Add a final Work Log entry.
3. Rename `*-ready-*` -> `*-complete-*`.
4. Update frontmatter `status: ready` -> `status: complete`.

## Distinctions

- This is persistent, file-based tracking in `todos/`.
- It is different from any application-level "Todo" model and different from any in-memory session todo tool.
