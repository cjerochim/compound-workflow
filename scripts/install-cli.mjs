#!/usr/bin/env node
/**
 * compound-workflow install
 * Native-only install: writes opencode.json from package metadata,
 * merges AGENTS.md, and ensures standard docs/todo directories.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage(exitCode = 0) {
  const msg = `
Usage:
  npx compound-workflow install [--root <projectDir>] [--dry-run] [--no-config]

Native-only install: writes opencode.json (loads from package), merges AGENTS.md,
creates standard docs/todos directories, and prompts for Repo Config Block
(unless --no-config).

  --root <dir>  Project directory (default: cwd)
  --dry-run     Print planned changes only
  --no-config   Skip Repo Config Block reminder
`;
  (exitCode === 0 ? console.log : console.error)(msg.trimStart());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { root: process.cwd(), dryRun: false, noConfig: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--no-config") out.noConfig = true;
    else if (arg === "--root") {
      const value = argv[i + 1];
      if (!value) usage(1);
      out.root = value;
      i++;
    } else if (arg === "install") {
      continue;
    } else if (arg === "-h" || arg === "--help") usage(0);
    else usage(1);
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

function hasCommand(cmd) {
  const checker = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(checker, [cmd], { stdio: "ignore" });
  return result.status === 0;
}

function stripJsonc(input) {
  let out = "";
  let i = 0;
  let inStr = false;
  let strQuote = "";
  let escape = false;

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

function ensureObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

const PACKAGE_ROOT = realpathSafe(path.join(__dirname, ".."));
const PACKAGE_AGENTS_ROOT = path.join(PACKAGE_ROOT, "src", ".agents");
const GENERATED_MANIFEST_PATH = path.join(PACKAGE_ROOT, "src", "generated", "opencode.managed.json");

function readGeneratedManifest() {
  if (!fs.existsSync(GENERATED_MANIFEST_PATH)) {
    throw new Error(
      `Missing generated OpenCode manifest at ${GENERATED_MANIFEST_PATH}. Run: npm run generate:artifacts`
    );
  }
  const manifest = JSON.parse(fs.readFileSync(GENERATED_MANIFEST_PATH, "utf8"));
  if (!manifest?.commandRoot || !manifest?.agentRoot || !manifest?.skillsPath) {
    throw new Error("Invalid generated OpenCode manifest: missing root path fields.");
  }
  if (!Array.isArray(manifest?.commands) || !Array.isArray(manifest?.agents)) {
    throw new Error("Invalid generated OpenCode manifest: commands/agents must be arrays.");
  }
  return manifest;
}

const GENERATED_MANIFEST = readGeneratedManifest();
const PACKAGE_COMMAND_ROOT = GENERATED_MANIFEST.commandRoot;
const PACKAGE_AGENT_ROOT = GENERATED_MANIFEST.agentRoot;
const PACKAGE_SKILL_ROOT = GENERATED_MANIFEST.skillsPath;

const LEGACY_MANAGED_COMMAND_ROOTS = [
  ".agents/compound-workflow/commands",
  PACKAGE_COMMAND_ROOT,
];
const LEGACY_MANAGED_AGENT_ROOTS = [
  ".agents/compound-workflow/agents",
  PACKAGE_AGENT_ROOT,
];

function managedCommandPath(entry) {
  const template = entry?.template;
  if (typeof template !== "string") return null;
  const match = template.match(/@([^\n\r]+)\nArguments: \$ARGUMENTS\n?$/m);
  if (!match) return null;
  return match[1].trim();
}

function managedAgentPath(entry) {
  const prompt = entry?.prompt;
  if (typeof prompt !== "string") return null;
  const match = prompt.match(/^\{file:([^}]+)\}$/);
  return match ? match[1].trim() : null;
}

function isManagedCommandPath(commandPath) {
  return LEGACY_MANAGED_COMMAND_ROOTS.some((root) => commandPath.startsWith(`${root}/`));
}

function isManagedAgentPath(agentPath) {
  return LEGACY_MANAGED_AGENT_ROOTS.some((root) => agentPath.startsWith(`${root}/`));
}

function writeOpenCodeJson(targetRoot, dryRun) {
  const opencodeAbs = path.join(targetRoot, "opencode.json");
  const existing = readJsonMaybe(opencodeAbs) ?? {};
  const next = structuredClone(existing);

  next.$schema = next.$schema || "https://opencode.ai/config.json";
  next.skills = ensureObject(next.skills);
  next.skills.paths = Array.isArray(next.skills.paths) ? next.skills.paths : [];

  // Full cutover: remove old symlink-based managed path and use direct package skills path.
  next.skills.paths = next.skills.paths.filter((p) => p !== ".agents/compound-workflow-skills");
  if (!next.skills.paths.includes(PACKAGE_SKILL_ROOT)) {
    next.skills.paths.unshift(PACKAGE_SKILL_ROOT);
  }

  next.command = ensureObject(next.command);
  next.agent = ensureObject(next.agent);

  const commands = GENERATED_MANIFEST.commands;
  const agents = GENERATED_MANIFEST.agents;

  // Upsert managed commands.
  for (const command of commands) {
    next.command[command.id] = {
      ...ensureObject(next.command[command.id]),
      description: command.description,
      agent: "build",
      template: `@AGENTS.md\n@${PACKAGE_COMMAND_ROOT}/${command.rel}\nArguments: $ARGUMENTS\n`,
    };
  }

  // Remove stale managed commands.
  const managedCommandTargets = new Set(
    commands.map((command) => `${PACKAGE_COMMAND_ROOT}/${command.rel}`)
  );
  for (const [id, entry] of Object.entries(next.command)) {
    const commandPath = managedCommandPath(entry);
    if (!commandPath || !isManagedCommandPath(commandPath)) continue;
    if (!managedCommandTargets.has(commandPath)) delete next.command[id];
  }

  // Upsert managed agents.
  for (const agent of agents) {
    next.agent[agent.id] = {
      ...ensureObject(next.agent[agent.id]),
      description: agent.description,
      mode: "subagent",
      prompt: `{file:${PACKAGE_AGENT_ROOT}/${agent.rel}}`,
      permission: { ...ensureObject(next.agent[agent.id]?.permission), edit: "deny" },
    };
  }

  // Remove stale managed agents.
  const managedAgentTargets = new Set(
    agents.map((agent) => `${PACKAGE_AGENT_ROOT}/${agent.rel}`)
  );
  for (const [id, entry] of Object.entries(next.agent)) {
    const agentPath = managedAgentPath(entry);
    if (!agentPath || !isManagedAgentPath(agentPath)) continue;
    if (!managedAgentTargets.has(agentPath)) delete next.agent[id];
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
  const { block: existingBlock } = existingMd
    ? extractRepoConfigBlock(existingMd)
    : { block: null };
  const { rest: templateRest } = extractRepoConfigBlock(templateMd);

  let out = templateRest;
  if (existingBlock) {
    const repoSection = `### Repo Config Block (Optional)\n\n\`\`\`yaml\n${existingBlock}\n\`\`\`\n`;

    if (!out.includes("### Repo Config Block")) {
      out = out.replace(
        "## Repo Configuration (Optional)",
        `## Repo Configuration (Optional)\n\n${repoSection}`
      );
    } else {
      out = out.replace(/### Repo Config Block[^\n]*\n\s*```yaml\n[\s\S]*?```/, repoSection);
    }
  }

  return out;
}

function writeAgentsMd(targetRoot, dryRun) {
  const templatePath = path.join(PACKAGE_ROOT, "src", "AGENTS.md");
  const targetPath = path.join(targetRoot, "AGENTS.md");
  const templateMd = fs.readFileSync(templatePath, "utf8");
  const existingMd = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : null;
  const merged = mergeAgentsMd(templateMd, existingMd);

  if (dryRun) {
    console.log("[dry-run] Would write AGENTS.md:", targetPath);
    return;
  }

  fs.writeFileSync(targetPath, merged, "utf8");
  console.log("Wrote:", targetPath);
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
    if (dryRun && !fs.existsSync(abs)) {
      console.log("[dry-run] Would create:", d);
    } else if (!fs.existsSync(abs)) {
      fs.mkdirSync(abs, { recursive: true });
      console.log("Created:", d);
    }
  }
}

function reportOpenCodeIntegration(targetRoot, dryRun) {
  if (dryRun) {
    console.log("[dry-run] OpenCode integration check skipped.");
    return;
  }

  const opencodeAbs = path.join(targetRoot, "opencode.json");
  const opencode = readJsonMaybe(opencodeAbs) ?? {};
  const skillPaths = Array.isArray(opencode?.skills?.paths) ? opencode.skills.paths : [];
  const hasSkillPath = skillPaths.includes(PACKAGE_SKILL_ROOT);

  console.log(
    "OpenCode integration:",
    hasSkillPath ? "ok" : "incomplete",
    `(skills.path=${hasSkillPath ? "yes" : "no"})`
  );
}

function main() {
  const args = parseArgs(process.argv);
  const targetRoot = realpathSafe(args.root);

  if (!fs.existsSync(PACKAGE_AGENTS_ROOT)) {
    console.error("Error: package agents dir not found:", PACKAGE_AGENTS_ROOT);
    process.exit(2);
  }

  const pkgInTarget = path.join(targetRoot, "node_modules", "compound-workflow");
  if (!fs.existsSync(pkgInTarget) && !args.dryRun) {
    console.error("Error: compound-workflow not found in project. Run: npm install compound-workflow");
    process.exit(2);
  }

  console.log("Target root:", targetRoot);
  console.log("Package root:", PACKAGE_ROOT);
  console.log("OpenCode CLI detected:", hasCommand("opencode") ? "yes" : "no");

  writeOpenCodeJson(targetRoot, args.dryRun);
  reportOpenCodeIntegration(targetRoot, args.dryRun);
  writeAgentsMd(targetRoot, args.dryRun);
  ensureDirs(targetRoot, args.dryRun);

  if (!args.noConfig && !args.dryRun && process.stdin.isTTY) {
    console.log("\nRepo Config: edit AGENTS.md to set default_branch, test_command, lint_command, dev_server_url.");
  }

  console.log("\nDone. Run opencode debug config to verify.");
}

main();
