---
name: react-ddd-mvc-frontend
description: Apply React frontend architecture standards using a DDD + MVC hybrid. Use when planning or reviewing frontend work to enforce domain-based feature structure, clear layer boundaries, composable pure components, container-driven composition, and XState controller integration.
---

# React DDD + MVC Frontend Standards

Use this skill as a reference standard during brainstorming, planning, implementation, and code review for frontend work.

## Workflow

1. Confirm frontend applicability.
- Use this skill when work changes React UI architecture, feature structure, components, containers, hooks, services, or controller state flow.
- Skip when no frontend surface is affected.

2. Load standards baseline.
- Start with [references/source-map.md](references/source-map.md).
- Load [references/feature-structure.md](references/feature-structure.md) and [references/responsibility-gates.md](references/responsibility-gates.md) first.

3. Enforce feature-by-domain structure.
- Group items into domains.
- Default location: `src/features/<feature-name>/`.
- Allow shared concerns under `src/features/common/` only when genuinely cross-domain.

4. Enforce DDD + MVC boundaries.
- Keep domain entities in `domain/entities`.
- Keep presentation concerns in `presentation`.
- Keep orchestration and composition in `application`.
- Keep IO adapters in `infrastructure`.

5. Apply controller/machine guidance.
- Controllers are XState machines in `application/controller`.
- For XState orchestration patterns, defer to `xstate-actor-orchestration`.

6. Apply coding style constraints.
- Prefer immutability and functional patterns.
- Apply YAGNI to avoid speculative abstractions.
- Optimize for simplicity, maintainability, and readability.

## Output Contract

When used in planning:
- Use applicable MUST gates as a checklist to shape acceptance criteria.
- Call out any boundary exceptions and rationale.

When used in review:
- Report MUST violations as high-priority findings by default.
- Report SHOULD violations as improvement findings.

When used in brainstorm/work:
- Use the structure and gates as reference guidance, not as a hard precondition.
