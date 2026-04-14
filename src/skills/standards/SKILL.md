---
name: standards
description: >
  Enforce frontend code standards when writing, reviewing, or refactoring frontend code.
  Use this skill for all frontend work — new features, PR reviews, refactors,
  component creation, or any code quality assessment. This skill defines mandatory pass/fail gates.
  If the user is writing, reading, or evaluating frontend code in any form, use this skill
  immediately — do not rely on general knowledge.
---

# Frontend Standards

Five themes apply to all frontend work. All must be satisfied.

| Theme | Concern |
|---|---|
| **Architecture** | Layered model, layer boundaries, data flow direction |
| **Code Quality** | Control flow, immutability, error handling |
| **Services** | IO boundary, Effect Layer structure, runtime composition |
| **State Management** | Controller responsibilities, state and event contracts |
| **Presentation** | Component structure, composition patterns, visual conventions |

---

## When to Load Reference Files

Load the relevant reference before reviewing or writing code in that area.

| Situation | Load |
|---|---|
| Layer structure, boundaries, or data flow | `references/architecture.md` |
| Control flow, error handling, or data transforms | `references/code-quality.md` |
| Effect services, Layers, or runtime composition | `references/services.md` |
| State machines, events, context, or actor patterns | `references/state-management.md` |
| Component structure or visual conventions | `references/presentation.md` |
| Full review or uncertainty about which layer applies | All five |

---

## Mandatory Gates

Each is **pass/fail**. A single `fail` means the work is incomplete.

| Gate | Theme | Rule |
|---|---|---|
| `architecture` | Architecture | All layers honour their boundaries — no layer reaches past its neighbour |
| `code_quality` | Code Quality | Control flow is flat, transforms are immutable, errors are handled explicitly |
| `services` | Services | All IO is isolated to the service layer — no IO in entities, controllers, or containers |
| `state_management` | State Management | Controllers own state; containers extract values and callbacks — never pass raw machine internals to components |
| `presentation` | Presentation | Components follow the folder, composition, and visual conventions |

---

## Required Evidence Format

Record in all work outputs and code reviews:

```markdown
standards_compliance:
  - architecture: pass|fail (evidence: file:line)
  - code_quality: pass|fail (evidence: file:line)
  - services: pass|fail (evidence: file:line)
  - state_management: pass|fail (evidence: file:line)
  - presentation: pass|fail (evidence: file:line)
```

On any `fail`: load the relevant reference file, surface the specific violation with evidence, explain the rule broken, and show the corrected pattern. List **all** failures before summarising — do not stop at the first.

---

## Reference Files

| File | Theme | Contents |
|---|---|---|
| `references/architecture.md` | Architecture | Layered model, layer responsibilities, file structure, import rules |
| `references/code-quality.md` | Code Quality | Control flow, immutability, error handling, validation boundary |
| `references/services.md` | Services | Effect Layer pattern, service structure, runtime composition |
| `references/state-management.md` | State Management | XState v5 patterns, events, guards, actions, actor communication |
| `references/presentation.md` | Presentation | Folder structure, compound components, barrel pattern, visual conventions |
