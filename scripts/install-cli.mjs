#!/usr/bin/env node
/**
 * compound-workflow install
 *
 * Native-only install: writes opencode.json from package metadata,
 * merges AGENTS.md, and ensures standard docs/todo directories.
 *
 * DECLARATIVE SOURCE OF TRUTH (no manual wiring):
 * - Commands: add/remove .md under src/.agents/commands/ (frontmatter: invocation, name, description).
 *   Registry (src/.agents/registry.json) + generate-platform-artifacts → opencode.managed.json → install.
 * - Agents: add/remove .md under src/.agents/agents/ (frontmatter: name, description). Same pipeline.
 * - Skills: add/remove dir src/.agents/skills/<name>/SKILL.md. OpenCode uses skills path; install syncs
 *   each skill into .cursor/skills/ (symlinks) so Cursor discovers them. Prune removes stale symlinks.
 * Run install (or npm install compound-workflow) after any change; no other registration needed.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage(exitCode = 0) {
  const msg = `
Usage:
  (automatic) npm install compound-workflow   # runs install via postinstall; no npx needed
  (manual)    npx compound-workflow install [--root <projectDir>] [--dry-run] [--no-config] [--no-register-cursor] [--register-cursor]

Install writes opencode.json (from package), merges AGENTS.md, creates standard
docs/todos directories, and prompts for Repo Config Block (unless --no-config).
When Cursor is detected (~/.cursor), registers the plugin so skills/commands appear.

  --root <dir>            Project directory (default: cwd)
  --dry-run               Print planned changes only
  --no-config             Skip Repo Config Block reminder
  --no-register-cursor    Do not register plugin with Cursor (skip apply to ~/.claude/)
  --register-cursor       Force registration with Cursor even if ~/.cursor not found
`;
  (exitCode === 0 ? console.log : console.error)(msg.trimStart());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { root: process.cwd(), dryRun: false, noConfig: false, noRegisterCursor: false, registerCursor: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--no-config") out.noConfig = true;
    else if (arg === "--no-register-cursor") out.noRegisterCursor = true;
    else if (arg === "--register-cursor") out.registerCursor = true;
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

let GENERATED_MANIFEST;
let PACKAGE_COMMAND_ROOT;
let PACKAGE_AGENT_ROOT;
let PACKAGE_SKILL_ROOT;

function getLegacyCommandRoots() {
  return [".agents/compound-workflow/commands", PACKAGE_COMMAND_ROOT, "src/.agents/commands"];
}
function getLegacyAgentRoots() {
  return [".agents/compound-workflow/agents", PACKAGE_AGENT_ROOT, "src/.agents/agents"];
}

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
  return getLegacyCommandRoots().some((root) => commandPath.startsWith(`${root}/`));
}

function isManagedAgentPath(agentPath) {
  return getLegacyAgentRoots().some((root) => agentPath.startsWith(`${root}/`));
}

function writeOpenCodeJson(targetRoot, dryRun, isSelfInstall) {
  const commandRoot = isSelfInstall ? "src/.agents/commands" : PACKAGE_COMMAND_ROOT;
  const agentRoot = isSelfInstall ? "src/.agents/agents" : PACKAGE_AGENT_ROOT;
  const skillRoot = isSelfInstall ? "src/.agents/skills" : PACKAGE_SKILL_ROOT;

  const opencodeAbs = path.join(targetRoot, "opencode.json");
  const existing = readJsonMaybe(opencodeAbs) ?? {};
  const next = structuredClone(existing);

  next.$schema = next.$schema || "https://opencode.ai/config.json";
  next.skills = ensureObject(next.skills);
  next.skills.paths = Array.isArray(next.skills.paths) ? next.skills.paths : [];

  next.skills.paths = next.skills.paths.filter((p) => p !== ".agents/compound-workflow-skills");
  if (!next.skills.paths.includes(skillRoot)) {
    next.skills.paths.unshift(skillRoot);
  }

  next.command = ensureObject(next.command);
  next.agent = ensureObject(next.agent);

  const commands = GENERATED_MANIFEST.commands;
  const agents = GENERATED_MANIFEST.agents;

  for (const command of commands) {
    next.command[command.id] = {
      ...ensureObject(next.command[command.id]),
      description: command.description,
      agent: "build",
      template: `@AGENTS.md\n@${commandRoot}/${command.rel}\nArguments: $ARGUMENTS\n`,
    };
  }

  const managedCommandTargets = new Set(
    commands.map((command) => `${commandRoot}/${command.rel}`)
  );
  for (const [id, entry] of Object.entries(next.command)) {
    const commandPath = managedCommandPath(entry);
    if (!commandPath || !isManagedCommandPath(commandPath)) continue;
    if (!managedCommandTargets.has(commandPath)) delete next.command[id];
  }

  for (const agent of agents) {
    next.agent[agent.id] = {
      ...ensureObject(next.agent[agent.id]),
      description: agent.description,
      mode: "subagent",
      prompt: `{file:${agentRoot}/${agent.rel}}`,
      permission: { ...ensureObject(next.agent[agent.id]?.permission), edit: "deny" },
    };
  }

  const managedAgentTargets = new Set(
    agents.map((agent) => `${agentRoot}/${agent.rel}`)
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

/**
 * Writes .cursor-plugin/plugin.json and .claude-plugin/plugin.json at targetRoot.
 * Paths (commands, agents, skills) in the written manifests are relative to project root
 * (parent of .cursor-plugin / .claude-plugin) so Cursor/Claude resolve assets correctly.
 */
