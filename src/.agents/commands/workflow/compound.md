---
name: compound
invocation: workflow:compound
description: Document a recently solved problem into docs/solutions/ to compound institutional knowledge
argument-hint: "[optional: brief context about the fix]"
---

# /workflow:compound

Capture a solved problem while context is fresh.

## Purpose

Create a single structured solution document in `docs/solutions/` with YAML frontmatter for searchability and future reference.

**Why "compound"?** Each documented solution compounds your team's knowledge. The first time you solve a problem takes research. Document it, and the next occurrence takes minutes. Knowledge compounds.

## Execution contract

**The `compound-docs` skill is the source of truth** for capture steps, YAML validation (against `schema.yaml` and, if present, `schema.project.yaml`), category mapping, filename generation, and the post-capture decision menu. This command does not redefine that contract.

<critical_requirement>
**Primary capture writes ONE file: the final solution documentation.**

Do not create drafts, notes, or intermediate files.

After the primary solution doc is written, optional post-capture actions (by explicit user choice) may update other references (e.g. patterns indexes).
</critical_requirement>

## Usage

```bash
/workflow:compound                    # Document the most recent fix
/workflow:compound [brief context]    # Provide additional context hint
```

## Guardrails

- Do not modify code. Do not create commits or push.
- Only update other files when the user explicitly selects a post-capture action from the `compound-docs` decision menu.

## Command flow

### 1. Preconditions (required)

- Confirm the problem is solved, verified working, and non-trivial.
- If critical context is missing, ask targeted questions and wait. Then **invoke the `compound-docs` skill** (it defines required fields, validation gates, and template).

### 2. Optional enrichment (before write)

Run only agents that exist in this `.agents` workspace. **Enrichment is read-only**—it informs the doc content but must not write files.

- Related docs: `Task learnings-researcher(<symptom/module/root cause keywords>)`
- Optional: `Task best-practices-researcher(<topic>)`, `Task framework-docs-researcher(<topic>)`

Complete enrichment before assembly. Report which ran vs skipped.

### 3. Capture

Execute the capture by following the **`compound-docs` skill**: gather context, check existing docs, validate YAML (including `schema.project.yaml` if present), write the single solution file, then present the **skill's decision menu** and wait for user choice. Do not present a different "What's next?" menu.

### 4. Optional review after capture

User may optionally run `document-review` on the created doc. If the repo has domain guardrail skills that match the doc's problem type/component and those skills exist under `.agents/skills/`, they may be invoked only when the user requests deeper review; do not name or assume skills that are not present.

## Preconditions

<preconditions enforcement="advisory">
  <check condition="problem_solved">
    Problem has been solved (not in-progress)
  </check>
  <check condition="solution_verified">
    Solution has been verified working
  </check>
  <check condition="non_trivial">
    Non-trivial problem (not simple typo or obvious error)
  </check>
</preconditions>

## What It Captures

- **Problem symptom**: Exact error messages, observable behavior
- **Investigation steps tried**: What didn't work and why
- **Root cause analysis**: Technical explanation
- **Working solution**: Step-by-step fix with code examples
- **Prevention strategies**: How to avoid in future
- **Cross-references**: Links to related issues and docs

## What It Creates

- File: `docs/solutions/<category>/<filename>.md` (category from `problem_type` per `compound-docs` / `yaml-schema.md`).

## Common Mistakes to Avoid

| Wrong | Correct |
|-------|---------|
| Subagents write files like `context-analysis.md`, `solution-draft.md` | Use `compound-docs`; write the primary solution doc only |
| Research and assembly in parallel | Enrichment completes, then capture runs |
| Unrequested side-effect file changes | Only update other files when user explicitly selects post-capture actions from the skill menu |
| Presenting a different post-capture menu | Use the `compound-docs` decision menu as-is |

## Success output (shape)

Report which optional enrichments ran vs skipped. Then output the path of the created file. Present the **`compound-docs` decision menu** (see skill) and wait for user choice—do not substitute a shorter custom menu.

Example summary (generic, portable):

```
✓ Documentation complete

Optional enrichments: related-docs ran|skipped, best-practices ran|skipped, framework-docs ran|skipped

File created: docs/solutions/<category>/YYYY-MM-DD-<module-slug>-<symptom-slug>.md

This documentation will be searchable for future reference when similar issues occur.

[Then present the compound-docs decision menu and wait.]
```

## Auto-Invoke

<auto_invoke>
<trigger_phrases>
- "that worked"
- "it's fixed"
- "working now"
- "problem solved"
- "that did it"
</trigger_phrases>
<manual_override>Use /workflow:compound [context] to document immediately without waiting for auto-detection.</manual_override>
</auto_invoke>

## Routes To

`compound-docs` skill

## Related Commands

- `/workflow:plan` - Planning workflow (references documented solutions)
- `/workflow:review` - Review may suggest compound when a systemic learning emerges
