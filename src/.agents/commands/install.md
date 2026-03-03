---
name: install
invocation: install
description: Install compound-workflow in this project (native mode): writes opencode.json, merges AGENTS.md, and creates docs/todo dirs.
argument-hint: "[--dry-run] [--root <path>] [--no-config]"
---

# /install

Install or update compound-workflow in this project with **one action**.

## When to use

- First-time setup in a repository.
- After updating `compound-workflow` to refresh generated OpenCode command/agent mappings and AGENTS template content.

## Prerequisites

- The project must have `compound-workflow` installed: `npm install compound-workflow`.

## Instructions for the agent

Run in the workspace root (or user-provided root):

```bash
npx compound-workflow install
npx compound-workflow install --root /path/to/project
npx compound-workflow install --dry-run
npx compound-workflow install --no-config
```

- `--dry-run`: Print planned changes only; no writes.
- `--root <path>`: Target project directory (default: current directory).
- `--no-config`: Skip Repo Config Block reminder; still writes opencode.json, AGENTS.md, and dirs.

After running, suggest `opencode debug config` in the project to verify OpenCode resolution.

## What Install does

1. Ensures `compound-workflow` is installed in the project.
2. Writes/merges `opencode.json` so OpenCode resolves commands/agents/skills directly from `node_modules/compound-workflow/src/.agents`.
3. Creates/merges `AGENTS.md` using the package template while preserving an existing Repo Config Block.
4. Creates missing directories: `docs/brainstorms`, `docs/plans`, `docs/solutions`, `docs/metrics/daily|weekly|monthly`, `todos`.

No setup/sync compatibility paths are supported in this cutover.
