---
name: setup
description: Interactive onboarding to configure repo defaults in AGENTS.md (default_branch, test/lint commands, dev server URL, tracker)
argument-hint: "[optional: path to AGENTS.md (defaults to ./AGENTS.md)]"
---

# /setup

Configure this repo to use the portable `.agents` workflows deterministically.

This command updates the "Repo Config Block" YAML in `AGENTS.md`.

## Inputs

- Optional: a path to an `AGENTS.md` file
- Default: `./AGENTS.md`

## Workflow

1. Resolve the target `AGENTS.md` path.
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

   Present the detected suggestions to the user.

5. Use AskUserQuestion to confirm or edit:

   - `default_branch` (recommended)
   - `dev_server_url` (only if this repo has a local dev server)
   - `test_command` (recommended)
   - `test_fast_command` (optional)
   - `lint_command` (optional)
   - `format_command` (optional)
   - `project_tracker` (github|linear|none)

6. Write/update the YAML block with the provided values.

Rules:

- Prefer "suggest + confirm" over guessing.
- If the user says "none" for a key, omit it from the YAML.
- Keep the YAML keys stable so commands can read them.
- After writing, print the resolved config values so the user can sanity check.

## Guardrails

- Only modify `AGENTS.md`.
- Do not run tests, lint, or any destructive git commands.
