#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredChecks = [
  {
    file: "docs/principles/workflow-baseline-principles.md",
    pattern: "tie-breaker",
    description: "baseline principles tie-breaker rule",
  },
  {
    file: "src/AGENTS.md",
    pattern: "## Contract Precedence",
    description: "AGENTS contract precedence section",
  },
  {
    file: "src/AGENTS.md",
    pattern: "No ad-hoc artifacts outside canonical outputs",
    description: "canonical artifact policy in AGENTS",
  },
  {
    file: "README.md",
    pattern: "If docs conflict:",
    description: "README conflict resolution note",
  },
  {
    file: "README.md",
    pattern: "code/config changes require `/workflow:review`",
    description: "README review gate policy",
  },
  {
    file: "src/.agents/commands/workflow/plan.md",
    pattern: "Contract precedence:",
    description: "plan command precedence note",
  },
  {
    file: "src/.agents/commands/workflow/triage.md",
    pattern: "Contract precedence:",
    description: "triage command precedence note",
  },
  {
    file: "src/.agents/commands/workflow/work.md",
    pattern: "Contract precedence:",
    description: "work command precedence note",
  },
  {
    file: "src/.agents/commands/workflow/work.md",
    pattern: "HARD GATE - WORKTREE FIRST",
    description: "worktree hard-gate wording in work command",
  },
  {
    file: "src/.agents/commands/workflow/work.md",
    pattern:
      "No file writes, implementation commands, test/lint/typecheck commands, or dependency-install commands may run before this gate passes.",
    description: "pre-gate write/command prohibition in work command",
  },
  {
    file: "src/.agents/commands/workflow/work.md",
    pattern: "workflow_complete: false (pending /workflow:review current)",
    description: "implementation-complete pending-review status in work command",
  },
  {
    file: "src/.agents/commands/workflow/review.md",
    pattern: "Contract precedence:",
    description: "review command precedence note",
  },
  {
    file: "src/.agents/commands/workflow/review.md",
    pattern: "Independent Reviewer Pass (REQUIRED)",
    description: "required independent reviewer pass in review command",
  },
  {
    file: "src/.agents/commands/workflow/review.md",
    pattern: "review_independence_mode: independent|degraded",
    description: "explicit review independence mode in review command",
  },
  {
    file: "src/.agents/commands/workflow/review.md",
    pattern: "what was skipped and why",
    description: "review skipped-pass disclosure requirement",
  },
];

const forbiddenChecks = [
  {
    file: "src/.agents/commands/workflow/work.md",
    pattern: "## When to Use Reviewer Agents",
    description: "legacy optional reviewer section in work command",
  },
  {
    file: "src/.agents/commands/workflow/work.md",
    pattern: "**Don't use by default.**",
    description: "legacy skip-by-default reviewer wording in work command",
  },
  {
    file: "src/.agents/commands/workflow/work.md",
    pattern: "skip specialist reviewers by default",
    description: "legacy skip-by-default specialist reviewer wording",
  },
];

const failures = [];

const readFile = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
};

for (const check of requiredChecks) {
  const contents = readFile(check.file);
  if (!contents.includes(check.pattern)) {
    failures.push(`Missing required contract text (${check.description}) in ${check.file}`);
  }
}

for (const check of forbiddenChecks) {
  const contents = readFile(check.file);
  if (contents.includes(check.pattern)) {
    failures.push(`Found forbidden contract text (${check.description}) in ${check.file}`);
  }
}

if (failures.length > 0) {
  console.error("Workflow contract drift check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Workflow contract check passed.");
