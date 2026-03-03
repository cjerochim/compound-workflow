#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const cacheDir =
  process.env.npm_config_cache ?? path.join(os.tmpdir(), `npm-cache-${process.pid}`);

let output;

try {
  output = execFileSync("npm", ["pack", "--dry-run", "--json", "--cache", cacheDir], {
    encoding: "utf8",
  });
} catch (error) {
  const stderr = error?.stderr?.toString?.() ?? error.message;
  console.error("Failed to run `npm pack --dry-run --json`.");
  console.error(stderr);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(output);
} catch (error) {
  console.error("Failed to parse npm pack JSON output.");
  console.error(error.message);
  process.exit(1);
}

const files = Array.isArray(report) && report[0]?.files ? report[0].files : [];
const hasRootReadme = files.some((file) => /^readme(?:\.[^/]+)?$/i.test(file.path));
const hasGeneratedManifest = files.some((file) => file.path === "src/generated/opencode.managed.json");
const hasCursorPlugin = files.some((file) => file.path === ".cursor-plugin/plugin.json");
const hasClaudePlugin = files.some((file) => file.path === ".claude-plugin/plugin.json");

if (!hasRootReadme) {
  console.error("Package guard failed: root README is missing from the packed tarball.");
  console.error("Add a root README (for example `README.md`) and ensure it is not excluded.");
  process.exit(1);
}

if (!hasGeneratedManifest) {
  console.error("Package guard failed: src/generated/opencode.managed.json is missing from the packed tarball.");
  console.error("Ensure 'src' is in package.json 'files' and the file is committed or generated before publish.");
  process.exit(1);
}

if (!hasCursorPlugin || !hasClaudePlugin) {
  console.error("Package guard failed: .cursor-plugin/plugin.json and .claude-plugin/plugin.json must be in the packed tarball.");
  console.error("Ensure '.cursor-plugin' and '.claude-plugin' are in package.json 'files'.");
  process.exit(1);
}

console.log("Package guard passed: root README, opencode.managed.json, and plugin manifests are present in npm pack output.");
