#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");

function realpathSafe(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function isTruthy(v) {
  const s = String(v || "").toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function hasFile(dir, name) {
  try {
    return fs.existsSync(path.join(dir, name));
  } catch {
    return false;
  }
}

function shouldSkip(targetRoot) {
  if (!targetRoot) return "INIT_CWD not set";
  if (isTruthy(process.env.npm_config_global)) return "global install";
  if (isTruthy(process.env.COMPOUND_WORKFLOW_SKIP_POSTINSTALL)) return "disabled by env";
  if (!hasFile(targetRoot, "package.json")) return "no package.json in target root";
  if (realpathSafe(targetRoot) === realpathSafe(packageRoot)) return "package development install";
  return null;
}

function run() {
  const targetRoot = process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD) : "";
  const skipReason = shouldSkip(targetRoot);
  if (skipReason) {
    console.log(`[compound-workflow] postinstall skipped (${skipReason})`);
    return;
  }

  const cliPath = path.join(packageRoot, "scripts", "install-cli.mjs");
  const result = spawnSync(
    process.execPath,
    [cliPath, "install", "--root", targetRoot, "--no-config"],
    { stdio: "inherit", env: process.env }
  );

  if (result.status !== 0) {
    console.warn(
      "[compound-workflow] automatic setup failed; run `npx compound-workflow install` in your project."
    );
  }
}

run();
