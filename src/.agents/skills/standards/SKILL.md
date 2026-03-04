---
name: standards
description: General coding practices, implementation styles, and patterns for the Altai application. Covers domain entities, XState patterns, type usage, and code organization. Use when implementing features, writing new code, or refactoring existing code in the Altai codebase.
---

# Altai Code Standards

## Mandatory Baseline (Declarative, Immutable, Maintainable)

These rules are mandatory for code/config implementation work. They are pass/fail gates, not advisory guidance.

**Declarative over imperative:** Prefer declarative solutions by requirement. Describe *what* should hold (state, transitions, invariants) and let the runtime or framework determine *how*; avoid imperative step-by-step control that mutates shared state in place.

### MUST

- **MUST prefer declarative over imperative:** Orchestration and data flow MUST be expressed declaratively (state/events/transitions, pure transforms) rather than imperative sequences (mutating variables, step-by-step handlers). When both are feasible, choose the declarative option.
- **MUST keep orchestration declarative** in containers/controllers: describe state transitions and event flow explicitly instead of imperative step-by-step control logic.
- **MUST use immutable transforms** for domain and controller data operations (`input -> output`), returning new values instead of mutating existing objects/arrays.
- **MUST keep domain logic in pure entity functions** (no side effects, no hidden mutable module state, no IO in entity transforms/predicates).
- **MUST keep maintainability boundaries clear**:
  - containers wire/select/send and avoid business rules
  - controllers manage state transitions and delegate reusable logic to entities
  - presentation components remain UI-focused
- **MUST keep branching complexity controlled** with early exits and extracted helpers when conditional logic grows.

### MUST NOT

- **MUST NOT choose imperative over declarative** when a declarative solution is feasible (e.g. state machine + events over manual flags and step counters; pure transforms over in-place mutation).
- **MUST NOT implement mutation-heavy imperative handlers** that modify shared state in-place across multiple steps.
- **MUST NOT use hidden mutable accumulators** (`let` variables mutated through control flow) when a pure transform is feasible.
- **MUST NOT mix business decision logic into containers/presentation** when it belongs in domain entities/controllers.
- **MUST NOT allow branching sprawl** in controllers/containers (deep nesting, chained `else-if`, or nested ternaries for workflow logic).
- **MUST NOT complete code/config work without standards evidence** recorded in work/review outputs.

### Required Evidence Format (Work and Review)

Use this format when reporting standards compliance in execution or review evidence:

```markdown
standards_compliance:
- declarative_over_imperative: pass|fail (evidence: file:line)  # Declarative solutions required; no imperative choice when declarative feasible
- declarative_flow: pass|fail (evidence: file:line)
- immutable_transforms: pass|fail (evidence: file:line)
- maintainability_boundaries: pass|fail (evidence: file:line)
- hidden_mutable_state: pass|fail (evidence: file:line)
```

If any mandatory line is `fail`, code/config work is not complete.

## Core Principles

1. **Simplicity over cleverness** - Prefer straightforward solutions
2. **Maintainability over flexibility** - Avoid premature abstraction
3. **YAGNI** - Add complexity when needed, not before
4. **Domain entities for logic** - Use pure functions in entities for transforms and predicates
5. **Keep controllers simple** - Delegate complexity to domain entities
6. **Early exits over else/else-if** - Return early for special cases, avoid nested conditionals

---

## Domain Entities

Location: `src/features/{feature}/domain/entities/`

Domain entities contain **types** and **pure functions** that encapsulate business logic. Use them for transforms, predicates, and any complex logic - keeping controllers/machines simple.

### Structure

- Pure functions, no classes
- One file per concern (e.g., `PlaylistSelectionEntity.ts` vs `PlaylistReorderEntity.ts`)
- Private helpers stay internal (no `export`)

### Function Signatures

**Use named params for 2+ arguments:**

```typescript
// Good - clear at call site
export const hasAddedPlaylists = ({
  current,
  incoming,
}: PlaylistCompareParams): boolean => {
  // ...
};

// Usage
hasAddedPlaylists({ current: ctx.playlists, incoming: evt.payload.playlists });
```

**Benefits**: Self-documenting, easier to refactor, better IDE support.

### Naming Conventions

