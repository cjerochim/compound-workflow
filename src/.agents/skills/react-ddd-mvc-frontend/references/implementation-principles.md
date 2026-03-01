# Implementation Principles

## Hooks

- Use hooks to provide common access patterns and shared feature wiring.
- Keep hooks focused and reusable; avoid mixing unrelated responsibilities.

## Immutability and Functional Style

- Prefer immutable updates and pure transformations.
- Avoid hidden in-place mutation across layers.

## Simplicity (YAGNI)

- Do not add speculative abstractions or layers before they are needed.
- Optimize for readability and maintainability over cleverness.

## Boundary Reminder

- If a change requires complex machine orchestration, use `xstate-actor-orchestration` as the source of truth for machine patterns.

