---
status: pending
priority: p2
issue_id: "XXX"
tags: []  # e.g. spike, discussion, backend, testing
dependencies: []
---

# Brief Task Title

Replace with a concise title describing what needs to be done.

## Problem Statement

What is broken, missing, or needs improvement? Provide clear context about why this matters.

## Findings

Investigation results, root cause analysis, and key discoveries.

- Finding 1 (include file references when possible)
- Finding 2

## Proposed Solutions

Present multiple options with pros, cons, effort estimates, and risk assessment.

### Option 1: [Solution Name]

Approach: Describe the solution clearly.

Pros:
- Benefit 1
- Benefit 2

Cons:
- Drawback 1
- Drawback 2

Effort: 2-3 hours

Risk: Low / Medium / High

---

### Option 2: [Solution Name]

Approach: Describe the solution clearly.

Pros:
- Benefit 1

Cons:
- Drawback 1

Effort: 4-6 hours

Risk: Low / Medium / High

## Recommended Action

To be filled during triage. Clear, actionable plan for resolving this todo.

## Agentic Execution Contract

- Access Preconditions: <services, credentials, fixtures, flags, env>
- Access Method: <how the agent gets access in this repo/runtime>
- Validation Commands: <commands/routes/checks>
- Evidence Targets: <logs/output/artifacts that prove success>
- Quality Gate Commands:
  - Test: <command>
  - Lint: <command or "ask once if not configured">
  - Typecheck: <command or "ask once if not configured">

## Technical Details

Affected files, related components, data changes, or architectural considerations.

## Resources

Links to logs, tests, PRs, documentation, similar issues.

- Plan: <path-to-plan-file>
- Plan checkbox: <exact checkbox text, if applicable>
- Plan section: <heading reference, if no checkbox>

## Acceptance Criteria

Testable checklist items for verifying completion.

- [ ] Acceptance criteria item 1
- [ ] Acceptance criteria item 2
- [ ] Success criteria evidence captured in Work Log
- [ ] Lint and typecheck evidence captured (configured or run-provided)

## Work Log

Chronological record of work sessions, actions taken, and learnings.

### YYYY-MM-DD - Session Title

By: <name>

Actions:
- Changes made (include file references)
- Commands executed
- Tests run
- Quality gates run (lint/typecheck)
- Status transition (`ready` -> `pending` with `tags: [blocker]` when blocked, or `ready` -> `complete` when done)

Learnings:
- What worked / what didn't
- Key insights

Blocker Decision (only when blocked):
- Blocker summary:
- Constraints discovered:
- Options considered (>=3):
- Recommendation:

---

(Add more entries as work progresses)

## Notes

Additional context, decisions, or reminders.
