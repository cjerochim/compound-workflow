---
name: brainstorming
description: This skill should be used before implementing features, building components, or making changes. It guides exploring user intent, approaches, and design decisions before planning. Triggers on "let's brainstorm", "help me think through", "what should we build", "explore approaches", ambiguous feature requests, or when the user's request has multiple valid interpretations that need clarification.
---

# Brainstorming

This skill provides detailed process knowledge for effective brainstorming sessions that clarify **WHAT** to build before diving into **HOW** to build it.

## When to Use This Skill

Brainstorming is valuable when:

- Requirements are unclear or ambiguous
- Multiple approaches could solve the problem
- Trade-offs need to be explored with the user
- The user hasn't fully articulated what they want
- The feature scope needs refinement

Brainstorming can be skipped when:

- Requirements are explicit and detailed
- The user knows exactly what they want
- The task is a straightforward bug fix or well-defined change

## Core Process

### Phase 0: Assess Requirement Clarity

Before diving into questions, assess whether brainstorming is needed.

**Signals that requirements are clear:**

- User provided specific acceptance criteria
- User referenced existing patterns to follow
- User described exact behavior expected
- Scope is constrained and well-defined

**Signals that brainstorming is needed:**

- User used vague terms ("make it better", "add something like")
- Multiple reasonable interpretations exist
- Trade-offs haven't been discussed
- User seems unsure about the approach

If requirements are clear, suggest: "Your requirements seem clear. Consider proceeding directly to planning or implementation."

### Phase 1: Understand the Idea

Default to **one question at a time**. Readability beats coverage — the user pulls the next layer, you don't push all of it.

**Default cadence (per iteration):**

1. **Synthesize current understanding** (≤ 3 short bullets)
2. **Ask ONE high-leverage question** (the single most useful thing to resolve right now)
3. **State working assumptions** (≤ 3 bullets, phrased as "tell me if any of these are wrong")

**Hard rules:**

- Exactly **one** question per turn. No follow-ups, no "also…", no multi-part questions.
- No "prompts to react to" / "pick any" menus. If you're tempted to list options, pick the single best one and ask that.
- Keep the whole turn short — think ≤ 12 lines of output. A reader should grasp it in one glance.
- If ambiguity blocks progress, ask one more clarifying question next turn. Never stack them.

**First response template (copy/paste shape):**

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

**Choosing the ONE question:**

This is a **dialog**, not a survey. Ask open, conversational questions that invite the user to think out loud — not multiple-choice prompts that force a pick.

1. **Anchor on purpose, users, success, or a hard constraint.** Avoid implementation sequencing ("how will we build it?").
2. **Keep it open-ended.** Prefer "how", "what", "why" over "which of these".
   - Good: "How would you want users to be notified, and why that way?"
   - Avoid: "Should the notification be: (a) email, (b) in-app, or (c) both?"
3. **Validate a specific assumption** when that's the biggest unknown — phrased so the user can elaborate, not just yes/no.
   - "I'm assuming users will be logged in when this triggers — is that right, and what happens if they aren't?"
4. **Prefer success criteria early.**
   - "What would make you say 'this worked'?"

**Question bank (pick one per turn — never list several):**

- Purpose: "What problem is painful enough to fix now?"
- Users: "Who is the primary user and what's their moment-of-need?"
- Constraints: "What constraint should we treat as immovable?"
- Success: "What does success look like (observable behavior)?"
- Edges: "What must not happen? What failure would be unacceptable?"
- Patterns: "What existing behavior/pattern do we want to preserve?"

**Exit condition:** Continue until direction is clear OR the user says "proceed" / "move on".

### Phase 2: Explore Approaches

After understanding the idea, propose 2-3 concrete approaches.

**Structure for Each Approach:**

```markdown
### Approach A: [Name]

[2-3 sentence description]

**Pros:**

- [Benefit 1]
- [Benefit 2]

**Cons:**

- [Drawback 1]
- [Drawback 2]

**Best when:** [Circumstances where this approach shines]
```

**Guidelines:**

- Lead with a recommendation and explain why
- Be honest about trade-offs
- Consider YAGNI—simpler is usually better
- Reference codebase patterns when relevant

### Phase 3: Capture the Design

Summarize key decisions in a structured format.

**Design Doc Structure:**

```markdown
---
date: YYYY-MM-DD
topic: <kebab-case-topic>
---

# <Topic Title>

## What We're Building

[Concise description—1-2 paragraphs max]

## Why This Approach

[Brief explanation of approaches considered and why this one was chosen]

## Key Decisions

- [Decision 1]: [Rationale]
- [Decision 2]: [Rationale]

## Open Questions

- [Any unresolved questions for the planning phase]

## Next Steps

→ `/workflow:plan` for implementation details
```

**Output Location:** `docs/brainstorms/YYYY-MM-DD-<topic>-brainstorm.md`

Before handoff, review the `Open Questions` section.

- Classify open questions as **blocking** vs **non-blocking**.
- Ask the user about each **blocking** question (one at a time) when possible.
- Move resolved items into a `Resolved Questions` section.
- Keep non-blocking items in `Open Questions` to carry into planning, with clear ownership or a decision deadline.

### Phase 4: Handoff

Present clear options for what to do next:

1. **Proceed to planning** → Run `/workflow:plan`
2. **Refine further** → Continue exploring the design
3. **Done for now** → User will return later

## YAGNI Principles

During brainstorming, actively resist complexity:

- **Don't design for hypothetical future requirements**
- **Choose the simplest approach that solves the stated problem**
- **Prefer boring, proven patterns over clever solutions**
- **Ask "Do we really need this?" when complexity emerges**
- **Defer decisions that don't need to be made now**

## Incremental Validation

Keep sections short—200-300 words maximum. After each section of output, pause to validate understanding:

- "What part feels most important / most wrong?"
- "Which prompt should we dig into next?"
- "Any assumption I should flip before we continue?"

This prevents wasted effort on misaligned designs.

## Anti-Patterns to Avoid

| Anti-Pattern                           | Better Approach                             |
| -------------------------------------- | ------------------------------------------- |
| Asking many questions in a row         | Exactly one question per turn               |
| Listing "prompts to react to"          | Pick the single best question and ask it    |
| Dense walls of bullets                 | ≤ 12 lines per turn; readable at a glance   |
| Jumping to implementation details      | Stay focused on WHAT, not HOW               |
| Proposing overly complex solutions     | Start simple, add complexity only if needed |
| Ignoring existing codebase patterns    | Research what exists first                  |
| Making assumptions without validating  | State assumptions explicitly and confirm    |
| Creating lengthy design documents      | Keep it concise—details go in the plan      |

## Integration with Planning

Brainstorming answers **WHAT** to build:

- Requirements and acceptance criteria
- Chosen approach and rationale
- Key decisions and trade-offs

Planning answers **HOW** to build it:

- Implementation steps and file changes
- Technical details and code patterns
- Testing strategy and verification

When brainstorm output exists, `/workflow:plan` should detect it and use it as input, skipping its own idea refinement phase.

Brainstorming should avoid deep implementation sequencing. Leave execution design and step-by-step build order to planning.
