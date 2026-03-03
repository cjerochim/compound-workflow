#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const agentsRoot = path.join(repoRoot, "src", ".agents");

function loadRegistry() {
  const registryPath = path.join(agentsRoot, "registry.json");
  if (!fs.existsSync(registryPath)) {
    throw new Error(`Registry not found at ${registryPath}`);
  }
  return JSON.parse(fs.readFileSync(registryPath, "utf8"));
}

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
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)\s*$/);
    if (!match) continue;
    out[match[1]] = (match[2] ?? "").replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
  return out;
}

/**
 * Resolve id from frontmatter and config. idFrom = list of frontmatter keys; idFallback = "basename" | "dirname".
 */
function resolveId(frontmatter, fileAbs, dirAbs, config) {
  for (const key of config.idFrom || []) {
    if (key === "dirname") {
      const relDir = path.relative(dirAbs, path.dirname(fileAbs));
      return (relDir ? relDir.replaceAll(path.sep, "/") : path.basename(path.dirname(fileAbs))).trim();
    }
    const v = frontmatter[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  if (config.idFallback === "basename") return path.basename(fileAbs, ".md").trim();
  if (config.idFallback === "dirname") return path.basename(path.dirname(fileAbs)).trim();
  return path.basename(fileAbs, ".md").trim();
}

function resolveDescription(frontmatter, config, id) {
  const key = config.descriptionFrom;
  if (key && frontmatter[key] != null) return String(frontmatter[key]).trim();
  if (config.descriptionFallback === "id") return id || "";
  return id || "";
}

/**
 * Discover assets of one type from registry config. Returns array of { id, description, rel }.
 */
function discoverByType(agentsRootAbs, typeKey, config) {
  const dirAbs = path.join(agentsRootAbs, config.dir);
  if (!fs.existsSync(dirAbs)) return [];

  let files = [];
  if (config.glob === "**/*.md") {
    files = walkFiles(dirAbs, (p) => p.endsWith(".md"));
  } else if (config.glob === "*/SKILL.md") {
    const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const skillMd = path.join(dirAbs, e.name, "SKILL.md");
        if (fs.existsSync(skillMd)) files.push(skillMd);
      }
    }
    files.sort();
  } else {
    files = walkFiles(dirAbs, (p) => p.endsWith(".md"));
  }

  const out = [];
  for (const fileAbs of files) {
    const rel = path.relative(dirAbs, fileAbs).replaceAll(path.sep, "/");
    const raw = fs.readFileSync(fileAbs, "utf8");
    const frontmatter = parseFrontmatter(raw);
    const id = resolveId(frontmatter, fileAbs, dirAbs, config);
    if (!id) continue;
    const description = resolveDescription(frontmatter, config, id);
    out.push({ id, description, rel });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeRepoUrl(repoValue) {
  const raw = typeof repoValue === "string" ? repoValue : repoValue?.url;
  if (typeof raw !== "string" || raw.trim().length === 0) return "";
  return raw.replace(/^git\+/, "").replace(/\.git$/, "");
}

function writeJson(absPath, value, checkOnly, changed) {
  const next = JSON.stringify(value, null, 2) + "\n";
  let prev = null;
  if (fs.existsSync(absPath)) prev = fs.readFileSync(absPath, "utf8");

  if (prev !== next) {
    changed.push(absPath);
    if (!checkOnly) {
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, next, "utf8");
      console.log("Wrote:", path.relative(repoRoot, absPath));
    }
  }
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const registry = loadRegistry();
  const roots = registry.roots?.consumer || {};
  const assetTypes = registry.assetTypes || {};

  const commands =
    assetTypes.command != null
      ? discoverByType(agentsRoot, "command", assetTypes.command)
      : [];
  const agents =
    assetTypes.agent != null ? discoverByType(agentsRoot, "agent", assetTypes.agent) : [];

  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const repositoryUrl = normalizeRepoUrl(pkg.repository);
  const changed = [];

  const commandRoot = roots.commands || "node_modules/compound-workflow/src/.agents/commands";
  const agentRoot = roots.agents || "node_modules/compound-workflow/src/.agents/agents";
  const skillsPath = roots.skills || "node_modules/compound-workflow/src/.agents/skills";

  const claudePlugin = {
    name: pkg.name,
    version: pkg.version,
    description: "Clarify -> plan -> execute -> verify -> capture workflow: commands, skills, and agents for Claude Code",
    author: { name: "Compound Workflow" },
    keywords: ["workflow", "planning", "agents", "skills", "commands", "claude"],
    license: pkg.license,
    repository: repositoryUrl,
    commands: "./src/.agents/commands",
    agents: "./src/.agents/agents",
    skills: "./src/.agents/skills",
  };

  const cursorPlugin = {
    name: pkg.name,
    version: pkg.version,
    description: "Clarify -> plan -> execute -> verify -> capture workflow for Cursor",
    author: { name: "Compound Workflow" },
    keywords: ["workflow", "cursor", "agents", "commands", "skills"],
    license: pkg.license,
    repository: repositoryUrl,
    commands: "./src/.agents/commands",
    agents: "./src/.agents/agents",
    skills: "./src/.agents/skills",
  };

  const openCodeManaged = {
    $schema: "https://opencode.ai/config.json",
    skillsPath,
    commandRoot,
    agentRoot,
    commands,
    agents,
  };

  writeJson(path.join(repoRoot, ".claude-plugin", "plugin.json"), claudePlugin, checkOnly, changed);
  writeJson(path.join(repoRoot, ".cursor-plugin", "plugin.json"), cursorPlugin, checkOnly, changed);
  writeJson(path.join(repoRoot, "src", "generated", "opencode.managed.json"), openCodeManaged, checkOnly, changed);

  if (checkOnly && changed.length) {
    console.error("Generated artifacts are stale:");
    for (const abs of changed) console.error("-", path.relative(repoRoot, abs));
    process.exit(1);
  }

  if (!changed.length) {
    console.log(checkOnly ? "Generated artifacts are up-to-date." : "No artifact updates required.");
  }
}

main();
