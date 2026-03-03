#!/usr/bin/env node
/**
 * compound-workflow install
 * One action: opencode.json (load from package) + AGENTS.md merge + dirs + Repo Config Block.
 * Run from project: npx compound-workflow install [all|--all] [--root <dir>] [--dry-run] [--no-config]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage(exitCode = 0) {
  const msg = `
Usage:
  npx compound-workflow install [all|--all] [--root <projectDir>] [--dry-run] [--no-config]

One action: writes opencode.json (loads from package), merges AGENTS.md, creates dirs,
and prompts for Repo Config Block (unless --no-config).

  all, --all    Kept for compatibility
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
    else if (a === "--cursor") {
      // Deprecated compatibility alias; install now auto-detects .cursor.
    }
    else if (a === "--all" || a === "all") {
      // Deprecated compatibility alias; install now auto-detects .cursor.
    }
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
const LOCAL_RUNTIME_ROOT = ".agents/compound-workflow";
const LOCAL_COMMANDS_ROOT = `${LOCAL_RUNTIME_ROOT}/commands`;
const LOCAL_AGENTS_ROOT = `${LOCAL_RUNTIME_ROOT}/agents`;
const LOCAL_REFERENCES_ROOT = `${LOCAL_RUNTIME_ROOT}/references`;

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
    const relWithinCommands = path.relative(commandsDir, fileAbs).replaceAll(path.sep, "/");
    const md = fs.readFileSync(fileAbs, "utf8");
    const fm = parseFrontmatter(md);
    const id = (fm.invocation || fm.name || path.basename(fileAbs, ".md")).trim();
    const description = (fm.description || id).trim();
    if (!id) continue;
    const localRel = `${LOCAL_COMMANDS_ROOT}/${relWithinCommands}`;
    map.set(id, { id, rel: localRel, description });
  }
  return map;
}

function discoverAgents(agentsRoot) {
  const agentsDir = path.join(agentsRoot, "agents");
  const files = walkFiles(agentsDir, (p) => p.endsWith(".md"));
  const map = new Map();
  for (const fileAbs of files) {
    const relWithinAgents = path.relative(agentsDir, fileAbs).replaceAll(path.sep, "/");
    const md = fs.readFileSync(fileAbs, "utf8");
    const fm = parseFrontmatter(md);
    const id = (fm.name || path.basename(fileAbs, ".md")).trim();
    const description = (fm.description || id).trim();
    if (!id) continue;
    const localRel = `${LOCAL_AGENTS_ROOT}/${relWithinAgents}`;
    map.set(id, { id, rel: localRel, description });
  }
  return map;
}

function copyDirContents(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) return;
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(sourceDir, entry.name);
    const dst = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirContents(src, dst);
      continue;
    }
    if (entry.isFile()) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
    if (entry.isSymbolicLink()) {
      const real = realpathSafe(src);
      const realStat = fs.statSync(real);
      if (realStat.isDirectory()) {
        copyDirContents(real, dst);
      } else if (realStat.isFile()) {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(real, dst);
      }
    }
  }
}

function syncRuntimeAssets(targetRoot, dryRun) {
  const mappings = [
    { label: "commands", src: path.join(packageAgents, "commands"), dst: path.join(targetRoot, LOCAL_COMMANDS_ROOT) },
    { label: "agents", src: path.join(packageAgents, "agents"), dst: path.join(targetRoot, LOCAL_AGENTS_ROOT) },
    { label: "references", src: path.join(packageAgents, "references"), dst: path.join(targetRoot, LOCAL_REFERENCES_ROOT) },
  ];

  for (const mapping of mappings) {
    if (!fs.existsSync(mapping.src)) continue;
    if (dryRun) {
      console.log("[dry-run] Would sync", mapping.label, "to", path.relative(targetRoot, mapping.dst));
      continue;
    }
    fs.rmSync(mapping.dst, { recursive: true, force: true });
    copyDirContents(mapping.src, mapping.dst);
    console.log("Synced", mapping.label + ":", path.relative(targetRoot, mapping.dst));
  }
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

function hasCommand(cmd) {
  const checker = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(checker, [cmd], { stdio: "ignore" });
  return result.status === 0;
}

const SKILLS_SYMLINK_PATH = ".agents/compound-workflow-skills";

function symlinkPointsTo(linkPath, expectedTargetAbs) {
  try {
    const stat = fs.lstatSync(linkPath);
    if (!stat.isSymbolicLink()) return false;
    const rawTarget = fs.readlinkSync(linkPath);
    const linkTargetAbs = path.resolve(path.dirname(linkPath), rawTarget);
    return realpathSafe(linkTargetAbs) === realpathSafe(expectedTargetAbs);
  } catch {
    return false;
  }
}

function removePathIfExists(linkPath) {
  try {
    fs.rmSync(linkPath, { recursive: true, force: true });
  } catch {}
}

function ensureSkillsSymlink(targetRoot, dryRun) {
  const agentsDir = path.join(targetRoot, ".agents");
  const linkPath = path.join(agentsDir, "compound-workflow-skills");
  const targetRel = path.join("..", "node_modules", "compound-workflow", "src", ".agents", "skills");
  const targetAbs = path.resolve(path.dirname(linkPath), targetRel);

  if (dryRun) {
    console.log("[dry-run] Would create", SKILLS_SYMLINK_PATH, "symlink");
    return;
  }

  if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });

  let needCreate = true;
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink() && symlinkPointsTo(linkPath, targetAbs)) needCreate = false;
    else if (!stat.isSymbolicLink()) {
      console.warn("Skipped", SKILLS_SYMLINK_PATH, "because it exists and is not a symlink");
      return;
    }
  } catch (_) {}

  if (needCreate) {
    removePathIfExists(linkPath);
    const type = process.platform === "win32" ? "dir" : "dir";
    fs.symlinkSync(targetRel, linkPath, type);
    console.log("Created", SKILLS_SYMLINK_PATH, "-> package skills");
  }
}

function ensureCursorDirSync(targetRoot, cursorSubdir, pkgSubdir, dryRun, label, cursorReady) {
  const cursorDir = path.join(targetRoot, ".cursor");
  if (!cursorReady) return { status: "skipped-missing-cursor" };
  const pkgPath = path.join(packageRoot, "src", ".agents", pkgSubdir);
  if (!fs.existsSync(pkgPath)) return { status: "skipped-missing-package-path" };

  const targetPath = path.join(cursorDir, cursorSubdir);
  if (dryRun) {
    console.log("[dry-run] Would sync .cursor/" + cursorSubdir, "from", label || pkgSubdir, "(Cursor)");
    return { status: "dry-run" };
  }

  if (fs.existsSync(targetPath)) {
    const stat = fs.lstatSync(targetPath);
    if (!stat.isDirectory()) {
      return { status: "blocked-nondirectory", path: targetPath };
    }
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
  copyDirContents(pkgPath, targetPath);
  console.log("Synced", ".cursor/" + cursorSubdir, "from", label || pkgSubdir, "(Cursor)");
  return { status: "synced" };
}

function ensureCursorSkills(targetRoot, dryRun, cursorReady) {
  const cursorDir = path.join(targetRoot, ".cursor");
  if (!cursorReady) return { blocked: [] };

  const packageSkillsDir = path.join(packageRoot, "src", ".agents", "skills");
  if (!fs.existsSync(packageSkillsDir)) return { blocked: [] };
  const skillsDir = path.join(cursorDir, "skills");
  if (dryRun) {
    console.log("[dry-run] Would sync .cursor/skills from package skills (Cursor)");
    return { blocked: [] };
  }

  if (fs.existsSync(skillsDir)) {
    const stat = fs.lstatSync(skillsDir);
    if (!stat.isDirectory()) {
      console.warn("Skipped .cursor/skills because it exists and is not a directory");
      return { blocked: [skillsDir] };
    }
  }

  fs.rmSync(skillsDir, { recursive: true, force: true });
  copyDirContents(packageSkillsDir, skillsDir);
  console.log("Synced .cursor/skills from package skills (Cursor)");
  return { blocked: [] };
}

function hasCursorPluginCommands(targetRoot) {
  const pluginPath = path.join(targetRoot, ".cursor-plugin", "plugin.json");
  if (!fs.existsSync(pluginPath)) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(pluginPath, "utf8"));
    return typeof parsed?.commands === "string" && parsed.commands.trim().length > 0;
  } catch {
    return false;
  }
}

function verifyCursorIntegration(targetRoot, options = {}) {
  const cursorDir = path.join(targetRoot, ".cursor");
  if (!fs.existsSync(cursorDir)) return [];
  const skipCommands = options.skipCommands === true;

  const checks = [
    { name: ".cursor/agents", rel: path.join("agents") },
    { name: ".cursor/references", rel: path.join("references") },
  ];
  if (!skipCommands) checks.splice(1, 0, { name: ".cursor/commands", rel: path.join("commands") });
  const issues = [];

  for (const check of checks) {
    const dirPath = path.join(cursorDir, check.rel);
    if (!fs.existsSync(dirPath)) issues.push(`${check.name} is missing`);
    else {
      const stat = fs.lstatSync(dirPath);
      if (!stat.isDirectory()) {
        issues.push(`${check.name} exists but is not a directory`);
      }
    }
  }

  const packageSkillsDir = path.join(packageRoot, "src", ".agents", "skills");
  if (fs.existsSync(packageSkillsDir)) {
    const missingSkills = [];
    for (const name of fs.readdirSync(packageSkillsDir)) {
      const skillPath = path.join(packageSkillsDir, name);
      if (!fs.statSync(skillPath).isDirectory()) continue;
      if (!fs.existsSync(path.join(skillPath, "SKILL.md"))) continue;
      const cursorSkill = path.join(cursorDir, "skills", name, "SKILL.md");
      if (!fs.existsSync(cursorSkill)) missingSkills.push(name);
    }
    if (missingSkills.length) {
      issues.push(
        `.cursor/skills is missing ${missingSkills.length} package skill(s), e.g. ${missingSkills[0]}`
      );
    }
  }

  const packageRoots = [
    { label: "agents", pkgDir: path.join(packageRoot, "src", ".agents", "agents"), cursorSubdir: "agents" },
    { label: "references", pkgDir: path.join(packageRoot, "src", ".agents", "references"), cursorSubdir: "references" },
  ];
  if (!skipCommands) {
    packageRoots.unshift({
      label: "commands",
      pkgDir: path.join(packageRoot, "src", ".agents", "commands"),
      cursorSubdir: "commands",
    });
  }
  for (const item of packageRoots) {
    if (!fs.existsSync(item.pkgDir)) continue;
    const pkgFiles = walkFiles(item.pkgDir, () => true);
    let missingCount = 0;
    let firstMissing = null;
    for (const abs of pkgFiles) {
      const rel = path.relative(item.pkgDir, abs);
      const targetFile = path.join(cursorDir, item.cursorSubdir, rel);
      if (!fs.existsSync(targetFile)) {
        missingCount++;
        if (!firstMissing) firstMissing = rel;
      }
    }
    if (missingCount) {
      issues.push(`.cursor/${item.label} is missing ${missingCount} package file(s), e.g. ${firstMissing}`);
    }
  }
  return issues;
}

function ensureCursorIntegration(targetRoot, dryRun, forceCursor) {
  const cursorDir = path.join(targetRoot, ".cursor");
  let cursorReady = fs.existsSync(cursorDir);
  const skipCommands = hasCursorPluginCommands(targetRoot);
  if (!fs.existsSync(cursorDir)) {
    if (!forceCursor) return { issues: [], status: "skipped-no-cursor" };
    if (dryRun) console.log("[dry-run] Would create .cursor directory (Cursor)");
    else {
      fs.mkdirSync(cursorDir, { recursive: true });
      cursorReady = true;
    }
    if (dryRun) cursorReady = true;
  }

  const skillReport = ensureCursorSkills(targetRoot, dryRun, cursorReady);
  const dirReports = [
    ensureCursorDirSync(targetRoot, "agents", "agents", dryRun, "package agents", cursorReady),
    ensureCursorDirSync(targetRoot, "references", "references", dryRun, "package references", cursorReady),
  ];
  if (!skipCommands) {
    dirReports.splice(1, 0, ensureCursorDirSync(targetRoot, "commands", "commands", dryRun, "package commands", cursorReady));
  }

  const issues = [];
  if (skillReport?.blocked?.length) {
    for (const p of skillReport.blocked) issues.push(`${path.relative(targetRoot, p)} blocks symlink creation (not a symlink)`);
  }
  for (const report of dirReports) {
    if (report?.status === "blocked-nondirectory") {
      issues.push(`${path.relative(targetRoot, report.path)} blocks sync (not a directory)`);
    }
  }

  if (!dryRun) {
    for (const issue of verifyCursorIntegration(targetRoot, { skipCommands })) issues.push(issue);
  }
  return { issues, status: "configured", skipCommands };
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

function reportOpenCodeIntegration(targetRoot, dryRun) {
  const opencodeAbs = path.join(targetRoot, "opencode.json");
  const skillsLinkAbs = path.join(targetRoot, SKILLS_SYMLINK_PATH);

  if (dryRun) {
    console.log("[dry-run] OpenCode integration check skipped.");
    return;
  }

  const opencode = readJsonMaybe(opencodeAbs) ?? {};
  const skillPaths = Array.isArray(opencode?.skills?.paths) ? opencode.skills.paths : [];
  const hasSkillsPath = skillPaths.includes(SKILLS_SYMLINK_PATH);
  const hasSkillsLink = fs.existsSync(skillsLinkAbs);

  console.log(
    "OpenCode integration:",
    hasSkillsPath && hasSkillsLink ? "ok" : "incomplete",
    `(skills.path=${hasSkillsPath ? "yes" : "no"}, symlink=${hasSkillsLink ? "yes" : "no"})`
  );
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
  console.log("OpenCode CLI detected:", hasCommand("opencode") ? "yes" : "no");

  syncRuntimeAssets(targetRoot, args.dryRun);
  writeOpenCodeJson(targetRoot, args.dryRun);
  ensureSkillsSymlink(targetRoot, args.dryRun);
  reportOpenCodeIntegration(targetRoot, args.dryRun);
  const cursorExists = fs.existsSync(path.join(targetRoot, ".cursor"));
  const cursorReport = ensureCursorIntegration(targetRoot, args.dryRun, cursorExists);
  if (cursorReport.status === "skipped-no-cursor") {
    console.log("Cursor integration: skipped (.cursor not found).");
  } else {
    if (cursorReport.skipCommands) {
      console.log("Cursor integration: verified skills, agents, references (commands supplied by .cursor-plugin).");
    } else {
      console.log("Cursor integration: verified skills, agents, commands, and references.");
    }
  }
  writeAgentsMd(targetRoot, args.dryRun);
  ensureDirs(targetRoot, args.dryRun);

  if (cursorReport.issues.length) {
    console.error("\nCursor integration drift detected:");
    for (const issue of cursorReport.issues) console.error("-", issue);
    if (!args.dryRun) {
      console.error("Fix blockers (or remove conflicting paths) and rerun install.");
      process.exit(2);
    }
  }

  if (!args.noConfig && !args.dryRun && process.stdin.isTTY) {
    console.log("\nRepo Config: edit AGENTS.md to set default_branch, test_command, lint_command, dev_server_url.");
  }

  console.log("\nDone. Run opencode debug config to verify.");
}

main();
