# State Management Reference

The controller layer is implemented using **XState v5**. This reference covers all patterns, conventions, and rules for writing correct, maintainable state machines.

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [Setup Pattern](#2-setup-pattern)
3. [State Nodes](#3-state-nodes)
4. [Context](#4-context)
5. [Events](#5-events)
6. [Guards](#6-guards)
7. [Actions](#7-actions)
8. [Actors — invoke vs spawn](#8-actors--invoke-vs-spawn)
9. [Cross-Machine Communication](#9-cross-machine-communication)
10. [Effect Runtime Injection](#10-effect-runtime-injection)
11. [Tags](#11-tags)
12. [File Organisation](#12-file-organisation)
13. [v5 API Changes from v4](#13-v5-api-changes-from-v4)
14. [Quick Check — Common Violations](#14-quick-check--common-violations)

---

## 1. Core Principles

### States represent behaviour, context holds data

A state node answers "what is the machine doing right now?"
Context answers "what data does the machine have?"

If you find yourself switching on a context value to determine behaviour — that value should be a state node, not context.

### Explicit over implicit

Every possible transition is declared in the chart. No hidden control flow, no behaviour that emerges from combinations of context values. If it's not in the chart, it doesn't happen.

### State chart over boolean flags

Model finite conditions as state nodes, not context booleans. Context booleans that gate behaviour are undeclared states — they make the machine harder to reason about and impossible to visualise.

```typescript
// ❌ State disguised as context
type Context = {
  isLoading: boolean;
  isOpen: boolean;
  viewMode: "folder" | "search";
};

// ✅ Modelled as state nodes
states: {
  idle: {},
  loading: {},
  folderView: {},
  searchView: {},
}
```

---

## 2. Setup Pattern

`setup()` is the idiomatic entry point for all machines in v5. Declare all types, guards, actors, and actions here — before the machine definition — so XState can infer and propagate types throughout.

```typescript
import { setup, assign, fromPromise, sendTo, enqueueActions } from "xstate";
import * as playlistSelectionEntity from "src/features/{feature}/domain/entities/PlaylistSelectionEntity";

export const playlistMachine = setup({
  types: {} as {
    input: { runtime: typeof AppRuntime };
    context: {
      runtime: typeof AppRuntime;
      playlists: Playlist[];
      activeFolderId: string | null;
    };
    events:
      | { type: "playlist.load"; payload: { folderId: string } }
      | { type: "playlist.sync"; payload: { playlists: Playlist[] } }
      | { type: "playlist.public.selectionChanged"; payload: { ids: string[] } };
  },
  guards: {
    hasPlaylists: ({ context }) =>
      playlistSelectionEntity.hasPlaylists(context.playlists),
    hasAddedPlaylists: ({ context, event }) =>
      playlistSelectionEntity.hasAddedPlaylists({
        current: context.playlists,
        incoming: event.payload.playlists,
      }),
  },
  actions: {
    assignPlaylists: assign({
      playlists: ({ event }) => event.payload.playlists,
    }),
    notifyLoaded: sendTo(
      ({ system }) => system.get("notifier"),
      { type: "notifier.notify", payload: { message: "Playlists loaded" } }
    ),
  },
  actors: {
    fetchPlaylists: fromPromise(
      ({ input }: { input: { runtime: typeof AppRuntime; folderId: string } }) =>
        input.runtime.runPromise(
          PlaylistService.pipe(Effect.flatMap(svc => svc.fetchPlaylists(input.folderId)))
        )
    ),
  },
}).createMachine({
  context: ({ input }) => ({
    runtime: input.runtime,
    playlists: [],
    activeFolderId: null,
  }),
  // ...
});
```

**Everything declared in `setup()` is strongly typed throughout the machine.** Guards, actions, and actors are referenced by string key inside the machine config — XState infers from the `setup()` declaration.

---

## 3. State Nodes

### Every state node requires a comment

Every state node must have a comment describing its intent — what it represents in the domain, not what it does mechanically.

```typescript
states: {
  idle: {
    // Waiting for the user to initiate an action. No background work.
  },
  loading: {
    // Fetching playlist data from the backend via the injected runtime.
    // Transitions to loaded on success, error on failure.
  },
  backgroundSync: {
    // Receives external data updates and syncs into context.
    // Runs concurrently with foreground states — neither blocks the other.
    type: "parallel",
    states: { ... }
  },
}
```

### Parallel states

Use `type: "parallel"` when multiple independent concerns must be active simultaneously. Each region is self-contained — regions do not transition into each other.

```typescript
states: {
  session: {
    // Manages auth and data sync as independent concurrent concerns.
    type: "parallel",
    states: {
      auth: {
        // Tracks authentication state independently of data loading.
        initial: "authenticated",
        states: {
          authenticated: { /* ... */ },
          expired: { /* ... */ },
        },
      },
      sync: {
        // Polls for data updates independently of auth state.
        initial: "idle",
        states: {
          idle: { /* ... */ },
          polling: { /* ... */ },
        },
      },
    },
  },
}
```

**When to use parallel states vs separate machines:**
- Use `type: "parallel"` when concerns share context and lifecycle — they start and stop together
- Use separate invoked machines when concerns are fully independent and need their own context
- Do not use parallel states for concerns that need to coordinate transitions between regions — that coupling is a signal to rethink the model

### Reenter behaviour (`reenter: true`)

In v5, transitions to a sibling or descendant state within a compound state are **internal by default** — entry and exit actions on the parent state do not fire. If you need the parent's entry/exit to re-run, you must opt in explicitly with `reenter: true`.

```typescript
states: {
  editing: {
    // User is actively editing a playlist item.
    entry: "resetForm",
    states: {
      idle: {},
      saving: {},
    },
    on: {
      "playlist.reset": {
        target: "editing.idle",
        // ✅ Explicitly re-enters editing — resetForm fires again
        reenter: true,
      },
      "playlist.save": {
        // ❌ Without reenter: true, resetForm does NOT fire on this transition
        target: "editing.saving",
      },
    },
  },
}
```

This is a common source of bugs when migrating from v4, where external transitions were the default.

---

## 4. Context

Context is appropriate for:
- **Payloads** — data received from events, passed downstream to containers
- **Previous values** — snapshots held for diffing/change detection
- **Derived UI data** — transformed data ready for containers to select
- **Identifiers** — IDs and references needed across transitions
- **Actor refs** — parent references passed via `input` for child-to-parent communication
- **Runtime** — the injected Effect runtime (infrastructure, not domain data)

Context is **not** appropriate for:
- Values you switch on to determine transitions
- Flags that represent where the machine is or what it's doing
- Anything with a finite set of values that map to distinct behaviours

**Exception — previous values:** Storing previous values for change detection is valid data, not state.

```typescript
type Context = {
  previousHierarchy: Hierarchy | null; // for diffing against incoming value
};
```

**Exception — runtime:** The Effect runtime lives in context as the sanctioned infrastructure exception. It is never switched on for transitions.

```typescript
type Context = {
  runtime: typeof AppRuntime; // injected once, used to call services
};
```

### Type-Safe Context Access

When types are defined in `setup({ types: { context: ... } })`, destructure directly without casting. XState's `setup()` provides full type inference — trust the types.

```typescript
// Machine with typed context
export const machine = setup({
  types: {
    context: {} as { sidebarCollapsed: boolean; currentRoute: string },
  },
}).createMachine({
  context: { sidebarCollapsed: false, currentRoute: "/" },
  // ...
});

// Container — no casting needed
const [snapshot] = useMachine(machine);
const { sidebarCollapsed, currentRoute } = snapshot.context; // Fully typed
```

```typescript
// ❌ Casting when types are already declared in setup()
const collapsed = (snapshot.context as { sidebarCollapsed: boolean }).sidebarCollapsed;

// ✅ Destructure directly — types flow from setup()
const { sidebarCollapsed } = snapshot.context;
```

---

## 5. Events

### String literal unions, not enums

Events are typed as **string literal discriminated unions**. XState v5's type inference in `setup()` flows from the union declared in `types.events`. Enums produce opaque values that break this inference chain and add unnecessary runtime overhead.

```typescript
// ✅ String literal union — inference flows through setup(), zero runtime cost
setup({
  types: {} as {
    events:
      | { type: "playlist.load"; payload: { folderId: string } }
      | { type: "playlist.sync"; payload: { playlists: Playlist[] } };
  },
})

// ❌ Enum — breaks XState v5 type inference
enum EventType {
  LOAD = "playlist.load",
  SYNC = "playlist.sync",
}
```

### Namespace convention

**Internal events** — private to the machine, defined in the controller file:
```
{ type: "{controllerNamespace}.{eventName}" }

// e.g.
{ type: "playlist.load" }
{ type: "playlist.sync" }
```

**Public events** — cross-machine API, defined in `types.ts`:
```
{ type: "{controllerNamespace}.public.{eventName}" }

// e.g.
{ type: "playlist.public.selectionChanged" }
```

### Partial event wildcards

Because events follow dot-delimited namespaces, you can handle an entire namespace group with a wildcard (`.*`). This is intentional — the naming convention enables the pattern.

```typescript
on: {
  // Handle all playlist events in one transition
  "playlist.*": {
    actions: "logPlaylistEvent",
  },

  // More specific transitions are checked first — wildcard is a fallback
  "playlist.load": {
    target: "loading",
  },
}
```

Use wildcards for cross-cutting concerns (logging, analytics, error boundaries) — not as a substitute for declaring explicit transitions.

### Public event documentation

Public event types in `types.ts` must have JSDoc comments describing when the event is emitted and what a subscriber receives:

```typescript
// types.ts
export type PublicPlaylistEvent =
  /** Emitted when the active playlist selection changes. Payload contains the updated selection IDs. */
  | { type: "playlist.public.selectionChanged"; payload: { ids: string[] } }
  /** Emitted when playlist data has been synchronised from the backend. */
  | { type: "playlist.public.synced"; payload: { playlists: Playlist[] } };
```

---

## 6. Guards

### Declaration

Declare all guards in `setup()`. Call entity predicates directly — no wrapper functions:

```typescript
import * as playlistSelectionEntity from "src/features/{feature}/domain/entities/PlaylistSelectionEntity";

setup({
  guards: {
    hasAddedPlaylists: ({ context, event }) =>
      playlistSelectionEntity.hasAddedPlaylists({
        current: context.playlists,
        incoming: event.payload.playlists,
      }),
    hasPlaylists: ({ context }) =>
      playlistSelectionEntity.hasPlaylists(context.playlists),
  },
})
```

### Guarded transition arrays

When a single event can lead to multiple targets depending on conditions, use an array of guarded transitions. The first guard that evaluates to `true` wins. A final entry with no guard is the default.

```typescript
on: {
  "playlist.sync": [
    {
      guard: "hasAddedPlaylists",
      target: "reconciling",
      actions: "assignIncomingPlaylists",
    },
    {
      guard: "hasPlaylists",
      target: "loaded",
    },
    {
      // Default — no guard
      target: "empty",
    },
  ],
}
```

### Higher-order guards

v5 ships `and`, `or`, and `not` combinators for composing guards without inline logic:

```typescript
import { and, or, not } from "xstate";

setup({
  guards: {
    isAuthenticated: ({ context }) => context.isAuthenticated,
    hasPermission: ({ context }) => context.role === "editor",
    isReadOnly: ({ context }) => context.accessLevel === "read",
  },
})

// In transitions — compose without extra guard definitions
on: {
  "playlist.edit": {
    guard: and(["isAuthenticated", "hasPermission"]),
    target: "editing",
  },
  "playlist.view": {
    guard: or(["isAuthenticated", not("isReadOnly")]),
    target: "viewing",
  },
}
```

Use combinators to express compound conditions in the chart rather than creating new named guards that just combine others.

---

## 7. Actions

### Declaration

Declare named actions in `setup()`. Actions referenced by string key inside the machine config are fully typed from `setup()`.

```typescript
setup({
  actions: {
    assignPlaylists: assign({
      playlists: ({ event }) => event.payload.playlists,
    }),
    resetContext: assign({
      playlists: [],
      activeFolderId: null,
    }),
  },
})
```

### Action params

Pass typed parameters to named actions using the `params` property. This keeps actions reusable across different transitions without coupling them to specific event shapes:

```typescript
setup({
  actions: {
    // Action accepts typed params — not bound to a specific event
    notifyUser: (_, params: { message: string; level: "info" | "error" }) => {
      // send to notifier system actor
    },
  },
})

// In transitions — pass params alongside the action reference
on: {
  "playlist.saved": {
    actions: {
      type: "notifyUser",
      params: { message: "Playlist saved", level: "info" },
    },
  },
  "playlist.error": {
    actions: {
      type: "notifyUser",
      params: { message: "Save failed", level: "error" },
    },
  },
}
```

### enqueueActions — conditional action sequences

Use `enqueueActions` when a single transition needs to conditionally execute multiple actions in sequence. This replaces the removed `pure()` and `choose()` from v4.

```typescript
import { enqueueActions } from "xstate";

setup({
  actions: {
    handlePlaylistSync: enqueueActions(({ enqueue, check, context, event }) => {
      // Always assign the incoming data
      enqueue.assign({
        playlists: event.payload.playlists,
      });

      // Conditionally notify if something changed
      if (check("hasAddedPlaylists")) {
        enqueue.sendTo(
          ({ system }) => system.get("notifier"),
          { type: "notifier.notify", payload: { message: "New playlists added" } }
        );
      }

      // Raise an internal event for further processing
      enqueue.raise({ type: "playlist.reconcile" });
    }),
  },
})
```

**When to use `enqueueActions`:**
- A transition needs to run multiple actions where some are conditional
- You need to mix `assign` with `sendTo` or `raise` in one logical step
- You need guard-checked branching inside a single action handler

**When not to use `enqueueActions`:**
- The actions are all unconditional — list them in the `actions` array directly
- The branching should be a guarded transition array instead

### assertEvent

`assertEvent` is used where XState does not automatically narrow the event type. This occurs in `entry` and `exit` actions — which can be triggered by multiple events — but not in transition-scoped handlers, where the type is already narrowed.

```typescript
// ✅ No assertEvent needed — transition scope narrows the type
on: {
  "playlist.load": {
    actions: assign({
      activeFolderId: ({ event }) => event.payload.folderId,
    }),
  },
}

// ✅ assertEvent required — entry can be triggered by multiple events
entry: ({ event }) => {
  assertEvent(event, "playlist.load");
  console.log(event.payload.folderId);
}

// ❌ Unnecessary — redundant inside a transition-scoped assign
on: {
  "playlist.load": {
    actions: assign({
      activeFolderId: ({ event }) => {
        assertEvent(event, "playlist.load"); // redundant
        return event.payload.folderId;
      },
    }),
  },
}
```

---

## 8. Actors — invoke vs spawn

Choosing between `invoke` and `spawn` is an architectural decision, not a style preference. Getting it wrong produces actors that either die too early or leak indefinitely.

### invoke — lifecycle bound to a state

Use `invoke` when the actor's work is scoped to a specific state. The actor starts when the state is entered and stops when it is exited. This is the correct choice for Effect service calls.

```typescript
states: {
  loading: {
    // Fetching playlists — actor lives only while in this state
    invoke: {
      src: "fetchPlaylists",
      input: ({ context }) => ({
        runtime: context.runtime,
        folderId: context.activeFolderId,
      }),
      onDone: {
        target: "loaded",
        actions: assign({ playlists: ({ event }) => event.output }),
      },
      onError: {
        target: "error",
      },
    },
  },
}
```

### spawn — dynamic, action-driven lifetime

Use `spawn` when you need to create actors dynamically at runtime, outside of a specific state's lifecycle. Spawned actors are created by an action, persist until explicitly stopped, and must be stored in context to be referenced later.

```typescript
setup({
  actions: {
    spawnUploadWorker: assign({
      uploadRef: ({ spawn, event }) =>
        spawn("uploadWorker", {
          input: { fileId: event.payload.fileId },
          systemId: `upload-${event.payload.fileId}`,
        }),
    }),
  },
})
```

### Decision rule

| Question | Answer | Use |
|---|---|---|
| Does the work belong to a specific state? | Yes | `invoke` |
| Should the actor stop when the state exits? | Yes | `invoke` |
| Are you calling an Effect service? | Yes | `invoke` |
| Do you need a dynamic number of actors? | Yes | `spawn` |
| Does the actor need to outlive the state that created it? | Yes | `spawn` |
| Is it a system-wide actor registered with `systemId`? | Yes | `invoke` at root |

**`invoke` is the default.** Effect service calls are always state-scoped. Reach for `spawn` only when the use case clearly requires a dynamic, independently-lived actor.

---

## 9. Cross-Machine Communication

### Receptionist pattern — system-wide actors

In v5, cross-actor communication uses the native actor system. There is no `broadcast()` function — that was a custom v4 abstraction with no equivalent in v5.

When `createActor()` is called on the root machine, an implicit actor system is created. Any actor invoked with a `systemId` is registered and can be looked up by any actor in the system via `system.get('systemId')`.

**Step 1 — Register the actor at the root:**

```typescript
export const rootMachine = setup({
  actors: { notifierMachine },
}).createMachine({
  invoke: {
    src: "notifierMachine",
    systemId: "notifier", // registered system-wide
  },
  // ...
});
```

**Step 2 — Send to it from any child:**

```typescript
export const playlistMachine = setup({
  actions: {
    notifyPlaylistSaved: sendTo(
      ({ system }) => system.get("notifier"),
      { type: "notifier.notify", payload: { message: "Playlist saved" } }
    ),
  },
}).createMachine({
  on: {
    "playlist.save": {
      actions: "notifyPlaylistSaved",
    },
  },
});
```

No import of the notifier machine is needed in child machines. The system is the coupling point.

### Child-to-parent communication

Pass `self` as input when invoking a child machine. The child stores the parent ref in context and uses `sendTo` to communicate back. `sendParent()` is deprecated in v5.

```typescript
// Parent — passes self reference as input
invoke: {
  src: "childMachine",
  input: ({ self }) => ({ parentRef: self }),
}

// Child — stores parent ref, communicates via sendTo
setup({
  types: {} as {
    input: { parentRef: ActorRef<Snapshot<unknown>, ParentEvent> };
    context: { parentRef: ActorRef<Snapshot<unknown>, ParentEvent> };
  },
}).createMachine({
  context: ({ input }) => ({ parentRef: input.parentRef }),
  on: {
    "child.done": {
      actions: sendTo(
        ({ context }) => context.parentRef,
        { type: "playlist.public.childCompleted" }
      ),
    },
  },
})
```

### Rules

- **No `broadcast()`** — removed in v5. Use `systemId` + `system.get()` for fan-out
- **No `sendParent()`** — deprecated. Pass `self` via `input`, store as `parentRef`, use `sendTo`
- Register system-wide actors with `systemId` at the root machine only
- Child machines reach system actors via `system.get('systemId')` — never import actor refs directly

---

## 10. Effect Runtime Injection

The app runtime is provided once via XState v5 `input` at the root actor creation site. The root machine stores it in context and passes it as `input` to invoked service actors. No machine constructs or imports the runtime directly.

```typescript
// src/main.ts — actor creation site
import { createActor } from "xstate";
import { AppRuntime } from "src/effects.ts";

const actor = createActor(rootMachine, {
  input: { runtime: AppRuntime },
});
actor.start();
```

```typescript
// Root machine — receives runtime via input, stores in context
setup({
  types: {} as {
    input: { runtime: typeof AppRuntime };
    context: { runtime: typeof AppRuntime };
  },
}).createMachine({
  context: ({ input }) => ({
    runtime: input.runtime,
  }),

  states: {
    loading: {
      // Passes runtime into the invoked actor — never calls runtime directly
      invoke: {
        src: "fetchPlaylists",
        input: ({ context }) => ({
          runtime: context.runtime,
          folderId: context.activeFolderId,
        }),
        onDone: {
          target: "loaded",
          actions: assign({ playlists: ({ event }) => event.output }),
        },
        onError: { target: "error" },
      },
    },
  },
});
```

**`runtime` in context is the sanctioned exception** to "context holds domain data only." It is infrastructure — it is never switched on for transitions and never passed to containers.

---

## 11. Tags

Tags are the public API of the machine — the contract between controller and container. State names are internal implementation detail. Containers read tags; they never read state names.

Tags are defined as enums. Unlike events, tags are identifier constants used to check set membership — they are not discriminants in a union type, so enums are appropriate and add clarity here.

```typescript
// In the controller file
export enum Tags {
  VIEW_MODE_FOLDER = "viewModeFolder",
  VIEW_MODE_SEARCH = "viewModeSearch",
  LOADING = "loading",
  SAVING = "saving",
}
```

```typescript
// In the machine — applied to state nodes
states: {
  folderView: {
    // User is browsing content via the folder hierarchy
    tags: [Tags.VIEW_MODE_FOLDER],
  },
  loading: {
    // Fetching data — UI should show a loading indicator
    tags: [Tags.LOADING],
  },
}
```

```typescript
// In the container — reads tags, never state names
const isFolderView = useSelector(actor, s => s.hasTag(Tags.VIEW_MODE_FOLDER));
const isLoading = useSelector(actor, s => s.hasTag(Tags.LOADING));

// ❌ Never do this — tightly coupled to internal structure
const isFolderView = useSelector(actor, s => s.matches("viewModeManagement.folderView"));
```

---

## 12. File Organisation

```
src/features/{feature}/application/controllers/
└── {Feature}Controller.ts     # Machine, Tags enum, internal event types
```

```
src/features/{feature}/
└── types.ts                  # Public event union types only — create when needed
```

| Concern | Location |
|---|---|
| `setup()` + machine definition | Controller file |
| Tags enum | Controller file |
| Internal event union type | Controller file |
| Public event union type | `types.ts` |

`types.ts` is only introduced when public events need to be consumed by other controllers. Do not create it preemptively.

---

## 13. v5 API Changes from v4

| v4 | v5 |
|---|---|
| `createMachine(config, options)` | `setup({ guards, actors, actions }).createMachine(config)` |
| `interpret(machine)` | `createActor(machine, { input })` |
| `service.send()` | `actor.send()` |
| `cond: 'guardName'` | `guard: 'guardName'` |
| `assign((ctx, evt) => ...)` | `assign(({ context, event }) => ...)` |
| `send()` action | `sendTo()` / `raise()` |
| `sendParent()` | `sendTo(({ context }) => context.parentRef, event)` |
| `pure()` / `choose()` | `enqueueActions()` |
| `broadcast()` (custom) | Receptionist pattern — `sendTo(({ system }) => system.get('id'), event)` |
| Implicit external transitions | Internal by default — use `reenter: true` to re-enter |
| Enum event types | String literal union event types |
| `in: '...'` transition property | `guard: stateIn(...)` from `xstate/guards` |
| `state.history` | Track previous snapshot manually via `actor.subscribe()` |
| `escalate()` action | Throw directly in actions — errors propagate automatically |

---

## 14. Quick Check — Common Violations

**Using `broadcast()` — removed in v5:**
```typescript
// ❌
broadcast({ type: "panelStack.public.sync", payload: ... })

// ✅
sendTo(({ system }) => system.get("notifier"), { type: "notifier.notify", ... })
```

**Using enum for event types:**
```typescript
// ❌ Breaks XState v5 type inference
enum EventType { LOAD = "playlist.load" }
on: { [EventType.LOAD]: { ... } }

// ✅
on: { "playlist.load": { ... } }
```

**Using `sendParent()` — deprecated:**
```typescript
// ❌
actions: sendParent({ type: "child.done" })

// ✅
actions: sendTo(({ context }) => context.parentRef, { type: "playlist.public.childCompleted" })
```

**Using `pure()` or `choose()` — removed:**
```typescript
// ❌
actions: pure((context, event) => [
  assign({ playlists: event.payload.playlists }),
  condition ? sendTo("notifier", ...) : undefined,
])

// ✅
actions: enqueueActions(({ enqueue, check }) => {
  enqueue.assign({ playlists: ({ event }) => event.payload.playlists });
  if (check("hasAddedPlaylists")) {
    enqueue.sendTo(({ system }) => system.get("notifier"), { type: "notifier.notify" });
  }
})
```

**Expecting parent entry/exit to fire without `reenter: true`:**
```typescript
// ❌ resetForm will NOT fire — internal transition by default in v5
on: {
  "playlist.reset": { target: "editing.idle" }
}

// ✅ resetForm fires — explicitly re-enters the parent
on: {
  "playlist.reset": { target: "editing.idle", reenter: true }
}
```

**Spawning when invoke is correct:**
```typescript
// ❌ spawn leaks — nothing stops this actor when the state exits
actions: assign({
  ref: ({ spawn }) => spawn("fetchPlaylists", { input: { folderId } }),
})

// ✅ invoke is lifecycle-bound — stops when state exits
invoke: {
  src: "fetchPlaylists",
  input: ({ context }) => ({ runtime: context.runtime, folderId: context.activeFolderId }),
}
```

**Boolean flag in context that should be a state node:**
```typescript
// ❌
type Context = { isLoading: boolean; hasError: boolean };

// ✅
states: { idle: {}, loading: {}, error: {} }
```

**Using v4 `cond` and `assign` signatures:**
```typescript
// ❌ v4
{ cond: "hasPlaylists" }
assign((context, event) => ({ ... }))

// ✅ v5
{ guard: "hasPlaylists" }
assign(({ context, event }) => ({ ... }))
```

**Targeting state name in container:**
```typescript
// ❌
s.matches("viewModeManagement.folderView")

// ✅
s.hasTag(Tags.VIEW_MODE_FOLDER)
```
