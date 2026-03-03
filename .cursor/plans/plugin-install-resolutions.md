# Plugin install — one-pass resolutions

**Principle:** Just install. `npm install` (or `npx compound-workflow install`) configures the right places for whatever tools the user has (opencode, Cursor, Claude). Same behavior in any project including this repo. No over-engineering; the end user does not care about repo vs consumer.

---

## Investigation: how Cursor and Claude resolve plugins

**Cursor:** Does **not** scan workspace root or `node_modules` for `.cursor-plugin`. Plugins are discovered only by: (1) **Marketplace** (install from Cursor UI), or (2) **User config**: `~/.claude/plugins/installed_plugins.json` with absolute `installPath` per plugin, plus `~/.claude/settings.json` with `enabledPlugins`. For local dev you copy the plugin to e.g. `~/.cursor/plugins/<name>` and register that path.  
Sources: [Cursor docs](https://cursor.com/docs/plugins), [Medium: local Cursor plugins](https://medium.com/@v.tajzich/how-to-write-and-test-cursor-plugins-locally-the-part-the-docs-dont-tell-you-4eee705d7f76).

**Claude Code:** Docs describe install from **marketplace** or testing with **`--plugin-dir`**. No documented behavior that it scans project root or node_modules for `.claude-plugin`.

**Conclusion:** Writing only a project-root `.cursor-plugin/plugin.json` that points at `node_modules/...` does **not** make Cursor or Claude discover the plugin. Discovery is marketplace or explicit registration (Cursor: `~/.claude/`).

---

## 1. Cursor/Claude discovery (fix)

**Done.** Project-relative only (no global). Install writes project-root `.cursor-plugin/plugin.json` and `.claude-plugin/plugin.json`. Consumer paths: `node_modules/compound-workflow/src/.agents/...`; self-install: `src/.agents/...`. Implemented in `install-cli.mjs` (`writePluginManifests`).

- (Legacy) Original spec had upsert to ~/.claude/; we do not do that. Only project-root manifests:
  - Copy metadata from package’s `.cursor-plugin/plugin.json` and `.claude-plugin/plugin.json` (name, version, description, author, keywords, license, repository).
  - Override path fields so they are relative to **project root**:
    - `commands`: `"node_modules/compound-workflow/src/.agents/commands"`
    - `agents`: `"node_modules/compound-workflow/src/.agents/agents"`
    - `skills`: `"node_modules/compound-workflow/src/.agents/skills"`
  - Skip writing if `args.dryRun`.

---

## 2. Dry-run integration report

- In `reportOpenCodeIntegration`, when `dryRun` is true: skip the check and log e.g. `[dry-run] OpenCode integration check skipped (state would be updated by install).`

---

## 3. Pack guard for plugin manifests

- In `scripts/check-pack-readme.mjs`: after existing checks, assert pack output includes `.cursor-plugin/plugin.json` and `.claude-plugin/plugin.json`. Exit with clear error if missing.

---

## 4. Manifest read and error message

- In `scripts/install-cli.mjs`: do **not** call `readGeneratedManifest()` at top level. Move manifest read into `main()` at the start (after args and targetRoot). If manifest file is missing, exit with: `Error: OpenCode manifest not found. Run 'npm run generate:artifacts' in the package or reinstall compound-workflow.` and exit code 2.

---

## 5. Self-install (just install everywhere)

- When `realpathSafe(targetRoot) === realpathSafe(PACKAGE_ROOT)`, skip the "compound-workflow not found in project" check. Install then runs and writes opencode.json, AGENTS.md, dirs, plugin manifests from the package. One flow: npm install configures for opencode / Cursor / Claude in any project including this repo. No "for the repo use generate:artifacts" for the user.

---

## 6. postinstall when INIT_CWD is unset

- In `scripts/postinstall.mjs`: when `INIT_CWD` is unset or empty, set `targetRoot` to `process.cwd()` and log: `[compound-workflow] INIT_CWD not set; using process.cwd() as project root.` Then run install with that root. Do not skip postinstall solely because INIT_CWD is missing.

---

## 7. Docs

- README and/or `src/.agents/commands/install.md`: (1) If postinstall didn’t run, run `npx compound-workflow install` manually. No repo vs consumer split; no generate:artifacts user guidance. One line: if postinstall did not run, run `npx compound-workflow install`.

---

## Implementation order

1. Plugin manifests (Cursor/Claude at project root)
2. Manifest lazy + self-install (errors and dev install)
3. Dry-run report
4. Pack guard
5. INIT_CWD fallback
6. Docs
