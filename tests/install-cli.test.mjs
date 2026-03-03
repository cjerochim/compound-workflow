import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const installCli = path.join(repoRoot, "scripts", "install-cli.mjs");

function createTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compound-workflow-install-"));
  fs.mkdirSync(path.join(dir, "node_modules", "compound-workflow"), { recursive: true });
  return dir;
}

function runInstall(projectRoot) {
  return spawnSync(
    process.execPath,
    [installCli, "install", "--root", projectRoot, "--no-config"],
    { cwd: repoRoot, encoding: "utf8" }
  );
}

test("install writes native OpenCode mappings and does not create runtime mirror paths", () => {
  const projectRoot = createTempProject();

  try {
    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const opencode = JSON.parse(fs.readFileSync(path.join(projectRoot, "opencode.json"), "utf8"));
    assert.match(
      opencode.command["workflow:work"].template,
      /@node_modules\/compound-workflow\/src\/.agents\/commands\/workflow\/work\.md/,
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
