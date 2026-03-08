---
title: Work Stuck Guard — Auto-Research on Blocked Execution
type: feat
status: completed
date: 2026-03-09
fidelity: medium
confidence: high
solution_scope: full_remediation
---

# Work Stuck Guard — Auto-Research on Blocked Execution

## Overview

Add a stuck detection guard to the `/workflow:work` Blocker Protocol that auto-launches research sub-agents in parallel when the agent cannot proceed, then synthesizes their findings into enriched, research-backed options before presenting the decision prompt to the user. The user still makes the final call — the guard enriches the information available at decision time, not the decision itself.

This is a targeted edit to `src/.agents/commands/workflow-work.md` only. No new commands, skills, or agents are introduced.

---

- **Fidelity selected:** Medium
- **Confidence:** High
- **Solution scope:** full_remediation
- **Research mode:** local only
- **Why this fidelity:** single-file docs-only edit; no security, payments, privacy, or data migration concerns; low rollback risk (revert one file section); pattern precedent is fully local
- **Open questions:** none

---

## Scope Contract

- **Completion expectation:** The Blocker Protocol section of `workflow-work.md` includes a mandatory "Stuck Guard" pre-step that fires on both trigger types, dispatches research sub-agents in parallel, synthesizes findings, and hands off an enriched output to the existing decision prompt. All acceptance criteria in this plan are verifiable via manual review of the updated command doc.
- **Non-goals:**
  - New commands, skills, or agents
  - Changes to any file other than `src/.agents/commands/workflow-work.md`
  - Automated metrics or stuck-frequency tracking
  - Changes to the Spike Protocol (guard output feeds into it, but Spike Protocol itself is unchanged)
  - Changes to the todo template or file-todos skill

## Problem Statement / Motivation

The existing Blocker Protocol surfaces ≥3 options and asks the user to decide — but produces those options from the agent's current (limited) context, without targeted research. When the agent is blocked due to unknown territory or repeated failures, the user receives options that may be poorly informed. The stuck guard fills this gap: it does a bounded, single-pass autonomous research pass before the options are surfaced, so the user's decision is grounded in findings rather than agent reasoning alone.

Institutional precedent (`docs/solutions/workflow-issues/2026-03-02-compound-workflow-enforce-worktree-and-spike-ordering.md`): advisory language is reliably skipped; mandatory enforcement language is required. The guard must be written as a required named gate, not a "should consider" suggestion.

## Proposed Solution

Insert a **Stuck Guard** as a named pre-step inside the Blocker Protocol, immediately after trigger detection and before the output format section. The guard:

1. Announces detection to the user (visible, not silent)
2. Immediately transitions the todo to `pending + tags: [blocker]` with a placeholder Work Log entry
3. Dispatches research sub-agents in parallel (baseline mandatory + conditional contextual)
4. Collects findings in a single pass (no recursive guard firing)
5. Synthesizes findings into the enriched Blocker Protocol output format
6. Hands off to the existing decision prompt

### Trigger Conditions (Explicit)

**Trigger 1 — Unknown territory:** The agent explicitly cannot identify a clear next step after consulting available context and codebase patterns. This requires agent self-declaration: the agent must recognize and name that it is in unknown territory (e.g. "required API behavior is not in context," "no codebase pattern exists for this operation," "prior attempts produced irreconcilable errors with no clear resolution path").

**Trigger 2 — Repeated failures:** ≥2 distinct failed approaches on the same todo step, OR ≥3 total failures on the same todo regardless of step or approach variety. Failure = a test, lint, type, or runtime check produces an error that the agent cannot resolve within one further attempt.

**Guard suppression:** The stuck guard MUST NOT fire for todos tagged `tags: [spike]`. Spikes are already the resolution mechanism for unknowns — guard-inside-spike creates protocol recursion. If a Spike is genuinely inconclusive, it surfaces through standard Spike completion with an "inconclusive" Work Log note.

### Sub-Agent Dispatch

Run in parallel immediately after todo state transition:

**Mandatory baseline (always):**
- `Task repo-research-analyst(<context>)` — codebase patterns, existing conventions
- `Task learnings-researcher(<context>)` — institutional knowledge in `docs/solutions/`

**Conditional (based on explicit signal mapping — not agent discretion):**

| Signal in `failure_description` or `stuck_type` | Add agent |
|---|---|
| References an external library, package, SDK, or API (e.g. error mentions a library name, imported module, or external endpoint) | `Task framework-docs-researcher(<context>)` |
| References approach, pattern, architecture, or design choice (e.g. "don't know which pattern to use", "multiple valid approaches exist") | `Task best-practices-researcher(<context>)` |
| Touches a file or function that already exists in the codebase (i.e. modifying rather than creating) | `Task git-history-analyzer(<context>)` |

When multiple signals are present, dispatch all matching agents. When no signal matches, dispatch baseline only.

