---
name: install
invocation: install
description: Install compound-workflow in this project — copies agents/skills/commands, writes opencode.json, merges AGENTS.md, and creates docs/todo dirs.
argument-hint: "[--dry-run] [--root <path>]"
---

# /install

Install or update compound-workflow in this project with **one action**.

## When to use

- First-time setup in a repository.
- After updating `compound-workflow` to refresh agents, skills, commands, and AGENTS.md template content.

## Prerequisites

- The project must have `compound-workflow` installed: `npm install compound-workflow`.

## Instructions for the agent

Run in the workspace root (or user-provided root):

```bash
npx compound-workflow install
npx compound-workflow install --root /path/to/project
npx compound-workflow install --dry-run
```

- `--dry-run`: Print planned changes only; no writes.
- `--root <path>`: Target project directory (default: current directory).

## What install does

1. Copies agents (flat) to `.claude/agents/` for Claude Code discovery.
2. Copies agents, skills, and commands to `.cursor/agents/`, `.cursor/skills/`, `.cursor/commands/` for Cursor discovery.
3. Copies agents, skills, and commands to `.agents/agents/`, `.agents/skills/`, `.agents/commands/` for OpenCode and general use.
4. Writes/merges `opencode.json` pointing commands and agents at `.agents/`.
5. Creates/merges `AGENTS.md` using the package template while preserving an existing Repo Config Block.
6. Creates missing directories: `docs/brainstorms`, `docs/plans`, `docs/solutions`, `docs/metrics/daily|weekly|monthly`, `todos`.

Stale files from previous installs are pruned automatically on each run.
