---
name: plan
invocation: workflow:plan
description: Transform feature descriptions into well-structured project plans using an explicit fidelity and confidence model
argument-hint: "[feature description, bug report, improvement idea, or brainstorm doc path]"
---

# Create a plan for a new feature or bug fix

## Introduction

**Note: The current year is 2026.** Use this when dating plans and searching for recent documentation.

Transform feature descriptions, bug reports, or improvement ideas into well-structured markdown plan files that follow project conventions and best practices. This command provides flexible detail levels to match your needs.

This workflow MUST choose a planning fidelity and confidence level before final plan construction:

- Fidelity: `Low | Medium | High`
- Confidence: `High | Medium | Low`

## Feature Description

<feature_description> #$ARGUMENTS </feature_description>

**If the feature description above is empty, ask the user:** "What would you like to plan? Please describe the feature, bug fix, or improvement you have in mind."

Do not proceed until you have a clear feature description from the user.

## Guardrails

- Do not write or modify application code.
- Do not create commits, push branches, or create PRs.
- Output is the plan file only; post-generation options are user-driven actions on that file.

## Resolve Repo Defaults (ALWAYS FIRST)

Read `AGENTS.md` and look for the "Repo Config Block" YAML.

Use it to resolve optional defaults used by this command:

- `default_branch`
- `project_tracker`

If not present, proceed with safe defaults and state what you assumed.

### 0. Idea Refinement

**Check for brainstorm output first:**

Before asking questions, look for recent brainstorm documents in `docs/brainstorms/` that match this feature:

Use file discovery tools (Glob/Read) to locate and read recent brainstorm documents under `docs/brainstorms/`.

**Relevance criteria:** A brainstorm is relevant if:

- The topic (from filename or YAML frontmatter) semantically matches the feature description
- Created within the last 14 days
- If multiple candidates match, use the most recent one

**If a relevant brainstorm exists:**

1. Read the brainstorm document
2. Announce: "Found brainstorm from [date]: [topic]. Using as context for planning."
3. Extract key decisions, chosen approach, and open questions
4. **Skip the idea refinement questions below** - the brainstorm already answered WHAT to build
5. Use brainstorm decisions as input to the research phase

**If multiple brainstorms could match:**
Use **AskQuestion** to ask which brainstorm to use, or whether to proceed without one.

**If no brainstorm found (or not relevant), run idea refinement:**

Refine the idea through collaborative dialogue using **AskQuestion**:

- Ask questions one at a time to understand the idea fully
- Prefer multiple choice questions when natural options exist
- Focus on understanding: purpose, constraints and success criteria
- Continue until the idea is clear OR user says "proceed"

**Gather signals for research decision.** During refinement, note:

- **User's familiarity**: Do they know the codebase patterns? Are they pointing to examples?
- **User's intent**: Speed vs thoroughness? Exploration vs execution?
- **Topic risk**: Security, payments, external APIs warrant more caution
- **Uncertainty level**: Is the approach clear or open-ended?

**Skip option:** If the feature description is already detailed, offer:
"Your description is clear. Should I proceed with research, or would you like to refine it further?"

## Main Tasks

### 1. Local Research (Always Runs - Parallel)

<thinking>
First, I need to understand the project's conventions, existing patterns, and any documented learnings. This is fast and local - it informs whether external research is needed.
</thinking>

Run these agents **in parallel** to gather local context:

- Task repo-research-analyst(feature_description)
- Task learnings-researcher(feature_description)

**What to look for:**

- **Repo research:** existing patterns, AGENTS.md guidance, technology familiarity, pattern consistency
- Also consider repo-level guidance files such as `AGENTS.md`.
- **Learnings:** documented solutions in `docs/solutions/` that might apply (gotchas, patterns, lessons learned)

These findings inform the next step.

### 1.5. Planning Fidelity + Confidence + Research Mode (REQUIRED)

After Step 0 and local research, you MUST choose planning fidelity and confidence, then decide whether to run external research.

#### Fidelity

Select one: `Low | Medium | High`

- Select `High` if any high-risk trigger exists (security, payments, privacy, schema/data migrations or backfills, production infra/deployment risk, hard-to-reverse changes).
- Default to `Medium` when signals are mixed or unclear.
- Otherwise select `Low`.

#### Confidence

Select one: `High | Medium | Low`

- `High`: clear scope + strong pattern match + low ambiguity.
- `Medium`: some ambiguity but enough to proceed.
- `Low`: key constraints missing or major unresolved decisions.

