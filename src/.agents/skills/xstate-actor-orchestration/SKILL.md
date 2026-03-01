---
name: xstate-actor-orchestration
description: Implement complex interaction models with XState v5 actor systems, including receptionist-style actor lookup with system IDs, orchestrator/coordinator parent actors, cross-actor messaging, lifecycle management with invoke/spawn, persistence and recovery, runtime inspection, and model-based testing. Use when designing or refactoring state-heavy workflows, async process coordination, retries/timeouts, or multi-actor frontend/backend logic in JavaScript or TypeScript.
---

# XState Actor Orchestration

Execute this workflow to design and implement robust interaction models with XState v5.

## Workflow

1. Model the interaction boundary.
- Identify external actors (UI, API, queues, timers, humans).
- Identify internal actors (orchestrator, workers, adapters).
- Define success, partial success, terminal failure, and compensation behavior.

2. Choose actor topology.
- Use a root orchestrator actor for cross-step coordination and policy decisions.
- Use worker actors for isolated tasks (IO, retries, transforms).
- Use receptionist-style lookup (`systemId` + `system.get`) when actors must be discoverable across branches.
- Use direct parent-child refs when communication can stay local.

3. Define event contracts before transitions.
- Create explicit event unions and payload schemas.
- Use namespaced event types (`checkout.submit`, `payment.authorized`).
- Plan wildcard routes for orchestration (`payment.*`, `checkout.*`, `*`) with explicit precedence.
- Keep error events explicit and typed.

4. Compose machine structure before writing actions.
- Start with nested states to scope events and transitions to relevant regions.
- Use parallel states when regions are independent and can progress concurrently.
- Use sequential flow only when one stage must complete before the next starts.
- Apply tags as stable UI selectors for state intent (`loading`, `error`, `submitting`), not ad-hoc booleans.

5. Implement with typed machine setup.
- Use `setup({...}).createMachine(...)`.
- Prefer named actions/guards/actors over inline logic.
- Use `invoke` for state-scoped lifetimes and `spawn`/`spawnChild` for dynamic long-lived workers.
- Use `emit(...)` for imperative out-of-band notifications when a fire-and-forget signal is needed.

6. Add reliability policy.
- Model retries, backoff, and circuit-breaker behavior as explicit states.
- Persist snapshots for restart/resume flows when required.
- Model idempotency boundaries for side effects.

7. Add observability.
- Attach `inspect` at root actor creation for runtime traces.
- Emit domain-level telemetry from actions, not from random call sites.

8. Prove behavior.
- Add unit tests for guards/actions and transition paths.
- Add model/path-based coverage for critical flows.
- Verify timeout, cancellation, and recovery paths.

9. Produce statechart review artifact and sign-off package.
- For every proposed or updated machine, generate a Mermaid statechart artifact.
- Store artifacts under `assets/statecharts/`.
- Treat the diagram as required for review discussion and final sign-off.
- Record review notes and approval in a paired sign-off file.
- Add or update the artifact at the current workflow phase:
- Brainstorm: create a draft diagram for option discussion.
- Implementation plan: refine the diagram into the proposed target design.
- Implementation/delivery: finalize the as-built diagram and complete sign-off.

## Pattern Selection

Use the references selectively:
- Start with [references/source-map.md](references/source-map.md) to pick source docs.
- Use [references/actor-system-patterns.md](references/actor-system-patterns.md) for receptionist/orchestrator structures.
- Use [references/event-contracts.md](references/event-contracts.md) before coding transitions.
- Use [references/functional-domain-patterns.md](references/functional-domain-patterns.md) for pure transforms and early-return style.
- Use [references/machine-structure-and-tags.md](references/machine-structure-and-tags.md) for nested/parallel composition and tags.
- Use [references/react-container-pattern.md](references/react-container-pattern.md) for React integration with containers and pure components.
- Use [references/reliability-observability.md](references/reliability-observability.md) for persistence/inspection/retry policy.
- Use [references/testing-strategy.md](references/testing-strategy.md) for verification.
- Use [references/statechart-review-and-signoff.md](references/statechart-review-and-signoff.md) for required Mermaid artifact workflow.
- Use [references/skill-validation.md](references/skill-validation.md) to validate skill quality without Python tooling.

