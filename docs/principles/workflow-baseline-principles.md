---
title: Workflow Baseline Principles
date: 2026-03-03
status: active
---

# Workflow Baseline Principles

This document is the baseline contract for how the workflow operates.  
When command docs or guidance conflict, these principles are the tie-breaker.

## Canonical Flow

1. `/workflow:brainstorm` - clarify WHAT to build
2. `/workflow:plan` - define HOW to build it
3. `/workflow:work` - implement in isolation with evidence (includes required triage gate)
4. `/workflow:review` - run independent quality validation
5. `/workflow:compound` - capture durable learnings

Optional manual command:

- `/workflow:triage` - explicitly curate/prioritize the queue before or during execution when needed

## Principles

- **Commands are the public API**  
  Intent: Keep behavior predictable by routing work through stable commands instead of ad-hoc agent behavior.

- **Phase separation is strict**  
  Intent: Prevent context mixing by keeping each phase focused on one responsibility.

- **Hard gates over advisory wording**  
  Intent: Make critical controls non-skippable (isolation, triage, validation) so execution is deterministic.

- **Plans must contain explicit contracts**  
  Intent: Define scope, completion criteria, non-goals, and validation upfront so implementation cannot drift.

- **Triage defines the executable queue**  
  Intent: Ensure only approved, dependency-aware, ready todos can be executed (via `/workflow:work` default triage gate or explicit `/workflow:triage`).

- **Isolation-first execution**  
  Intent: Reduce branch contamination and accidental edits through worktrees or equivalent isolation by default.
  `/workflow:work` must ask (or honor an explicit prior user instruction) whether to create/use a worktree before any implementation commands.

- **No silent scope expansion**  
  Intent: Force explicit decisions when new work appears instead of quietly changing scope.

- **Evidence is required for completion**  
  Intent: A task is done only when acceptance criteria and quality checks are proven and recorded.

- **Quality gates use configured commands with controlled fallback**  
  Intent: Keep validation consistent across repos while allowing a single explicit fallback when config is missing.

- **Review is independent and risk-aware**  
  Intent: Catch correctness and direction drift through a fresh, structured pass before work is considered complete.

- **Artifacts are the source of truth**  
  Intent: Keep plans, todos, and solution docs aligned so project state is visible and auditable.

- **Capture reusable learnings**  
  Intent: Convert solved issues into durable docs that reduce repeated mistakes and ambiguity.
