# Statechart Review and Sign-Off

Use this process for every new machine proposal and every machine update.

This artifact is part of the compound workflow. Produce or update it in every phase, not only at the end.

## Required artifact bundle

For each machine change, create both files under `assets/statecharts/`:
- `<machine-name>-<timestamp>.mmd`
- `<machine-name>-<timestamp>.signoff.md`

Generate with:

```bash
./scripts/create-statechart-artifact.sh . <machine-name>
```

## Mermaid diagram requirements

Represent:
- Top-level states and nested states.
- Parallel regions where applicable.
- Key transitions, including wildcard routing (`domain.*`, `*`) when used.
- Terminal states and cancellation/failure paths.
- Tags that UI depends on (capture in sign-off notes if diagram labels become noisy).

## Review discussion checklist

1. Are scopes correct (events handled only where valid)?
2. Are parallel states used only for independent regions?
3. Are wildcard transitions fallback-oriented and not hiding core business flow?
4. Are retry/recovery states explicit?
5. Are UI-relevant tags represented and consistent with component selectors?
6. Are emitted imperative events (`emit`) intentional and documented?

## Phase-aware usage

1. Brainstorm phase
- Produce a draft `.mmd` artifact to compare options.
- Mark sign-off status as `DRAFT`.

2. Implementation-plan phase
- Update the same artifact line to the planned machine structure.
- Mark sign-off status as `PLANNED`.
- Capture unresolved decisions in review notes.

3. Implementation/delivery phase
- Update artifact to as-built machine behavior.
- Mark sign-off status as `APPROVED` when reviewed.
- Treat missing final artifact/sign-off as incomplete delivery.

## Final sign-off checklist

1. Diagram reflects current machine implementation.
2. Event namespace and wildcard behavior are reviewed.
3. Failure/cancel/recovery paths are reviewed.
4. Reviewer and date are recorded in `.signoff.md`.
5. Implementation is not marked complete until sign-off is present.
