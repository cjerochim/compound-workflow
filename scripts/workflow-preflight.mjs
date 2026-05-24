#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function usage(exitCode = 0) {
  const msg = `
Usage:
  npx compound-workflow preflight -- --plan <path> --mode <mode> --approval-source <source> --todo <path> [--expected-branch <branch>]

Modes:
  dedicated_worktree
  existing_worktree
  current_checkout_approved

Approval sources:
  user_prompt
  plan_contract
  explicit_argument
`;
  (exitCode === 0 ? console.log : console.error)(msg.trimStart());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    plan: null,
    mode: null,
    approvalSource: null,
    todo: null,
    expectedBranch: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--plan") args.plan = argv[++i] ?? null;
    else if (arg === "--mode") args.mode = argv[++i] ?? null;
    else if (arg === "--approval-source") args.approvalSource = argv[++i] ?? null;
    else if (arg === "--todo") args.todo = argv[++i] ?? null;
    else if (arg === "--expected-branch") args.expectedBranch = argv[++i] ?? null;
    else usage(1);
  }

  return args;
}

function fail(message) {
  console.error(`workflow preflight failed: ${message}`);
  process.exit(1);
}

function git(args, cwd = process.cwd()) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    fail(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function gitMaybe(args, cwd = process.cwd()) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function readRepoConfig(topLevel) {
  const agentsPath = path.join(topLevel, "AGENTS.md");
  if (!fs.existsSync(agentsPath)) return {};

  const content = fs.readFileSync(agentsPath, "utf8");
  const block = content.match(/```yaml\n([\s\S]*?)```/);
  if (!block) return {};

  const config = {};
  for (const line of block[1].split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.+?)\s*$/);
    if (match) config[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return config;
}

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function realpathSafe(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function currentWorktreeInfo(topLevel) {
  const porcelain = git(["worktree", "list", "--porcelain"], topLevel);
  const records = porcelain.split(/\n(?=worktree )/).map((record) => {
    const info = {};
    for (const line of record.split(/\r?\n/)) {
      const [key, ...rest] = line.split(" ");
      if (key) info[key] = rest.join(" ");
    }
    return info;
  });

  return records.find((record) => path.resolve(record.worktree ?? "") === topLevel) ?? null;
}

const args = parseArgs(process.argv);

const validModes = new Set(["dedicated_worktree", "existing_worktree", "current_checkout_approved"]);
const validApprovalSources = new Set(["user_prompt", "plan_contract", "explicit_argument"]);

if (!args.plan) fail("--plan is required");
if (!args.todo) fail("--todo is required");
if (!validModes.has(args.mode)) fail("--mode must be dedicated_worktree, existing_worktree, or current_checkout_approved");
if (!validApprovalSources.has(args.approvalSource)) fail("--approval-source must be user_prompt, plan_contract, or explicit_argument");

const cwd = realpathSafe(process.cwd());
const topLevel = realpathSafe(git(["rev-parse", "--show-toplevel"]));
const branch = git(["branch", "--show-current"], topLevel);
const defaultBranch = (gitMaybe(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], topLevel) ?? "")
  .replace(/^origin\//, "") || "main";
const config = readRepoConfig(topLevel);
const worktreeDirName = path.basename(config.worktree_dir ?? ".worktrees");

const planPathInput = path.resolve(args.plan);
const todoPathInput = path.resolve(args.todo);

if (!isInside(cwd, topLevel)) fail(`cwd ${cwd} is not inside git top-level ${topLevel}`);
if (!fs.existsSync(planPathInput)) fail(`plan file does not exist: ${planPathInput}`);
if (!fs.existsSync(todoPathInput)) fail(`todo/checkpoint file does not exist: ${todoPathInput}`);
const planPath = realpathSafe(planPathInput);
const todoPath = realpathSafe(todoPathInput);
if (!isInside(planPath, topLevel)) fail(`plan file is not inside execution context: ${planPath}`);
if (!isInside(todoPath, topLevel)) fail(`todo/checkpoint file is not inside execution context: ${todoPath}`);
if (!branch) fail("current branch could not be resolved");
if (args.expectedBranch && branch !== args.expectedBranch) {
  fail(`current branch ${branch} does not match expected branch ${args.expectedBranch}`);
}

if (args.mode === "dedicated_worktree" || args.mode === "existing_worktree") {
  const worktreeInfo = currentWorktreeInfo(topLevel);
  if (!worktreeInfo) fail(`git worktree metadata does not include current path: ${topLevel}`);
  if (branch === defaultBranch) fail(`worktree mode cannot run on default branch ${defaultBranch}`);

  const pathParts = topLevel.split(path.sep);
  if (!pathParts.includes(worktreeDirName)) {
    fail(`worktree path must be under configured worktree dir ${worktreeDirName}: ${topLevel}`);
  }
}

if (args.mode === "current_checkout_approved") {
  if (args.approvalSource !== "user_prompt" && args.approvalSource !== "explicit_argument") {
    fail("current_checkout_approved requires user_prompt or explicit_argument approval source");
  }
}

const evidence = {
  isolation_preflight: {
    required: true,
    mode: args.mode,
    approval_source: args.approvalSource,
    worktree_path: args.mode === "current_checkout_approved" ? null : topLevel,
    branch,
    all_subsequent_commands_cwd: cwd,
    plan_path_in_execution_context: planPath,
    triage_checkpoint_path: todoPath,
    status: "passed",
  },
};

console.log(JSON.stringify(evidence, null, 2));
