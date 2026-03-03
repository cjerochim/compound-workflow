---
title: 2.0.0 Native Cutover Migration
status: active
date: 2026-03-03
---

# 2.0.0 Native Cutover Migration

Version 2.0.0 removes all compatibility pathways and adopts strict native wiring.

## Removed

- `/setup` command
- `/sync` command
- `/workflow:review-v2` command
- `scripts/sync-into-repo.sh`
- Runtime copies under `.agents/compound-workflow/*`
- Symlink `.agents/compound-workflow-skills`
- Cursor copy/sync integration logic (`.cursor/skills|commands|agents|references`)

## New Install Behavior

`npx compound-workflow install` now does only:

1. Write/update `opencode.json` managed command/agent/skills entries pointing directly at:
   - `node_modules/compound-workflow/src/.agents/commands/*`
   - `node_modules/compound-workflow/src/.agents/agents/*`
   - `node_modules/compound-workflow/src/.agents/skills`
2. Merge `AGENTS.md` (preserving existing Repo Config Block).
3. Ensure standard docs/todo directories exist.

## Required Migration Action

Run in each consuming repo:

```bash
npm install compound-workflow@2
npx compound-workflow install
```

## Path Changes

Before:

- `opencode.json` command templates could point to `.agents/compound-workflow/commands/...`
- `opencode.json` agent prompts could point to `.agents/compound-workflow/agents/...`
- `skills.paths` could include `.agents/compound-workflow-skills`

After:

- command templates point to `node_modules/compound-workflow/src/.agents/commands/...`
- agent prompts point to `node_modules/compound-workflow/src/.agents/agents/...`
- `skills.paths` includes `node_modules/compound-workflow/src/.agents/skills`

## Validation

- Run `opencode debug config`.
- Confirm no `.agents/compound-workflow` folder is created by install.
- Confirm no `.agents/compound-workflow-skills` symlink is created by install.