If confidence is `Low`, ask 1-2 focused clarifying questions before finalizing the plan.

#### Research Mode

Decide whether to run external research.

Baseline policy (by fidelity):

- `Low`: optional
- `Medium`: recommended
- `High`: required

Override: high-risk topics always require external research, even if the user prefers speed.

**Required sections by fidelity** (ensure the chosen template includes these; see Step 4):

- **Low**: problem, constraints, acceptance criteria, implementation outline, verification checklist
- **Medium**: all Low + alternatives/tradeoffs, dependency/risk table, rollout notes, observability/test notes
- **High**: all Medium + failure modes, rollback plan, deployment gates, migration/data safety checks, expanded test matrix

Required announcement format:

```
Fidelity selected: <Low|Medium|High>
Confidence: <High|Medium|Low>

Why this fidelity:
1) ...
2) ...

Research mode: local only | local + external
Open questions: none | <list>
```

**When Open questions is not "none":** You MUST materialize them in the plan body as actionable items (see Step 2.5). If an unknown blocks implementation feasibility, prefer **Spike Candidates**. If confidence is `Low`, the plan MUST include at least one checkbox under Discussion Points or Spike Candidates so `/workflow:work` can create pending todos and triage can resolve them.

### 1.5b. External Research (Conditional)

Run external research when Step 1.5 selected `local + external`.

Run these agents in parallel:

- Task best-practices-researcher(feature_description)
- Task framework-docs-researcher(feature_description)

### 1.5c. Git History Research (Conditional)

Use git history research when historical context is likely to change the plan.

Policy:

- Fidelity `High`: recommended by default.
- Fidelity `Medium`: run when touching existing behavior, refactoring legacy areas, debugging regressions, or when repo patterns are unclear.
- Fidelity `Low`: usually skip.

If selected, run:

- Task git-history-analyzer(feature_description)

### 1.6. Consolidate Research

After all research steps complete, consolidate findings:

- Document relevant file paths from repo research (e.g., `src/services/example_service.ts:42`)
- **Include relevant institutional learnings** from `docs/solutions/` (key insights, gotchas to avoid)
- Note external documentation URLs and best practices (if external research was done)
- List related issues or PRs discovered
- Capture AGENTS.md conventions

**Optional validation:** Briefly summarize findings and ask if anything looks off or missing before proceeding to planning.

### 1.7. SpecFlow Analysis (by fidelity)

Run flow/gap analysis to surface missing requirements before locking structure:

- **Low fidelity:** optional (skip if scope is trivial)
- **Medium fidelity:** recommended
- **High fidelity:** required

When running: Task spec-flow-analyzer(feature_description, research_findings). Then incorporate identified gaps and edge cases into the upcoming issue structure and acceptance criteria.

### 2. Issue Planning & Structure

<thinking>
Think like a product manager - what would make this issue clear and actionable? Consider multiple perspectives
</thinking>

**Title & Categorization (single contract):**

- [ ] **type**: one of `feat | fix | refactor` (used in filename and for issue prefix)
- [ ] **title**: clear, searchable human title **without** a type prefix (e.g., "Add user authentication", "Cart total calculation")
- [ ] **Filename**: `YYYY-MM-DD-<type>-<slug>-plan.md` where `<slug>` is kebab-case of the title (3–5 words, descriptive)
  - Example: type `feat`, title "User authentication flow" → `2026-01-21-feat-user-authentication-flow-plan.md`
  - Never embed a colon or space in the filename; keep plans findable by context

**Stakeholder Analysis:**

- [ ] Identify who will be affected by this issue (end users, developers, operations)
- [ ] Consider implementation complexity and required expertise

**Content Planning:**

- [ ] Choose appropriate detail level based on issue complexity and audience
- [ ] List all necessary sections for the chosen template
- [ ] Gather supporting materials (error logs, screenshots, design mockups)
- [ ] Prepare code examples or reproduction steps if applicable, name the mock filenames in the lists

### 3. Incorporate SpecFlow (if Step 1.7 ran)

If SpecFlow was run in Step 1.7:

- [ ] Review SpecFlow analysis results
- [ ] Ensure any identified gaps or edge cases are reflected in the issue structure and acceptance criteria

### 3.5. Discussion Points & Spike Candidates (REQUIRED when Open questions ≠ none)

When you declared Open questions in Step 1.5 (other than "none"), the plan file MUST include one or both of these sections with checkboxes so `/workflow:work` and `file-todos` can create pending todos for triage:

