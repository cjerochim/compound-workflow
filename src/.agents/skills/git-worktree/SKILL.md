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
- **Optional env file copying** from repo root to new worktrees

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
git fetch origin
git worktree add -b feature-login ".worktrees/feature-login" "origin/main"

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

Default base branch selection:

- If `from-branch` is provided, use it.
- Otherwise, prefer the current branch.
- If the current branch is the default branch, use the repo's configured `default_branch` (AGENTS.md) or fall back to `main` then `master`.

Steps:

1. Ensure `.worktrees/` exists.
2. Ensure `.worktrees/` is ignored by git (add to `.gitignore` if needed).
3. Fetch the base branch from origin.
4. Create the worktree at `.worktrees/<branch-name>`.
5. Optionally copy env files from repo root to the new worktree.

Example:

```bash
git fetch origin
git worktree add -b "feat/my-feature" ".worktrees/feat-my-feature" "origin/main"
```

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
git fetch origin
git worktree add -b pr-123-feature-name ".worktrees/pr-123-feature-name" "origin/main"
cd .worktrees/pr-123-feature-name

# After review, remove when done:
cd ../..
git worktree remove ".worktrees/pr-123-feature-name"
git worktree prune
```

### Parallel Feature Development

```bash
git fetch origin
git worktree add -b feature-login ".worktrees/feature-login" "origin/main"
git worktree add -b feature-notifications ".worktrees/feature-notifications" "origin/main"
git worktree list
```

## Key Design Principles

### KISS (Keep It Simple, Stupid)

- **One manager script** handles all worktree operations
- **Simple commands** with sensible defaults
- **Interactive prompts** prevent accidental operations
- **Clear naming** using branch names directly

### Opinionated Defaults

- Worktrees default to base branch **main** (unless specified)
- Worktrees stored in **.worktrees/** directory
- Branch name becomes worktree name
- **.gitignore** automatically managed

### Safety First

- **Confirms before creating** worktrees
- **Confirms before cleanup** to prevent accidental removal
- **Won't remove current worktree**
- **Clear error messages** for issues

## Integration with Workflows

- `/workflow:work` should ask whether to use a worktree and request a branch name.
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

If your repo uses env files and you want them in the worktree, copy from the repo root to the worktree directory.

Do not overwrite existing files.

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
