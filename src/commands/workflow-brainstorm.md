---
name: brainstorm
invocation: workflow:brainstorm
description: Explore requirements and approaches through collaborative dialogue before planning implementation
argument-hint: "[feature idea or problem to explore]"
---

# Brainstorm a Feature or Improvement

Explore requirements and approaches through collaborative dialogue before planning implementation.

**Note: The current year is 2026.** Use this when dating brainstorm documents.

Brainstorming helps answer **WHAT** to build through collaborative
dialogue. It precedes `/workflow:plan`, which answers **HOW** to build
it.

**Process knowledge:** Load the `brainstorming` skill for detailed
discussion-first facilitation (one-question-then-prompts), approach
exploration patterns, and YAGNI principles.

It is critical that you follow this workflow in order; do not skip or shortcut steps.

## Guardrails

- Do not write or modify application code.
- Do not create commits or PRs.
- Output is the brainstorm document only.

---

## Feature Description

<feature_description>#$ARGUMENTS</feature_description>

**If the feature description above is empty, ask the user:**\
"What would you like to explore? Please describe the feature, problem,
or improvement you're thinking about."

Do not proceed until you have a feature description from the user.

---

## Execution Flow

---

### Phase 0: Assess Requirements Clarity

Evaluate whether brainstorming is needed based on the feature
description.

**Clear requirements indicators:**

- Specific acceptance criteria provided
- Referenced existing patterns to follow
- Described exact expected behavior
- Constrained, well-defined scope

**If requirements are already clear:**\
Use **AskUserQuestion** to suggest:

> "Your requirements seem detailed enough to proceed directly to
> planning. Should I run `/workflow:plan` instead, or would you like to
> explore the idea further?"

**State orchestration candidate signals (detection only):**

- Multi-step async flow with branching or compensation
- More than one boolean/flag controlling the same flow
- Retries, timeouts, cancellation, or recovery requirements
- Cross-component or cross-service coordination
- Planned spawned-child actors or receptionist-style actor lookup

If these signals appear, note that `/workflow:plan` should evaluate
whether to load a state-orchestration skill (see Skill Index in
AGENTS.md). Do not force architecture decisions in brainstorm.

---

### Phase 1: Understand the Idea

#### 1.1 Repository Research (Lightweight)

Run a quick repo scan to understand existing patterns:

- Task repo-research-analyst("Understand existing patterns related to:
  <feature_description>")

Focus on: - Similar features - Established patterns - AGENTS.md guidance

Also consider any repo-level guidance files such as `AGENTS.md`.

---

#### 1.2 Structured Dialogue Exploration (Default)

Engage in collaborative dialogue rather than a rapid question loop.

**Critical (non-negotiable):** Default response shape is **synthesize + discussion prompts + assumptions**. Multiple-choice / AskUserQuestion only for handoffs (Phase 0, Phase 4) or a single blocking question when the user is stuck.

**Enforcement rule:** Do **not** use AskUserQuestion during exploration until **after** at least one full dialogue iteration (Synthesize + discussion prompts + Capture). AskUserQuestion is only for handoffs or when one focused multiple-choice truly unblocks.

**Default cadence (per iteration):**

1. **Synthesize Current Understanding** (2--4 bullets)
2. **Ask at most ONE high-leverage question** (only if needed)
3. **Surface Tensions & Unknowns** using 3--5 **discussion prompts** (not interrogation)
4. **Capture Emerging Assumptions** (bullets)

**Hard rules:**

- Do not ask follow-up questions in the same turn.
- Ask **no more than one** clarifying question per iteration.
- If blocked, ask **one** additional clarifying question max, then return to prompts.

**First assistant message template (copy/paste shape):**

```markdown
**What I think you're aiming for (so far):**
- ...
- ...

**One question to anchor us:**
<single sentence>

**Prompts to react to (pick any):**
- Tradeoff: ...
- Edge area: ...
- UX vs architecture: ...
- Scale implication: ...
- Short-term vs long-term: ...

**Working assumptions (tell me what’s wrong):**
- ...
- ...
```

For each iteration:

1.  **Synthesize Current Understanding**

    - What the feature appears to be
    - Who it impacts
    - What class of change this is (incremental, foundational, risky, trivial)
    - Implied constraints

2.  **Ask at most ONE high-leverage question** (only if needed to unblock discussion)

3.  **Surface Tensions & Unknowns** via 3--5 prompts to react to (not interrogation), such as:

    - Tradeoff
    - Edge area
    - Scale implication
    - UX vs architecture tension
    - Short-term vs long-term implication

4.  **Capture Emerging Assumptions** Explicitly note:

    - Working assumptions
    - Tentative decisions
    - Areas still unresolved

5.  Continue iteratively until:

    - Direction is clear
    - Or user says "proceed"

---

#### Targeted Clarification Fallback

If ambiguity blocks meaningful progress:

- Ask **one** focused, high-leverage clarification question.
- Only use direct questioning when it is truly blocking meaningful discussion.
- Avoid serial low-value questioning.

---

### Phase 2: Explore Approaches

Propose **2--3 concrete approaches** based on research and dialogue.

For each approach, provide:

- Brief description (2--3 sentences)
- Pros and cons
- When it is best suited

Lead with your recommendation and explain why. Apply YAGNI --- prefer
simpler solutions.

Use **AskUserQuestion** to confirm preferred direction if needed.

---

### Phase 3: Capture the Design

Write a brainstorm document to:

docs/brainstorms/YYYY-MM-DD-`<topic>`-brainstorm.md

**Document structure must include:**

- What We're Building
- Why This Approach
- Key Decisions
- Open Questions

Ensure `docs/brainstorms/` exists before writing.

**Critical Rule:**\
Before proceeding to Phase 4, check if Open Questions remain.

If Open Questions exist:

- Classify each as **blocking** vs **non-blocking**.
- You MUST ask the user about each **blocking** question.
- Move resolved questions into a "Resolved Questions" section.
- Non-blocking questions may remain for planning, but must be clearly stated.

---

### Phase 4: Handoff

Use **AskUserQuestion** to present next steps:

**Question:**
"Brainstorm captured. What would you like to do next?"

**Options:**

1.  Review and refine
2.  Proceed to planning
3.  Ask more questions
4.  Done for now

If "Ask more questions" is selected: Return to Phase 1.2 and continue
structured dialogue.

If "Review and refine" is selected: Load the `document-review` skill and
apply it.

---

## Output Summary

When complete, display:

Brainstorm complete!

Document: docs/brainstorms/YYYY-MM-DD-`<topic>`-brainstorm.md

Key decisions: - \[Decision 1\] - \[Decision 2\]

Next: Run `/workflow:plan` when ready to implement.

---

## Important Guidelines

- Stay focused on WHAT, not HOW
- Dialogue first; interrogation only when necessary
- Apply YAGNI
- Keep outputs concise (200--300 words per section max)
- NEVER CODE during brainstorming
