---
name: agents
invocation: workflow:agents
description: Review and update AGENTS.md to keep skills and agents accurate, consistent, and aligned to current workflow needs
---

# /workflow:agents

## Purpose

Maintain `AGENTS.md` as the single source of truth for:

- skills
- agents
- capability routing

This command reviews the registry and updates it in place.

---

## Modes

### Default (review + update)

/workflow:agents

#### Behaviour

1. Locate registry:

   - src/AGENTS.md
   - fallback: AGENTS.md

2. Read entire file

3. Review:

   - skills (clarity, overlap, gaps)
   - agents (scope, supported skills, duplication)
   - structure (consistency)

4. Fix:

   - tighten vague skills
   - remove or merge duplicates
   - add missing capabilities ONLY if:
     - a clear responsibility exists in the current workflow
     - no existing skill covers it
   - align agents to skills
   - mark outdated entries as deprecated
   - resolve any ambiguity or overlap during this run

5. Update AGENTS.md

6. Output summary

---

### Validate (no changes)

/workflow:agents validate

#### Behaviour

- read registry
- report:
  - overlaps
  - missing skills
  - inconsistent structure
- do NOT update file

---

## Rules

- No step-by-step prompts
- No partial updates
- Prefer refinement over expansion
- Avoid broad/general-purpose skills
- Keep responsibilities explicit
- Do not modify other files
- Do not introduce new skills unless clearly justified by workflow gaps
- Do not leave unresolved overlaps or unclear definitions

---

## Output

## Registry Update Summary

- Registry: <path>

## Changes

- <refinements>
- <additions>
- <deprecations>

## Notes

- <observations>
