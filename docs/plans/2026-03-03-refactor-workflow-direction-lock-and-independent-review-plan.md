---
title: Enforce Direction Lock and Independent Review in Workflow Commands
type: refactor
status: active
date: 2026-03-03
fidelity: medium
confidence: high
solution_scope: full_remediation
---

# Enforce Direction Lock and Independent Review in Workflow Commands

## Overview

Harden the command workflow so execution cannot silently drift from approved direction after brainstorming and planning. Add mandatory independent correction passes and a direction-lock contract that is checked during execution.

## Planning Declaration

- Fidelity selected: Medium
- Confidence: High
- Solution scope: full_remediation
- Spike evaluation: not-required
- Spikes needed: n/a
- Research mode: local only
- Open questions: none

Why this fidelity:
1. The changes are process-contract updates across multiple workflow docs, but not runtime product code.
2. Requirements are clear from current command behavior and identified failure modes.
3. The work needs explicit contracts and verification checks more than deep architectural exploration.

## Scope Contract

- Completion expectation: `/workflow:plan`, `/workflow:work`, and `/workflow:review` explicitly enforce direction lock and independent review checkpoints, with README and AGENTS guidance aligned.
- Non-goals:
  - No changes to install CLI or packaging behavior.
  - No changes to optional QA command (`/test-browser`) behavior.
  - No expansion of workflow phases beyond current canonical flow.

## Problem Statement / Motivation

Current workflow docs still allow confirmation bias and direction drift:

- `/workflow:work` marks reviewer agents as optional and skip-by-default, so independent correction can be bypassed.
- `/workflow:review` does not mandate a fresh-context reviewer pass.
- `brainstorm` and `plan` decisions are consumed, but there is no immutable direction-lock checksum that `work` must re-validate per todo.

This allows momentum-driven execution to continue even when new work diverges from initial intent.

## Proposed Solution

### 1. Add a Direction Lock contract in planning and execution

- In `/workflow:plan`, require a `## Direction Lock` section with:
  - fixed problem boundary
  - must-preserve constraints
  - explicit out-of-direction signals
  - escalation rule when drift is detected
- In `/workflow:work`, add a hard gate to verify Direction Lock before implementation and before marking each todo complete.
- If a todo fails the lock check, move it to `pending`, tag with `blocker`, and require triage.

### 2. Make independent correction mandatory before completion

- In `/workflow:work`, replace optional reviewer guidance with a required independent correction gate before final completion.
- Require evidence in Work Log:
  - reviewer pass executed
  - findings and disposition recorded
  - resulting follow-up todos created when needed

### 3. Enforce a fresh-context reviewer pass in `/workflow:review`

- Add a required reviewer pass that challenges plan assumptions and drift risk from a fresh context.
- If a dedicated independent reviewer agent is not available, require documented fallback process (second-pass synthesis checklist with explicit dissent checks) and mark output as degraded confidence.
- Record what reviewer pass ran, what was skipped, and why.

### 4. Align governance and public docs

- Update `src/AGENTS.md` non-negotiables to declare Direction Lock and independent correction as hard workflow contracts.
- Update README command summary and guardrails to reflect mandatory independent review gate.

## Alternatives / Tradeoffs

1. Keep reviewer pass optional and rely on `/workflow:review` recommendations.
- Pros: less overhead on simple work.
- Cons: does not solve drift in practice; same bias remains likely.

2. Enforce mandatory `/workflow:review` command for all work completion.
- Pros: strongest correction boundary.
- Cons: heavier cycle time for small doc-only changes unless exemptions are explicit.

3. Hybrid (recommended): mandatory independent correction gate in `/workflow:work` with explicit lightweight exemptions.
- Pros: strong default protection with pragmatic exceptions.
- Cons: needs careful wording to avoid exemption abuse.

## Technical Considerations

- Wording must avoid conflicting directives such as "execute faster" that undermine hard gates.
- Gate definitions must be deterministic and auditable in todo Work Logs.
- Any fallback mode must be explicit and never silently treated as equivalent to independent reviewer coverage.

