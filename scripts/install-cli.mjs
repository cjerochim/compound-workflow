#!/usr/bin/env node
/**
 * compound-workflow install
 *
 * Copies agents, skills, and commands from the package into every harness dir.
 * Harnesses are declared in HARNESSES below; every harness receives all three
 * asset kinds so skills and commands stay in parity across .claude/, .cursor/,
 * and .agents/. Only agent layout varies per harness (flat vs. recursive).
 *
 *   .claude/{agents,skills,commands}  — Claude Code (flat agents)
 *   .cursor/{agents,skills,commands}  — Cursor (recursive agents)
 *   .agents/{agents,skills,commands}  — OpenCode / generic (recursive agents)
 *
 * Also writes opencode.json, AGENTS.md, and standard docs directories.
 *
 * Usage:
 *   (automatic) npm install compound-workflow   # runs via postinstall
 *   (manual)    npx compound-workflow install [--root <projectDir>] [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function realpathSafe(p) {
  try { return fs.realpathSync(p); } catch { return path.resolve(p); }
}

const PACKAGE_ROOT = realpathSafe(path.join(__dirname, ".."));

function hasCommand(cmd) {
  const checker = process.platform === "win32" ? "where" : "which";
  return spawnSync(checker, [cmd], { stdio: "ignore" }).status === 0;
}

function stripJsonc(input) {
  let out = "", i = 0, inStr = false, strQuote = "", escape = false;
  while (i < input.length) {
    const c = input[i], n = input[i + 1];
    if (inStr) {
      out += c;
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === strQuote) inStr = false;
      i++; continue;
    }
    if (c === '"' || c === "'") { inStr = true; strQuote = c; out += c; i++; continue; }
    if (c === "/" && n === "/") { while (i < input.length && input[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { i += 2; while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++; i += 2; continue; }
    out += c; i++;
  }
  return out;
}

function readJsonMaybe(fileAbs) {
  if (!fs.existsSync(fileAbs)) return null;
  return JSON.parse(stripJsonc(fs.readFileSync(fileAbs, "utf8")));
}

function ensureObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function parseFrontmatter(md) {
  if (!md.startsWith("---\n") && !md.startsWith("---\r\n")) return {};
  const end = md.indexOf("\n---", 4);
  if (end === -1) return {};
  const block = md.slice(4, end + 1);
  const out = {};
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)\s*$/);
    if (!match) continue;
    out[match[1]] = (match[2] ?? "").replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
  return out;
}

function walkFiles(dirAbs, ext) {
  const out = [];
  const stack = [dirAbs];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && (!ext || p.endsWith(ext))) out.push(p);
    }
  }
  return out.sort();
}

function copyDirRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      // Remove symlinks before copying so we write a real file, not through a broken link
      try { if (fs.lstatSync(destPath).isSymbolicLink()) fs.rmSync(destPath, { force: true }); } catch { /* doesn't exist */ }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Copy operations
// ---------------------------------------------------------------------------

/**
 * Copy all .md files from srcDir (recursively) into destDir (flat).
 * Prunes .md files in destDir not in current source.
 */
function copyAgentsFlat(srcDir, destDir, dryRun, label) {
  const files = walkFiles(srcDir, ".md");
  const srcNames = new Set(files.map((f) => path.basename(f)));
  if (dryRun) { console.log(`[dry-run] Would copy ${files.length} agents (flat) to ${label}`); return; }
  fs.mkdirSync(destDir, { recursive: true });
  try {
    for (const e of fs.readdirSync(destDir, { withFileTypes: true })) {
      if (e.name.endsWith(".md") && !srcNames.has(e.name)) fs.rmSync(path.join(destDir, e.name), { force: true });
    }
  } catch { /* ignore */ }
  for (const f of files) {
    const dest = path.join(destDir, path.basename(f));
    try { if (fs.lstatSync(dest).isSymbolicLink()) fs.rmSync(dest, { force: true }); } catch { /* doesn't exist */ }
    fs.copyFileSync(f, dest);
  }
  console.log(`Copied ${files.length} agents to ${label}`);
}

/**
 * Copy srcDir recursively to destDir, pruning top-level subdirs no longer in source.
 */
function copyAgentsRecursive(srcDir, destDir, dryRun, label) {
  const files = walkFiles(srcDir, ".md");
  if (dryRun) { console.log(`[dry-run] Would copy ${files.length} agents (recursive) to ${label}`); return; }
  const validSubdirs = new Set();
  for (const f of files) {
    const sub = path.relative(srcDir, path.dirname(f));
    if (sub && sub !== ".") validSubdirs.add(sub.split(path.sep)[0]);
  }
  fs.mkdirSync(destDir, { recursive: true });
  try {
    for (const e of fs.readdirSync(destDir, { withFileTypes: true })) {
      if (e.isDirectory() && !validSubdirs.has(e.name)) fs.rmSync(path.join(destDir, e.name), { recursive: true, force: true });
    }
  } catch { /* ignore */ }
  copyDirRecursive(srcDir, destDir);
  console.log(`Copied ${files.length} agents to ${label}`);
}

