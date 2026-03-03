---
name: install
invocation: install
description: Install compound-workflow in this project (one action)—opencode.json, AGENTS.md, dirs, Repo Config Block, and optional Cursor wiring.
argument-hint: "[all|--all] [--dry-run] [--root <path>] [--no-config] [--cursor]"
---

# /install

Install or update compound-workflow in this project with **one action**. Writes opencode.json (OpenCode loads from the package), merges AGENTS.md (template + preserved Repo Config Block), creates standard dirs, and reminds you to set the Repo Config Block if needed.

## When to use

- First time adding compound-workflow to this repo (OpenCode users).
- After updating the compound-workflow package and you want the latest AGENTS.md template and opencode.json entries.

## Prerequisites

- The project must have `compound-workflow` installed: `npm install compound-workflow` (or add to dependencies and run `npm install`).

## Instructions for the agent

Run in the **workspace root** (or the directory the user specifies):

```bash
npx compound-workflow@latest install
npx compound-workflow@latest install all
```

Or with a specific root and flags:

```bash
npx compound-workflow install --root /path/to/project
npx compound-workflow install --dry-run
npx compound-workflow install --no-config
npx compound-workflow install --cursor
```

- **all / --all**: Full install shortcut; same as `--cursor` (creates `.cursor` if missing, then wires skills/agents/commands/references).
- **--dry-run**: Print planned changes only; no writes.
- **--root &lt;path&gt;**: Target project directory (default: current directory).
- **--no-config**: Skip Repo Config Block reminder; only write opencode.json, AGENTS.md merge, and dirs.
- **--cursor**: Force Cursor integration (create `.cursor` if missing, then wire skills/agents/commands/references).

Do not copy files from a compound-workflow clone; the Install CLI uses the package from `node_modules/compound-workflow`.

After running, suggest the user run `opencode debug config` in the project to verify OpenCode sees the commands and agents.

## What Install does (one run)

1. Ensures `compound-workflow` is in the project (exits with instructions if not).
2. Writes/merges **opencode.json** so OpenCode loads commands, agents, and skills from `node_modules/compound-workflow` (no copy into the project).
3. Creates/merges **AGENTS.md** (template content; preserves existing Repo Config Block).
4. Creates **docs/brainstorms/**, **docs/plans/**, **docs/solutions/**, **docs/metrics/daily|weekly|monthly/**, **todos/** if missing.
5. Reminds the user to edit AGENTS.md for the Repo Config Block (default_branch, test_command, lint_command, dev_server_url, etc.) unless `--no-config` was used.

No separate Sync or Setup step; this single command replaces both.