**Context payload passed to each agent:**
```
{
  todo_title: <title from todo frontmatter>,
  todo_description: <problem statement from todo>,
  stuck_type: "unknown_territory" | "repeated_failure",
  failure_description: <specific error/blocker description>,
  working_directory: <current worktree path>
}
```

**Fallback when Task dispatch is unavailable:**
Announce explicitly: "Research sub-agents unavailable — proceeding with agent-reasoned options only." Produce the standard Blocker Protocol output (no enrichment possible). Do NOT silently produce unresearched options presented as researched.

**Sub-agent timeout:** Each agent has a single-pass return. If an agent does not return within its execution window, record `[agent-name]: no findings returned` in the Research Findings section and continue synthesis.

### Enriched Blocker Protocol Output Format

The output of the stuck guard replaces the standard Blocker Protocol output format. Required sections:

```markdown
## Stuck Guard Triggered

**Detected:** [unknown_territory | repeated_failure]
**Investigating...** Launching: repo-research-analyst, learnings-researcher[, framework-docs-researcher][, best-practices-researcher][, git-history-analyzer]

---

## Research Findings

- **repo-research-analyst:** [2–5 sentence summary, or "no findings returned"]
- **learnings-researcher:** [2–5 sentence summary, or "no findings returned"]
- **framework-docs-researcher:** [2–5 sentence summary, or "not invoked" | "no findings returned"]
- **best-practices-researcher:** [2–5 sentence summary, or "not invoked" | "no findings returned"]
- **git-history-analyzer:** [2–5 sentence summary, or "not invoked" | "no findings returned"]

**Synthesis confidence:** `high` | `medium` | `low` (based on findings quality — low when all agents return empty)

---

## Blocker Summary

[1–2 sentences describing what specifically blocked execution]

## Constraints Discovered

- [constraint 1]
- [constraint 2]

## Options

**Option 1: [Name]** *(source: [agent name(s)] | agent-reasoned)*
- Pros: ...
- Cons: ...
- Risk: ...
- Effort: ...

**Option 2: [Name]** *(source: [agent name(s)] | agent-reasoned)*
- ...

**Option 3: [Name]** *(source: [agent name(s)] | agent-reasoned)*
- ...

## Recommendation

[One option + 2–4 bullets explaining why, citing research findings]

---

*Which option should we take?*
```

**When findings are empty (all sub-agents return no findings):** Produce ≥3 options clearly marked `*(agent-reasoned — research returned no findings)*`. Do not fabricate citations. Set `synthesis_confidence: low`.

**When one option is a Spike:** Use the standard Spike Candidate format from `workflow-work.md` Spike Protocol (include `Initial priority`, `Depends on`, `Unblocks`, `Timebox`, `Deliverable`, `Parallelizable` metadata) so the existing Spike Protocol can process it without modification.

### Todo State Transition Sequence

This order is mandatory:

1. Guard trigger detected
2. Announce to user: "Pausing to investigate..."
3. **Immediately** transition todo: `ready` → `pending + tags: [blocker]`
4. Add placeholder Work Log entry: `"Stuck Guard triggered. Investigation in progress. [stuck_type]. [timestamp]. Partial changes may exist — review working directory before resuming."`
5. Dispatch sub-agents in parallel (per signal mapping table above)
6. Collect findings
7. Synthesize enriched output
8. Update Work Log `Blocker Decision` section with full enriched output
9. Present decision prompt to user
10. After user decision: apply existing Blocker Protocol after-decision steps (convert to todos; re-approve through triage before returning to `ready`)

State transitions happen before sub-agent dispatch (step 3) to prevent concurrent session pickup of the todo during research.

## Alternatives / Tradeoffs

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| Pre-step inside Blocker Protocol (chosen) | No new protocol; reuses sub-agent pattern; user decision preserved; minimal doc change | Slightly longer Blocker Protocol section | Selected |
| Auto-trigger full Spike Protocol | Reuses spike machinery end-to-end | Requires user triage approval before research runs (defeats purpose); adds worktree overhead for routine blockers | Rejected |
| Silent research then surface | Lowest friction | Breaks human-gated contract; user can't observe what's happening | Rejected |
| Post-decision enrichment | No change to trigger timing | Research happens too late to inform the decision | Rejected |

## Acceptance Criteria

### Trigger Detection
- [ ] AC-1: Guard MUST NOT fire on first failure — threshold must have been crossed (≥2 distinct approaches OR ≥3 total failures on same todo)
- [ ] AC-2: Guard MUST fire when agent explicitly self-declares unknown territory (agent names the stuck condition)
- [ ] AC-3: Guard MUST categorize stuck type (`unknown_territory` | `repeated_failure`) and log this in the announcement and Work Log
- [ ] AC-4: Guard MUST NOT fire for todos tagged `tags: [spike]`