- **## Discussion Points (resolve/decide)** — Decisions to make (no code). Use `- [ ]` items (e.g. "Decide: X or Y?", "Confirm constraint Z").
- **## Spike Candidates (timeboxed)** — Timeboxed investigations to de-risk. Use `- [ ] Spike: <short description>` items.

Rules:

- If an unknown blocks implementation feasibility, prefer listing it under **Spike Candidates**.
- If confidence is `Low`, include at least one checkbox in one of these sections.
- These sections may appear after the main implementation content (e.g. after Acceptance Criteria or References) or in a dedicated "Unknowns & decisions" area; ensure they are in the written plan file when Open questions exist.

### 4. Choose Implementation Detail Level

Select how comprehensive you want the issue to be. Fidelity should drive this choice.

Mapping:

- Fidelity `Low` -> MINIMAL by default
- Fidelity `Medium` -> MORE by default
- Fidelity `High` -> A LOT by default

If the user explicitly requests a different level, allow it, but keep required fidelity sections.

#### 📄 MINIMAL (Quick Issue)

**Best for:** Simple bugs, small improvements, clear features

**Includes (required for Low fidelity):**

- Problem statement or feature description
- Constraints
- Basic acceptance criteria
- Implementation outline (e.g., MVP)
- Verification checklist
- Essential context only

**Structure:**

````markdown
---
title: [Issue Title]
type: [feat|fix|refactor]
status: active
date: YYYY-MM-DD
---

# [Issue Title]

[Brief problem/feature description]

## Constraints

[Key constraints (technical, scope, or policy)]

## Acceptance Criteria

- [ ] Core requirement 1
- [ ] Core requirement 2

## Context

[Any critical information]

## MVP

### example.ext

```text
[Minimal pseudo code illustrating the MVP]
```

## Verification Checklist

- [ ] How to verify requirement 1
- [ ] How to verify requirement 2

## References

- Related issue: #[issue_number]
- Documentation: [relevant_docs_url]
````

#### 📋 MORE (Standard Issue)

**Best for:** Most features, complex bugs, team collaboration

**Includes everything from MINIMAL plus (required for Medium fidelity):**

- Detailed background and motivation
- Alternatives/tradeoffs
- Dependency/risk table
- Rollout notes
- Observability and test notes
- Success metrics
- Basic implementation suggestions

**Structure:**

```markdown
---
title: [Issue Title]
type: [feat|fix|refactor]
status: active
date: YYYY-MM-DD
---

# [Issue Title]

## Overview

[Comprehensive description]

## Problem Statement / Motivation

[Why this matters]

## Proposed Solution

[High-level approach]

## Alternatives / Tradeoffs

[Other options considered and why this approach]

## Technical Considerations

- Architecture impacts
- Performance implications
- Security considerations

## Acceptance Criteria

- [ ] Detailed requirement 1
- [ ] Detailed requirement 2
- [ ] Testing requirements

## Success Metrics

[How we measure success]

## Dependencies & Risks (table)

| Dependency / Risk | Impact | Mitigation |
|-------------------|--------|------------|
| ...               | ...    | ...        |

## Rollout

[Phased rollout or release notes]

## Observability & Test Plan

[What to monitor; how to test and validate]

## References & Research

- Similar implementations: [file_path:line_number]
- Best practices: [documentation_url]
- Related PRs: #[pr_number]
```

#### 📚 A LOT (Comprehensive Issue)

**Best for:** Major features, architectural changes, complex integrations

**Includes everything from MORE plus (required for High fidelity):**

- Detailed implementation plan with phases
- Failure modes and rollback plan
- Deployment gates and migration/data safety
- Expanded test matrix
- Resource requirements and timeline
- Future considerations and extensibility
- Documentation requirements

**Structure:**

