#!/usr/bin/env node
/**
 * compound-workflow install
 * One action: opencode.json (load from package) + AGENTS.md merge + dirs + Repo Config Block.
 * Run from project: npx compound-workflow install [--root <dir>] [--dry-run] [--no-config]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage(exitCode = 0) {
  const msg = `
Usage:
  npx compound-workflow install [--root <projectDir>] [--dry-run] [--no-config]

One action: writes opencode.json (loads from package), merges AGENTS.md, creates dirs,
and prompts for Repo Config Block (unless --no-config).

  --root <dir>   Project directory (default: cwd)
  --dry-run      Print planned changes only
  --no-config   Skip Repo Config Block prompt (only write opencode.json + AGENTS.md + dirs)
`;
  (exitCode === 0 ? console.log : console.error)(msg.trimStart());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { root: process.cwd(), dryRun: false, noConfig: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--no-config") out.noConfig = true;
    else if (a === "--root") {
      const v = argv[i + 1];
      if (!v) usage(1);
      out.root = v;
      i++;
    }     else if (a === "-h" || a === "--help") usage(0);
    else if (a && a !== "install" && !a.startsWith("-")) usage(1);
  }
  return out;
}

function realpathSafe(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

const packageRoot = realpathSafe(path.join(__dirname, ".."));
const packageAgents = path.join(packageRoot, "src", ".agents");
const PKG_PREFIX = "node_modules/compound-workflow";

function walkFiles(dirAbs, predicate) {
  const out = [];
  const stack = [dirAbs];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && predicate(p)) out.push(p);
    }
  }
  out.sort();
  return out;
}

function parseFrontmatter(md) {
  if (!md.startsWith("---\n") && !md.startsWith("---\r\n")) return {};
  const end = md.indexOf("\n---", 4);
  if (end === -1) return {};
  const block = md.slice(4, end + 1);
  const out = {};
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)\s*$/);
    if (!m) continue;
    let v = (m[2] ?? "").replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    out[m[1]] = v;
  }
  return out;
}

function discoverCommands(agentsRoot) {
  const commandsDir = path.join(agentsRoot, "commands");
  const files = walkFiles(commandsDir, (p) => p.endsWith(".md"));
  const map = new Map();
  for (const fileAbs of files) {
    const rel = path.relative(packageRoot, fileAbs).replaceAll(path.sep, "/");
    const md = fs.readFileSync(fileAbs, "utf8");
    const fm = parseFrontmatter(md);
    const id = (fm.invocation || fm.name || path.basename(fileAbs, ".md")).trim();
    const description = (fm.description || id).trim();
    if (!id) continue;
    const pkgRel = `${PKG_PREFIX}/${rel}`;
    map.set(id, { id, rel: pkgRel, description });
  }
  return map;
}

function discoverAgents(agentsRoot) {
  const agentsDir = path.join(agentsRoot, "agents");
  const files = walkFiles(agentsDir, (p) => p.endsWith(".md"));
  const map = new Map();
  for (const fileAbs of files) {
    const rel = path.relative(packageRoot, fileAbs).replaceAll(path.sep, "/");
    const md = fs.readFileSync(fileAbs, "utf8");
    const fm = parseFrontmatter(md);
    const id = (fm.name || path.basename(fileAbs, ".md")).trim();
    const description = (fm.description || id).trim();
    if (!id) continue;
    const pkgRel = `${PKG_PREFIX}/${rel}`;
    map.set(id, { id, rel: pkgRel, description });
  }
  return map;
}

function ensureObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function stripJsonc(input) {
  let out = "";
  let i = 0;
  let inStr = false,
    strQuote = "",
    escape = false;
  while (i < input.length) {
    const c = input[i];
    const n = input[i + 1];
    if (inStr) {
      out += c;
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === strQuote) inStr = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      strQuote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && n === "/") {
      while (i < input.length && input[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function readJsonMaybe(fileAbs) {
  if (!fs.existsSync(fileAbs)) return null;
  const raw = fs.readFileSync(fileAbs, "utf8");
  return JSON.parse(stripJsonc(raw));
}

const SKILLS_SYMLINK_PATH = ".agents/compound-workflow-skills";

function ensureSkillsSymlink(targetRoot, dryRun) {
  const agentsDir = path.join(targetRoot, ".agents");
  const linkPath = path.join(agentsDir, "compound-workflow-skills");
  const targetRel = path.join("..", "node_modules", "compound-workflow", "src", ".agents", "skills");

  if (dryRun) {
    console.log("[dry-run] Would create", SKILLS_SYMLINK_PATH, "symlink");
    return;
  }

  if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });

  let needCreate = true;
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      fs.realpathSync(linkPath);
      needCreate = false;
    }
  } catch (_) {}

  if (needCreate) {
    try {
      fs.unlinkSync(linkPath);
    } catch (_) {}
    const type = process.platform === "win32" ? "dir" : "dir";
    fs.symlinkSync(targetRel, linkPath, type);
    console.log("Created", SKILLS_SYMLINK_PATH, "-> package skills");
  }
}

function writeOpenCodeJson(targetRoot, dryRun) {
  const opencodeAbs = path.join(targetRoot, "opencode.json");
  const existing = readJsonMaybe(opencodeAbs) ?? {};
  const next = structuredClone(existing);

  next.$schema = next.$schema || "https://opencode.ai/config.json";
  next.skills = ensureObject(next.skills);
  if (!Array.isArray(next.skills.paths)) next.skills.paths = [];
  if (!next.skills.paths.includes(SKILLS_SYMLINK_PATH)) next.skills.paths.unshift(SKILLS_SYMLINK_PATH);
  next.command = ensureObject(next.command);
  next.agent = ensureObject(next.agent);

  const commands = discoverCommands(packageAgents);
  const agents = discoverAgents(packageAgents);

  for (const [id, cmd] of commands) {
    next.command[id] = {
      ...ensureObject(next.command[id]),
      description: cmd.description,
      agent: "build",
      template: `@AGENTS.md\n@${cmd.rel}\nArguments: $ARGUMENTS\n`,
    };
  }
  for (const [id, ag] of agents) {
    next.agent[id] = {
      ...ensureObject(next.agent[id]),
      description: ag.description,
      mode: "subagent",
      prompt: `{file:${ag.rel}}`,
      permission: { ...ensureObject(next.agent[id]?.permission), edit: "deny" },
    };
  }

  const out = JSON.stringify(next, null, 2) + "\n";
  if (dryRun) {
    console.log("[dry-run] Would write opencode.json:", opencodeAbs);
    return;
  }
  fs.writeFileSync(opencodeAbs, out, "utf8");
  console.log("Wrote:", opencodeAbs);
}

function extractRepoConfigBlock(md) {
  const match = md.match(/(### Repo Config Block[^\n]*\n)?\s*```yaml\n([\s\S]*?)```/);
  if (!match) return { block: null, rest: md };
  const full = match[0];
  const block = match[2].trim();
  const rest = md.replace(full, "").replace(/\n{3,}/g, "\n\n").trim();
  return { block, rest };
}

function mergeAgentsMd(templateMd, existingMd) {
  const { block: existingBlock, rest: existingRest } = existingMd
    ? extractRepoConfigBlock(existingMd)
    : { block: null, rest: "" };
  const { block: _tplBlock, rest: templateRest } = extractRepoConfigBlock(templateMd);
  let out = templateRest;
  if (existingBlock) {
    const repoSection =
      "### Repo Config Block (Optional)\n\n```yaml\n" + existingBlock + "\n```\n";
    if (!out.includes("### Repo Config Block")) {
      out = out.replace("## Repo Configuration (Optional)", "## Repo Configuration (Optional)\n\n" + repoSection);
    } else {
      out = out.replace(/### Repo Config Block[^\n]*\n\s*```yaml\n[\s\S]*?```/, repoSection);
    }
  }
  return out;
}

function writeAgentsMd(targetRoot, dryRun) {
  const templatePath = path.join(packageRoot, "src", "AGENTS.md");
  const targetPath = path.join(targetRoot, "AGENTS.md");
  const templateMd = fs.readFileSync(templatePath, "utf8");
  const existingMd = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : null;
  const merged = mergeAgentsMd(templateMd, existingMd);
  if (dryRun) {
    console.log("[dry-run] Would write AGENTS.md:", targetPath);
    return merged;
  }
  fs.writeFileSync(targetPath, merged, "utf8");
  console.log("Wrote:", targetPath);
  return merged;
}

const DIRS = [
  "docs/brainstorms",
  "docs/plans",
  "docs/solutions",
  "docs/metrics/daily",
  "docs/metrics/weekly",
  "docs/metrics/monthly",
  "todos",
];

function ensureDirs(targetRoot, dryRun) {
  for (const d of DIRS) {
    const abs = path.join(targetRoot, d);
    if (dryRun && !fs.existsSync(abs)) console.log("[dry-run] Would create:", d);
    else if (!fs.existsSync(abs)) {
      fs.mkdirSync(abs, { recursive: true });
      console.log("Created:", d);
    }
  }
}

function main() {
  const args = parseArgs(process.argv);
  const targetRoot = realpathSafe(args.root);

  if (!fs.existsSync(packageAgents)) {
    console.error("Error: package agents dir not found:", packageAgents);
    process.exit(2);
  }

  const pkgInTarget = path.join(targetRoot, "node_modules", "compound-workflow");
  if (!fs.existsSync(pkgInTarget) && !args.dryRun) {
    console.error("Error: compound-workflow not found in project. Run: npm install compound-workflow");
    process.exit(2);
  }

  console.log("Target root:", targetRoot);
  console.log("Package root:", packageRoot);

  writeOpenCodeJson(targetRoot, args.dryRun);
  ensureSkillsSymlink(targetRoot, args.dryRun);
  writeAgentsMd(targetRoot, args.dryRun);
  ensureDirs(targetRoot, args.dryRun);

  if (!args.noConfig && !args.dryRun && process.stdin.isTTY) {
    console.log("\nRepo Config: edit AGENTS.md to set default_branch, test_command, lint_command, dev_server_url.");
  }

  console.log("\nDone. Run opencode debug config to verify.");
}

main();
