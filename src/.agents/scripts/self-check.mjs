#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage(exitCode = 0) {
  const msg = `
Usage:
  node .agents/scripts/self-check.mjs [--root <repoRoot>]

Checks:
  - Every .agents/commands/**/*.md and .agents/agents/**/*.md is registered in opencode.json
  - Managed entries in opencode.json point to existing source files
  - Flags missing required frontmatter fields:
    - commands: description (all)
    - commands/workflow/**: invocation (recommended/expected)
    - agents: description (all)
`;
  (exitCode === 0 ? console.log : console.error)(msg.trimStart());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { root: process.cwd() };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") {
      const v = argv[i + 1];
      if (!v) usage(1);
      out.root = v;
      i++;
    } else if (a === "-h" || a === "--help") usage(0);
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

function parseFrontmatter(md) {
  if (!md.startsWith("---\n") && !md.startsWith("---\r\n")) return {};
  const end = md.indexOf("\n---", 4);
  if (end === -1) return {};
  const block = md.slice(4, end + 1);
  const out = {};
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)\s*$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2] ?? "";
    v = v.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    out[k] = v;
  }
  return out;
}

function discoverCommands(rootAbs) {
  const dir = path.join(rootAbs, ".agents", "commands");
  const files = walkFiles(dir, (p) => p.endsWith(".md"));
  const out = [];
  for (const fileAbs of files) {
    const rel = path.relative(rootAbs, fileAbs).replaceAll(path.sep, "/");
    const md = fs.readFileSync(fileAbs, "utf8");
    const fm = parseFrontmatter(md);
    const id = (fm.invocation || fm.name || path.basename(fileAbs, ".md")).trim();
    out.push({ fileAbs, rel, fm, id });
  }
  return out;
}

function discoverAgents(rootAbs) {
  const dir = path.join(rootAbs, ".agents", "agents");
  const files = walkFiles(dir, (p) => p.endsWith(".md"));
  const out = [];
  for (const fileAbs of files) {
    const rel = path.relative(rootAbs, fileAbs).replaceAll(path.sep, "/");
    const md = fs.readFileSync(fileAbs, "utf8");
    const fm = parseFrontmatter(md);
    const id = (fm.name || path.basename(fileAbs, ".md")).trim();
    out.push({ fileAbs, rel, fm, id });
  }
  return out;
}

function fileExists(rootAbs, rel) {
  return fs.existsSync(path.join(rootAbs, rel));
}

function main() {
  const args = parseArgs(process.argv);
  const rootAbs = realpathSafe(args.root);
  const opencodeAbs = path.join(rootAbs, "opencode.json");

  console.log(`Resolved root: ${rootAbs}`);
  console.log(`Checking opencode.json: ${opencodeAbs}`);

  if (!fs.existsSync(opencodeAbs)) {
    console.error("Error: missing opencode.json");
    process.exit(2);
  }

  const opencode = JSON.parse(stripJsonc(fs.readFileSync(opencodeAbs, "utf8")));
  const commandsReg = opencode.command ?? {};
  const agentsReg = opencode.agent ?? {};

  const errors = [];
  const warnings = [];

  const cmds = discoverCommands(rootAbs);
  const ags = discoverAgents(rootAbs);

  for (const c of cmds) {
    if (!c.id) errors.push(`Command missing id (name/invocation): ${c.rel}`);
    if (!c.fm.description) errors.push(`Command missing frontmatter description: ${c.rel} (${c.id || "?"})`);
    if (c.rel.startsWith(".agents/commands/workflow/") && !c.fm.invocation) {
      errors.push(`Workflow command missing frontmatter invocation: ${c.rel} (${c.id || "?"})`);
    }
    if (c.id && !commandsReg[c.id]) errors.push(`Command not registered in opencode.json: ${c.id} (source: ${c.rel})`);
  }

  for (const a of ags) {
    if (!a.id) errors.push(`Agent missing id (name): ${a.rel}`);
    if (!a.fm.description) errors.push(`Agent missing frontmatter description: ${a.rel} (${a.id || "?"})`);
    if (a.id && !agentsReg[a.id]) errors.push(`Agent not registered in opencode.json: ${a.id} (source: ${a.rel})`);
  }

  // Validate managed template/prompt pointers exist
  for (const [id, entry] of Object.entries(commandsReg)) {
    const tpl = entry?.template;
    if (typeof tpl !== "string") continue;
    if (!tpl.includes("@.agents/commands/")) continue;
    const m = tpl.match(/@(\.agents\/commands\/[^\n\r]+)/);
    const rel = m?.[1];
    if (rel && !fileExists(rootAbs, rel)) errors.push(`Managed command '${id}' points to missing file: ${rel}`);
  }

  for (const [id, entry] of Object.entries(agentsReg)) {
    const p = entry?.prompt;
    if (typeof p !== "string") continue;
    if (!p.includes("{file:.agents/agents/")) continue;
    const m = p.match(/\{file:(\.agents\/agents\/[^}]+)\}/);
    const rel = m?.[1];
    if (rel && !fileExists(rootAbs, rel)) errors.push(`Managed agent '${id}' points to missing file: ${rel}`);
  }

  if (warnings.length) {
    console.log("\nWarnings:");
    for (const w of warnings) console.log(`- ${w}`);
  }

  if (errors.length) {
    console.error("\nSelf-check failed:");
    for (const e of errors) console.error(`- ${e}`);
    process.exit(2);
  }

  console.log("Self-check passed.");
}

main();

