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
    file: "docs/principles/workflow-baseline-principles.md",
    pattern: "/workflow:work` - implement in isolation with evidence (includes required triage gate)",
    description: "canonical flow routes triage through work by default",
  },
  {
    file: "docs/principles/workflow-baseline-principles.md",
    pattern: "Optional manual command:",
    description: "principles preserve standalone manual triage command",
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
    file: "src/AGENTS.md",
    pattern: "Standards baseline is mandatory for code/config changes.",
    description: "standards hard-gate policy in AGENTS",
  },
  {
    file: "README.md",
    pattern: "If docs conflict:",
    description: "README conflict resolution note",
  },
  {
    file: "README.md",
    anyOf: [
      "code/config changes require `/workflow:review`",
      "Independent review policy:",
    ],
    description: "README review gate policy",
  },
  {
    file: "README.md",
    anyOf: [
      "Standards baseline policy:",
      "standards baseline gate",
    ],
    description: "README standards baseline guardrail",
  },
  {
    file: "src/commands/workflow-plan.md",
    pattern: "Contract precedence:",
    description: "plan command precedence note",
  },
  {
    file: "src/commands/workflow-triage.md",
    pattern: "Contract precedence:",
    description: "triage command precedence note",
  },
  {
    file: "src/commands/workflow-triage.md",
    pattern: "independently runnable",
    description: "triage command explicitly standalone while work auto-runs triage",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "Contract precedence:",
    description: "work command precedence note",
  },
  {
    file: "src/commands/workflow-plan.md",
    pattern: "Start `/workflow:work`",
    description: "plan command default next-step routes to work",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "Environment Setup (Hard Gate)",
    description: "worktree hard-gate section in work command",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "Opt-out requires explicit user confirmation.",
    description: "worktree decision requires explicit opt-out in work command",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "Missing isolation approval is a hard blocker.",
    description: "work command blocks when isolation approval is absent",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern:
      "No source file writes, implementation commands, test/lint/typecheck commands, or dependency-install commands may run before this gate passes.",
    description: "pre-gate write/command prohibition in work command",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "npm run workflow:preflight",
    description: "work command requires executable workflow preflight",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "isolation_preflight:",
    description: "work command requires structured isolation_preflight evidence",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "If this block is missing, implementation has not started.",
    description: "missing isolation preflight blocks implementation",
  },
  {
    file: "src/commands/workflow-plan.md",
    pattern: "Implementation Start Preconditions",
    description: "plan template carries implementation start preconditions",
  },
  {
    file: "scripts/workflow-preflight.mjs",
    pattern: "current_checkout_approved",
    description: "workflow preflight script supports explicit current checkout approval",
  },
  {
    file: "package.json",
    pattern: "\"workflow:preflight\": \"node scripts/workflow-preflight.mjs\"",
    description: "workflow preflight script is exposed as npm command",
  },
  {
    file: "src/commands/workflow-review.md",
    pattern: "Contract precedence:",
    description: "review command precedence note",
  },
  {
    file: "src/commands/workflow-review.md",
    pattern: "Independent Reviewer Pass (REQUIRED)",
    description: "required independent reviewer pass in review command",
  },
  {
    file: "src/commands/workflow-review.md",
    pattern: "review_independence_mode: independent|degraded",
    description: "explicit review independence mode in review command",
  },
  {
    file: "src/commands/workflow-review.md",
    pattern: "what was skipped and why",
    description: "review skipped-pass disclosure requirement",
  },
  {
    file: "src/commands/workflow-review.md",
    pattern: "standards_compliance: pass|pass-with-notes|fail",
    description: "review standards compliance output field",
  },
  {
    file: "src/commands/workflow-review.md",
    pattern: "standards `MUST` violations => blocking finding and review recommendation `fail`",
    description: "review must-violation fail criteria",
  },
  {
    file: "src/skills/standards/SKILL.md",
    pattern: "## Mandatory Gates",
    description: "standards mandatory gates section",
  },
  {
    file: "src/skills/standards/SKILL.md",
    pattern: "pass|fail",
    description: "standards gates are pass/fail",
  },
];

const forbiddenChecks = [
  {
    file: "src/commands/workflow-work.md",
    pattern: "## When to Use Reviewer Agents",
    description: "legacy optional reviewer section in work command",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "**Don't use by default.**",
    description: "legacy skip-by-default reviewer wording in work command",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "skip specialist reviewers by default",
    description: "legacy skip-by-default specialist reviewer wording",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "Follow project coding standards (see AGENTS.md)",
    description: "legacy advisory-only coding standards wording in work command",
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
  const hasPattern = check.pattern ? contents.includes(check.pattern) : false;
  const hasAnyOf = Array.isArray(check.anyOf)
    ? check.anyOf.some((pattern) => contents.includes(pattern))
    : false;
  if (!hasPattern && !hasAnyOf) {
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
