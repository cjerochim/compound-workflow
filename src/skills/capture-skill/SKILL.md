---
name: capture-skill
description: Capture learnings, patterns, or workflows from the current conversation into a new or existing skill. Use when the user wants to save what was learned, discovered, or built during a conversation as a reusable skill for future sessions.
---

# Capture Skill from Conversation

This skill extracts reusable knowledge from the current conversation and stores it as a skill.

## Default Policy

`capture-skill` uses an overlay model by default:

- Treat existing repo-provided skills as immutable unless the user explicitly asks to edit a specific one.
- Store project-specific refinements in a project overlay skill (for example, a `project-standards/` skill in the current harness skills directory — resolve from `harnesses` in AGENTS.md Repo Config).
- Only modify an existing skill when the user clearly says to do so (for example, "update skill X").
- Promote overlay content into base skills only as an explicit, deliberate follow-up action.

## When to Use

- The user says "capture this as a skill" or "save this for next time"
- A reusable workflow, pattern, or piece of domain knowledge emerged
- The user wants to refine project standards based on this conversation
- The conversation revealed non-obvious steps, gotchas, or best practices worth preserving

## Capture Process

### Phase 1: Identify What to Capture

Prioritize broad, reusable patterns over one-off implementation details.

Look for:

1. High-level principles and standards
2. Multi-step workflows discovered through trial and error
3. Domain constraints that are not obvious
4. Gotchas and reliable fixes
5. Decision rationale that establishes a repeatable rule

Summarize the planned capture and confirm with the user before writing.

### Phase 2: Check Related Skills and Consolidate

Before creating a new skill:

1. List existing skills in personal and project locations.
2. Find related skill scopes.
3. Decide: consolidate into existing skill, extend an existing skill section, or create a new skill.

Consolidate when content overlaps domain, trigger conditions, or workflow usage.

### Phase 3: Choose Destination

If not already specified:

1. Decide whether this is a new skill or an update.
2. For new captures, decide storage:
   - Personal skill directory for cross-project behavior
   - Project skill directory for project-specific behavior
3. Apply the default policy:
   - Prefer project overlay skills for refinements
   - Do not mutate repo-provided skills by default

### Phase 4: Draft Skill Content

For new skills:

1. Use a descriptive kebab-case name (max 64 chars)
2. Write a precise description with WHAT + WHEN
3. Distill into actionable instructions
4. Add compact examples
5. Include scripts/assets only when needed

For updates:

1. Read existing `SKILL.md`
2. Integrate into the best section
3. Avoid duplication
4. Keep structure and voice consistent

### Phase 5: Distill for Reuse

Guidelines:

1. Lead with general principles
2. Generalize from specific files/functions
3. Explain why the pattern exists
4. Include only context the agent would not infer
5. Keep content concise and maintainable (`SKILL.md` under 500 lines)

Do not:

- Store conversation artifacts
- Overfit to single-file fixes
- Repeat obvious model knowledge
- Include excessive implementation trivia

### Phase 6: Write and Verify

If consolidating:

1. Merge into the chosen home skill
2. Keep sections clear and non-overlapping
3. Remove obsolete duplicate skills
4. Update name/description if scope broadened

If creating/updating:

1. Write `SKILL.md`
2. Verify trigger description accuracy
3. Verify no duplicate scope across skills
4. Confirm captured content with the user

## Consolidation Rules

- Prefer fewer, broader, discoverable skills over many narrow duplicates.
- Group frequently co-used patterns into one skill with clear sections.
- If overlap is discovered after creation, consolidate immediately.

## Edge Cases

- Multiple unrelated learnings: split into separate skills.
- Tiny single-rule capture: recommend a rule file instead of a skill.
- Major rewrite needed: ask whether to restructure or supersede.
- User asks to evolve standards safely: keep changes in project overlay unless explicit promotion is requested.
