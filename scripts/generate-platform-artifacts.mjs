#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const agentsRoot = path.join(repoRoot, "src", ".agents");

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

function discoverCommands() {
  const commandsDir = path.join(agentsRoot, "commands");
  const files = walkFiles(commandsDir, (p) => p.endsWith(".md"));
  const commands = [];

  for (const fileAbs of files) {
    const relWithin = path.relative(commandsDir, fileAbs).replaceAll(path.sep, "/");
    const frontmatter = parseFrontmatter(fs.readFileSync(fileAbs, "utf8"));
    const id = (frontmatter.invocation || frontmatter.name || path.basename(fileAbs, ".md")).trim();
    if (!id) continue;
    commands.push({
      id,
      description: (frontmatter.description || id).trim(),
      rel: relWithin,
    });
  }

  return commands.sort((a, b) => a.id.localeCompare(b.id));
}

function discoverAgents() {
  const agentDir = path.join(agentsRoot, "agents");
  const files = walkFiles(agentDir, (p) => p.endsWith(".md"));
  const agents = [];

  for (const fileAbs of files) {
    const relWithin = path.relative(agentDir, fileAbs).replaceAll(path.sep, "/");
    const frontmatter = parseFrontmatter(fs.readFileSync(fileAbs, "utf8"));
    const id = (frontmatter.name || path.basename(fileAbs, ".md")).trim();
    if (!id) continue;
    agents.push({
      id,
      description: (frontmatter.description || id).trim(),
      rel: relWithin,
    });
  }

  return agents.sort((a, b) => a.id.localeCompare(b.id));
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

  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const repositoryUrl = normalizeRepoUrl(pkg.repository);
  const commands = discoverCommands();
  const agents = discoverAgents();
  const changed = [];

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
    commands: "src/.agents/commands",
    agents: "src/.agents/agents",
    skills: "src/.agents/skills",
  };

  const openCodeManaged = {
    $schema: "https://opencode.ai/config.json",
    skillsPath: "node_modules/compound-workflow/src/.agents/skills",
    commandRoot: "node_modules/compound-workflow/src/.agents/commands",
    agentRoot: "node_modules/compound-workflow/src/.agents/agents",
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
