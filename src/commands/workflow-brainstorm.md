---
name: brainstorm
invocation: workflow:brainstorm
description: Interrogate a feature idea into a decision-grade WHAT contract before planning implementation
argument-hint: "[feature idea or problem to explore]"
---

# Brainstorm a Feature or Improvement

Interrogate a feature idea into a planning-ready **WHAT** contract. This
command precedes `/workflow:plan`, which answers **HOW** to build it.

**Note: The current year is 2026.** Use this when dating brainstorm documents.

**Process knowledge:** Load the `brainstorming` skill for the grill-style
decision-tree interview, one-branch-at-a-time questioning, recommended answers,
repo-answerable question handling, and YAGNI principles.

It is critical that you follow this workflow in order; do not skip or shortcut steps.

## Guardrails

- Do not write or modify application code.
- Do not create commits or PRs.
- Output is the brainstorm document only.
- Stay focused on WHAT and WHY; leave HOW to `/workflow:plan`.
- Never list all questions up front.
- Never provide a questionnaire or discovery checklist for the user to answer.

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

### Phase 0: Assess Whether Brainstorming Is Needed

Evaluate whether the feature description already contains a planning-ready WHAT
contract.

**Clear requirements indicators:**

- Specific acceptance criteria are provided.
- The primary user and problem are clear.
- Success can be observed or measured.
- Constraints and non-goals are stated.
- The desired product/workflow direction is explicit.

**If requirements are already clear:**\
Use **AskUserQuestion** to suggest:

> "Your requirements seem detailed enough to proceed directly to
> planning. Should I run `/workflow:plan` instead, or would you like to
> pressure-test the idea further first?"

If the user continues brainstorming, proceed to Phase 1.

---

### Phase 1: Decision-Tree Interrogation

Brainstorming is a guided interrogation, not a survey. Walk the user through the
decision tree one branch at a time until the WHAT contract is strong enough for
planning.

**Critical rule:** Exactly one unresolved decision branch may be handled per
assistant turn. Stop after asking the question. Wait for the user's answer before
moving to another branch.

**Default turn shape:**

```markdown
**Decision branch:** <one unresolved WHAT/WHY decision>

**Current read:** <1-3 bullets or short sentences>

**Recommended answer:** <your recommended answer and why>

**One question:** <one sentence asking the user to accept, reject, or modify the recommendation>
```

**Hard rules:**

- Ask exactly one question per turn.
- Provide a recommended answer for that question.
- Ask about the most load-bearing unresolved decision first.
- Do not ask multi-part questions.
- Do not ask "also" follow-ups.
- Do not list future questions.
- Do not use AskUserQuestion during Phase 1.
- Do not turn assumptions into extra questions.
- If the user gives a vague answer, say what remains vague and ask one sharper follow-up.

**Decision branch order, unless the conversation demands otherwise:**

1. Problem: what pain is worth solving now?
2. User: who experiences it and in what moment?
3. Success: what observable outcome proves this worked?
4. Scope: what is included, excluded, or explicitly deferred?
5. Constraints: what must not be violated?
6. Direction: which product/workflow direction should planning preserve?
7. Risks: what failure would make this unacceptable?

Do not present this order to the user as a questionnaire. Use it internally to
select the next single decision branch.

---

### Phase 2: Repo-Answerable Questions

If a question can be answered by exploring the repository, inspect the repository
instead of asking the user.

Use repo exploration only to answer a specific active decision branch, such as:

- whether a similar workflow or pattern already exists;
- whether project guidance constrains the WHAT contract;
- whether a proposed direction conflicts with documented repo principles.

Keep this lightweight. Deep technical research, file-level design, skill
selection, and implementation sequencing belong in `/workflow:plan`.

If repo signals imply a planning concern, record it as a **Planning Note**, not a
brainstorm decision. Example: "Planning should evaluate state-orchestration
needs because the desired workflow includes retries and cancellation."

---

### Phase 3: Direction Options

When the major decision branches are understood, present 2-3 product/workflow
directions only if there is a real choice to make.

For each direction, provide:

- Brief description, focused on WHAT changes for the user or workflow.
- Pros and cons.
- Best fit.

Lead with your recommendation and ask one question about that recommendation.

Do not present implementation approaches, architecture choices, file changes,
test strategy, rollout sequencing, or skill/subagent routing. Those belong in
`/workflow:plan`.

---

### Phase 4: Capture the WHAT Contract

Write a brainstorm document to:

docs/brainstorms/YYYY-MM-DD-`<topic>`-brainstorm.md

Ensure `docs/brainstorms/` exists before writing.

**Document structure must include:**

- What We're Building
- Problem and User
- Success Criteria
- Constraints
- Non-Goals
- Recommended Direction
- Alternatives Considered
- Key Decisions
- Planning Notes
- Open Questions
- Resolved Questions
- Next Steps

**Open question handling:**

- Classify each open question as **blocking** or **non-blocking**.
- Ask the user about each blocking question one at a time before handoff.
- Move resolved questions into a "Resolved Questions" section.
- Non-blocking questions may remain for planning, but must include ownership or a decision deadline.

**Readiness declaration:**

The document must declare one of:

- `Ready for planning: yes`
- `Ready for planning: no`
- `Ready for planning: partial`

If readiness is not `yes`, state the top blocker in one sentence.

---

### Phase 5: Handoff

Use **AskUserQuestion** to present next steps:

**Question:**
"Brainstorm captured. What would you like to do next?"

**Options:**

1. Review and refine
2. Proceed to planning
3. Continue interrogation
4. Done for now

If "Continue interrogation" is selected: return to Phase 1 and continue with
the next unresolved decision branch.

If "Review and refine" is selected: load the `document-review` skill and apply it.

---

## Output Summary

When complete, display:

Brainstorm complete!

Document: docs/brainstorms/YYYY-MM-DD-`<topic>`-brainstorm.md

Readiness: ready|partial|blocked

Key decisions:
- [Decision 1]
- [Decision 2]

Top blocker: [one sentence, or "None"]

Next: Run `/workflow:plan` when ready to implement.

---

## Important Guidelines

- Grill the idea, not the user.
- Stay focused on WHAT and WHY, not HOW.
- Be opinionated: every question gets a recommended answer.
- Apply YAGNI.
- Keep each turn short.
- Never code during brainstorming.