| Prefix | Purpose               | Example                                    |
| ------ | --------------------- | ------------------------------------------ |
| `hasX` | Boolean predicate     | `hasAddedPlaylists`, `hasRemovedPlaylists` |
| `getX` | Retrieve/extract data | `getAddedPlaylists`, `getRemovedPlaylists` |
| `toX`  | Transform data        | `toPlaylistIds`, `toSortedPlaylistIds`     |

### Early Exit Pattern

**Always prefer early exits over else/else-if** - this is a code standard, not a suggestion.

```typescript
// ❌ Bad - nested conditionals with else-if
export const createAction = (params) => {
  if (params.pendingFolder) {
    return {
      metadata: {
        createFolder: params.pendingFolder,
        mode: "create",
      },
    };
  } else if (params.existingFolder) {
    return {
      metadata: {
        targetFolder: params.existingFolder,
        mode: "existing",
      },
    };
  } else {
    throw new Error("Invalid params");
  }
};

// ✅ Good - early exits, flat structure
export const createAction = (params) => {
  // Handle special case first
  if (params.pendingFolder) {
    return {
      metadata: {
        createFolder: params.pendingFolder,
        mode: "create",
      },
    };
  }

  // Handle next case
  if (params.existingFolder) {
    return {
      metadata: {
        targetFolder: params.existingFolder,
        mode: "existing",
      },
    };
  }

  // Invalid state
  throw new Error("Invalid params");
};
```

**Benefits**:

- **Flat code structure** - No nesting, easier to read
- **Clear intent** - Each case is independent and complete
- **Easier to modify** - Add/remove cases without touching others
- **No else-if** - Else-if is a code smell indicating missed early exit opportunities

**When extracting action creation to entities**:

```typescript
// ✅ Good - early exits for different contexts
export const createSelectFolderRootAction = ({
  folder,
  activeTabId,
  activeFolderId,
  pendingFolderName,
}: Params): PanelActionEntity => {
  // Early exit - pending folder
  if (pendingFolderName && activeTabId) {
    return panelActionEntity.toActionItem(ActionTypes.SHARE, {
      label: pendingFolderName,
      metadata: {
        targetTabId: activeTabId,
        createFolderName: pendingFolderName,
        mode: "folderRoot",
      },
    });
  }

  // Early exit - existing folder in share context
  if (activeTabId && activeFolderId) {
    return panelActionEntity.toActionItem(ActionTypes.SHARE, {
      label: folder?.label ?? "Folder",
      metadata: {
        targetTabId: activeTabId,
        targetFolderId: activeFolderId,
        mode: "folderRoot",
      },
    });
  }

  // Early exit - move to folder context
  if (activeFolderId) {
    return panelActionEntity.toActionItem(ActionTypes.MOVE, {
      label: folder?.label ?? "Folder",
      metadata: {
        targetFolderId: activeFolderId,
        mode: "folderRoot",
      },
    });
  }

  throw new Error("Invalid parameters");
};
```

**Anti-patterns to avoid**:

- `else` and `else-if` blocks
- Conditional spreading: `...(condition && { prop: value })`
- Let variables modified in conditionals
- Nested ternaries for complex logic

### When to Use

- **Predicates**: `hasAddedPlaylists`, `isValidState`
- **Transforms**: `toPlaylistIds`, `toSortedItems`
- **Comparisons**: Diffing arrays, checking membership
- **Complex conditionals**: Extract to helper functions

```typescript
// Extract complex logic to helpers
const getFolderLabel = (
  folder: InputOption | ClipsPanelFolderEntity
): string => {
  return "label" in folder ? folder.label : (folder.folderName ?? "Folder");
};
```

This keeps controllers/machines simple - they delegate logic to entities.

---

## XState Patterns

### Guards (Conditions)

Extract complex guards to domain entity predicates. Inline the entity call in `cond`:

```typescript
import * as playlistSelectionEntity from "src/features/tapesv3/domain/entities/PlaylistSelectionEntity";

[EventType.PLAYLIST_CHANGED]: [
  {
    cond: (ctx, evt) =>
      playlistSelectionEntity.hasAddedPlaylists({
        current: ctx.playlists,
        incoming: evt.payload.playlists,
      }),
    actions: [/* ... */],
  },
],
```

