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
    pattern: "## Agent Index",
    description: "AGENTS agent registry section",
  },
  {
    file: "src/AGENTS.md",
    pattern: "frontend-react-specialist",
    description: "AGENTS frontend React specialist registry entry",
  },
  {
    file: "src/AGENTS.md",
    pattern: "backend-node-specialist",
    description: "AGENTS backend Node specialist registry entry",
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
    file: "src/commands/workflow-plan.md",
    pattern: "execution_route",
    description: "plan command assigns execution route per task",
  },
  {
    file: "src/commands/workflow-plan.md",
    pattern: "Do not invent fallback agent IDs.",
    description: "plan command prevents fake fallback agents",
  },
  {
    file: "src/commands/workflow-plan.md",
    pattern: "Agent Registry",
    description: "plan command reads agent registry for task routing",
  },
  {
    file: "src/commands/workflow-plan.md",
    pattern: "Agent Index from `AGENTS.md`",
    description: "plan command uses Agent Index as portable registry source",
  },
  {
    file: ".agents/commands/workflow-plan.md",
    pattern: "Agent Index from `AGENTS.md`",
    description: "active plan command uses Agent Index as portable registry source",
  },
  {
    file: "src/commands/workflow-plan.md",
    pattern: "active harness directories listed in the Repo Config Block `harnesses` value",
    description: "plan command resolves agents from configured harnesses",
  },
  {
    file: "src/commands/workflow-plan.md",
    pattern: "execution_route_validity",
    description: "plan command records execution route validity as part of isolation checks",
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
    file: "src/commands/workflow-work.md",
    pattern: "Resolve Agent and Skill Assignments",
    description: "work command validates assigned agents and skills",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "Execution route is contractual",
    description: "work command treats execution route as a contract",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "execution_contract.execution_route",
    description: "work command dispatches build phase by execution route",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "Reject invented fallback agent IDs.",
    description: "work command prevents fake fallback agents",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "Agent Index from `AGENTS.md`",
    description: "work command uses Agent Index as portable registry source",
  },
  {
    file: ".agents/commands/workflow-work.md",
    pattern: "Agent Index from `AGENTS.md`",
    description: "active work command uses Agent Index as portable registry source",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "No formal completion validation commands",
    description: "work command separates diagnostics from formal validation",
  },
  {
    file: ".agents/commands/workflow-work.md",
    pattern: "No formal completion validation commands",
    description: "active work command separates diagnostics from formal validation",
  },
  {
    file: "src/commands/workflow-plan.md",
    pattern: "Start `/workflow:work`",
    description: "plan command default next-step routes to work",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "## Opening Sequence",
    description: "work command starts with opening sequence",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "Ask the user to choose the execution context and wait for the answer",
    description: "work command requires explicit execution-context selection",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "`dedicated_worktree` is recommended, but never silently assumed or created.",
    description: "work command separates recommendation from action",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "Missing isolation selection is a hard blocker.",
    description: "work command blocks when isolation selection is absent",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern:
      "The selected worktree/current checkout verification and this checkpoint are the only allowed mutations before preflight.",
    description: "pre-preflight mutation boundary in work command",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "If this order is violated, stop. Do not repair automatically.",
    description: "generic ordering violation hard stop",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "npx compound-workflow preflight",
    description: "work command requires package-owned executable workflow preflight",
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
    file: "src/commands/workflow-work.md",
    pattern: "Phase 2 starts only after `isolation_preflight.status: passed`.",
    description: "post-preflight setup phase is ordered after preflight",
  },
  {
    file: "docs/principles/workflow-baseline-principles.md",
    pattern: "must start with an Opening Sequence that asks for the execution context",
    description: "baseline principle requires opening sequence isolation question",
  },
  {
    file: "src/AGENTS.md",
    pattern: "Isolation selection starts `/workflow:work`.",
    description: "AGENTS template records isolation selection first gate",
  },
  {
    file: "AGENTS.md",
    pattern: "Isolation selection starts `/workflow:work`.",
    description: "root AGENTS records isolation selection first gate",
  },
  {
    file: "src/skills/setup-agents/SKILL.md",
    pattern: "Isolation selection starts `/workflow:work`.",
    description: "setup-agents template records isolation selection first gate",
  },
  {
    file: "src/skills/setup-agents/SKILL.md",
    pattern: "## Agent Index",
    description: "setup-agents template includes agent registry",
  },
  {
    file: "src/skills/setup-agents/SKILL.md",
    pattern: "$agents_dirs",
    description: "setup-agents discovers agent directories",
  },
  {
    file: "src/skills/setup-agents/SKILL.md",
    pattern: "$agent_matrix",
    description: "setup-agents builds an agent matrix",
  },
  {
    file: "src/skills/setup-agents/SKILL.md",
    pattern: "Phase 3b: Build the Agent Index",
    description: "setup-agents has a deterministic Agent Index phase",
  },
  {
    file: "scripts/install-cli.mjs",
    pattern: "permission.edit = fm.permission_edit || permission.edit || \"deny\";",
    description: "installer defaults package-managed agents to edit deny unless source allows edit",
  },
  {
    file: "src/agents/specialists/backend-node-specialist.md",
    pattern: "formal `/workflow:work` validation gate",
    description: "backend specialist separates diagnostics from validation gate",
  },
  {
    file: "README.md",
    pattern: "starts with an Opening Sequence",
    description: "README documents opening sequence",
  },
  {
    file: "src/skills/git-worktree/SKILL.md",
    pattern: "Create a dedicated worktree only after explicit selection/confirmation",
    description: "git-worktree skill aligns with explicit selection",
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
    file: "scripts/install-cli.mjs",
    pattern: "args.command === \"preflight\"",
    description: "workflow preflight script is exposed as compound-workflow CLI subcommand",
  },
  {
    file: "src/commands/workflow-review.md",
    pattern: "Contract precedence:",
    description: "review command precedence note",
  },
  {
    file: "src/commands/workflow-review.md",
    pattern: "agent_routing_assessment: pass|pass-with-notes|fail",
    description: "review command assesses specialist routing quality",
  },
  {
    file: ".agents/commands/workflow-review.md",
    pattern: "agent_routing_assessment: pass|pass-with-notes|fail",
    description: "active review command assesses specialist routing quality",
  },
  {
    file: ".agents/commands/workflow-review.md",
    pattern: "execution_route",
    description: "active review command verifies execution route",
  },
  {
    file: "src/commands/workflow-review.md",
    pattern: "Specialist review does not replace independent review.",
    description: "review command keeps specialist review subordinate to independence gate",
  },
  {
    file: ".agents/commands/workflow-review.md",
    pattern: "Specialist review does not replace independent review.",
    description: "active review command keeps specialist review subordinate to independence gate",
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
    file: "src/commands/workflow-plan.md",
    pattern: "generic-build",
    description: "fake generic-build agent in plan command",
  },
  {
    file: ".agents/commands/workflow-plan.md",
    pattern: "generic-build",
    description: "fake generic-build agent in active plan command",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "generic-build",
    description: "fake generic-build agent in work command",
  },
  {
    file: ".agents/commands/workflow-work.md",
    pattern: "generic-build",
    description: "fake generic-build agent in active work command",
  },
  {
    file: "src/commands/workflow-plan.md",
    pattern: "Agent Registry from `AGENTS.md` and `.agents/agents/`",
    description: "hardcoded .agents agent registry lookup in plan command",
  },
  {
    file: ".agents/commands/workflow-plan.md",
    pattern: "Agent Registry from `AGENTS.md` and `.agents/agents/`",
    description: "hardcoded .agents agent registry lookup in active plan command",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "Agent Registry from `AGENTS.md` and `.agents/agents/`",
    description: "hardcoded .agents agent registry lookup in work command",
  },
  {
    file: ".agents/commands/workflow-work.md",
    pattern: "Agent Registry from `AGENTS.md` and `.agents/agents/`",
    description: "hardcoded .agents agent registry lookup in active work command",
  },
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
  {
    file: "src/commands/workflow-work.md",
    pattern: "select `dedicated_worktree` automatically",
    description: "silent dedicated worktree selection in work command",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "Otherwise, select `dedicated_worktree`",
    description: "implicit dedicated worktree fallback in work command",
  },
  {
    file: "src/commands/workflow-work.md",
    pattern: "return to Phase 2, create/update the isolation checkpoint",
    description: "automatic preflight recovery mutation in work command",
  },
  {
    file: "src/skills/git-worktree/SKILL.md",
    pattern: "default to a worktree (opt-out)",
    description: "legacy worktree opt-out wording",
  },
  {
    file: "src/skills/git-worktree/SKILL.md",
    pattern: "then bootstrap (copy env/config + install deps)",
    description: "legacy bootstrap-before-preflight wording",
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