function writePluginManifests(targetRoot, dryRun, isSelfInstall) {
  const pathsBase = isSelfInstall ? "./src/.agents" : "./node_modules/compound-workflow/src/.agents";
  const cursorSrc = path.join(PACKAGE_ROOT, ".cursor-plugin", "plugin.json");
  const claudeSrc = path.join(PACKAGE_ROOT, ".claude-plugin", "plugin.json");
  const cursorManifest = readJsonMaybe(cursorSrc);
  const claudeManifest = readJsonMaybe(claudeSrc);
  if (!cursorManifest || !claudeManifest) return;

  // Cursor supports full manifest with commands/agents/skills path overrides.
  const cursorOut = {
    ...cursorManifest,
    commands: `${pathsBase}/commands`,
    agents: `${pathsBase}/agents`,
    skills: `${pathsBase}/skills`,
  };
  // Claude Code only accepts name, description, author in plugin.json.
  // Agents are discovered from the adjacent agents/ directory (flat .md files).
  const claudeOut = {
    name: claudeManifest.name,
    description: claudeManifest.description,
    author: claudeManifest.author,
  };
  const cursorDir = path.join(targetRoot, ".cursor-plugin");
  const claudeDir = path.join(targetRoot, ".claude-plugin");

  const installPathAbs = realpathSafe(targetRoot);
  const registrationDescriptor = {
    pluginId: "compound-workflow@local",
    scope: "user",
    installPath: installPathAbs,
  };

  if (dryRun) {
    console.log("[dry-run] Would write .cursor-plugin/plugin.json, .claude-plugin/plugin.json, .cursor-plugin/registration.json" + (isSelfInstall ? "" : ", .claude-plugin/marketplace.json"));
    return;
  }
  fs.mkdirSync(cursorDir, { recursive: true });
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(cursorDir, "plugin.json"), JSON.stringify(cursorOut, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(claudeDir, "plugin.json"), JSON.stringify(claudeOut, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(cursorDir, "registration.json"), JSON.stringify(registrationDescriptor, null, 2) + "\n", "utf8");

  // Sync flat agent symlinks into .claude-plugin/agents/ so Claude Code discovers them.
  // Claude Code only scans the root of the agents/ directory (not subdirectories).
  const claudeAgentsDir = path.join(claudeDir, "agents");
  const packageAgentsDirAbs = isSelfInstall
    ? path.join(PACKAGE_ROOT, "src", ".agents", "agents")
    : path.join(targetRoot, "node_modules", "compound-workflow", "src", ".agents", "agents");
  if (fs.existsSync(packageAgentsDirAbs)) {
    fs.mkdirSync(claudeAgentsDir, { recursive: true });
    const agentBasenames = new Set(GENERATED_MANIFEST.agents.map((a) => path.basename(a.rel)));
    // Prune stale symlinks
    try {
      for (const entry of fs.readdirSync(claudeAgentsDir, { withFileTypes: true })) {
        if (!agentBasenames.has(entry.name)) {
          fs.rmSync(path.join(claudeAgentsDir, entry.name), { force: true });
        }
      }
    } catch { /* ignore */ }
    for (const agent of GENERATED_MANIFEST.agents) {
      const linkPath = path.join(claudeAgentsDir, path.basename(agent.rel));
      const targetPath = path.join(packageAgentsDirAbs, agent.rel);
      try {
        if (fs.lstatSync(linkPath)) fs.rmSync(linkPath, { force: true });
      } catch { /* doesn't exist */ }
      try {
        fs.symlinkSync(targetPath, linkPath);
      } catch (err) {
        console.warn("[claude] Could not symlink agent", agent.id, err.message);
      }
    }
  }

  // Claude Code 2.1.x+ no longer loads from installed_plugins.json; it requires marketplace flow.
  // Write a project-level marketplace so user can: /plugin marketplace add . then /plugin install compound-workflow@compound-workflow-local
  if (!isSelfInstall) {
    const marketplaceManifest = {
      name: "compound-workflow-local",
      owner: { name: "Compound Workflow" },
      plugins: [
        {
          name: "compound-workflow",
          source: "./node_modules/compound-workflow",
          description: claudeOut.description || "Clarify → plan → execute → verify → capture workflow.",
        },
      ],
    };
    fs.writeFileSync(path.join(claudeDir, "marketplace.json"), JSON.stringify(marketplaceManifest, null, 2) + "\n", "utf8");
  }
  console.log("Wrote: .cursor-plugin/plugin.json, .claude-plugin/plugin.json, .cursor-plugin/registration.json" + (isSelfInstall ? "" : ", .claude-plugin/marketplace.json"));
}

/**
 * Cursor discovers skills only from .agents/skills, .cursor/skills, ~/.cursor/skills.
 * Populate .cursor/skills/ with symlinks to the package skills so Cursor finds them.
 */
function syncCursorSkills(targetRoot, dryRun, isSelfInstall) {
  const packageSkillsAbs = isSelfInstall
    ? path.join(PACKAGE_ROOT, "src", ".agents", "skills")
    : path.join(targetRoot, "node_modules", "compound-workflow", "src", ".agents", "skills");
  if (!fs.existsSync(packageSkillsAbs)) return;

  const cursorSkillsDir = path.join(targetRoot, ".cursor", "skills");
  let entries;
  try {
    entries = fs.readdirSync(packageSkillsAbs, { withFileTypes: true });
  } catch {
    return;
  }

  const skillDirs = entries.filter((e) => e.isDirectory() && fs.existsSync(path.join(packageSkillsAbs, e.name, "SKILL.md"))).map((e) => e.name);
  if (skillDirs.length === 0) return;

  if (dryRun) {
    console.log("[dry-run] Would symlink", skillDirs.length, "skills into .cursor/skills/");
    return;
  }

  fs.mkdirSync(cursorSkillsDir, { recursive: true });
  const packageSkillsReal = realpathSafe(packageSkillsAbs);
  const skillSet = new Set(skillDirs);

  // Prune: remove symlinks that point at our package but are no longer in the package
  try {
    for (const entry of fs.readdirSync(cursorSkillsDir, { withFileTypes: true })) {
      if (!entry.isSymbolicLink()) continue;
      const linkPath = path.join(cursorSkillsDir, entry.name);
      try {
        const resolved = realpathSafe(linkPath);
        if (!resolved.startsWith(packageSkillsReal + path.sep) && resolved !== packageSkillsReal) continue;
        const base = path.basename(resolved);
        if (skillSet.has(base)) continue;
        fs.rmSync(linkPath);
      } catch {
        /* ignore broken symlinks or permission errors */
      }
    }
  } catch {
    /* .cursor/skills not readable */
  }

  for (const name of skillDirs) {
    const linkPath = path.join(cursorSkillsDir, name);
    const targetPath = path.join(packageSkillsAbs, name);
    try {
      if (fs.existsSync(linkPath)) {
        const stat = fs.lstatSync(linkPath);
        if (!stat.isSymbolicLink()) continue;
        try {
          if (realpathSafe(linkPath) !== realpathSafe(targetPath)) continue;
        } catch {
          continue;
        }
        fs.rmSync(linkPath);
      }
      fs.symlinkSync(targetPath, linkPath, "dir");
    } catch (err) {
      if (err.code === "EPERM" && process.platform === "win32") {
        try {
          fs.symlinkSync(targetPath, linkPath, "junction");
        } catch {
          console.warn("[cursor] Could not symlink skill", name, err.message);
        }
      } else {
        console.warn("[cursor] Could not symlink skill", name, err.message);
      }
    }
  }
  console.log("Synced", skillDirs.length, "skills to .cursor/skills/");
}

function cursorDetected() {
  return fs.existsSync(path.join(os.homedir(), ".cursor"));
}

function applyCursorRegistration(targetRoot, dryRun, noRegisterCursor, forceRegister, isSelfInstall) {
  const claudePluginsDir = path.join(os.homedir(), ".claude", "plugins");
  const installedPath = path.join(claudePluginsDir, "installed_plugins.json");
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");

  const pluginVersion = (() => {
    try {
      const pkgPath = path.join(PACKAGE_ROOT, "package.json");
      return JSON.parse(fs.readFileSync(pkgPath, "utf8")).version || "0.0.0";
    } catch {
      return "0.0.0";
    }
  })();

  const projectRoot = isSelfInstall ? PACKAGE_ROOT : targetRoot;
  const pluginId = "compound-workflow@local";

  if (dryRun) {
    console.log("[dry-run] Would register Claude plugin (project-scoped) at:", projectRoot);
    return;
  }

  // Registration is always project-scoped: write only to <project>/.claude/settings.json.
  // Claude Code manages ~/.claude/plugins/installed_plugins.json itself via marketplace flow;
  // writing to user-level files causes "unregistered local marketplace" errors on startup.
  const projectSettingsPath = path.join(projectRoot, ".claude", "settings.json");
  let projectSettings = {};
  if (fs.existsSync(projectSettingsPath)) {
    try { projectSettings = readJsonMaybe(projectSettingsPath) ?? {}; } catch { projectSettings = {}; }
  }
  projectSettings.enabledPlugins = ensureObject(projectSettings.enabledPlugins);
  projectSettings.enabledPlugins[pluginId] = true;
  // Remove stale/invalid marketplace keys left by earlier install methods
  if (projectSettings.extraKnownMarketplaces?.["compound-workflow"]) {
    delete projectSettings.extraKnownMarketplaces["compound-workflow"];
  }
  projectSettings.extraKnownMarketplaces = ensureObject(projectSettings.extraKnownMarketplaces);
  projectSettings.extraKnownMarketplaces["compound-workflow-local"] = {
    source: { source: "file", path: ".claude-plugin/marketplace.json" },
  };
  fs.mkdirSync(path.join(projectRoot, ".claude"), { recursive: true });
  fs.writeFileSync(projectSettingsPath, JSON.stringify(projectSettings, null, 2) + "\n", "utf8");

  // Clean up any stale user-level enabledPlugins entries left by previous install versions.
  // These cause "unregistered local marketplace" errors on every Claude Code startup.
  if (fs.existsSync(settingsPath)) {
    try {
      let userSettings = readJsonMaybe(settingsPath) ?? {};
      const staleIds = ["compound-workflow@local", "compound-workflow@compound-workflow-local"];
      let changed = false;
      for (const id of staleIds) {
        if (userSettings?.enabledPlugins?.[id] !== undefined) {
          delete userSettings.enabledPlugins[id];
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(settingsPath, JSON.stringify(userSettings, null, 2) + "\n", "utf8");
        console.log("Cleaned up stale compound-workflow entries from ~/.claude/settings.json");
      }
    } catch { /* ignore */ }
  }

  console.log("Registered compound-workflow with Claude Code (project-scoped).");
  if (!isSelfInstall) {
    console.log("  Claude Code 2.1+: open /plugin, go to Discover; install 'compound-workflow' from marketplace 'compound-workflow-local', or run: claude --plugin-dir ./node_modules/compound-workflow");
  }
  console.log("  Restart Claude Code; enable 'Include third-party Plugins, Skills, and other configs' in Settings if needed.");

  if (noRegisterCursor && !forceRegister) return;
  const shouldApply = forceRegister || (cursorDetected() && !noRegisterCursor);
  if (!shouldApply) {
    console.log("[cursor] Cursor not detected; skipped Cursor plugin registration. Use --register-cursor to force.");
    return;
  }
  const registrationPath = path.join(targetRoot, ".cursor-plugin", "registration.json");
  if (!fs.existsSync(registrationPath)) return;
  console.log("Registered compound-workflow with Cursor. Restart Cursor; enable 'Include third-party Plugins, Skills, and other configs' in Settings if needed.");
}

function reportOpenCodeIntegration(targetRoot, dryRun) {
  if (dryRun) {
    console.log("[dry-run] OpenCode integration check skipped (state would be updated by install).");
    return;
  }

  const opencodeAbs = path.join(targetRoot, "opencode.json");
  const opencode = readJsonMaybe(opencodeAbs) ?? {};
  const skillPaths = Array.isArray(opencode?.skills?.paths) ? opencode.skills.paths : [];
  const hasSkillPath = skillPaths.includes(PACKAGE_SKILL_ROOT) || skillPaths.includes("src/.agents/skills");

  console.log(
    "OpenCode integration:",
    hasSkillPath ? "ok" : "incomplete",
    `(skills.path=${hasSkillPath ? "yes" : "no"})`
  );
}

function main() {
  const args = parseArgs(process.argv);
  const targetRoot = realpathSafe(args.root);

  const genScript = path.join(PACKAGE_ROOT, "scripts", "generate-platform-artifacts.mjs");
  if (fs.existsSync(genScript)) {
    console.log("[compound-workflow] Regenerating manifest from package source...");
    const result = spawnSync(process.execPath, [genScript], {
      cwd: PACKAGE_ROOT,
      stdio: "pipe",
      encoding: "utf8",
    });
    if (result.status !== 0) {
      console.error("Failed to regenerate manifest:", result.stderr || result.error || "unknown");
      process.exit(1);
    }
  }

  try {
    GENERATED_MANIFEST = readGeneratedManifest();
    PACKAGE_COMMAND_ROOT = GENERATED_MANIFEST.commandRoot;
    PACKAGE_AGENT_ROOT = GENERATED_MANIFEST.agentRoot;
    PACKAGE_SKILL_ROOT = GENERATED_MANIFEST.skillsPath;
  } catch (err) {
    console.error("Error: OpenCode manifest not found. Run 'npm run generate:artifacts' in the package or reinstall compound-workflow.");
    process.exit(2);
  }

  if (!fs.existsSync(PACKAGE_AGENTS_ROOT)) {
    console.error("Error: package agents dir not found:", PACKAGE_AGENTS_ROOT);
    process.exit(2);
  }

  const isSelfInstall = realpathSafe(targetRoot) === realpathSafe(PACKAGE_ROOT);
  const pkgInTarget = path.join(targetRoot, "node_modules", "compound-workflow");
  if (!isSelfInstall && !fs.existsSync(pkgInTarget) && !args.dryRun) {
    console.error("Error: compound-workflow not found in project. Run: npm install compound-workflow");
    process.exit(2);
  }

  console.log("Target root:", targetRoot);
  console.log("Package root:", PACKAGE_ROOT);
  console.log("OpenCode CLI detected:", hasCommand("opencode") ? "yes" : "no");

  writeOpenCodeJson(targetRoot, args.dryRun, isSelfInstall);
  writePluginManifests(targetRoot, args.dryRun, isSelfInstall);
  syncCursorSkills(targetRoot, args.dryRun, isSelfInstall);
  applyCursorRegistration(targetRoot, args.dryRun, args.noRegisterCursor, args.registerCursor, isSelfInstall);
  reportOpenCodeIntegration(targetRoot, args.dryRun);
  writeAgentsMd(targetRoot, args.dryRun);
  ensureDirs(targetRoot, args.dryRun);

  if (!args.noConfig && !args.dryRun && process.stdin.isTTY) {
    console.log("\nRepo Config: edit AGENTS.md to set default_branch, test_command, lint_command, dev_server_url.");
  }

  console.log("\nDone. Run opencode debug config to verify.");
}

main();