## Acceptance Criteria

- [ ] `src/.agents/commands/workflow/plan.md` requires a `## Direction Lock` section and defines required fields.
- [ ] `src/.agents/commands/workflow/work.md` includes a hard Direction Lock check before implementation and per-todo completion.
- [ ] `src/.agents/commands/workflow/work.md` replaces optional reviewer language with a mandatory independent correction gate (with explicit exemptions and evidence rules).
- [ ] `src/.agents/commands/workflow/review.md` requires a fresh-context reviewer pass or a clearly marked degraded-confidence fallback.
- [ ] `src/AGENTS.md` non-negotiables include direction-lock enforcement and independent correction requirements.
- [ ] `README.md` workflow/guardrail summary matches the new mandatory review contract.
- [ ] Validation commands and targeted grep checks pass and outputs are recorded in Work Log evidence.

## Success Metrics

- 100% of new plans include a Direction Lock section.
- 100% of completed todos include independent correction evidence or explicit approved exemption.
- 0 sampled runs where work is marked complete without review-gate evidence.

## Dependencies & Risks (table)

| Dependency / Risk | Impact | Mitigation |
|-------------------|--------|------------|
| Reviewer agent availability differs by environment | Gate may be skipped in practice | Define fallback as degraded-confidence mode with explicit disclosure and follow-up requirement |
| Contract wording conflicts with speed-oriented guidance | Models may follow looser language | Remove/replace conflicting text and centralize gate precedence |
| Increased process overhead | Slower throughput on low-risk work | Add narrow, explicit exemptions for doc-only or no-code tasks with traceable rationale |

## Rollout

1. Update command contracts (`plan`, `work`, `review`) and governance (`AGENTS.md`).
2. Update README wording for public contract consistency.
3. Run validation checks and a dry-run walkthrough against one sample plan/todo flow.
4. Capture resulting workflow learning with `/workflow:compound` if new enforcement gotchas appear.

## Observability & Test Plan

- Contract presence checks:
  - `rg -n "## Direction Lock" src/.agents/commands/workflow/plan.md src/.agents/commands/workflow/work.md`
  - `rg -n "independent correction|fresh-context|degraded-confidence" src/.agents/commands/workflow/work.md src/.agents/commands/workflow/review.md`
- Regression checks for conflicting optional wording:
  - `rg -n "Consider Reviewer Agents|Don't use by default|skip specialist reviewers by default" src/.agents/commands/workflow/work.md`
- Documentation consistency checks:
  - `rg -n "review|independent|direction lock" README.md src/AGENTS.md`
- Packaging sanity:
  - `npm run check:pack-readme`

## Agentic Access & Validation Contract

- Access Preconditions: local workspace write access to workflow markdown files and docs.
- Access Method: edit files directly in this repository using command-line and patch tools.
- Validation Path: run targeted `rg` checks plus `npm run check:pack-readme`.
- Evidence Required: command outputs showing contract text present and conflicting wording removed.
- Quality Gates:
  - test: not configured for this docs-only change
  - lint: ask once if a repo lint command is required for markdown/doc changes
  - typecheck: ask once if a repo typecheck command is required for markdown/doc changes

## References & Research

- Existing workflow sequence and contracts: `/Users/cjerochim/Documents/DEVELOPMENT/compound-workflow/README.md:64`
- Current optional reviewer guidance in work: `/Users/cjerochim/Documents/DEVELOPMENT/compound-workflow/src/.agents/commands/workflow/work.md:434`
- Current review parallel pass requirements: `/Users/cjerochim/Documents/DEVELOPMENT/compound-workflow/src/.agents/commands/workflow/review.md:100`
- Current brainstorm-to-plan context handoff: `/Users/cjerochim/Documents/DEVELOPMENT/compound-workflow/src/.agents/commands/workflow/plan.md:60`
