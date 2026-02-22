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

## Usage

```bash
/workflow:compound                    # Document the most recent fix
/workflow:compound [brief context]    # Provide additional context hint
```

## Execution Strategy

<critical_requirement>
**Primary capture writes ONE file: the final solution documentation.**

Do not create drafts, notes, or intermediate files.

After the primary solution doc is written, optional post-capture actions (by explicit user choice) may update other references (e.g. patterns indexes).
</critical_requirement>

### Phase 1: Preconditions and Context (Required)

1. Confirm the problem is solved, verified working, and non-trivial.
2. If critical context is missing (module/component, exact symptom/error, root cause, fix steps, verification), ask targeted questions and wait.
3. Use the `compound-docs` skill as the source of truth for required fields and the solution doc template.

### Phase 2: Related Docs and Enrichment (Optional)

Run only agents that exist in this `.agents` workspace.

- Related docs lookup: `Task learnings-researcher(<symptom/module/root cause keywords>)`
- Optional best-practice enrichment: `Task best-practices-researcher(<topic>)`
- Optional framework reference enrichment: `Task framework-docs-researcher(<topic>)`

At the end of this phase, report which optional enrichments ran vs were skipped.

### Phase 3: Assemble and Write (Required)

1. Determine `problem_type` and validate YAML frontmatter against `.agents/skills/compound-docs/schema.yaml`.
2. Determine category directory from `problem_type` per `.agents/skills/compound-docs/references/yaml-schema.md`.
3. Generate filename slug.
4. Ensure directory exists: `mkdir -p docs/solutions/<category>/`
5. Write exactly one file: `docs/solutions/<category>/<filename>.md`
   - Use `.agents/skills/compound-docs/assets/resolution-template.md` as the base structure.

### Phase 4: Final Polish (Optional)

If desired, run `document-review` on the created solution doc.

### Phase 5: Optional Domain Review Passes (Skill-First)

After the doc is written, optionally run domain review passes to improve prevention guidance and correctness.

Prefer skills over agents for portability.

Mechanism:

1. Determine domain from the captured doc's YAML (`problem_type`, `component`, `tags`, `severity`).
2. If a matching domain skill exists in `.agents/skills/`, load it and apply it to the created solution doc.
3. If no domain skill exists, fall back to `document-review` with a domain lens.

Suggested domain mapping (skill names are recommendations):

- `performance_issue` -> skill `performance-review`
- `security_issue` -> skill `security-review`
- `database_issue` -> skill `data-integrity-review`
- `test_failure` -> skill `test-review`
- Code-heavy issues -> skill `code-simplicity-review`

If specialist agents also exist, they can be used as optional overlays, but do not require them.

Always report which domain passes ran vs were skipped.

## What It Captures

- **Problem symptom**: Exact error messages, observable behavior
- **Investigation steps tried**: What didn't work and why
- **Root cause analysis**: Technical explanation
- **Working solution**: Step-by-step fix with code examples
- **Prevention strategies**: How to avoid in future
- **Cross-references**: Links to related issues and docs

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

## What It Creates

**Organized documentation:**

- File: `docs/solutions/[category]/[filename].md`

**Categories auto-detected from problem:**

- build-errors/
- test-failures/
- runtime-errors/
- performance-issues/
- database-issues/
- security-issues/
- ui-bugs/
- integration-issues/
- logic-errors/

## Common Mistakes to Avoid

| ❌ Wrong | ✅ Correct |
|----------|-----------|
| Subagents write files like `context-analysis.md`, `solution-draft.md` | Use `compound-docs` + write the primary solution doc only |
| Research and assembly run in parallel | Research completes → then assembly runs |
| Unrequested side-effect file changes | Only update other files when user explicitly selects post-capture actions |

## Success Output

```
✓ Documentation complete

Optional passes executed:
  - Related docs lookup: ran|skipped
  - Best practices enrichment: ran|skipped
  - Framework docs enrichment: ran|skipped
  - Domain review passes: ran|skipped

File created:
- docs/solutions/<category>/YYYY-MM-DD-<module-slug>-<symptom-slug>.md

This documentation will be searchable for future reference when similar
issues occur in the Email Processing or Brief System modules.

What's next?
1. Continue workflow (recommended)
2. Link related documentation
3. Update other references
4. View documentation
5. Other
```

## The Compounding Philosophy

This creates a compounding knowledge system:

1. First time you solve "N+1 query in brief generation" → Research (30 min)
2. Document the solution → docs/solutions/performance-issues/n-plus-one-briefs.md (5 min)
3. Next time similar issue occurs → Quick lookup (2 min)
4. Knowledge compounds → Team gets smarter

The feedback loop:

```
Build → Test → Find Issue → Research → Improve → Document → Validate → Deploy
    ↑                                                                      ↓
    └──────────────────────────────────────────────────────────────────────┘
```

**Each unit of engineering work should make subsequent units of work easier—not harder.**

## Auto-Invoke

<auto_invoke> <trigger_phrases> - "that worked" - "it's fixed" - "working now" - "problem solved" </trigger_phrases>

<manual_override> Use /workflow:compound [context] to document immediately without waiting for auto-detection. </manual_override> </auto_invoke>

## Routes To

`compound-docs` skill

## Optional Specialized Overlays

If specialist agents exist in this `.agents` workspace, they can be invoked as overlays after the skill-first passes.

Only invoke agents that exist locally.

### When to Invoke
- **Auto-triggered** (optional): Agents can run post-documentation for enhancement
- **Manual trigger**: User can invoke agents after /workflow:compound completes for deeper review
- **Customize agents**: Extend `.agents/agents/` with additional reviewers and update this command to reference them

## Related Commands

- `/workflow:plan` - Planning workflow (references documented solutions)
