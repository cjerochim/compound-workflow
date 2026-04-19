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

Engage in collaborative **dialog, one question at a time**. This is a discussion, not a survey — ask open-ended, conversational questions that invite the user to think out loud. Readability beats coverage.

**Critical (non-negotiable):** Default response shape is **synthesize + ONE open question + assumptions**. No "prompts to react to" menus. No multiple-choice questions during exploration. No multi-part questions. AskUserQuestion (which forces multiple-choice) is reserved strictly for handoffs (Phase 0, Phase 4) — never for exploration.

**Enforcement rule:** Do **not** use AskUserQuestion during Phase 1 exploration. Ask open-ended questions in plain prose and let the user reply in plain prose. AskUserQuestion is only for the Phase 0 / Phase 4 handoff decisions.

**Default cadence (per iteration):**

1. **Synthesize Current Understanding** (≤ 3 short bullets)
2. **Ask ONE high-leverage question** (the single most useful thing to resolve now)
3. **State Working Assumptions** (≤ 3 bullets, phrased as "tell me if any of these are wrong")

**Hard rules:**

- Exactly **one** question per turn. No follow-ups, no "also…", no multi-part questions.
- No "prompts to react to" / "pick any" menus. If tempted to list options, pick the single best one and ask that.
- Keep the whole turn short — aim for ≤ 12 lines. A reader should grasp it in one glance.
- If blocked, ask one more clarifying question **next** turn, never stack them.

**First assistant message template (copy/paste shape):**

```markdown
**What I think you're aiming for:**
- ...
- ...

**One question:**
<single sentence>

**I'm assuming (tell me if any of these are wrong):**
- ...
- ...
```

For each iteration:

1.  **Synthesize Current Understanding** (≤ 3 bullets)

    - What the feature appears to be
    - Who it impacts / what class of change (incremental, foundational, risky, trivial)
    - Implied constraint worth surfacing

2.  **Ask ONE high-leverage, open-ended question** anchored on purpose, users, success, or a hard constraint. Use "how/what/why" phrasing — not "which of these". Invite the user to think out loud.

3.  **State Working Assumptions** — the 1–3 most load-bearing beliefs you're operating on. Ask the user to flag anything wrong; do not turn these into extra questions.

4.  Continue iteratively until:

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

Ask which direction resonates as an open question in the conversation ("Which of these fits best, or does something in between feel closer?"). Do **not** use AskUserQuestion here — keep it a discussion.

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
