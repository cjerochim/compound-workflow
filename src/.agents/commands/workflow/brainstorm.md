---
name: brainstorm
invocation: workflow:brainstorm
description: Explore requirements and approaches through collaborative dialogue before planning implementation
argument-hint: "[feature idea or problem to explore]"
---

# Brainstorm a Feature or Improvement

**Note: The current year is 2026.** Use this when dating brainstorm
documents.

Brainstorming helps answer **WHAT** to build through collaborative
dialogue. It precedes `/workflow:plan`, which answers **HOW** to build
it.

**Process knowledge:** Load the `brainstorming` skill for detailed
question techniques, approach exploration patterns, and YAGNI
principles.

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
Use **AskUserQuestion tool** to suggest:

> "Your requirements seem detailed enough to proceed directly to
> planning. Should I run `/workflow:plan` instead, or would you like to
> explore the idea further?"

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

For each iteration:

1.  **Synthesize Current Understanding**

    - What the feature appears to be
    - Who it impacts
    - What class of change this is (incremental, foundational, risky,
      trivial)
    - Implied constraints

2.  **Surface Tensions & Unknowns** Provide 3--5 bullet discussion
    angles such as:

    - Tradeoffs
    - Edge areas
    - Scale implications
    - UX vs architecture tension
    - Short-term vs long-term implications

    These should be framed as prompts to react to --- not interrogation.

3.  **Capture Emerging Assumptions** Explicitly note:

    - Working assumptions
    - Tentative decisions
    - Areas still unresolved

4.  Continue iteratively until:

    - Direction is clear
    - Or user says "proceed"

---

#### Targeted Clarification Fallback

If ambiguity blocks meaningful progress:

- Ask 1--2 focused, high-leverage clarification questions.
- Only use direct questioning when necessary to prevent incorrect
  planning.
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

Use **AskUserQuestion tool** to confirm preferred direction if needed.

---

### Phase 3: Capture the Design

Write a brainstorm document to:

docs/brainstorms/YYYY-MM-DD-`<topic>`{=html}-brainstorm.md

**Document structure must include:**

- What We're Building
- Why This Approach
- Key Decisions
- Open Questions

Ensure `docs/brainstorms/` exists before writing.

**Critical Rule:**\
Before proceeding to Phase 4, check if Open Questions remain.

If Open Questions exist, you MUST: - Ask the user about each one. - Move
resolved questions into a "Resolved Questions" section. - Do not proceed
until ambiguity is reduced.

---

### Phase 4: Handoff

Use **AskUserQuestion tool** to present next steps:

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

Document: docs/brainstorms/YYYY-MM-DD-`<topic>`{=html}-brainstorm.md

Key decisions: - \[Decision 1\] - \[Decision 2\]

Next: Run `/workflow:plan` when ready to implement.

---

## Important Guidelines

- Stay focused on WHAT, not HOW
- Dialogue first; interrogation only when necessary
- Apply YAGNI
- Keep outputs concise (200--300 words per section max)
- NEVER CODE during brainstorming