/**
 * Copy skill directories (each containing SKILL.md) to destDir.
 * Prunes skill dirs in destDir no longer in source.
 */
function copySkills(srcDir, destDir, dryRun, label) {
  if (!fs.existsSync(srcDir)) return;
  const skillDirs = fs.readdirSync(srcDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(srcDir, e.name, "SKILL.md")))
    .map((e) => e.name);
  if (dryRun) { console.log(`[dry-run] Would copy ${skillDirs.length} skills to ${label}`); return; }
  const skillSet = new Set(skillDirs);
  fs.mkdirSync(destDir, { recursive: true });
  try {
    for (const e of fs.readdirSync(destDir, { withFileTypes: true })) {
      if (e.isDirectory() && fs.existsSync(path.join(destDir, e.name, "SKILL.md")) && !skillSet.has(e.name))
        fs.rmSync(path.join(destDir, e.name), { recursive: true, force: true });
    }
  } catch { /* ignore */ }
  for (const name of skillDirs) {
    const dest = path.join(destDir, name);
    fs.rmSync(dest, { recursive: true, force: true });
    copyDirRecursive(path.join(srcDir, name), dest);
  }
  console.log(`Copied ${skillDirs.length} skills to ${label}`);
}

/**
 * Copy .md command files from srcDir to destDir (flat).
 * Prunes .md files in destDir not in current source.
 */
function copyCommands(srcDir, destDir, dryRun, label) {
  if (!fs.existsSync(srcDir)) return;
  const files = fs.readdirSync(srcDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name);
  if (dryRun) { console.log(`[dry-run] Would copy ${files.length} commands to ${label}`); return; }
  const fileSet = new Set(files);
  fs.mkdirSync(destDir, { recursive: true });
  try {
    for (const e of fs.readdirSync(destDir, { withFileTypes: true })) {
      if (e.name.endsWith(".md") && !fileSet.has(e.name)) fs.rmSync(path.join(destDir, e.name), { force: true });
    }
  } catch { /* ignore */ }
  for (const name of files) fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name));
  console.log(`Copied ${files.length} commands to ${label}`);
}

// ---------------------------------------------------------------------------
// opencode.json
// ---------------------------------------------------------------------------

function writeOpenCodeJson(targetRoot, srcRoot, dryRun) {
  const commandsDir = path.join(srcRoot, "commands");
  const agentsDir = path.join(srcRoot, "agents");

  const commands = [];
  if (fs.existsSync(commandsDir)) {
    for (const f of walkFiles(commandsDir, ".md")) {
      const rel = path.relative(commandsDir, f).replaceAll(path.sep, "/");
      const fm = parseFrontmatter(fs.readFileSync(f, "utf8"));
      const id = fm.invocation || fm.name || path.basename(f, ".md");
      commands.push({ id: id.trim(), description: (fm.description || id).trim(), rel });
    }
  }

  const agents = [];
  if (fs.existsSync(agentsDir)) {
    for (const f of walkFiles(agentsDir, ".md")) {
      const rel = path.relative(agentsDir, f).replaceAll(path.sep, "/");
      const fm = parseFrontmatter(fs.readFileSync(f, "utf8"));
      const id = fm.name || path.basename(f, ".md");
      agents.push({ id: id.trim(), description: (fm.description || id).trim(), rel });
    }
  }

  const opencodeAbs = path.join(targetRoot, "opencode.json");
  const existing = readJsonMaybe(opencodeAbs) ?? {};
  const next = structuredClone(existing);

  next.$schema = next.$schema || "https://opencode.ai/config.json";
  next.skills = ensureObject(next.skills);
  next.skills.paths = Array.isArray(next.skills.paths) ? next.skills.paths : [];
  // Remove old package-relative paths, ensure .agents/skills is present
  next.skills.paths = next.skills.paths.filter((p) => !p.includes("compound-workflow") && !p.includes("src/.agents"));
  if (!next.skills.paths.includes(".agents/skills")) next.skills.paths.unshift(".agents/skills");

  next.command = ensureObject(next.command);
  next.agent = ensureObject(next.agent);

  for (const cmd of commands) {
    next.command[cmd.id] = {
      ...ensureObject(next.command[cmd.id]),
      description: cmd.description,
      agent: "build",
      template: `@AGENTS.md\n@.agents/commands/${cmd.rel}\nArguments: $ARGUMENTS\n`,
    };
  }

  for (const ag of agents) {
    next.agent[ag.id] = {
      ...ensureObject(next.agent[ag.id]),
      description: ag.description,
      mode: "subagent",
      prompt: `{file:.agents/agents/${ag.rel}}`,
      permission: { ...ensureObject(next.agent[ag.id]?.permission), edit: "deny" },
    };
  }

  if (dryRun) { console.log("[dry-run] Would write opencode.json"); return; }
  fs.writeFileSync(opencodeAbs, JSON.stringify(next, null, 2) + "\n", "utf8");
  console.log("Wrote: opencode.json");
}

