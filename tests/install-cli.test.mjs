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

test("install syncs cursor commands into directories and wires local command paths", () => {
  const projectRoot = createTempProject();
  try {
    fs.mkdirSync(path.join(projectRoot, ".cursor", "commands"), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, ".cursor", "commands", "stale.md"), "stale", "utf8");

    const result = spawnSync(
      process.execPath,
      [installCli, "install", "--root", projectRoot, "--no-config"],
      { cwd: repoRoot, encoding: "utf8" }
    );

    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const cursorCommands = path.join(projectRoot, ".cursor", "commands");
    const cursorWork = path.join(cursorCommands, "workflow", "work.md");
    assert.ok(fs.existsSync(cursorWork), "expected .cursor command files to be copied");
    assert.ok(fs.lstatSync(cursorCommands).isDirectory(), ".cursor/commands should be a directory");
    assert.equal(fs.lstatSync(cursorCommands).isSymbolicLink(), false, ".cursor/commands should not be a symlink");
    assert.equal(fs.existsSync(path.join(cursorCommands, "stale.md")), false, "stale files should be replaced during sync");

    const localWork = path.join(projectRoot, ".agents", "compound-workflow", "commands", "workflow", "work.md");
    assert.ok(fs.existsSync(localWork), "expected local runtime command copy under .agents/compound-workflow");

    const opencode = JSON.parse(fs.readFileSync(path.join(projectRoot, "opencode.json"), "utf8"));
    assert.match(
      opencode.command["workflow:work"].template,
      /@\.agents\/compound-workflow\/commands\/workflow\/work\.md/,
      "workflow command template should point at local runtime command copy"
    );
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install skips cursor sync when .cursor is not present", () => {
  const projectRoot = createTempProject();
  try {
    const result = spawnSync(
      process.execPath,
      [installCli, "install", "--root", projectRoot, "--no-config"],
      { cwd: repoRoot, encoding: "utf8" }
    );

    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);

    const cursorDir = path.join(projectRoot, ".cursor");
    assert.equal(fs.existsSync(cursorDir), false, "install should not create .cursor when it is not present");
    assert.match(result.stdout, /Cursor integration: skipped \(.cursor not found\)\./);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("install skips .cursor/commands when .cursor-plugin already supplies commands", () => {
  const projectRoot = createTempProject();
  try {
    fs.mkdirSync(path.join(projectRoot, ".cursor"), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, ".cursor-plugin"), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, ".cursor-plugin", "plugin.json"),
      JSON.stringify({ name: "x", commands: "src/.agents/commands" }),
      "utf8"
    );

    const result = spawnSync(
      process.execPath,
      [installCli, "install", "--root", projectRoot, "--no-config"],
      { cwd: repoRoot, encoding: "utf8" }
    );

    assert.equal(result.status, 0, `installer failed: ${result.stderr}\n${result.stdout}`);
    assert.equal(
      fs.existsSync(path.join(projectRoot, ".cursor", "commands")),
      false,
      "installer should skip .cursor/commands when plugin already provides commands"
    );
    assert.match(
      result.stdout,
      /commands supplied by \.cursor-plugin/,
      "expected installer output to explain skipped cursor command sync"
    );
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