Avoid unnecessary wrapper functions - inline entity calls directly.

### State vs Context: Model UI Modes as State

**Use state machines to model UI modes** - don't store mode flags in context:

```typescript
// Bad - storing mode in context
type Context = {
  viewMode: "folder" | "search"; // Don't store what state can represent
};

// Good - model modes as parallel states
viewModeManagement: {
  initial: "folderView",
  states: {
    folderView: {
      on: {
        [EventType.SYNC_VIEW_MODE]: {
          cond: (_, evt) => evt.payload.viewMode === "search",
          target: "searchView",
        },
      },
    },
    searchView: { /* ... */ },
  },
},
```

**Rationale**: State machines semantically represent modes. Context holds data, not state.

**Exception**: Storing previous values in context for business logic comparison is acceptable:

```typescript
// Acceptable - storing previous value for change detection
type Context = {
  oldHierarchy: Hierarchy | null; // For comparing with newHierarchy
  viewMode: "folder" | "search"; // For comparing previous vs current in change detection
};
```

The distinction: Don't store current UI state in context when it can be modeled as machine state. Do store previous values when needed for comparison logic (change detection, diffing, etc.).

### Event & Type Patterns

**Consolidate similar events with properties:**

```typescript
// Bad - event proliferation
BROADCAST_FOLDER_VIEW_MODE;
BROADCAST_SEARCH_VIEW_MODE;

// Good - single event with property
BROADCAST_VIEW_MODE: {
  payload: {
    viewMode: "folder" | "search";
  }
}
```

**Move reusable types to domain entities:**

```typescript
// Domain entity: FolderSelectorEntity.ts
export type FolderSelectorViewMode = "folder" | "search";
```

Single source of truth, consistent types across controllers/containers.

### assertEvent Usage

**Only use `assertEvent` when TypeScript can't narrow the event type:**

```typescript
// Bad - redundant, TypeScript already knows the type from transition
[EventType.SYNC_VIEW_MODE]: {
  actions: assign({
    viewMode: (_, evt) => {
      assertEvent(evt, EventType.SYNC_VIEW_MODE); // Unnecessary
      return evt.payload.viewMode;
    },
  }),
}

// Good - no assertEvent needed in assign actions
[EventType.SYNC_VIEW_MODE]: {
  actions: assign({
    viewMode: (_, evt) => evt.payload.viewMode,
  }),
}

// Good - assertEvent needed in broadcast payload functions
broadcast({
  type: PublicEventType.BROADCAST_VIEW_MODE,
  payload: (ctx, evt) => {
    assertEvent(evt, EventType.SYNC_VIEW_MODE); // Needed - type not narrowed
    return { viewMode: evt.payload.viewMode };
  },
})
```

**Rationale**: In `assign` actions, the event type is already narrowed by the transition. In `broadcast` payload functions, the event type isn't narrowed, so `assertEvent` provides runtime type safety.

### Handler Placement

**Event handlers live in the state that manages that concern** - not in parallel states or background sync:

```typescript
// Good - handler in the state managing search view
viewModeManagement: {
  states: {
    searchView: {
      on: {
        [EventType.SYNC_BATCH_SEARCH_RESULTS]: {
          actions: [/* Handle search results here */],
        },
      },
    },
  },
},
```

Keeps concerns separated, avoids "half jobs" split across states.

### Container State Management

**When moving state to parent, remove all fallback logic** - make props required:

```typescript
// Good - fully controlled by parent
type ContainerProps = {
  viewMode: ViewMode; // Required
  onViewModeChange: (viewMode: ViewMode) => void; // Required
};

// Parent manages state
const [viewMode, setViewMode] = useState<ViewMode>("folder");
<Container viewMode={viewMode} onViewModeChange={setViewMode} />
```

Eliminates dual sources of truth, makes data flow explicit.

### Entity Imports

Import as namespace for clarity:

```typescript
import * as playlistSelectionEntity from "...";
playlistSelectionEntity.hasAddedPlaylists({ ... });
```

---

## Import Paths

Use absolute paths from `src/`:

```typescript
import { InputOption } from "src/features/common/domain/entities/SelectionInputEntity";
import * as playlistSelectionEntity from "src/features/tapesv3/domain/entities/PlaylistSelectionEntity";
```

