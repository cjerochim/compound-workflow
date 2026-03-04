---
name: install
invocation: install
description: Install compound-workflow in this project (native mode): writes opencode.json, merges AGENTS.md, and creates docs/todo dirs.
argument-hint: "[--dry-run] [--root <path>] [--no-config] [--no-register-cursor] [--register-cursor]"
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
- `--no-register-cursor`: Do not register the plugin with Cursor (skip writing to ~/.claude/).
- `--register-cursor`: Force registration with Cursor even if Cursor is not detected in the default location.

After running, suggest `opencode debug config` in the project to verify OpenCode resolution.

## Cursor

One command installs and registers the plugin with Cursor when Cursor is detected (`~/.cursor` exists). Restart Cursor after install; if skills or commands do not appear, enable "Include third-party Plugins, Skills, and other configs" in Cursor Settings > Features. Use `--no-register-cursor` to skip registration (e.g. in CI).

## What Install does

1. Ensures `compound-workflow` is installed in the project.
2. Writes/merges `opencode.json` so OpenCode resolves commands/agents/skills directly from `node_modules/compound-workflow/src/.agents`.
3. Creates/merges `AGENTS.md` using the package template while preserving an existing Repo Config Block.
4. Creates missing directories: `docs/brainstorms`, `docs/plans`, `docs/solutions`, `docs/metrics/daily|weekly|monthly`, `todos`.

No setup/sync compatibility paths are supported in this cutover.
