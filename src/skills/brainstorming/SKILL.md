---
name: brainstorming
description: Use before planning or implementing features when intent, scope, success, user impact, constraints, or direction need to be clarified. Runs a grill-style, one-decision-at-a-time interview that produces a planning-ready WHAT contract without drifting into HOW.
---

# Brainstorming

This skill turns an idea into a decision-grade **WHAT** contract before
`/workflow:plan` decides **HOW** to build it.

The mode is deliberately closer to a design grilling than a friendly survey:
walk the decision tree one branch at a time, recommend an answer for each branch,
and keep going until the unresolved ambiguity is either resolved or explicitly
carried into planning.

## When to Use This Skill

Use brainstorming when:

- Requirements are unclear or ambiguous.
- Multiple product/workflow directions could solve the problem.
- User intent, success criteria, constraints, or non-goals need clarification.
- The user wants to pressure-test an idea before planning.
- The feature scope needs refinement.

Skip or shorten brainstorming when:

- The user already provided acceptance criteria, constraints, and direction.
- The task is a straightforward bug fix or well-defined change.
- The user explicitly asks to proceed directly to planning.

## Core Principle

Brainstorming answers:

- What problem are we solving?
- Who is it for?
- What outcome proves it worked?
- What is in scope and out of scope?
- What constraints must planning preserve?
- Which product/workflow direction should planning use?
- What ambiguity remains?

Brainstorming does not answer:

- Which files change?
- Which architecture pattern is selected?
- Which skills, agents, or task contracts execute?
- What tests, rollout sequence, or implementation steps are required?

## Phase 0: Assess Requirement Clarity

Before questioning, decide whether a brainstorm is needed.

**Signals requirements are already planning-ready:**

- Specific acceptance criteria are provided.
- The primary user and problem are clear.
- Success can be observed or measured.
- Constraints and non-goals are stated.
- The desired product/workflow direction is explicit.

If requirements are clear, suggest proceeding to planning or offer to
pressure-test the idea further.

## Phase 1: Decision-Tree Interrogation

Default to exactly one unresolved decision branch per turn. This is the heart of
the skill.

**Turn template:**

```markdown
**Decision branch:** <one unresolved WHAT/WHY decision>

**Current read:** <1-3 bullets or short sentences>

**Recommended answer:** <your recommended answer and why>

**One question:** <one sentence asking the user to accept, reject, or modify the recommendation>
```

**Hard rules:**

- Ask exactly one question per turn.
- Provide your recommended answer before the question.
- Stop after the question and wait.
- Never list all questions up front.
- Never provide a questionnaire.
- Never enumerate future branches as questions.
- Never ask multi-part questions.
- Never add "also" follow-ups.
- Never use multiple-choice prompts during exploration.
- If the answer is vague, name the remaining ambiguity and ask one sharper follow-up next turn.

**Decision branch order, unless context requires otherwise:**

1. Problem: what pain is worth solving now?
2. User: who has the problem and when?
3. Success: what observable outcome proves this worked?
4. Scope: what is included, excluded, or deferred?
5. Constraints: what cannot be violated?
6. Direction: which product/workflow direction should planning preserve?
7. Risks: what failure would make this unacceptable?

Use this order internally. Do not dump it into the conversation as a list of
questions.

## Phase 2: Repo-Answerable Questions

If a question can be answered by exploring the codebase, explore the codebase
instead of asking the user.

Use repo exploration only when it answers the active decision branch, such as:

- finding an existing similar workflow or pattern;
- checking repo guidance that constrains the WHAT contract;
- confirming whether a proposed direction conflicts with documented principles.

Keep this lightweight. Do not perform implementation research, file-level design,
skill selection, or task sequencing here. If a repo finding matters for later
implementation, capture it as a planning note.

## Phase 3: Direction Options

Offer 2-3 product/workflow directions only when the decision tree reveals a real
choice.

For each direction:

- Describe what changes for the user or workflow.
- List pros and cons.
- State when it is best.

Lead with a recommendation and ask exactly one question about whether the user
accepts, rejects, or wants to modify that recommendation.

Do not present implementation approaches, architecture choices, file changes,
test strategy, rollout sequencing, or skill/subagent routing.

## Phase 4: Capture the WHAT Contract

Write the brainstorm document to:

`docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`

**Document structure:**

```markdown
---
date: YYYY-MM-DD
topic: <kebab-case-topic>
ready_for_planning: yes|partial|no
---

# <Topic Title>

## What We're Building

## Problem and User

## Success Criteria

## Constraints

## Non-Goals

## Recommended Direction

## Alternatives Considered

## Key Decisions

## Planning Notes

## Open Questions

## Resolved Questions

## Next Steps
```

Before handoff:

- Classify open questions as **blocking** or **non-blocking**.
- Ask about each blocking question one at a time when possible.
- Move resolved questions into `Resolved Questions`.
- Keep non-blocking questions in `Open Questions` with ownership or a decision deadline.
- Declare `Ready for planning: yes|partial|no`.

## Phase 5: Handoff

Present clear options:

1. **Proceed to planning** -> Run `/workflow:plan`.
2. **Review and refine** -> Load `document-review`.
3. **Continue interrogation** -> Return to the next unresolved decision branch.
4. **Done for now** -> User will return later.

## YAGNI Principles

During brainstorming:

- Do not design for hypothetical future requirements.
- Choose the simplest product/workflow direction that solves the stated problem.
- Prefer established repo/product patterns when they answer the active branch.
- Ask whether complexity is necessary when it appears.
- Defer HOW decisions to planning.

## Anti-Patterns

| Anti-Pattern | Better Approach |
| --- | --- |
| Asking many questions in a row | Ask exactly one decision question |
| Listing a question bank | Pick the next load-bearing branch |
| Asking the user what the repo can answer | Inspect the repo for that branch |
| Asking neutral questions only | Provide a recommended answer first |
| Accepting vague answers | Name the ambiguity and sharpen the next question |
| Jumping to implementation details | Capture a planning note and return to WHAT |
| Creating lengthy design documents | Keep the WHAT contract concise |

## Integration with Planning

When brainstorm output exists, `/workflow:plan` should detect it and use it as
input, skipping its own idea refinement phase.

Planning may revisit HOW details, but it should not re-litigate WHAT decisions
that the brainstorm captured as resolved.
