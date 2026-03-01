# Actor System Patterns

## 1. Orchestrator pattern

Use one actor as the policy owner for a workflow.

Responsibilities:
- Accept domain commands/events.
- Start/stop workers.
- Enforce timeout/retry/cancel policy.
- Translate worker outcomes into business states.

Do not put IO logic directly in orchestrator actions unless trivial.

## 2. Receptionist pattern in XState terms

In XState v5, this is implemented through actor-system registration and lookup:
- Register actors with `systemId`.
- Resolve actors via `system.get(systemId)` when direct refs are unavailable.

Use this when actors in different branches need late-bound communication.

## 3. Topology decision table

- Parent-child only:
- Use when communication is local and lifetime is tightly coupled.
- Receptionist lookup:
- Use when actor discovery must cross hierarchy boundaries.
- Event bus adapter actor:
- Use when integration requires protocol translation or fan-out.

## 4. Lifecycle guidance

- `invoke`:
- Prefer for state-bound tasks that should stop when exiting a state.
- `spawn`/`spawnChild`:
- Prefer for dynamic or longer-lived workers.
- Root actor:
- Own system-wide inspection and persistence boundaries.

## 5. Minimal receptionist example

```ts
import { createMachine, createActor, sendTo } from 'xstate';

const workerMachine = createMachine({
  id: 'worker',
  initial: 'idle',
  states: { idle: {} },
});

const rootMachine = createMachine({
  entry: ({ spawnChild }) => {
    spawnChild(workerMachine, {
      id: 'worker-local',
      systemId: 'worker.service',
    });
  },
  on: {
    'task.dispatch': {
      actions: sendTo(({ system }) => system.get('worker.service')!, {
        type: 'task.run',
      }),
    },
  },
});

createActor(rootMachine).start();
```

Guard against missing registrations before `sendTo`.