// ---------------------------------------------------------------------------
// AGENTS.md merge
// ---------------------------------------------------------------------------

function extractRepoConfigBlock(md) {
  const match = md.match(/(### Repo Config Block[^\n]*\n)?\s*```yaml\n([\s\S]*?)```/);
  if (!match) return { block: null, rest: md };
  const block = match[2].trim();
  const rest = md.replace(match[0], "").replace(/\n{3,}/g, "\n\n").trim();
  return { block, rest };
}

function writeAgentsMd(targetRoot, packageRoot, dryRun) {
  const templatePath = path.join(packageRoot, "src", "AGENTS.md");
  const targetPath = path.join(targetRoot, "AGENTS.md");
  const templateMd = fs.readFileSync(templatePath, "utf8");
  const existingMd = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : null;

  const { block: existingBlock } = existingMd ? extractRepoConfigBlock(existingMd) : { block: null };
  const { rest: templateRest } = extractRepoConfigBlock(templateMd);

  let out = templateRest;
  if (existingBlock) {
    const repoSection = `### Repo Config Block (Optional)\n\n\`\`\`yaml\n${existingBlock}\n\`\`\`\n`;
    if (!out.includes("### Repo Config Block")) {
      out = out.replace("## Repo Configuration (Optional)", `## Repo Configuration (Optional)\n\n${repoSection}`);
    } else {
      out = out.replace(/### Repo Config Block[^\n]*\n\s*```yaml\n[\s\S]*?```/, repoSection);
    }
  }

  if (dryRun) { console.log("[dry-run] Would write AGENTS.md"); return; }
  fs.writeFileSync(targetPath, out, "utf8");
  console.log("Wrote: AGENTS.md");
}

// ---------------------------------------------------------------------------
// Standard dirs
// ---------------------------------------------------------------------------

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
    if (!fs.existsSync(abs)) {
      if (dryRun) console.log("[dry-run] Would create:", d);
      else { fs.mkdirSync(abs, { recursive: true }); console.log("Created:", d); }
    }
  }
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function usage(exitCode = 0) {
  const msg = `
Usage:
  (automatic) npm install compound-workflow   # runs install via postinstall
  (manual)    npx compound-workflow install [--root <projectDir>] [--dry-run]

Copies agents, skills, and commands into .claude/, .cursor/, and .agents/.
Also writes opencode.json, AGENTS.md, and standard docs directories.

  --root <dir>    Project directory (default: cwd)
  --dry-run       Print planned changes only
`;
  (exitCode === 0 ? console.log : console.error)(msg.trimStart());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { root: process.cwd(), dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--root") { const v = argv[++i]; if (!v) usage(1); out.root = v; }
    else if (arg === "install") { /* subcommand, ignore */ }
    else if (arg === "-h" || arg === "--help") usage(0);
    else usage(1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Harness registry — every harness receives agents + skills + commands.
// Agent layout varies because Claude Code requires flat .md files while
// Cursor and OpenCode preserve subdirectories.
// ---------------------------------------------------------------------------

const HARNESSES = [
  { name: ".claude", agentsMode: "flat" },
  { name: ".cursor", agentsMode: "recursive" },
  { name: ".agents", agentsMode: "recursive" },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv);
  const targetRoot = realpathSafe(args.root);
  const isSelfInstall = targetRoot === PACKAGE_ROOT;

  const packageSrc = isSelfInstall
    ? path.join(PACKAGE_ROOT, "src")
    : path.join(targetRoot, "node_modules", "compound-workflow", "src");

  if (!isSelfInstall && !fs.existsSync(packageSrc) && !args.dryRun) {
    console.error("Error: compound-workflow not found in project. Run: npm install compound-workflow");
    process.exit(2);
  }

  const srcAgents = path.join(packageSrc, "agents");
  const srcSkills = path.join(packageSrc, "skills");
  const srcCommands = path.join(packageSrc, "commands");

  console.log("Target:", targetRoot);
  console.log("Package:", PACKAGE_ROOT);
  console.log("OpenCode CLI:", hasCommand("opencode") ? "yes" : "no");

  for (const h of HARNESSES) {
    const agentsDest = path.join(targetRoot, h.name, "agents");
    const skillsDest = path.join(targetRoot, h.name, "skills");
    const commandsDest = path.join(targetRoot, h.name, "commands");

    const copyAgents = h.agentsMode === "flat" ? copyAgentsFlat : copyAgentsRecursive;
    copyAgents(srcAgents, agentsDest, args.dryRun, `${h.name}/agents/`);
    copySkills(srcSkills, skillsDest, args.dryRun, `${h.name}/skills/`);
    copyCommands(srcCommands, commandsDest, args.dryRun, `${h.name}/commands/`);
  }

  writeOpenCodeJson(targetRoot, packageSrc, args.dryRun);
  writeAgentsMd(targetRoot, PACKAGE_ROOT, args.dryRun);
  ensureDirs(targetRoot, args.dryRun);

  console.log("\nDone.");
}

main();