Relative paths acceptable within same feature for deeply nested files.

---

## File Organization

### Feature Structure

```
src/features/{feature}/
├── application/
│   ├── containers/     # React containers (connect to XState)
│   └── controllers/    # XState machines
├── domain/
│   └── entities/       # Pure functions, types, business logic
├── presentation/       # React components (UI only)
└── types.ts           # Shared types, event enums
```

### When to Create New Files

- **New entity file**: When the concern is distinct (e.g., selection vs reordering)
- **Same file**: When functions are tightly related and small

---

## Container / Controller Separation

### Containers

Location: `src/features/{feature}/application/containers/`

Containers wire controllers to presentation components. They do NOT contain business logic.

**Responsibilities:**

- Get actor ref via `useActorRefById`
- Select UI-relevant data via `useSelector`
- Create callbacks that send events to controller
- Compose presentation components
- Apply `useMemo` for derived UI values if needed

**Do NOT:**

- Transform data (controller's job)
- Contain business logic
- Make decisions about state

```typescript
export const TapesClipsViewHeaderContainer = () => {
  const actor = useActorRefById<TapesClipsViewerHeaderRef>({
    actorId: TapesActorIds.CLIPS_VIEWER_HEADER,
  });

  // Select UI data from controller
  const { playlists, availablePlaylists } = useSelector(
    actor,
    (s) => ({
      playlists: s.context.playlists,
      availablePlaylists: s.context.availablePlaylists,
    }),
    shallowEquals,
  );

  // Callback sends event - no logic
  const onPlaylistChange = useCallback(
    (playlists: InputOption[]) => {
      actor.send({
        type: TapesClipsViewerHeaderEventType.PLAYLIST_CHANGED,
        payload: { playlists },
      });
    },
    [actor],
  );

  return (
    <PanelClips.TapesViewerHeader>
      <MultiSelectorV2Container
        selectedOptions={playlists}
        options={availablePlaylists}
        onChange={onPlaylistChange}
      />
    </PanelClips.TapesViewerHeader>
  );
};
```

### Controllers

Location: `src/features/{feature}/application/controllers/`

Controllers handle all business rules and data transforms.

**Responsibilities:**

- Transform incoming data to UI-ready format
- Handle business logic (predicates, conditions)
- Broadcast events to other actors
- Manage state transitions

```typescript
[PublicTapesEventType.BROADCAST_CLIPS_DATA_SYNC]: {
  actions: [
    assign({
      playlists: (ctx, evt) => {
        // Transform here, not in container
        return evt.payload.clipsData?.playlists.map((playlist) => ({
          id: playlist.playlistId,
          label: playlist.playlistTitle ?? "",
          value: playlist.playlistId,
        })) ?? [];
      },
    }),
  ],
},
```

### Data Flow

```
Server Data → Controller (transform) → Context → Container (useSelector) → Presentation
                  ↑
User Action → Container (send event) → Controller (business logic)
```

### Containers, Handlers, and React Query

When events trigger handlers that fetch/update data, data flows through React Query and derived state—**never through useState in the container**.

**Rules:**

1. **No useState for handler-driven data** — Handler results live in React Query cache, not container state
2. **Queries only in dedicated hooks** — All queries in feature hook (e.g. `useTapesQueries`)
3. **Handler writes to cache** — Use `queryClient.setQueryData(key, result)`, query hook subscribes
4. **Trigger only in container** — Callback invokes handler prop, data returns via props from derived state
5. **Sync in useEffect** — Watch props, sync to actor in `useEffect`

**Pipeline:**

```
Event → Container (invoke handler)
     → Handler (fetch + setQueryData)
     → Query hook (subscribed to cache)
     → Derived state (transform)
     → Container props
     → useEffect syncs to actor
```

---

## Persisting State to localStorage

When user preferences persist across sessions, use a localStorage service invoked by the state machine.

### Service Pattern

Create service in `src/features/{feature}/infrastructure/services/`:

```typescript
export type ViewType = "Batch" | "Profile";
const STORAGE_KEY = "feature:preferenceKey";

export const getPreference = (): Promise<ViewType> => {
  return new Promise((resolve) => {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        resolve("Batch");
        return;
      }
      const stored = window.localStorage.getItem(STORAGE_KEY);
      resolve(stored === "Profile" ? "Profile" : "Batch");
    } catch {
      resolve("Batch");
    }
  });
};

export const setPreference = (viewType: ViewType): void => {
  try {
    window.localStorage?.setItem(STORAGE_KEY, viewType);
  } catch {
    // Silently fail
  }
};
```

### Machine Hydration Pattern

```typescript
viewManagement: {
  initial: "hydrate",
  states: {
    hydrate: {
      invoke: {
        src: getPreference,
        onDone: [
          {
            target: "profile",
            cond: (_, evt) => evt.data === "Profile", // XState v4 uses evt.data
          },
          { target: "batch" },
        ],
        onError: { target: "batch" },
      },
    },
    batch: {
      tags: [Tags.VIEW_TYPE_BATCH],
      entry: [broadcast({ type: EventType.BROADCAST_VIEW_TYPE_CHANGED, payload: () => ({ viewType: "Batch" }) })],
      on: {
        [EventType.TOGGLE_VIEW_TYPE]: {
          target: "profile",
          actions: [() => setPreference("Profile")],
        },
      },
    },
    profile: {
      tags: [Tags.VIEW_TYPE_PROFILE],
      entry: [broadcast({ type: EventType.BROADCAST_VIEW_TYPE_CHANGED, payload: () => ({ viewType: "Profile" }) })],
      on: {
        [EventType.TOGGLE_VIEW_TYPE]: {
          target: "batch",
          actions: [() => setPreference("Batch")],
        },
      },
    },
  },
},
```

**Key points**: Broadcast on entry for dependent controllers, use `evt.data` for invoke results, guard `window`/`localStorage` for SSR.

---

## Error Handling and Validation

### Never Suppress Unexpected Outcomes

**Always throw errors for unexpected states** - never silent returns:

```typescript
// Bad - silently fails, hides bugs
if (!playlist) return;

// Good - throws error, makes failures visible
if (!playlist) throw new Error("Playlist not found");
```

Silent failures hide bugs and data inconsistencies.

### Validation at Call Sites

**Validate at call sites** (controllers) for context-specific checks, then pass validated data to pure functions:

```typescript
// Controller validates
if (!ctx.activeTabId || !ctx.activeFolderId) {
  throw new Error("Active tab ID and folder ID are required");
}
const playlist = ctx.availablePlaylists.find(
  (p) => p.id === evt.payload.playlistId
);
if (!playlist) throw new Error("Playlist not found");

// Entity receives validated data
const action = tapesActionEntity.createApplyPlaylistActionForFolder({
  playlist,
  activeTabId: ctx.activeTabId,
  activeFolderId: ctx.activeFolderId,
});
```

**Entity functions validate**: Input format/type issues, required parameters that can't be validated at call site.

**Entity functions do NOT validate**: Objects already validated at call sites, context-specific requirements.

### Type Safety: Required vs Optional

**Make parameters required when always validated at call sites:**

```typescript
// Good - required, TypeScript enforces
export const createAction = ({
  playlist,
  activeFolderId, // Required - validated at call site
}: {
  playlist: InputOption;
  activeFolderId: string;
}) => {
  // No runtime check needed
};
```

TypeScript catches missing parameters at compile time, removes redundant runtime validation.

### Extracting Action Creation

When action creation logic appears in multiple controllers, extract to entity file.

**Location**: `src/features/{feature}/actions/{Feature}ActionEntity.ts`

```typescript
// Entity file
export const createApplyPlaylistAction = ({
  playlist,
}: {
  playlist: ClipsBatchPlayListTag;
}): PanelActionEntity => {
  return panelActionEntity.toActionItem(TapesActionTypes.APPLY_PLAYLIST, {
    label: playlist.label,
    referenceId: playlist.id,
    buttonType: "button",
    metadata: { playlistId: playlist.id },
  });
};

// Controller uses entity
const action = tapesActionEntity.createApplyPlaylistAction({ playlist });
```

Reusable, testable, single source of truth.

---

## Future Sections

_Add patterns as they emerge:_

- Testing patterns
- API/data fetching patterns
