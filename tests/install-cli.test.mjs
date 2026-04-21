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

/** Copy minimal package contents into node_modules so install runs as a consumer project. */
function copyMinimalPackageIntoNodeModules(projectRoot) {
  const pkgDir = path.join(projectRoot, "node_modules", "compound-workflow");
  fs.mkdirSync(path.join(pkgDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(pkgDir, "src"), { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, "scripts", "install-cli.mjs"),
    path.join(pkgDir, "scripts", "install-cli.mjs")
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

function setup() {
  const projectRoot = createTempProject();
  copyMinimalPackageIntoNodeModules(projectRoot);
  return projectRoot;
}

// ---------------------------------------------------------------------------

test("install: agents copied flat to .claude/agents/", () => {
  const projectRoot = setup();
  try {
    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const claudeAgentsDir = path.join(projectRoot, ".claude", "agents");
    assert.ok(fs.existsSync(claudeAgentsDir), ".claude/agents should exist");

    const entries = fs.readdirSync(claudeAgentsDir, { withFileTypes: true });
    assert.equal(entries.filter((e) => e.isDirectory()).length, 0, ".claude/agents should be flat (no subdirectories)");
    assert.ok(entries.filter((e) => e.isFile() && e.name.endsWith(".md")).length > 0, ".claude/agents should contain .md files");
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

    const srcSkills = path.join(repoRoot, "src", "skills");
    const expected = fs.readdirSync(srcSkills, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(srcSkills, e.name, "SKILL.md")))
      .map((e) => e.name);
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

test("install: copied files are real files, not symlinks", () => {
  const projectRoot = setup();
  try {
    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    for (const f of fs.readdirSync(path.join(projectRoot, ".claude", "agents"))) {
      const stat = fs.lstatSync(path.join(projectRoot, ".claude", "agents", f));
      assert.ok(!stat.isSymbolicLink(), `${f} in .claude/agents should be a real file`);
    }
    for (const f of fs.readdirSync(path.join(projectRoot, ".agents", "commands"))) {
      const stat = fs.lstatSync(path.join(projectRoot, ".agents", "commands", f));
      assert.ok(!stat.isSymbolicLink(), `${f} in .agents/commands should be a real file`);
    }
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

test("install preserves non-managed files in target dirs (e.g. .mdc rules)", () => {
  const projectRoot = setup();
  try {
    const userRule = path.join(projectRoot, ".cursor", "commands", "stale.mdc");
    fs.mkdirSync(path.dirname(userRule), { recursive: true });
    fs.writeFileSync(userRule, "user-rule", "utf8");

    const result = runInstall(projectRoot);
    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);
    assert.equal(fs.readFileSync(userRule, "utf8"), "user-rule", "install should not remove non-.md files");
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
