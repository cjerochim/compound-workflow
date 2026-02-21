---
name: assess
description: Review recent metrics entries to identify failures/trends and propose concrete improvements to commands/skills/agents
argument-hint: "[daily|weekly|monthly] [optional: count]"
---

# /assess

Summarize what failed, what caused friction, and what to change next.

This command is the feedback loop that improves the `.agents` system over time.

## Inputs

- Default: `weekly 7`
- Examples:
  - `/assess daily 1`
  - `/assess weekly 7`
  - `/assess monthly 30`

## Workflow

1. Determine window:
   - daily: last N daily entries
   - weekly: last 7 days (or N)
   - monthly: last 30 days (or N)
2. Read metrics files from:
   - `docs/metrics/daily/`
3. Produce:
   - Top failure modes (ranked)
   - Repeat blockers (ranked)
   - Leading indicators (e.g., many partials, many pending todos, frequent lint failures)
   - Positive signals (what improved)
   - Trend call: quality up/down and speed up/down (simple narrative)
4. Propose actions:
   - Each action should target a component:
     - command (`.agents/commands/*.md`)
     - skill (`.agents/skills/**/SKILL.md`)
     - agent (`.agents/agents/**/*.md`)
     - repo config (`AGENTS.md` keys)
   - Provide the smallest change that would move the metric.
5. Materialize actions:
   - Create `todos/` items (pending by default) for each approved action using `file-todos`.
6. Optional aggregation:
   - Write a weekly or monthly summary file under:
     - `docs/metrics/weekly/YYYY-WW.md`
     - `docs/metrics/monthly/YYYY-MM.md`

## Output Format

- Window reviewed
- Metrics summary (counts)
- Top issues
- Proposed actions (with owners and expected metric movement)
- Todos created (paths)

## Guardrails

- Do not modify code or `.agents` components automatically.
- Only create todos and summary docs.
