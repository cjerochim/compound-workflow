---
name: git-worktree
description: Manage Git worktrees for isolated parallel development using portable git commands.
---

# Git Worktree Manager

This skill provides a unified interface for managing Git worktrees across your development workflow. Whether you're reviewing PRs in isolation or working on features in parallel, this skill handles all the complexity.

## What This Skill Does

- **Create worktrees** from a base branch with clear branch names
- **List worktrees** with current status
- **Switch between worktrees** for parallel work
- **Clean up completed worktrees** automatically
- **Interactive confirmations** at each step
- **Automatic .gitignore management** for worktree directory
- **Bootstrap new worktrees** (optional): copy env/config files + install deps (non-overwriting, portable defaults)

## Portability Notes

This skill is intentionally portable.

- It does not rely on plugin roots or external scripts.
- It uses standard `git worktree` commands.
- It will not overwrite env files when copying.

## When to Use This Skill

Use this skill in these scenarios:

1. **Code Review (`/workflow:review`)**: If NOT already on the target branch, offer worktree for isolated review
2. **Feature Work (`/workflow:work`)**: Offer worktree for isolated parallel development
3. **Parallel Development**: When working on multiple features simultaneously
4. **Cleanup**: After completing work in a worktree

## How to Use

### Usage

This skill can be invoked from `/workflow:work` or manually from bash.

```bash
# Create a new worktree
git worktree add -b feature-login ".worktrees/feature-login" "HEAD"

# List all worktrees
git worktree list

# Remove a worktree (must not be the current worktree)
git worktree remove ".worktrees/feature-login"

# Prune stale worktree metadata
git worktree prune
```

## Create Workflow

Inputs:

- `branch-name` (required)
- `from-branch` (optional)

Default base selection (single source of truth):

- If `from-branch` is provided, use it.
- Otherwise, use the current active branch (or `HEAD` if detached).

Steps:

1. Resolve `worktree_dir`:
   - Prefer `worktree_dir` from the Repo Config Block in `AGENTS.md` when present
   - Otherwise default to `.worktrees/`
2. Ensure the worktree dir exists.
3. Ensure the worktree dir is ignored by git (add to `.gitignore` if needed).
4. (Optional) `git fetch origin` if you intend to base off a remote ref.
5. Create the worktree at `<worktree_dir>/<sanitized-branch-name>`.
   - Sanitize branch names for paths: replace `/` with `-` (e.g. `feat/foo` → `feat-foo`)
6. Bootstrap (optional but recommended for `/workflow:work`):
   - Copy env/config files (non-overwriting)
   - Install dependencies (command from config or best-effort autodetect)

Example:

```bash
git worktree add -b "feat/my-feature" ".worktrees/feat-my-feature" "HEAD"
```

## After creating a worktree

All subsequent code changes and terminal commands for this workflow MUST be executed in this worktree: use the worktree directory for all file paths and as the cwd for every command. The main repo checkout is not the implementation target.

## Bootstrap (Hybrid: config override + safe autodetect)

This skill is portable, so bootstrap is best-effort by default and configurable per repo via `AGENTS.md`.

Sources (precedence):

1. Repo Config Block (`AGENTS.md`):
   - `worktree_copy_files`
   - `worktree_install_command`
   - `worktree_bootstrap_notes` (read-first prerequisites; not executed)
2. Safe defaults + autodetect when keys are missing.

### Copy env/config files (non-overwriting)

- Prefer `worktree_copy_files` from `AGENTS.md`.
- Otherwise default to copying: `.env` and `.env.*`
  - Exclude `.env.example`, `.env.template`, `.env.sample` (and similar).
- Do not overwrite existing files in the target worktree.

### Install dependencies

- Prefer `worktree_install_command` from `AGENTS.md`.
- Otherwise auto-detect (Node-first):
  - `pnpm-lock.yaml` → `pnpm install`
  - `yarn.lock` → `yarn install`
  - `package-lock.json` → `npm ci`
  - `bun.lockb` → `bun install`
  - `package.json` only → `npm install`
- If you cannot infer safely, ask once for the install command.

## List Worktrees

```bash
git worktree list
```

## Switch Worktrees

List worktrees and `cd` into the one you want.

## Cleanup

```bash
git worktree prune
```

Remove worktree directories explicitly with `git worktree remove`.

## Workflow Examples

### Code Review with Worktree

```bash
git worktree add -b pr-123-feature-name ".worktrees/pr-123-feature-name" "HEAD"
cd .worktrees/pr-123-feature-name

# After review, remove when done:
cd ../..
git worktree remove ".worktrees/pr-123-feature-name"
git worktree prune
```

### Parallel Feature Development

```bash
git worktree add -b feature-login ".worktrees/feature-login" "HEAD"
git worktree add -b feature-notifications ".worktrees/feature-notifications" "HEAD"
git worktree list
```

## Key Design Principles

### KISS (Keep It Simple, Stupid)

- **One manager script** handles all worktree operations
- **Simple commands** with sensible defaults
- **Interactive prompts** prevent accidental operations
- **Clear naming** using branch names directly

### Opinionated Defaults

- Worktrees default to base branch **current active branch** (unless `from-branch` specified)
- Worktrees stored in **.worktrees/** directory (unless overridden by `worktree_dir`)
- Branch name becomes worktree directory name (sanitized for filesystem)
- **.gitignore** automatically managed

### Safety First

- **Confirms before creating** worktrees
- **Confirms before cleanup** to prevent accidental removal
- **Won't remove current worktree**
- **Clear error messages** for issues

## Integration with Workflows

- `/workflow:work` should default to a worktree (opt-out), pass `from-branch = current active branch`, and then bootstrap (copy env/config + install deps).
- `/workflow:review` may offer a worktree when not on the target branch.

## Troubleshooting

### "Worktree already exists"

If you see this, list worktrees and switch to the existing one:

```bash
git worktree list
```

### "Cannot remove worktree: it is the current worktree"

Switch out of the worktree first (to main repo), then cleanup:

```bash
cd $(git rev-parse --show-toplevel)
git worktree prune
```

### Lost in a worktree?

See where you are:

```bash
git worktree list
```

### Optional: Copy env files

If your repo uses env/config files and you want them in the worktree, copy from the repo root to the worktree directory.

Rules:

- Prefer `worktree_copy_files` from `AGENTS.md` when present.
- Otherwise default to `.env` and `.env.*` (exclude example/template files).
- Do not overwrite existing files.

Also consider `worktree_bootstrap_notes` from `AGENTS.md` (system deps/services/tooling) before running installs/tests.

Navigate back to main:

```bash
cd $(git rev-parse --show-toplevel)
```

## Technical Details

### Directory Structure

```
.worktrees/
├── feature-login/          # Worktree 1
│   ├── .git
│   ├── app/
│   └── ...
├── feature-notifications/  # Worktree 2
│   ├── .git
│   ├── app/
│   └── ...
└── ...

.gitignore (updated to include .worktrees)
```

### How It Works

- Uses `git worktree add` for isolated environments
- Each worktree has its own branch
- Changes in one worktree don't affect others
- Share git history with main repo
- Can push from any worktree

### Performance

- Worktrees are lightweight (just file system links)
- No repository duplication
- Shared git objects for efficiency
- Much faster than cloning or stashing/switching
