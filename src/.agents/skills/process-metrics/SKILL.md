---
name: process-metrics
description: Define a portable metrics schema and templates for evaluating workflow performance. Use after /workflow:work, /workflow:review, or /workflow:compound to log outcomes and refine the system.
---

# Process Metrics

## Goal

Measure workflow performance so the system can improve over time.

Metrics should be:

- light-weight (takes < 3 minutes)
- comparable (same fields each time)
- actionable (each failure maps to an improvement)

## Storage

- Daily: `docs/metrics/daily/YYYY-MM-DD.md`
- Weekly: `docs/metrics/weekly/YYYY-WW.md`
- Monthly: `docs/metrics/monthly/YYYY-MM.md`

## Core Fields

- workflow: brainstorm|plan|work|triage|review|compound|test-browser|other
- context: plan/todo/pr/solution path or label
- outcome: success|partial|failed
- minutes: integer
- risk_tier: low|medium|high
- quality:
  - tests: ran|skipped|failed
  - lint: ran|skipped|failed
- blocker: one sentence
- rework: 0|1|2|3+ (how many times you had to redo work)

## Notes

- Failures should include "what failed" + "why" + "what to change".
- Improvements should target a component: command/skill/agent/config.

## Templates

- [daily-template.md](./assets/daily-template.md)
- [weekly-template.md](./assets/weekly-template.md)
- [monthly-template.md](./assets/monthly-template.md)
