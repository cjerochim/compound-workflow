---
name: setup
description: Interactive onboarding to configure repo defaults in AGENTS.md (default_branch, test/lint commands, dev server URL, tracker)
argument-hint: "[optional: path to AGENTS.md (defaults to ./AGENTS.md)]"
---

# /setup

Configure this repo to use the portable `.agents` workflows deterministically.

This command updates the "Repo Config Block" YAML in `AGENTS.md` and keeps the repo-root `opencode.json` in sync with `.agents/commands/*` and `.agents/agents/**` so running plain `opencode` always has the right commands and agents registered.

When compound-workflow is used as an in-repo clone, run **`/sync`** from the clone first to copy the latest `.agents` and `AGENTS.md` into the host repo (and refresh `opencode.json`); then run `/setup` in the host to configure or update repo defaults.

## Inputs

- Optional: a path to an `AGENTS.md` file
- Default: `./AGENTS.md`
- Flags (by convention in `$ARGUMENTS`):
  - `--dry-run`: preview detected defaults + planned YAML + planned `opencode.json` changes; **no writes**

## Workflow

1. Resolve the target `AGENTS.md` path.
   - Always print the resolved `AGENTS.md` as an **absolute path** before any writes.
2. Read the file and locate the "Repo Config Block" section.
3. If the section does not exist, add it under "Repo Configuration (Optional)".

4. Detect suggested defaults (do this before asking questions):

   - `default_branch`:
     - prefer `origin/HEAD` if available
     - else prefer `main`, else `master`
   - language/tooling hints:
     - Node: `package.json`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lockb`
     - Ruby: `Gemfile`, `Gemfile.lock`, `bin/rails`
     - Python: `pyproject.toml`, `poetry.lock`, `requirements.txt`
     - Go: `go.mod`
   - suggest `test_command`:
     - Node: prefer `npm test` / `pnpm test` / `yarn test` / `bun test` based on lockfile
     - Ruby: `bin/rails test` (or the repo's documented command)
     - Python: `pytest`
     - Go: `go test ./...`
     - if a Makefile exists and has a `test` target, prefer `make test`
   - suggest `lint_command` / `format_command`:
     - Node: read `package.json` scripts and prefer `lint` / `format` when present
     - otherwise leave blank and ask
   - suggest `dev_server_url`:
     - only if there is a browser app to validate
     - default to `http://localhost:3000` unless the repo clearly uses another port
       (e.g., Vite often 5173)
   - suggest `project_tracker`:
     - default `github` when `.git` is present; otherwise ask

   - suggest worktree bootstrap defaults (used by `/workflow:work` + `git-worktree`):
     - `worktree_dir`:
       - default `.worktrees`
     - `worktree_install_command` (best-effort autodetect):
       - Node:
         - `pnpm-lock.yaml` -> `pnpm install`
         - `yarn.lock` -> `yarn install`
         - `package-lock.json` -> `npm ci`
         - `bun.lockb` -> `bun install`
         - `package.json` only -> `npm install`
       - Ruby:
         - `Gemfile` -> `bundle install`
       - Python:
         - `poetry.lock` -> `poetry install`
         - `requirements.txt` -> `pip install -r requirements.txt`
       - Go:
         - `go.mod` -> `go mod download`
       - If unclear, leave blank and ask.
     - `worktree_copy_files`:
       - if `.env` exists: suggest copying `.env`
       - if `.env.local` / `.env.development` / `.env.development.local` exist: suggest including them
       - otherwise leave blank and ask (do not invent secrets)
     - `worktree_bootstrap_notes`:
       - default empty; prompt user for any required per-worktree prerequisites (system deps, services, toolchain, `direnv allow`, migrations/seeds)

   Present the detected suggestions to the user.

5. Use AskQuestion to confirm or edit:

   - `default_branch` (recommended)
   - `dev_server_url` (only if this repo has a local dev server)
   - `test_command` (recommended)
   - `test_fast_command` (optional)
   - `lint_command` (optional)
   - `format_command` (optional)
   - `project_tracker` (github|linear|none)
   - `worktree_dir` (optional)
   - `worktree_copy_files` (optional)
   - `worktree_install_command` (optional)
   - `worktree_bootstrap_notes` (optional)

6. Write/update the YAML block with the provided values.