### Sub-Agent Dispatch
- [ ] AC-5: `repo-research-analyst` and `learnings-researcher` MUST always be dispatched
- [ ] AC-6: Conditional agents MUST be dispatched based on the explicit signal mapping table (library/API reference → framework-docs-researcher; approach/pattern reference → best-practices-researcher; existing file modification → git-history-analyzer) — not agent discretion
- [ ] AC-7: When Task dispatch is unavailable, guard MUST produce explicit "Research unavailable" warning — MUST NOT silently produce unresearched options labeled as researched
- [ ] AC-8: Sub-agents MUST NOT be able to recursively trigger the Stuck Guard (guard is suppressed in `spike` tagged todos)

### State Transitions
- [ ] AC-9: Todo MUST transition to `pending + tags: [blocker]` BEFORE sub-agent dispatch begins
- [ ] AC-10: Work Log MUST contain an "Investigation in progress" placeholder entry at state transition time
- [ ] AC-11: Work Log MUST be updated with full enriched Blocker Decision after synthesis completes
- [ ] AC-12: The placeholder Work Log entry (step 4) MUST include: "Partial changes may exist — review working directory before resuming" — unconditionally, regardless of whether changes are detected

### Output Quality
- [ ] AC-13: Synthesized output MUST contain ≥3 options even when findings are empty (explicitly marked `agent-reasoned` when research was inconclusive)
- [ ] AC-14: Each option MUST cite the sub-agent source(s) that support it, or explicitly state "agent-reasoned"
- [ ] AC-15: Output MUST include a `## Research Findings` section listing each sub-agent invoked and a summary (or "no findings" / "not invoked")
- [ ] AC-16: The announcement MUST be visible to the user and MUST name the sub-agents being launched
- [ ] AC-17: **Synthesis confidence** (`high`|`medium`|`low`) MUST be declared in the output based on findings quality; MUST be `low` when all agents return empty findings

### Spike Protocol Integration
- [ ] AC-18: When a Spike is recommended, it MUST use the standard Spike Candidate metadata format from Spike Protocol
- [ ] AC-19: Guard MUST NOT introduce a new todo state — only `pending + tags: [blocker]` (existing states only)

## Dependencies & Risks

| Dependency / Risk | Impact | Mitigation |
|---|---|---|
| Sub-agent environment unavailable | Guard cannot do research; must degrade gracefully | Explicit fallback: "Research unavailable" warning + standard Blocker output |
| Guard fires too eagerly (low threshold) | Too many pauses; friction for routine blockers | Threshold is ≥2 distinct approaches or ≥3 total failures; first-failure pass-through preserved |
| Protocol recursion (guard inside spike) | Infinite loop risk | Explicit suppression: guard MUST NOT fire for `tags: [spike]` todos |
| Advisory language gets skipped | Guard becomes optional in practice | All language uses MUST/MUST NOT; named as required gate; institutional precedent confirms this works |
| Output format drift over time | Review cannot validate enriched output | Concrete output template in plan; AC-13–AC-17 define structural compliance |

## Rollout

Single file edit to `src/.agents/commands/workflow-work.md`. No staged rollout needed — the change is additive within an existing section, and the fallback path (unavailable sub-agents → standard Blocker) ensures backward compatibility.

## Observability & Test Plan

- Manual review: verify enriched Blocker Protocol output template appears in the updated `workflow-work.md`
- Manual review: verify trigger conditions, state transition sequence, sub-agent dispatch contract, and fallback path are all present with mandatory (MUST/MUST NOT) language
- Manual review: verify AC-1 through AC-19 against the written doc
- Functional validation occurs when `/workflow:work` naturally hits a blocker in a downstream session — the guard fires and produces the enriched output format

## Agentic Access & Validation Contract

- **Access Preconditions:** Read/write access to `src/.agents/commands/workflow-work.md`
- **Access Method:** Standard file edit tools (Read → Edit); no services, credentials, or env vars required
- **Validation Path:** After edit, read `workflow-work.md` and verify the Blocker Protocol section contains the Stuck Guard pre-step with all required elements
- **Evidence Required:**
  - `workflow-work.md` diff showing the Stuck Guard insertion in the Blocker Protocol section
  - All 19 acceptance criteria verified as present in the written document (checklist review)
- **Quality Gates:**
  - test: not applicable (docs-only change)
  - lint: not applicable
  - typecheck: not applicable

## References & Research

### Internal References
- Blocker Protocol (current): `src/.agents/commands/workflow-work.md:360–381`
- Spike Protocol (sub-agent dispatch pattern): `src/.agents/commands/workflow-work.md:383–400`
- Spike sub-agent baseline: `src/.agents/commands/workflow-work.md:391–393`
- Brainstorm: `docs/brainstorms/2026-03-09-work-stuck-guard-brainstorm.md`

### Institutional Learnings
- `docs/solutions/workflow-issues/2026-03-02-compound-workflow-enforce-worktree-and-spike-ordering.md` — mandatory enforcement language pattern; advisory language is reliably skipped; baseline sub-agent execution must be non-optional
