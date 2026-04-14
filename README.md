# Compound Workflow

A portable, command-first system for shipping software with less ambiguity and stronger verification.

Inspired by [Compound Engineering](https://every.to/guides/compound-engineering) — the idea that small, consistent improvements compound over time into significantly better outcomes. Applied here: every piece of work follows the same cycle, every decision is captured, and every session makes the next one faster.

---

## What it does

Compound Workflow gives your AI agent a structured process for turning a request into validated, documented output. Instead of ad-hoc conversations, you get a repeatable cycle:

**Clarify → Plan → Execute → Verify → Capture**

Each step has an explicit gate. Work doesn't move forward until the previous step is done. Learnings are captured so the next similar problem takes minutes, not hours.

---

## Get Started

```bash
npm install compound-workflow
```

Postinstall runs automatically and sets up your repo: `AGENTS.md`, standard directories, and OpenCode wiring.

If your package manager skipped the lifecycle script, or after updating the package:

```bash
npx compound-workflow install
```

---

## The Workflow

```
brainstorm → plan → work → review → compound → metrics
```

### `/workflow:brainstorm`
Clarify what to build before any planning starts. The agent asks structured questions, surfaces ambiguities, and produces a brief that confirms intent and constraints. Nothing gets designed until the "what" is agreed.

### `/workflow:plan`
Turn the brief into an executable plan. Declares fidelity level (Low / Medium / High), confidence, solution scope, and open questions. Cites local code references and prior solutions. No code is written here.

### `/workflow:work`
Execute the approved plan. The agent derives todo contracts, isolates work in a git worktree, applies the standards gate, runs triage, delegates to subagents, and collects verified output. Evidence is required before any todo moves to complete.

### `/workflow:review`
Independent quality check before the work is considered done. Runs in a separate pass from the implementer. Emits a clear pass / fail with standards compliance noted. Required for code and config changes.

### `/workflow:compound`
Capture what was learned. Writes a structured solution doc to `docs/solutions/` with searchable YAML frontmatter. The first time you solve a problem takes research — document it and the next occurrence takes minutes.

### `/metrics` and `/assess`
Log session outcomes and spot trends. `/metrics` records a single session. `/assess` rolls up recent entries and proposes concrete improvements to commands, skills, or config.

---

## Optional Commands

**`/workflow:triage`** — Manually curate and prioritise a backlog before execution. `/workflow:work` runs triage automatically, but this gives you explicit control when the queue is complex.

**`/workflow:tech-review`** — Technical correctness check on a plan before build. Use when the approach needs a second opinion before committing to implementation.

**`/test-browser`** — Browser-level validation of affected routes. Useful for UI changes where automated tests aren't enough.

**`/install`** — Re-run setup. Safe to run again after updating the package or adding a new harness.

---

## How it's structured

Skills and agents are the internals. Commands are the public API — stable entry points that compose the right skills for each phase.

| Layer | What it is |
| --- | --- |
| **Commands** (`src/commands/`) | What you invoke. Orchestrate the workflow steps. |
| **Skills** (`src/skills/`) | Focused capabilities loaded by commands when needed. |
| **Agents** (`src/agents/`) | Specialised subagents for research, review, and analysis. |
| **AGENTS.md** | Project config: repo settings, harness list, skill index. |

On install, files are copied into whichever harness directories are present in your project (`.agents/`, `.cursor/`, `.claude/`). No symlinks, no generated manifests.

---

## Guardrails

- **Independent review policy:** code/config changes require `/workflow:review` before workflow completion. Docs-only changes are exempt.
- **Standards baseline policy:** `/workflow:work` and `/workflow:review` both apply the standards baseline. Violations block completion.
- **No ad-hoc artifacts** — output goes to `docs/plans`, `docs/solutions`, `todos`, or `docs/metrics`. Nothing else.

If docs conflict: follow `docs/principles/workflow-baseline-principles.md`, then `AGENTS.md`, then command docs, then skill docs.

---

## Learn More

- [Workflow principles](docs/principles/workflow-baseline-principles.md)
- [AGENTS.md](src/AGENTS.md) — command index, repo config, skill routing
- [Commands](src/commands/) — full command specs
- [Skills](src/skills/) — skill docs and templates
