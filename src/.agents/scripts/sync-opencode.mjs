#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage(exitCode = 0) {
  const msg = `
Usage:
  node .agents/scripts/sync-opencode.mjs [--root <repoRoot>] [--dry-run]

What it does:
  - Discovers commands from .agents/commands/**/*.md
    - id: frontmatter 'invocation' (preferred) else 'name' else filename
  - Discovers agents from .agents/agents/**/*.md
    - id: frontmatter 'name' else filename
  - Creates/updates repo-root opencode.json with managed command/agent entries
  - Prunes managed entries whose source files no longer exist

Output:
  - Always prints resolved root and absolute modified paths
  - Prints idempotency summary (0 changes needed vs updated N managed entries)
`;
  (exitCode === 0 ? console.log : console.error)(msg.trimStart());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { root: process.cwd(), dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--root") {
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
  // Removes // and /* */ comments while preserving strings.
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

function readJsonMaybeJsonc(fileAbs) {
  if (!fs.existsSync(fileAbs)) return null;
  const raw = fs.readFileSync(fileAbs, "utf8");
  const stripped = stripJsonc(raw);
  return JSON.parse(stripped);
}

function parseFrontmatter(md) {
  // Only supports simple YAML key: value lines (enough for name/description/invocation).
  if (!md.startsWith("---\n") && !md.startsWith("---\r\n")) return {};
  const end = md.indexOf("\n---", 4);
  if (end === -1) return {};
  const block = md.slice(4, end + 1); // include trailing newline for simpler parsing
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

function isUnder(parentAbs, childAbs) {
  const rel = path.relative(parentAbs, childAbs);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function discoverCommands(rootAbs) {
  const commandsDir = path.join(rootAbs, ".agents", "commands");
  const files = walkFiles(commandsDir, (p) => p.endsWith(".md"));
  const map = new Map();
  const warnings = [];
  for (const fileAbs of files) {
    const rel = path.relative(rootAbs, fileAbs).replaceAll(path.sep, "/");
    const md = fs.readFileSync(fileAbs, "utf8");
    const fm = parseFrontmatter(md);
    const id = (fm.invocation || fm.name || path.basename(fileAbs, ".md")).trim();
    const description = (fm.description || id).trim();
    if (!id) {
      warnings.push(`Command file missing id (name/invocation): ${rel}`);
      continue;
    }
    if (!fm.description) warnings.push(`Command missing frontmatter description: ${rel} (${id})`);

    // Prefer first occurrence to avoid silent overwrites.
    if (map.has(id)) {
      warnings.push(`Duplicate command id '${id}': ${rel} (already have ${map.get(id).rel})`);
      continue;
    }
    map.set(id, { id, rel, fileAbs, description });
  }
  return { map, warnings };
}

function discoverAgents(rootAbs) {
  const agentsDir = path.join(rootAbs, ".agents", "agents");
  const files = walkFiles(agentsDir, (p) => p.endsWith(".md"));
  const map = new Map();
  const warnings = [];
  for (const fileAbs of files) {
    const rel = path.relative(rootAbs, fileAbs).replaceAll(path.sep, "/");
    const md = fs.readFileSync(fileAbs, "utf8");
    const fm = parseFrontmatter(md);
    const id = (fm.name || path.basename(fileAbs, ".md")).trim();
    const description = (fm.description || id).trim();
    if (!id) {
      warnings.push(`Agent file missing id (name): ${rel}`);
      continue;
    }
    if (!fm.description) warnings.push(`Agent missing frontmatter description: ${rel} (${id})`);
    if (map.has(id)) {
      warnings.push(`Duplicate agent id '${id}': ${rel} (already have ${map.get(id).rel})`);
      continue;
    }
    map.set(id, { id, rel, fileAbs, description });
  }
  return { map, warnings };
}

function ensureObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + "\n";
}

function buildManagedCommandTemplate(cmdRel) {
  // Keep simple + consistent with existing docs.
  return `@AGENTS.md\n@${cmdRel}\nArguments: $ARGUMENTS\n`;
}

function buildManagedAgentPrompt(agentRel) {
  return `{file:${agentRel}}`;
}

function isManagedCommand(entry) {
  const tpl = entry?.template;
  return typeof tpl === "string" && tpl.includes("@.agents/commands/");
}

function isManagedAgent(entry) {
  const p = entry?.prompt;
  return typeof p === "string" && p.includes("{file:.agents/agents/");
}

function fileExists(rootAbs, rel) {
  const abs = path.join(rootAbs, rel);
  return fs.existsSync(abs);
}

function main() {
  const args = parseArgs(process.argv);
  const rootAbs = realpathSafe(args.root);
  const agentsDir = path.join(rootAbs, ".agents");
  const commandsDir = path.join(agentsDir, "commands");
  const agentsMdAbs = path.join(rootAbs, "AGENTS.md");
  const opencodeAbs = path.join(rootAbs, "opencode.json");

  if (!fs.existsSync(commandsDir)) {
    console.error(`Error: missing .agents/commands in ${rootAbs}`);
    process.exit(2);
  }
  if (!fs.existsSync(path.join(agentsDir, "agents"))) {
    console.error(`Error: missing .agents/agents in ${rootAbs}`);
    process.exit(2);
  }

  const { map: commands, warnings: cmdWarn } = discoverCommands(rootAbs);
  const { map: agents, warnings: agentWarn } = discoverAgents(rootAbs);
  const warnings = [...cmdWarn, ...agentWarn];

  const existing = readJsonMaybeJsonc(opencodeAbs) ?? {};
  const next = structuredClone(existing);

  const SKILLS_COMPOUND_PATH = ".agents/compound-workflow-skills";
  next.$schema = next.$schema || "https://opencode.ai/config.json";
  next.skills = ensureObject(next.skills);
  next.skills.paths = Array.isArray(next.skills.paths) ? next.skills.paths : [".agents/skills"];
  const hasCompoundWorkflow =
    fs.existsSync(path.join(rootAbs, "node_modules", "compound-workflow")) ||
    fs.existsSync(path.join(rootAbs, SKILLS_COMPOUND_PATH));
  if (hasCompoundWorkflow && !next.skills.paths.includes(SKILLS_COMPOUND_PATH)) {
    next.skills.paths.unshift(SKILLS_COMPOUND_PATH);
  }
  next.command = ensureObject(next.command);
  next.agent = ensureObject(next.agent);

  let created = 0;
  let updated = 0;
  let pruned = 0;

  // Upsert commands
  for (const [id, cmd] of commands.entries()) {
    const entry = ensureObject(next.command[id]);
    const desired = {
      ...entry,
      description: cmd.description,
      agent: "build",
      template: buildManagedCommandTemplate(cmd.rel),
    };
    const before = JSON.stringify(next.command[id] ?? null);
    const after = JSON.stringify(desired);
    if (!next.command[id]) created++;
    else if (before !== after) updated++;
    next.command[id] = desired;
  }

  // Upsert agents
  for (const [id, ag] of agents.entries()) {
    const entry = ensureObject(next.agent[id]);
    const desired = {
      ...entry,
      description: ag.description,
      mode: "subagent",
      prompt: buildManagedAgentPrompt(ag.rel),
      permission: {
        ...(ensureObject(entry.permission)),
        edit: ensureObject(entry.permission).edit ?? "deny",
      },
    };
    const before = JSON.stringify(next.agent[id] ?? null);
    const after = JSON.stringify(desired);
    if (!next.agent[id]) created++;
    else if (before !== after) updated++;
    next.agent[id] = desired;
  }

  // Prune stale managed commands
  for (const [id, entry] of Object.entries(next.command)) {
    if (!isManagedCommand(entry)) continue;
    const tpl = entry.template;
    const m = tpl.match(/@(\.agents\/commands\/[^\n\r]+)/);
    const rel = m?.[1];
    if (!rel) continue;
    if (!fileExists(rootAbs, rel)) {
      delete next.command[id];
      pruned++;
    }
  }

  // Prune stale managed agents
  for (const [id, entry] of Object.entries(next.agent)) {
    if (!isManagedAgent(entry)) continue;
    const p = entry.prompt;
    const m = p.match(/\{file:(\.agents\/agents\/[^}]+)\}/);
    const rel = m?.[1];
    if (!rel) continue;
    if (!fileExists(rootAbs, rel)) {
      delete next.agent[id];
      pruned++;
    }
  }

  const afterText = stableStringify(next);
  // Semantic idempotency (ignore formatting / key order differences in the source file).
  const semanticChanged = JSON.stringify(existing) !== JSON.stringify(next);

  console.log(`Resolved root: ${rootAbs}`);
  console.log(`Target opencode.json: ${opencodeAbs}`);
  if (!fs.existsSync(agentsMdAbs)) console.log(`Note: missing AGENTS.md at ${agentsMdAbs} (commands may still run; templates reference it).`);

  if (warnings.length) {
    console.log("\nWarnings:");
    for (const w of warnings) console.log(`- ${w}`);
  }

  if (!semanticChanged) {
    console.log("\nIdempotency: 0 changes needed.");
    process.exit(0);
  }

  console.log(`\nPlanned managed changes: created=${created}, updated=${updated}, pruned=${pruned}`);
  if (args.dryRun) {
    console.log("Dry-run: no changes made.");
    process.exit(0);
  }

  fs.writeFileSync(opencodeAbs, afterText, "utf8");
  console.log(`Wrote: ${opencodeAbs}`);
  console.log(`Idempotency: updated ${created + updated + pruned} managed entries.`);
}

main();