## Implementation Rules

- Keep orchestrator context small and policy-focused.
- Keep domain/entity object transformations in pure functions or dedicated modules, not large inline action bodies.
- Use immutable transforms (`input -> output`) that are directly unit-testable.
- Use early returns in actions/guards/transforms instead of deep nested `if/else` trees.
- Never model machine control flow with booleans; represent control flow with states, substates, and tags.
- Do not send untyped catch-all events (`{ type: 'ERROR', data: any }`).
- Route by event namespace first, then by event detail.
- Keep wildcard transitions as fallback, not primary business routing.
- Prefer one-way responsibilities: orchestrator decides; workers execute; adapters translate external systems.
- In React, use container components as controllers that bind actor refs/selectors to presentational components.
- Keep presentational components pure; they receive props and render only.
- Use `useSelector` to read actor snapshot/state/context in containers.
- Use `useEffect` to subscribe to emitted actor events for fire-and-forget UI effects (toasts, navigation, analytics).
- Do not complete machine review without a Mermaid statechart and a sign-off record.

## Validation (No Python Required)

Run:

```bash
./scripts/validate-skill.sh .
```

Validate before proposing completion:
- Frontmatter includes only `name` and `description`.
- `name` matches folder naming rules.
- `agents/openai.yaml` includes a `default_prompt` mentioning `$<skill-name>`.
- No unresolved TODO placeholders remain.
- Local references linked from `SKILL.md` exist.
- `assets/statecharts/` exists for diagram artifacts.

Generate a new artifact bundle:

```bash
./scripts/create-statechart-artifact.sh . <machine-name> [timestamp] [DRAFT|PLANNED|APPROVED]
```

## Minimal Starter Skeleton

```ts
import { setup, assign, sendTo, fromPromise } from 'xstate';

type FlowEvent =
  | { type: 'flow.start'; input: { orderId: string } }
  | { type: 'payment.ok'; txnId: string }
  | { type: 'payment.fail'; reason: string }
  | { type: 'flow.cancel' };

interface FlowContext {
  orderId?: string;
  txnId?: string;
  error?: string;
}

const paymentLogic = fromPromise(async ({ input }: { input: { orderId: string } }) => {
  return { txnId: `txn-${input.orderId}` };
});

export const flowMachine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvent,
  },
  actors: {
    paymentLogic,
  },
  actions: {
    captureInput: assign(({ event }) =>
      event.type === 'flow.start' ? { orderId: event.input.orderId } : {}
    ),
    setError: assign(({ event }) =>
      event.type === 'payment.fail' ? { error: event.reason } : {}
    ),
    notifyWorker: sendTo('payment-worker', ({ context }) => ({
      type: 'run',
      orderId: context.orderId,
    })),
  },
}).createMachine({
  id: 'flow.orchestrator',
  initial: 'idle',
  context: {},
  states: {
    idle: {
      on: {
        'flow.start': {
          target: 'authorizing',
          actions: 'captureInput',
        },
      },
    },
    authorizing: {
      invoke: {
        id: 'payment-worker',
        src: 'paymentLogic',
        input: ({ context }) => ({ orderId: context.orderId! }),
        onDone: {
          target: 'done',
          actions: assign(({ event }) => ({ txnId: event.output.txnId })),
        },
        onError: {
          target: 'failed',
          actions: assign(({ event }) => ({ error: String(event.error) })),
        },
      },
      on: {
        'flow.cancel': 'cancelled',
      },
    },
    done: { type: 'final' },
    failed: {},
    cancelled: {},
  },
});
```

Adapt the skeleton to domain events and actor topology; keep contracts and state semantics explicit.