7. Sync OpenCode configuration (repo-root `opencode.json`).

   Why: When users run plain `opencode`, OpenCode loads `./opencode.json` at the repo root. A config at `.opencode/opencode.json` is not used unless the user explicitly sets `OPENCODE_CONFIG`.

   7.1 Discover source command and agent definitions:

   - Commands: glob `.agents/commands/**/*.md`
     - command id: **frontmatter `invocation` (preferred)** else `name` else file basename
     - description: frontmatter `description` (fallback: id)
   - Agents: glob `.agents/agents/**/*.md`

     - agent id: frontmatter `name` (fallback: file basename)
     - description: frontmatter `description` (fallback: `"<name>"`)

     7.2 Ensure repo-root `opencode.json` exists.

     7.2.1 Validate schema URL (online check).

   - Fetch `https://opencode.ai/config.json` and confirm it returns JSON.
   - Sanity check that it looks like the OpenCode config schema (e.g., it contains top-level fields like `properties` and includes `command` / `agent` keys).
   - If the fetch fails (offline, network, etc.), proceed using the known schema URL anyway, but explicitly note that the schema check could not be verified.

   - If missing: create it with:
     - `$schema: https://opencode.ai/config.json` (from the validated schema URL)
     - `skills.paths: [".agents/skills"]`
     - `command: {}` and `agent: {}` populated from discovered sources
   - If present: update it (merge + prune) without touching unrelated user config.

     7.3 Write/update commands in `opencode.json`.

   For each discovered command `<cmd>` (from `.agents/commands/<cmd>.md`), ensure:

   - `command.<cmd>.description` is set from frontmatter
   - `command.<cmd>.agent` is `"build"`
   - `command.<cmd>.template` includes the source file contents using OpenCode's documented file reference syntax:

     - `@AGENTS.md`
     - `@.agents/commands/<cmd>.md`
     - `Arguments: $ARGUMENTS`

     7.4 Write/update agents in `opencode.json`.

   For each discovered agent `<agent>` (from `.agents/agents/**/<file>.md`), ensure:

   - `agent.<agent>.description` is set from frontmatter
   - `agent.<agent>.mode` is `"subagent"`
   - `agent.<agent>.prompt` loads the file using OpenCode's documented file substitution syntax:
     - `{file:.agents/agents/<relative-path>.md}`
   - Safety default: set `agent.<agent>.permission.edit` to `"deny"` unless the agent is intended to edit files.

     7.5 Prune stale managed entries (enabled).

   Remove entries from `opencode.json` only when they are clearly managed by this sync:

   - Managed commands: any `command.*.template` that contains `@.agents/commands/`
     - If its corresponding source file no longer exists, delete that `command.*` entry.
   - Managed agents: any `agent.*.prompt` that contains `{file:.agents/agents/`
     - If its corresponding source file no longer exists, delete that `agent.*` entry.

   Never delete non-managed commands/agents.

   7.6 Deterministic sync (recommended; supports `--dry-run` + idempotency summary):

   - Run:
     - `node .agents/scripts/sync-opencode.mjs [--dry-run]`
   - It prints:
     - resolved repo root (absolute)
     - absolute modified paths
     - idempotency summary (“0 changes needed” vs “updated N managed entries.”)

   7.7 Post-sync self-check (required):

   - Run:
     - `node .agents/scripts/self-check.mjs`
   - Fail (and report) if:
     - a discovered command/agent is missing from `opencode.json`
     - a managed entry points to a missing source file
     - required frontmatter fields are missing (especially `invocation` for `commands/workflow/**`)

8. Verify configuration is being picked up:

   - Run `opencode debug config` and confirm `command` and `agent` are populated.

## Non-interactive / timeout recovery (opencode run)

If `opencode run` aborts repeatedly (cold starts / tool timeouts):

- Prefer a persistent backend:
  - `opencode serve`
  - then: `opencode run --attach http://localhost:4096 --command setup -- <args>`
- If shell steps time out, increase bash default timeout:
  - `OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS=600000 opencode run ...`

Rules:

- Prefer "suggest + confirm" over guessing.
- If the user says "none" for a key, omit it from the YAML.
- Keep the YAML keys stable so commands can read them.
- After writing, print the resolved config values so the user can sanity check.

## Guardrails

- Only modify `AGENTS.md` and repo-root `opencode.json`.
- Do not run tests, lint, or any destructive git commands.