```markdown
---
title: [Issue Title]
type: [feat|fix|refactor]
status: active
date: YYYY-MM-DD
---

# [Issue Title]

## Overview

[Executive summary]

## Problem Statement

[Detailed problem analysis]

## Proposed Solution

[Comprehensive solution design]

## Technical Approach

### Architecture

[Detailed technical design]

### Implementation Phases

#### Phase 1: [Foundation]

- Tasks and deliverables
- Success criteria
- Estimated effort

#### Phase 2: [Core Implementation]

- Tasks and deliverables
- Success criteria
- Estimated effort

#### Phase 3: [Polish & Optimization]

- Tasks and deliverables
- Success criteria
- Estimated effort

## Alternative Approaches Considered

[Other solutions evaluated and why rejected]

## Acceptance Criteria

### Functional Requirements

- [ ] Detailed functional criteria

### Non-Functional Requirements

- [ ] Performance targets
- [ ] Security requirements
- [ ] Accessibility standards

### Quality Gates

- [ ] Test coverage requirements
- [ ] Documentation completeness
- [ ] Code review approval

## Success Metrics

[Detailed KPIs and measurement methods]

## Dependencies & Prerequisites

[Detailed dependency analysis]

## Risk Analysis & Mitigation

[Comprehensive risk assessment]

## Failure Modes

[Key failure modes and how they manifest]

## Rollback Plan

[How to roll back safely; triggers and steps]

## Deployment Gates

[Pre-deploy checks and gates]

## Migration / Data Safety

[Data migrations, backfills, and safety checks]

## Expanded Test Matrix

[Test scenarios by dimension: env, role, data, edge cases]

## Resource Requirements

[Team, time, infrastructure needs]

## Future Considerations

[Extensibility and long-term vision]

## Documentation Plan

[What docs need updating]

## References & Research

### Internal References

- Architecture decisions: [file_path:line_number]
- Similar features: [file_path:line_number]
- Configuration: [file_path:line_number]

### External References

- Framework documentation: [url]
- Best practices guide: [url]
- Industry standards: [url]

### Related Work

- Previous PRs: #[pr_numbers]
- Related issues: #[issue_numbers]
- Design documents: [links]
```

### 5. Issue Creation & Formatting

<thinking>
Apply best practices for clarity and actionability, making the issue easy to scan and understand
</thinking>

**Content Formatting:**

