---
module: compound-workflow
date: 2026-04-15
problem_type: best_practice
component: tooling
symptoms:
  - "Install pipeline assumed .agents/ always exists; silent failures on other harness setups"
  - "Commands and skills hardcoded .agents/skills/ paths, breaking when only .cursor/ or .claude/ present"
  - "Symlinks in plugin manifests broke on re-install and across filesystems (WSL, cross-device)"
root_cause: hardcoded_harness_path_assumptions_and_symlink_based_distribution
resolution_type: workflow_improvement
severity: medium
tags: [architecture, install, harness-detection, portability, copy-based-install, compound-workflow]
---

# Pattern: Copy-Based Install and Harness-Agnostic Path Resolution

## Problem

The original install pipeline used a 3-layer system: `registry.json` → `generate-platform-artifacts.mjs` → generated plugin manifests (`.claude-plugin/`, `.cursor-plugin/`) with symlinks. Commands and skills throughout `src/` hardcoded `.agents/skills/` paths as if that harness always exists. This caused silent failures when only `.claude/` or `.cursor/` was installed, and symlink breakage on re-install and across filesystems.

## Environment

- Module: compound-workflow (the package itself)
- Component: install pipeline, command and skill files
- Environment: any project consuming `compound-workflow` via npm

## Symptoms

- Running in a `.cursor/`-only environment silently failed to find skills because every lookup hardcoded `.agents/skills/`
- Re-running install left broken symlinks; `copyFileSync` would ENOENT writing through a stale symlink target
- Generated plugin manifests (`.claude-plugin/`, `.cursor-plugin/`) needed regenerating on every source change, adding friction to the dev cycle
- `setup-agents` skill listed hardcoded harness paths in its Phase 1 table rather than detecting what exists on disk

## What Didn't Work

**Attempted Solution 1:** Candidate path lists — replace single hardcoded path with `check .agents/skills/, .cursor/skills/ — use first found`.
- **Why it failed:** Still assumes a fixed set of harness names. Any new harness or renamed directory silently breaks discovery. Shifts the assumption rather than removing it.

## Solution

### 1. Copy-based install (no symlinks, no generated manifests)

Delete the plugin pipeline entirely. Source files live flat in `src/agents/`, `src/skills/`, `src/commands/`. The install script copies directly into whatever harness directories exist on disk.

```
src/agents/  →  .claude/agents/  (flat — Claude Code requires no subdirectories)
             →  .cursor/agents/  (preserve structure)
             →  .agents/agents/  (preserve structure)
src/skills/  →  .cursor/skills/
             →  .agents/skills/
src/commands/ → .cursor/commands/
              → .agents/commands/
```

No symlinks. On re-install, existing symlinks are detected via `lstatSync().isSymbolicLink()` and removed before copying.

### 2. `harnesses` in AGENTS.md Repo Config as single source of truth

Add a `harnesses` key to AGENTS.md Repo Config, written by `/setup-agents` from disk detection — not assumed:

```yaml
harnesses:
  - .agents
  - .cursor
```

`setup-agents` Phase 1 checks which directories actually exist (`ls` / Glob from project root). Only found directories appear in the list. Commands and skills that need to locate skill files or templates resolve the path from this key:

> "Use the skills directory of the current harness. If unclear, check `harnesses` in AGENTS.md Repo Config and use the first listed harness that has a `skills/` subdirectory."

No file in `src/commands/` or `src/skills/` ever names a harness directory directly.

### 3. Self-referential skills use relative language

Skills that reference their own assets (e.g. `compound-docs` loading `schema.yaml`) use:

> "Load `schema.yaml` from the same directory as this skill file."

This survives any harness layout without modification.

### 4. Sync comment pattern for paired files

`src/AGENTS.md` and `setup-agents/SKILL.md` Phase 4 template are dual instances of the same structure. Each carries a comment pointing to the other:

```markdown
<!-- Default template. Structural source of truth: src/skills/setup-agents/SKILL.md Phase 4.
     When changing sections here, keep that template in sync (and vice versa). -->
```

When one changes, the comment is the signal to update the other.

### 5. Contract check as a living document

`scripts/check-workflow-contracts.mjs` guards invariant phrases in CI. Every new non-negotiable added to AGENTS.md should get a corresponding check. The check description field should explain *why* the phrase matters, not just what it says.

## Why This Works

The root cause was a mismatch between authoring time (when `src/` files are written) and runtime (when an agent executes them in a specific project). At authoring time, no one knows which harnesses will be installed. The fix moves harness knowledge to the one place that is written at install time with full disk visibility: AGENTS.md Repo Config. Everything else defers to that config.

Copy-on-install removes the symlink indirection entirely — the installed file is the file, not a pointer to a source tree that may have moved.

## Prevention

- **Never hardcode a harness directory path** in a command or skill file. If you need to reference a skill template or asset, use one of:
  - "resolve from `harnesses` in AGENTS.md Repo Config"
  - "same directory as this skill file" (for self-referential assets)
- **When adding a new non-negotiable**, add a corresponding check to `check-workflow-contracts.mjs` in the same PR.
- **Re-run `/setup-agents`** after adding or removing harnesses — `harnesses` in AGENTS.md is written at setup time and may become stale.
- **The install script is authoritative** for which harness directories get populated. If a new harness is added, update `scripts/install-cli.mjs` and `/setup-agents` Phase 1 together.

## Related Issues

- See also: [2026-03-02-compound-workflow-enforce-worktree-and-spike-ordering.md](../workflow-issues/2026-03-02-compound-workflow-enforce-worktree-and-spike-ordering.md)
