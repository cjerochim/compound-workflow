---
name: metrics
description: Log a metrics entry for the current workflow run so process performance can be reviewed daily/weekly/monthly
argument-hint: "[optional: context path (plan/todo/PR/solution) or short label]"
---

# /metrics

Log a single metrics entry capturing outcome, quality, and friction for a unit of work.

This command logs AND assesses the session in one step.

It creates or appends to one file under `docs/metrics/daily/`.

## Inputs

- Optional context: `$ARGUMENTS`
  - plan path (preferred)
  - todo path / issue id
  - PR number / URL
  - solution doc path
  - short label

## Workflow

1. Determine today's date (YYYY-MM-DD).
2. Ensure directories exist:
   - `docs/metrics/daily/`
   - `docs/metrics/weekly/`
   - `docs/metrics/monthly/`
3. Create the daily entry:
   - file: `docs/metrics/daily/YYYY-MM-DD.md`
   - if it exists, append a new "Session" block
4. Use the template from `process-metrics` skill:
   - `process-metrics/assets/daily-template.md` within the skills directory of the current harness (resolve from `harnesses` in AGENTS.md Repo Config)
5. Ask for the minimum missing fields:
   - workflow (`brainstorm|plan|work|triage|review|compound|test-browser|other`)
   - outcome (`success|partial|failed`)
   - time spent (minutes)
   - biggest blocker (one sentence)
   - quality signal (tests/lint ran? pass/fail)
6. Assess the session (REQUIRED):
   - what failed (if anything)
   - why it failed (root cause)
   - what to change next time (1-3 actions)
   - target each action to: command|skill|agent|config|todo
7. Materialize improvements (optional):
   - if an action needs follow-up work, create a `pending` todo via `file-todos`
   - otherwise keep it as a simple note in the metrics entry

## Guardrails

- Keep metrics brief and structured.
- Do not change code.
- Do not create commits/PRs.

## After /metrics

- Use `/assess weekly 7` to see aggregate performance and trends.
