---
name: sync
description: Copy .agents and AGENTS.md from this compound-workflow clone into the host repo root, then sync OpenCode config (opencode.json).
argument-hint: "[optional: path to host repo root (default: parent of compound-workflow clone)]"
---

# /sync

Copy the canonical workflow from this compound-workflow clone into the host repository, then update the host's repo-root `opencode.json` so commands and agents stay registered.

Use this when compound-workflow is cloned **inside** a repo (e.g. `vendor/compound-workflow` or `compound-workflow/`) and you want to push the latest `.agents` and `AGENTS.md` into the host repo without manual copy.

## Inputs

- Optional: path to host repo root
- Default: parent directory of the compound-workflow clone (current workspace root when the workspace is the clone)
- Override: `COMPOUND_SYNC_TARGET` env var

## Workflow

1. **Resolve host repo root (`HOST_ROOT`).**
   - If argument provided and it is an existing directory, use it.
   - Else if `COMPOUND_SYNC_TARGET` is set and is an existing directory, use it.
   - Else use the parent of the current workspace root (assume workspace root is the compound-workflow clone).
   - Verify `HOST_ROOT` is not the same as or under the clone's `src/` (avoid overwriting the source). If invalid, stop and report.

2. **Resolve clone root (`CLONE_ROOT`).**
   - Current workspace root (must contain `src/.agents` and `src/AGENTS.md`). If missing, stop and report that this command must run from a compound-workflow clone.

3. **Copy and merge into host.**
   - Copy `CLONE_ROOT/src/.agents` → `HOST_ROOT/.agents` (replace existing).
   - **AGENTS.md:**
     - If `HOST_ROOT/AGENTS.md` does not exist: copy `CLONE_ROOT/src/AGENTS.md` → `HOST_ROOT/AGENTS.md`.
     - If `HOST_ROOT/AGENTS.md` exists: use AI to **merge**. Treat the clone's `src/AGENTS.md` as the canonical structure and content (sections, principles, directory layout, skill index, etc.). Merge with the host's current `AGENTS.md`: preserve the host's "Repo Config Block" YAML and any other host-specific customizations (extra sections, repo-specific notes). Produce a single merged `AGENTS.md` and write it to `HOST_ROOT/AGENTS.md`. Do not simply overwrite with the clone file; the merge must retain host repo-specific content while bringing in updates from the template.

4. **Sync OpenCode configuration in the host repo.**

   Run the same logic as `/setup` step 7, with all paths relative to `HOST_ROOT`:

   - 4.1 Discover commands: glob `HOST_ROOT/.agents/commands/**/*.md` (id from frontmatter `name` or basename; description from frontmatter).
   - 4.2 Discover agents: glob `HOST_ROOT/.agents/agents/**/*.md` (id from frontmatter `name` or basename; description from frontmatter).
   - 4.3 Ensure `HOST_ROOT/opencode.json` exists. If missing: create with `$schema: https://opencode.ai/config.json`, `skills.paths: [".agents/skills"]`, and `command` / `agent` from discovery. If present: merge and prune only managed entries.
   - 4.4 For each command: set `command.<id>.description`, `command.<id>.agent` to `"build"`, `command.<id>.template` with `@AGENTS.md`, `@.agents/commands/...`, `Arguments: $ARGUMENTS`.
   - 4.5 For each agent: set `agent.<id>.description`, `agent.<id>.mode` to `"subagent"`, `agent.<id>.prompt` with `{file:.agents/agents/...}`, and `agent.<id>.permission.edit` to `"deny"` unless the agent is intended to edit.
   - 4.6 Prune: remove `command.*` / `agent.*` whose template/prompt references `.agents/commands/` or `.agents/agents/` and whose source file no longer exists in the host.

5. **Confirm.**
   - List what was copied and that `opencode.json` was updated. Suggest running `opencode debug config` in the host repo to verify.

## Guardrails

- Only modify files under `HOST_ROOT`: `.agents/`, `AGENTS.md`, `opencode.json`.
- Do not run tests, lint, or destructive git commands.
- When merging `AGENTS.md`, use AI to combine clone (canonical template) with host (Repo Config Block and any repo-specific content); never overwrite host AGENTS.md with a raw copy when the host file exists.
