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

if (!hasRootReadme) {
  console.error("Package guard failed: root README is missing from the packed tarball.");
  console.error("Add a root README (for example `README.md`) and ensure it is not excluded.");
  process.exit(1);
}

console.log("Package guard passed: root README is present in npm pack output.");
