import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const installCli = path.join(repoRoot, "scripts", "install-cli.mjs");
const generateArtifacts = path.join(repoRoot, "scripts", "generate-platform-artifacts.mjs");

function createTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compound-workflow-install-"));
  fs.mkdirSync(path.join(dir, "node_modules", "compound-workflow"), { recursive: true });
  return dir;
}

/** Copy minimal package contents so install runs with package root = node_modules/compound-workflow (simulates npm install). */
function copyMinimalPackageIntoNodeModules(projectRoot) {
  const pkgDir = path.join(projectRoot, "node_modules", "compound-workflow");
  fs.mkdirSync(path.join(pkgDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(pkgDir, "src", "generated"), { recursive: true });
  fs.mkdirSync(path.join(pkgDir, "src", ".agents"), { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, "scripts", "install-cli.mjs"),
    path.join(pkgDir, "scripts", "install-cli.mjs")
  );
  fs.copyFileSync(
    path.join(repoRoot, "src", "generated", "opencode.managed.json"),
    path.join(pkgDir, "src", "generated", "opencode.managed.json")
  );
  fs.copyFileSync(path.join(repoRoot, "src", "AGENTS.md"), path.join(pkgDir, "src", "AGENTS.md"));
  fs.mkdirSync(path.join(pkgDir, ".cursor-plugin"), { recursive: true });
  fs.mkdirSync(path.join(pkgDir, ".claude-plugin"), { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, ".cursor-plugin", "plugin.json"),
    path.join(pkgDir, ".cursor-plugin", "plugin.json")
  );
  fs.copyFileSync(
    path.join(repoRoot, ".claude-plugin", "plugin.json"),
    path.join(pkgDir, ".claude-plugin", "plugin.json")
  );
}

/** Copy skills dir (one skill) so syncCursorSkills runs and creates .cursor/skills symlinks. */
function copySkillsIntoNodeModules(projectRoot) {
  const pkgSkills = path.join(projectRoot, "node_modules", "compound-workflow", "src", ".agents", "skills");
  const srcSkills = path.join(repoRoot, "src", ".agents", "skills", "brainstorming");
  if (!fs.existsSync(srcSkills)) return;
  fs.mkdirSync(path.join(pkgSkills, "brainstorming"), { recursive: true });
  fs.copyFileSync(path.join(srcSkills, "SKILL.md"), path.join(pkgSkills, "brainstorming", "SKILL.md"));
}

function runInstall(projectRoot) {
  return spawnSync(
    process.execPath,
    [installCli, "install", "--root", projectRoot, "--no-config", "--no-register-cursor"],
    { cwd: repoRoot, encoding: "utf8" }
  );
}

/** Run install from consumer project so package root is node_modules/compound-workflow. */
function runInstallFromConsumerProject(projectRoot) {
  const pkgCli = path.join(projectRoot, "node_modules", "compound-workflow", "scripts", "install-cli.mjs");
  return spawnSync(process.execPath, [pkgCli, "install", "--root", projectRoot, "--no-config", "--no-register-cursor"], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

test("repo is single-plugin: .claude-plugin has only plugin.json", () => {
  assert.equal(
    fs.existsSync(path.join(repoRoot, ".claude-plugin", "marketplace.json")),
    false,
    ".claude-plugin/marketplace.json must not exist (single-plugin repo)"
  );
  assert.ok(
    fs.existsSync(path.join(repoRoot, ".claude-plugin", "plugin.json")),
    ".claude-plugin/plugin.json must exist"
  );
});

test("install writes native OpenCode mappings and does not create runtime mirror paths", () => {
  const projectRoot = createTempProject();

  try {
    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const opencode = JSON.parse(fs.readFileSync(path.join(projectRoot, "opencode.json"), "utf8"));
    assert.match(
      opencode.command["workflow:work"].template,
      /@node_modules\/compound-workflow\/src\/.agents\/commands\/workflow-work\.md/,
      "workflow command template should point at package command path"
    );
    assert.match(
      opencode.agent["repo-research-analyst"].prompt,
      /\{file:node_modules\/compound-workflow\/src\/.agents\/agents\/research\/repo-research-analyst\.md\}/,
      "agent prompt should point at package agent path"
    );
    assert.ok(
      opencode.skills.paths.includes("node_modules/compound-workflow/src/.agents/skills"),
      "skills path should include package skills path"
    );

    assert.equal(
      fs.existsSync(path.join(projectRoot, ".agents", "compound-workflow")),
      false,
      "install should not create .agents/compound-workflow runtime mirror"
    );
    assert.equal(
      fs.existsSync(path.join(projectRoot, ".agents", "compound-workflow-skills")),
      false,
      "install should not create .agents/compound-workflow-skills symlink"
    );
    const cursorPlugin = JSON.parse(fs.readFileSync(path.join(projectRoot, ".cursor-plugin", "plugin.json"), "utf8"));
    assert.equal(cursorPlugin.commands, "./node_modules/compound-workflow/src/.agents/commands", "project-root plugin manifest should point at node_modules");
    assert.ok(fs.existsSync(path.join(projectRoot, ".cursor-plugin", "registration.json")), "registration.json should be written for Cursor discovery");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install does not mutate existing .cursor assets", () => {
  const projectRoot = createTempProject();

  try {
    const stale = path.join(projectRoot, ".cursor", "commands", "stale.mdc");
    fs.mkdirSync(path.dirname(stale), { recursive: true });
    fs.writeFileSync(stale, "stale", "utf8");

    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);
    assert.equal(fs.readFileSync(stale, "utf8"), "stale", "install should not sync or replace .cursor files");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install prunes legacy managed paths and removes deprecated skill symlink path", () => {
  const projectRoot = createTempProject();

  try {
    const opencodePath = path.join(projectRoot, "opencode.json");
    fs.writeFileSync(
      opencodePath,
      JSON.stringify(
        {
          skills: {
            paths: [
              ".agents/compound-workflow-skills",
              "custom/skills"
            ]
          },
          command: {
            setup: {
              template: "@AGENTS.md\n@.agents/compound-workflow/commands/setup.md\nArguments: $ARGUMENTS\n"
            }
          },
          agent: {
            legacy: {
              prompt: "{file:.agents/compound-workflow/agents/research/repo-research-analyst.md}"
            }
          }
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const opencode = JSON.parse(fs.readFileSync(opencodePath, "utf8"));
    assert.equal(opencode.command.setup, undefined, "legacy managed setup command should be pruned");
    assert.equal(opencode.agent.legacy, undefined, "legacy managed agent should be pruned");
    assert.equal(
      opencode.skills.paths.includes(".agents/compound-workflow-skills"),
      false,
      "legacy compound-workflow skills symlink path should be removed"
    );
    assert.ok(opencode.skills.paths.includes("custom/skills"), "custom skill paths should be preserved");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("generated manifest has required shape and includes all registry-driven commands", () => {
  const result = spawnSync(process.execPath, [generateArtifacts], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(result.status, 0, `generate:artifacts failed: ${result.stderr}\n${result.stdout}`);

  const manifestPath = path.join(repoRoot, "src", "generated", "opencode.managed.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.ok(manifest.commandRoot, "manifest must have commandRoot");
  assert.ok(manifest.agentRoot, "manifest must have agentRoot");
  assert.ok(manifest.skillsPath, "manifest must have skillsPath");
  assert.ok(Array.isArray(manifest.commands), "manifest must have commands array");
  assert.ok(Array.isArray(manifest.agents), "manifest must have agents array");

  const commandIds = manifest.commands.map((c) => c.id);
  assert.ok(commandIds.includes("workflow:tech-review"), "manifest must include workflow:tech-review command");
  assert.ok(commandIds.includes("workflow:work"), "manifest must include workflow:work command");
  assert.ok(manifest.agents.some((a) => a.id === "planning-technical-reviewer"), "manifest must include planning-technical-reviewer agent");
});

test("install is deterministic: two runs produce identical opencode.json", () => {
  const projectRoot = createTempProject();

  try {
    const r1 = runInstall(projectRoot);
    assert.equal(r1.status, 0, `first install failed: ${r1.stderr}\n${r1.stdout}`);
    const opencode1 = JSON.parse(fs.readFileSync(path.join(projectRoot, "opencode.json"), "utf8"));

    const r2 = runInstall(projectRoot);
    assert.equal(r2.status, 0, `second install failed: ${r2.stderr}\n${r2.stdout}`);
    const opencode2 = JSON.parse(fs.readFileSync(path.join(projectRoot, "opencode.json"), "utf8"));

    assert.deepStrictEqual(opencode1, opencode2, "install output must be deterministic");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install from consumer project (package in node_modules) reads manifest and writes opencode.json", () => {
  const projectRoot = createTempProject();
  copyMinimalPackageIntoNodeModules(projectRoot);

  try {
    const result = runInstallFromConsumerProject(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const opencodePath = path.join(projectRoot, "opencode.json");
    assert.ok(fs.existsSync(opencodePath), "opencode.json should be written");
    const opencode = JSON.parse(fs.readFileSync(opencodePath, "utf8"));
    assert.match(
      opencode.command["workflow:work"].template,
      /@node_modules\/compound-workflow\/src\/.agents\/commands\/workflow-work\.md/,
      "workflow command template should point at package command path"
    );
    assert.ok(
      opencode.command["workflow:tech-review"],
      "opencode must include workflow:tech-review command"
    );
    assert.ok(
      opencode.skills.paths.includes("node_modules/compound-workflow/src/.agents/skills"),
      "skills path should include package skills path"
    );
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install registers Claude plugin via installed_plugins.json and enabledPlugins (compound-workflow@local)", () => {
  const projectRoot = createTempProject();
  copyMinimalPackageIntoNodeModules(projectRoot);

  try {
    const result = runInstallFromConsumerProject(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const projectSettingsPath = path.join(projectRoot, ".claude", "settings.json");
    assert.ok(fs.existsSync(projectSettingsPath), ".claude/settings.json should exist in project root");
    const projectSettings = JSON.parse(fs.readFileSync(projectSettingsPath, "utf8"));

    assert.equal(
      projectSettings?.enabledPlugins?.["compound-workflow@local"],
      true,
      "project settings must enable compound-workflow@local"
    );
    assert.equal(
      projectSettings?.extraKnownMarketplaces?.["compound-workflow"],
      undefined,
      "install must not write legacy compound-workflow entry (invalid local schema)"
    );
    assert.deepEqual(
      projectSettings?.extraKnownMarketplaces?.["compound-workflow-local"],
      { source: { source: "file", path: ".claude-plugin/marketplace.json" } },
      "install must register compound-workflow-local marketplace via file source"
    );

    const installedPath = path.join(os.homedir(), ".claude", "plugins", "installed_plugins.json");
    assert.ok(fs.existsSync(installedPath), "installed_plugins.json should exist");
    const installed = JSON.parse(fs.readFileSync(installedPath, "utf8"));
    const entries = installed?.plugins?.["compound-workflow@local"];
    assert.ok(Array.isArray(entries) && entries.length > 0, "compound-workflow@local should have at least one entry");
    assert.equal(entries.some((e) => e.scope === "project" && e.projectPath), true, "should have project-scope entry");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install strips invalid compound-workflow extraKnownMarketplaces from existing .claude/settings.json", () => {
  const projectRoot = createTempProject();
  copyMinimalPackageIntoNodeModules(projectRoot);
  const claudeDir = path.join(projectRoot, ".claude");
  const settingsPath = path.join(claudeDir, "settings.json");
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(
    settingsPath,
    JSON.stringify(
      {
        extraKnownMarketplaces: {
          "compound-workflow": { source: { source: "local", path: "./node_modules/compound-workflow" } },
        },
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  try {
    const result = runInstallFromConsumerProject(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);
    const projectSettings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    assert.equal(projectSettings?.extraKnownMarketplaces?.["compound-workflow"], undefined, "install must remove invalid compound-workflow entry");
    assert.ok(projectSettings?.extraKnownMarketplaces?.["compound-workflow-local"]?.source?.source === "file", "install must add compound-workflow-local via file");
    assert.equal(projectSettings?.enabledPlugins?.["compound-workflow@local"], true, "enabledPlugins must be set (compound-workflow@local)");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install writes independent .claude/settings.json for two different projects", () => {
  const projectA = createTempProject();
  const projectB = createTempProject();
  copyMinimalPackageIntoNodeModules(projectA);
  copyMinimalPackageIntoNodeModules(projectB);

  try {
    const resultA = runInstallFromConsumerProject(projectA);
    assert.equal(resultA.status, 0, `installer failed for project A: ${resultA.stderr}\n${resultA.stdout}`);

    const resultB = runInstallFromConsumerProject(projectB);
    assert.equal(resultB.status, 0, `installer failed for project B: ${resultB.stderr}\n${resultB.stdout}`);

    const settingsA = JSON.parse(fs.readFileSync(path.join(projectA, ".claude", "settings.json"), "utf8"));
    const settingsB = JSON.parse(fs.readFileSync(path.join(projectB, ".claude", "settings.json"), "utf8"));

    assert.equal(settingsA?.enabledPlugins?.["compound-workflow@local"], true, "project A must enable plugin");
    assert.equal(settingsB?.enabledPlugins?.["compound-workflow@local"], true, "project B must enable plugin");
  } finally {
    fs.rmSync(projectA, { recursive: true, force: true });
    fs.rmSync(projectB, { recursive: true, force: true });
  }
});

test("install writes .claude-plugin/marketplace.json in consumer project for Claude Code 2.1+", () => {
  const projectRoot = createTempProject();
  copyMinimalPackageIntoNodeModules(projectRoot);

  try {
    const result = runInstallFromConsumerProject(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const marketplacePath = path.join(projectRoot, ".claude-plugin", "marketplace.json");
    assert.ok(fs.existsSync(marketplacePath), ".claude-plugin/marketplace.json should exist in consumer project");
    const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
    assert.equal(marketplace.name, "compound-workflow-local", "marketplace name");
    assert.ok(Array.isArray(marketplace.plugins) && marketplace.plugins.length === 1, "one plugin entry");
    assert.equal(marketplace.plugins[0].name, "compound-workflow", "plugin name");
    assert.equal(marketplace.plugins[0].source, "./node_modules/compound-workflow", "plugin source");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install syncs package skills into .cursor/skills as symlinks for Cursor discovery", () => {
  const projectRoot = createTempProject();
  copyMinimalPackageIntoNodeModules(projectRoot);
  copySkillsIntoNodeModules(projectRoot);

  try {
    const result = runInstallFromConsumerProject(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);
    assert.ok(fs.existsSync(path.join(projectRoot, ".cursor", "skills")), ".cursor/skills should exist");
    const skillLink = path.join(projectRoot, ".cursor", "skills", "brainstorming");
    assert.ok(fs.existsSync(skillLink), ".cursor/skills/brainstorming should exist");
    const stat = fs.lstatSync(skillLink);
    assert.ok(stat.isSymbolicLink(), ".cursor/skills/brainstorming should be a symlink");
    const target = path.join(projectRoot, "node_modules", "compound-workflow", "src", ".agents", "skills", "brainstorming");
    const resolved = fs.realpathSync(skillLink);
    assert.equal(resolved, fs.realpathSync(target), "symlink should point at package skill dir");
    assert.ok(fs.existsSync(path.join(resolved, "SKILL.md")), "resolved skill dir should contain SKILL.md");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
