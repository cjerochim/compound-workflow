# Compound Workflow

Compound Workflow is a portable, command-first system for shipping software with less ambiguity and stronger verification.
It follows a simple cycle: **clarify -> plan -> execute -> verify -> capture**.

Use it when you want repeatable delivery without ad-hoc process drift.

Inspired by [Compound Engineering](https://every.to/guides/compound-engineering) (Every).

Best fit when you need:

- Clear intent and acceptance criteria before coding
- Structured execution with explicit review gates
- A repeatable process that captures reusable learnings

## Workflow

The workflow turns a request into validated output and reusable team knowledge.

```mermaid
flowchart LR
  A["brainstorm"] --> B["plan"] --> C["work (includes triage)"] --> D["review"] --> E["capture"] --> F["metrics"]
```

## Get Started

```bash
npm install compound-workflow
```

`npm install` adds the package and automatically configures your repo (`AGENTS.md`, required directories, and native OpenCode wiring).
If your package manager skips lifecycle scripts, run `npx compound-workflow install` manually.

Install configures:

- Workflow template content in `AGENTS.md`
- Standard workspace directories for plans/todos/docs
- `opencode.json` managed entries that reference `node_modules/compound-workflow/src/.agents/*`

## Breaking Change (2.0.0)

2.0.0 removes all legacy compatibility pathways (`/setup`, `/sync`, runtime mirror copies, and Cursor sync fallbacks).
See migration notes in [docs/migrations/2026-03-03-v2-native-cutover.md](docs/migrations/2026-03-03-v2-native-cutover.md).

## Critical Path

After install, use this default sequence:

1. `/workflow:brainstorm` for requirements clarity
2. `/workflow:plan` for implementation design
3. `/workflow:work` to execute against the approved plan (includes automatic triage)
4. `/workflow:review` to validate quality before completion
5. `/workflow:compound` to capture reusable learnings

Optional:

- `/workflow:triage` for manual backlog curation before or during execution
- `/metrics` and `/assess` for process improvement

## Commands (Quick Map)

Core flow: `/workflow:brainstorm` -> `/workflow:plan` -> `/workflow:work` -> `/workflow:review` -> `/workflow:compound` -> `/metrics` (optional `/assess` for rollups).

| Command                | Purpose                                                                                                      | Related skills                                                                   | Related agents                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/install`             | Configure workflow files and runtime wiring in the repo                                                      | install CLI (no workflow skill routing)                                          | none                                                                                                                                                                                   |
| `/workflow:brainstorm` | Clarify what to build through structured discussion                                                          | `brainstorming` (primary), `document-review` (optional refinement)               | `repo-research-analyst`                                                                                                                                                                |
| `/workflow:plan`       | Convert intent into an executable plan with fidelity/confidence                                              | state-orchestration skill when needed (for example `xstate-actor-orchestration`) | `repo-research-analyst`, `learnings-researcher`, `best-practices-researcher`, `framework-docs-researcher`, `git-history-analyzer`, `spec-flow-analyzer`, `planning-technical-reviewer` |
| `/workflow:triage`     | Manual queue curation for complex/multi-item backlogs (optional; `/workflow:work` runs triage automatically) | `file-todos`                                                                     | none                                                                                                                                                                                   |
| `/workflow:work`       | Execute plan/todos with quality gates and validation evidence                                                | `git-worktree`, `file-todos`, `standards`, state-orchestration skill when needed | `repo-research-analyst`, `learnings-researcher`, `best-practices-researcher`, `framework-docs-researcher`, `git-history-analyzer`                                                      |
| `/workflow:review`     | Perform independent quality review before completion                                                         | `git-worktree` (for non-current targets), `standards`                            | `learnings-researcher`, `lint`, `bug-reproduction-validator`, `git-history-analyzer`, `framework-docs-researcher`, `agent-native-reviewer`                                             |
| `/workflow:compound`   | Capture reusable implementation learnings in `docs/solutions/`                                               | `compound-docs` (primary), `document-review` (optional)                          | `learnings-researcher`, `best-practices-researcher`, `framework-docs-researcher`                                                                                                       |
| `/metrics`             | Log session outcomes and improvement actions                                                                 | `process-metrics`, `file-todos` (optional for follow-ups)                        | none                                                                                                                                                                                   |
| `/assess`              | Aggregate metrics trends and propose process improvements                                                    | `file-todos` (for approved follow-up actions)                                    | none                                                                                                                                                                                   |
| `/test-browser`        | Validate affected routes with browser-level checks                                                           | `agent-browser`, `git-worktree` (optional branch isolation)                      | none                                                                                                                                                                                   |

Canonical command docs: [src/.agents/commands/](src/.agents/commands/)

## Learn More

- Workflow principles: [docs/principles/workflow-baseline-principles.md](docs/principles/workflow-baseline-principles.md)
- Project command and policy index: [src/AGENTS.md](src/AGENTS.md)
- Command definitions: [src/.agents/commands/](src/.agents/commands/)

If docs conflict: follow `docs/principles/workflow-baseline-principles.md`, then `src/AGENTS.md`, then command docs.

Guardrails:

- Independent review policy: code/config changes require `/workflow:review` before workflow completion (docs-only changes are exempt).
- Standards baseline policy: code/config changes must pass the standards baseline gate in `/workflow:work` and `/workflow:review`.
