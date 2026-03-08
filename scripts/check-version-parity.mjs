#!/usr/bin/env node
/**
 * Exit 0 if package.json version matches .cursor-plugin/plugin.json and .claude-plugin/plugin.json.
 * Used in CI to validate release artifact sync.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const cursorPlugin = JSON.parse(
  fs.readFileSync(path.join(root, ".cursor-plugin", "plugin.json"), "utf8")
);
const claudePlugin = JSON.parse(
  fs.readFileSync(path.join(root, ".claude-plugin", "plugin.json"), "utf8")
);

const expected = pkg.version;

// Claude Code's plugin.json is intentionally minimal (see scripts/generate-platform-artifacts.mjs)
// and may not include a version field. When absent, treat it as not applicable.
const claudeVersion = claudePlugin.version;
const claudeOk = claudeVersion == null || claudeVersion === expected;

if (cursorPlugin.version !== expected || !claudeOk) {
  console.error(
    "Version mismatch: package.json=%s, .cursor-plugin/plugin.json=%s, .claude-plugin/plugin.json=%s",
    expected,
    cursorPlugin.version,
    claudeVersion
  );
  process.exit(1);
}