- [ ] Use clear, descriptive headings with proper hierarchy (##, ###)
- [ ] Include code examples in triple backticks with language syntax highlighting
- [ ] Add screenshots/mockups if UI-related (drag & drop or use image hosting)
- [ ] Use task lists (- [ ]) for trackable items that can be checked off
- [ ] Add collapsible sections for lengthy logs or optional details using `<details>` tags
- [ ] Apply appropriate emoji for visual scanning (🐛 bug, ✨ feature, 📚 docs, ♻️ refactor)
  - If working in a repo/style that avoids emoji, omit them.

**Cross-Referencing:**

- [ ] Link to related issues/PRs using #number format
- [ ] Reference specific commits with SHA hashes when relevant
- [ ] Link to code using GitHub's permalink feature (press 'y' for permanent link)
- [ ] Mention relevant team members with @username if needed
- [ ] Add links to external resources with descriptive text

**Code & Examples:**

````markdown
# Good example with syntax highlighting and line references

```text
# path/to/file.ext:42
[Code snippet]
```

# Collapsible error logs

<details>
<summary>Full error stacktrace</summary>

`Error details here...`

</details>
````

**AI-Era Considerations:**

- [ ] Account for accelerated development with AI pair programming
- [ ] Include prompts or instructions that worked well during research
- [ ] Note which AI tools were used for initial exploration (Claude, Copilot, etc.)
- [ ] Emphasize comprehensive testing given rapid implementation
- [ ] Document any AI-generated code that needs human review

### 6. Final Review & Submission

**Pre-submission Checklist:**

- [ ] Title is searchable and descriptive
- [ ] Labels accurately categorize the issue
- [ ] All template sections are complete
- [ ] Links and references are working
- [ ] Acceptance criteria are measurable
- [ ] Add names of files in pseudo code examples and todo lists
- [ ] Add an ERD mermaid diagram if applicable for new model changes

## Write Plan File

**REQUIRED: Write the plan file to disk before presenting any options.**

```bash
mkdir -p docs/plans/
```

Write the complete plan file to `docs/plans/YYYY-MM-DD-<type>-<slug>-plan.md`. This step is mandatory and cannot be skipped — even when running as part of LFG/SLFG or other automated pipelines.

**When Open questions were declared (Step 1.5):** The written plan MUST include at least one of: `## Discussion Points (resolve/decide)` with `- [ ]` items, or `## Spike Candidates (timeboxed)` with `- [ ] Spike: ...` items. If confidence is `Low`, at least one checkbox is required in one of these sections. This ensures `file-todos` can create pending discussion/spike todos for `/workflow:triage`.

Confirm: "Plan written to docs/plans/[filename]"

**Non-interactive mode:** When the invocation is non-interactive (e.g., `workflow:plan` run by automation, CI, or with an explicit non-interactive flag/convention), skip AskQuestion calls and do not present Post-Generation Options. For determinism, the repo should define the flag or convention (e.g., in `AGENTS.md` Repo Config Block or a documented env var). Still **declare** Fidelity, Confidence, Research mode, and Open questions in the required announcement format before writing the plan. Use these defaults when user input is unavailable: fidelity = Medium, confidence = Medium, research mode = local + external for Medium/High risk topics else local only. Proceed directly to writing the plan file and then exit or return the plan path as output.

**Required in plan frontmatter:** Add these fields to the plan file:

- `fidelity: low|medium|high`
- `confidence: high|medium|low`

## Output Format

**Filename:** Use the filename from Step 2 (Title & Categorization): `YYYY-MM-DD-<type>-<slug>-plan.md` with type and slug from the single contract.

```
docs/plans/YYYY-MM-DD-<type>-<slug>-plan.md
```

Examples:

- ✅ `docs/plans/2026-01-15-feat-user-authentication-flow-plan.md`
- ✅ `docs/plans/2026-02-03-fix-checkout-race-condition-plan.md`
- ✅ `docs/plans/2026-03-10-refactor-api-client-extraction-plan.md`
- ❌ `docs/plans/2026-01-15-feat-thing-plan.md` (not descriptive - what "thing"?)
- ❌ `docs/plans/2026-01-15-feat-new-feature-plan.md` (too vague - what feature?)
- ❌ `docs/plans/2026-01-15-feat: user auth-plan.md` (invalid characters - colon and space)
- ❌ `docs/plans/feat-user-auth-plan.md` (missing date prefix)

## Post-Generation Options

After writing the plan file, use **AskQuestion** to present these options:

**Question:** "Plan ready at `docs/plans/YYYY-MM-DD-<type>-<slug>-plan.md`. What would you like to do next?"

**Options:**

1. **Open plan in editor** - Open the plan file for review
2. **Review and refine** - Improve the document through structured self-review
3. **Start `/workflow:work`** - Begin implementing this plan locally
4. **Create Issue** - Create issue in project tracker (GitHub/Linear)
5. **Other** - Adjust the plan

Optional (only if those workflows exist in this repo):

- `/deepen-plan` - Enhance each section with parallel research agents
- **Technical review** - Load `technical-review` skill for technical correctness (no edits). Pair with `document-review` to apply any agreed changes to the plan.

Based on selection:

- **Open plan in editor** → Open the plan file in the editor (navigate to `docs/plans/<plan_filename>.md`)
- **Review and refine** → Load `document-review` skill.
- **Technical review** → Load `technical-review` skill; then if user agrees to changes, load `document-review` to update the plan.
- **Create Issue** → See "Issue Creation" section below
- **Other** → Accept free text for rework or specific changes

**Note:** Only if `/deepen-plan` exists in this repo and the user has enabled it (e.g., ultrathink), you may run `/deepen-plan` after plan creation for extra depth; it is optional, not required.

Loop back to options after changes until user selects `/workflow:work` or ends the session.

## Issue Creation

When user selects "Create Issue", detect their project tracker from repo guidance (e.g., `AGENTS.md`):

1. **Check for tracker preference** in guidance files (project or global):

   - Look for `project_tracker: github` or `project_tracker: linear`
   - Or look for mentions of "GitHub Issues" or "Linear" in their workflow section

2. **If GitHub:**

   Use **type** and **title** from Step 2 (title has no prefix). Compose issue title as `"<type>: <title>"` (e.g., `feat: User authentication flow`).

   If the `gh` CLI is available, create the issue via:

   ```bash
   gh issue create --title "<type>: <title>" --body-file <plan_path>
   ```

   Otherwise, provide the composed title + body for manual issue creation.

3. **If Linear:**

   Use **type** and **title** from Step 2. For Linear, use either the full title or `"<type>: <title>"` per team convention.

   If the `linear` CLI is available, create the issue via:

   ```bash
   linear issue create --title "<type>: <title>" --description "$(cat <plan_path>)"
   ```

   Otherwise, provide the composed title + body for manual issue creation.

4. **If no tracker configured:**
   Ask user: "Which project tracker do you use? (GitHub/Linear/Other)"

   - Suggest adding `project_tracker: github` or `project_tracker: linear` to their AGENTS.md

5. **After creation:**
   - Display the issue URL
   - Ask if they want to proceed to `/workflow:work`

NEVER CODE! Just research and write the plan.
