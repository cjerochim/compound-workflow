---
module: Compound Workflow
date: 2026-03-02
problem_type: workflow_issue
component: tooling
symptoms:
  - "Execution-focused models skipped worktree setup and started coding in the main checkout."
  - "Spike investigations were not consistently front-loaded before dependent implementation tasks."
  - "Parallel spike research coverage varied because baseline subagent execution was optional."
root_cause: advisory workflow language made preflight and spike ordering controls easy to bypass
framework: markdown-command-workflow
environment: dev
resolution_type: workflow_improvement
severity: high
tags: [workflow, worktree, spike-planning, triage, execution-ordering]
---

# Troubleshooting: Enforce Worktree Preflight and Spike Ordering in Workflow Commands

## Problem
The command contracts allowed execution momentum to override guardrails. In practice, models could skip worktree setup and defer spike ordering decisions until late execution, causing inconsistent behavior.

## Environment
- Module: Compound Workflow
- Framework/Runtime: markdown command + skill specs
- Environment/Stage: dev
- Affected Component: workflow command contracts (`plan`, `work`, `triage`) and todo mapping (`file-todos`)
- Date: 2026-03-02

## Symptoms
- Worktree setup was treated as optional even when isolation was the intended default.
- Spike candidates lacked upfront dependency and priority metadata, so ordering depended on later interpretation.
- Spike research subagents were documented as optional, resulting in uneven discovery quality.

## What Didn't Work (optional for implementation insights)

**Attempted Solution 1:** Keep "recommended/default" language for worktree and spike handling.
- **Why it failed:** Execution-oriented agents optimize for progress and can interpret advisory wording as skippable.

**Attempted Solution 2:** Depend on triage/work phases alone to infer spike ordering.
- **Why it failed:** Without plan-level dependency and unblock metadata, downstream ordering remains ambiguous.

## Solution

Hardened the command contracts end-to-end so intent is defined in planning, confirmed in triage, and enforced in work execution.

**Code changes** (if applicable):
```text
# Plan hardening:
src/.agents/commands/workflow/plan.md
- Added risky-work Spike Need Evaluation with explicit declaration:
  - Spike evaluation: required|not-required
  - Spikes needed: yes|no|n/a
- Added required Spike Candidate metadata:
  Initial priority, Depends on, Unblocks, Timebox, Deliverable, Parallelizable
- Added checklist and write-time gates for risky plans.

# Todo mapping hardening:
src/.agents/skills/file-todos/SKILL.md
- Carry spike metadata from plan into pending spike todos.
- Default unblocking spikes to p1 if priority is not explicitly set.
- Require triage confirmation/adjustment of carried metadata.

# Triage hardening:
src/.agents/commands/workflow/triage.md
- Enforce blocking spikes first.
- Prevent dependent build todos from being executable before blocking spikes.
- Allow parallel readiness only for independent spikes.

# Work hardening:
src/.agents/commands/workflow/work.md
- Enforce blocking spike execution before dependent build todos.
- Require baseline parallel spike research subagents:
  repo-research-analyst + learnings-researcher
- Execute dependent spikes in dependency order.

# Governance:
src/AGENTS.md
- Added non-negotiable rule for explicit, ordered spike governance.
```

**Commands run** (if applicable):
```bash
# Validation and context gathering:
rg -n "spike|dependencies|parallel|triage|worktree" src/.agents/** src/AGENTS.md
nl -ba src/.agents/commands/workflow/*.md
nl -ba src/.agents/skills/file-todos/SKILL.md

# Documentation capture:
mkdir -p docs/solutions/workflow-issues
```

## Why This Works

1. **Root cause addressed:** The issue was not missing steps, but weak enforcement semantics. Explicit gates and required metadata remove interpretive gaps.
2. **Ordering is now deterministic:** Plan defines dependency intent, triage confirms it, and work enforces it against ready/unblocked state.
3. **Research quality is stabilized:** Mandatory baseline parallel subagents guarantee minimum context before spike recommendations.

## Prevention

- Treat isolation and spike controls as hard contract points, not guidance text.
- Require dependency/unblock metadata at plan time for all spikes that may gate implementation.
- Preserve the execution chain:
  - `plan/file-todos`: define
  - `triage`: confirm
  - `work`: enforce
- Include contract checks in command pre-submission checklists to prevent regressions in future edits.

## Related Issues

No related issues documented yet.
