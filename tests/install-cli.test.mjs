import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function createTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compound-workflow-install-"));
  fs.mkdirSync(path.join(dir, "node_modules", "compound-workflow"), { recursive: true });
  return dir;
}

function copyDirRecursiveForTest(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursiveForTest(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

function assertNoSymlinksUnder(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    const stat = fs.lstatSync(entryPath);
    assert.ok(!stat.isSymbolicLink(), `${entryPath} should be a real file or directory, not a symlink`);
    if (entry.isDirectory()) assertNoSymlinksUnder(entryPath);
  }
}

function sourceSkillNames(root = repoRoot) {
  const srcSkills = path.join(root, "src", "skills");
  return fs.readdirSync(srcSkills, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(srcSkills, e.name, "SKILL.md")))
    .map((e) => e.name)
    .sort();
}

/** Copy minimal package contents into node_modules so install runs as a consumer project. */
function copyMinimalPackageIntoNodeModules(projectRoot) {
  const pkgDir = path.join(projectRoot, "node_modules", "compound-workflow");
  fs.mkdirSync(path.join(pkgDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(pkgDir, "src"), { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, "scripts", "install-cli.mjs"),
    path.join(pkgDir, "scripts", "install-cli.mjs")
  );
  fs.copyFileSync(
    path.join(repoRoot, "scripts", "workflow-preflight.mjs"),
    path.join(pkgDir, "scripts", "workflow-preflight.mjs")
  );
  fs.copyFileSync(path.join(repoRoot, "src", "AGENTS.md"), path.join(pkgDir, "src", "AGENTS.md"));
  copyDirRecursiveForTest(path.join(repoRoot, "src", "agents"), path.join(pkgDir, "src", "agents"));
  copyDirRecursiveForTest(path.join(repoRoot, "src", "skills"), path.join(pkgDir, "src", "skills"));
  copyDirRecursiveForTest(path.join(repoRoot, "src", "commands"), path.join(pkgDir, "src", "commands"));
}

/** Run install from consumer project so package root is node_modules/compound-workflow. */
function runInstall(projectRoot) {
  const pkgCli = path.join(projectRoot, "node_modules", "compound-workflow", "scripts", "install-cli.mjs");
  return spawnSync(process.execPath, [pkgCli, "install", "--root", projectRoot], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

function runSourceCliInstall(projectRoot, extraArgs = []) {
  const pkgCli = path.join(repoRoot, "scripts", "install-cli.mjs");
  return spawnSync(process.execPath, [pkgCli, "install", "--root", projectRoot, ...extraArgs], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

function runInstalledCli(projectRoot, args = []) {
  const pkgCli = path.join(projectRoot, "node_modules", "compound-workflow", "scripts", "install-cli.mjs");
  return spawnSync(process.execPath, [pkgCli, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

function setup() {
  const projectRoot = createTempProject();
  copyMinimalPackageIntoNodeModules(projectRoot);
  return projectRoot;
}

// ---------------------------------------------------------------------------

test("install: agents copied flat to .claude/agents/ while preserving local nested agents", () => {
  const projectRoot = setup();
  try {
    const localNestedAgent = path.join(projectRoot, ".claude", "agents", "custom", "local-agent.md");
    fs.mkdirSync(path.dirname(localNestedAgent), { recursive: true });
    fs.writeFileSync(localNestedAgent, "local-agent", "utf8");

    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const claudeAgentsDir = path.join(projectRoot, ".claude", "agents");
    assert.ok(fs.existsSync(claudeAgentsDir), ".claude/agents should exist");

    const entries = fs.readdirSync(claudeAgentsDir, { withFileTypes: true });
    assert.ok(entries.filter((e) => e.isFile() && e.name.endsWith(".md")).length > 0, ".claude/agents should contain .md files");
    assert.equal(fs.readFileSync(localNestedAgent, "utf8"), "local-agent", "install should preserve local nested agents");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install: .cursor/agents/ preserves subdirectory structure", () => {
  const projectRoot = setup();
  try {
    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const cursorAgentsDir = path.join(projectRoot, ".cursor", "agents");
    assert.ok(fs.existsSync(cursorAgentsDir), ".cursor/agents should exist");
    const dirs = fs.readdirSync(cursorAgentsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    assert.ok(dirs.length > 0, ".cursor/agents should have subdirectories (research/review/workflow)");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install: .agents/ gets agents, skills, and commands", () => {
  const projectRoot = setup();
  try {
    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    assert.ok(fs.existsSync(path.join(projectRoot, ".agents", "agents")), ".agents/agents should exist");
    assert.ok(fs.existsSync(path.join(projectRoot, ".agents", "skills")), ".agents/skills should exist");
    assert.ok(fs.existsSync(path.join(projectRoot, ".agents", "commands")), ".agents/commands should exist");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install: .claude/ gets agents, skills, and commands", () => {
  const projectRoot = setup();
  try {
    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    assert.ok(fs.existsSync(path.join(projectRoot, ".claude", "agents")), ".claude/agents should exist");
    assert.ok(fs.existsSync(path.join(projectRoot, ".claude", "skills")), ".claude/skills should exist");
    assert.ok(fs.existsSync(path.join(projectRoot, ".claude", "commands")), ".claude/commands should exist");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install: every skill in src/skills/ appears in every harness", () => {
  const projectRoot = setup();
  try {
    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const expected = sourceSkillNames();
    assert.ok(expected.length > 0, "source skills must exist for the parity assertion to mean anything");

    for (const harness of [".claude", ".cursor", ".agents"]) {
      for (const name of expected) {
        const skillMd = path.join(projectRoot, harness, "skills", name, "SKILL.md");
        assert.ok(fs.existsSync(skillMd), `${harness}/skills/${name}/SKILL.md should exist`);
      }
    }
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install: removed skill aliases are absent from source and harness output", () => {
  const forbidden = ["compound_doc", "pii-protection-prisma"];
  const names = sourceSkillNames();

  for (const name of forbidden) {
    assert.equal(names.includes(name), false, `src/skills/${name} should not exist`);
  }

  const projectRoot = setup();
  try {
    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    for (const harness of [".claude", ".cursor", ".agents"]) {
      for (const name of forbidden) {
        assert.equal(
          fs.existsSync(path.join(projectRoot, harness, "skills", name)),
          false,
          `${harness}/skills/${name} should not be installed`
        );
      }
    }
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install: updated skill content overwrites previous copy", () => {
  const projectRoot = setup();
  try {
    const stalePath = path.join(projectRoot, ".claude", "skills", "setup-agents", "SKILL.md");
    fs.mkdirSync(path.dirname(stalePath), { recursive: true });
    fs.writeFileSync(stalePath, "stale-contents", "utf8");

    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const sourceContents = fs.readFileSync(path.join(repoRoot, "src", "skills", "setup-agents", "SKILL.md"), "utf8");
    const installedContents = fs.readFileSync(stalePath, "utf8");
    assert.equal(installedContents, sourceContents, "reinstall should overwrite stale skill content");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install: source and copied files are real files, not symlinks", () => {
  assertNoSymlinksUnder(path.join(repoRoot, "src", "skills"));

  const projectRoot = setup();
  try {
    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    for (const harness of [".claude", ".cursor", ".agents"]) {
      assertNoSymlinksUnder(path.join(projectRoot, harness, "agents"));
      assertNoSymlinksUnder(path.join(projectRoot, harness, "skills"));
      assertNoSymlinksUnder(path.join(projectRoot, harness, "commands"));
    }
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install: AGENTS.md is copied from the package src template", () => {
  const projectRoot = setup();
  try {
    const packageAgents = path.join(projectRoot, "node_modules", "compound-workflow", "src", "AGENTS.md");
    const sentinel = "sentinel-package-agents-template";
    fs.appendFileSync(packageAgents, `\n<!-- ${sentinel} -->\n`, "utf8");

    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const installed = fs.readFileSync(path.join(projectRoot, "AGENTS.md"), "utf8");
    assert.match(installed, new RegExp(sentinel), "installed AGENTS.md should come from package src/AGENTS.md");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install: opencode.json written with .agents/ paths", () => {
  const projectRoot = setup();
  try {
    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const opencode = JSON.parse(fs.readFileSync(path.join(projectRoot, "opencode.json"), "utf8"));
    assert.ok(opencode.skills.paths.includes(".agents/skills"), "skills.paths should include .agents/skills");

    const workCmd = opencode.command["workflow:work"];
    assert.ok(workCmd, "workflow:work command should exist in opencode.json");
    assert.match(workCmd.template, /@\.agents\/commands\//, "command template should reference .agents/commands/");
    assert.ok(opencode.command["workflow:tech-review"], "workflow:tech-review should be present");

    const researchAgent = opencode.agent["repo-research-analyst"];
    assert.ok(researchAgent, "repo-research-analyst agent should exist");
    assert.match(researchAgent.prompt, /\.agents\/agents\//, "agent prompt should reference .agents/agents/");

    const frontendAgent = opencode.agent["frontend-react-specialist"];
    assert.ok(frontendAgent, "frontend-react-specialist agent should exist");
    assert.equal(frontendAgent.model, "openai/gpt-5.5");
    assert.equal(frontendAgent.mode, "subagent");
    assert.equal(frontendAgent.color, "info");
    assert.match(frontendAgent.prompt, /\.agents\/agents\/specialists\/frontend-react-specialist\.md/);
    assert.deepEqual(frontendAgent.permission, {
      read: "allow",
      edit: "allow",
      bash: "deny",
      webfetch: "allow",
      websearch: "allow",
    });

    const backendAgent = opencode.agent["backend-node-specialist"];
    assert.ok(backendAgent, "backend-node-specialist agent should exist");
    assert.equal(backendAgent.model, "openai/gpt-5.5");
    assert.equal(backendAgent.mode, "subagent");
    assert.equal(backendAgent.color, "success");
    assert.match(backendAgent.prompt, /\.agents\/agents\/specialists\/backend-node-specialist\.md/);
    assert.deepEqual(backendAgent.permission, {
      read: "allow",
      edit: "allow",
      bash: "allow",
      webfetch: "allow",
      websearch: "allow",
    });
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install: package-managed agents default to edit deny unless source explicitly allows edit", () => {
  const projectRoot = setup();
  try {
    fs.writeFileSync(
      path.join(projectRoot, "opencode.json"),
      JSON.stringify({
        agent: {
          "repo-research-analyst": {
            permission: { edit: "allow", bash: "allow" },
          },
        },
      }, null, 2) + "\n",
      "utf8"
    );

    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const opencode = JSON.parse(fs.readFileSync(path.join(projectRoot, "opencode.json"), "utf8"));
    assert.equal(opencode.agent["repo-research-analyst"].permission.edit, "deny");
    assert.equal(opencode.agent["repo-research-analyst"].permission.bash, undefined);
    assert.equal(opencode.agent["backend-node-specialist"].permission.edit, "allow");
    assert.equal(opencode.agent["backend-node-specialist"].permission.bash, "allow");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install: running package CLI can install into a project without local node_modules copy", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "compound-workflow-npx-"));
  try {
    const result = runSourceCliInstall(projectRoot);
    assert.equal(result.status, 0, `source CLI install failed: ${result.stderr}\n${result.stdout}`);

    assert.ok(fs.existsSync(path.join(projectRoot, ".agents", "commands", "workflow-brainstorm.md")));
    assert.ok(fs.existsSync(path.join(projectRoot, ".agents", "skills", "brainstorming", "SKILL.md")));
    assert.ok(fs.existsSync(path.join(projectRoot, "AGENTS.md")));
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install: running package CLI dry-run works without local node_modules copy", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "compound-workflow-npx-dry-"));
  try {
    const result = runSourceCliInstall(projectRoot, ["--dry-run"]);
    assert.equal(result.status, 0, `source CLI dry-run failed: ${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /\[dry-run\] Would copy \d+ commands to \.agents\/commands\//);
    assert.equal(fs.existsSync(path.join(projectRoot, ".agents")), false, "dry-run should not write harness dirs");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("preflight: installed package CLI validates current checkout without project npm script", () => {
  const projectRoot = setup();
  try {
    const gitInit = spawnSync("git", ["init", "-b", "main"], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    assert.equal(gitInit.status, 0, `git init failed: ${gitInit.stderr}\n${gitInit.stdout}`);

    const planPath = path.join(projectRoot, "docs", "plans", "example-plan.md");
    const todoPath = path.join(projectRoot, "todos", "isolation-checkpoint.md");
    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.mkdirSync(path.dirname(todoPath), { recursive: true });
    fs.writeFileSync(planPath, "# Example plan\n", "utf8");
    fs.writeFileSync(todoPath, "# Isolation checkpoint\n", "utf8");

    const result = runInstalledCli(projectRoot, [
      "preflight",
      "--",
      "--plan",
      planPath,
      "--mode",
      "current_checkout_approved",
      "--approval-source",
      "explicit_argument",
      "--todo",
      todoPath,
    ]);

    assert.equal(result.status, 0, `preflight failed: ${result.stderr}\n${result.stdout}`);
    const evidence = JSON.parse(result.stdout);
    assert.equal(evidence.isolation_preflight.status, "passed");
    assert.equal(evidence.isolation_preflight.mode, "current_checkout_approved");
    assert.equal(evidence.isolation_preflight.worktree_path, null);
    assert.equal(evidence.isolation_preflight.branch, "main");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install is deterministic: two runs produce identical opencode.json", () => {
  const projectRoot = setup();
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

test("install preserves non-managed files in target dirs", () => {
  const projectRoot = setup();
  try {
    const userRule = path.join(projectRoot, ".cursor", "commands", "stale.mdc");
    const userCommand = path.join(projectRoot, ".cursor", "commands", "local-command.md");
    const userSkill = path.join(projectRoot, ".cursor", "skills", "local-skill", "SKILL.md");
    const userAgent = path.join(projectRoot, ".agents", "agents", "local", "local-agent.md");
    fs.mkdirSync(path.dirname(userRule), { recursive: true });
    fs.mkdirSync(path.dirname(userSkill), { recursive: true });
    fs.mkdirSync(path.dirname(userAgent), { recursive: true });
    fs.writeFileSync(userRule, "user-rule", "utf8");
    fs.writeFileSync(userCommand, "local-command", "utf8");
    fs.writeFileSync(userSkill, "---\nname: local-skill\ndescription: local skill\n---\n", "utf8");
    fs.writeFileSync(userAgent, "local-agent", "utf8");

    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);
    assert.equal(fs.readFileSync(userRule, "utf8"), "user-rule", "install should not remove non-.md files");
    assert.equal(fs.readFileSync(userCommand, "utf8"), "local-command", "install should preserve local .md commands");
    assert.match(fs.readFileSync(userSkill, "utf8"), /local skill/, "install should preserve local skills");
    assert.equal(fs.readFileSync(userAgent, "utf8"), "local-agent", "install should preserve local agents");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install cleans old package-relative skill paths from opencode.json", () => {
  const projectRoot = setup();
  try {
    fs.writeFileSync(
      path.join(projectRoot, "opencode.json"),
      JSON.stringify({
        skills: { paths: ["node_modules/compound-workflow/src/.agents/skills", "custom/skills"] },
      }, null, 2) + "\n",
      "utf8"
    );

    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const opencode = JSON.parse(fs.readFileSync(path.join(projectRoot, "opencode.json"), "utf8"));
    assert.equal(
      opencode.skills.paths.includes("node_modules/compound-workflow/src/.agents/skills"),
      false,
      "old package-relative skill path should be removed"
    );
    assert.ok(opencode.skills.paths.includes(".agents/skills"), ".agents/skills should be present");
    assert.ok(opencode.skills.paths.includes("custom/skills"), "custom/skills should be preserved");
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
