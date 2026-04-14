# Architecture Reference

## The Layered Model

All frontend code follows a strict five-layer architecture. Data flows in one direction. Layers do not skip.

```
Entities (pure functions — transforms and predicates)
    ↓ consumed by
Services (Effect Layers — all IO and side effects)
    ↓ consumed by
Controllers (XState machines — own state and transitions)
    ↓ consumed by
Containers (composition layer — wire state to UI)
    ↓ consumed by
Presentation (UI only)
```

Each layer has a single responsibility. No layer reaches past its neighbour.

---

## Layer Responsibilities

### Entities

Location: `src/features/{feature}/domain/entities/`

Entities are pure functions. They have no knowledge of state machines, services, React, or the UI. They do two things:

1. **Transforms** — `toX` functions, input → output, inbound and outbound data shaping
2. **Predicates** — `hasX`, `isX` functions, inferring facts from data

Entities are the data boundary for backend responses — they apply defaults and ensure correct shape as part of the transform. They may use Effect's typed utilities (`Effect.try`, `Option`, `Either`) for safe transforms, but must remain pure. No runtime, no Layer dependencies.

**Rules:**
- Pure functions only — no side effects, no framework imports, no IO
- No classes — functions only
- One file per concern (`PlaylistSelectionEntity.ts` vs `PlaylistReorderEntity.ts`)
- Private helpers stay internal — no `export`

**Naming conventions:**

| Prefix | Purpose | Example |
|---|---|---|
| `hasX` | Boolean predicate | `hasAddedPlaylists` |
| `isX` | Boolean predicate | `isValidState` |
| `getX` | Retrieve/extract | `getAddedPlaylists` |
| `toX` | Transform | `toPlaylistIds` |

**Function signatures** — use object params for 2+ arguments:

```typescript
export const hasAddedPlaylists = ({
  current,
  incoming,
}: {
  current: InputOption[];
  incoming: InputOption[];
}): boolean => { ... };
```

**Imports** — import as namespace:

```typescript
import * as playlistSelectionEntity from "src/features/{feature}/domain/entities/PlaylistSelectionEntity";
playlistSelectionEntity.hasAddedPlaylists({ ... });
```

---

### Services

Location: `src/features/{feature}/infrastructure/services/`

Services own all IO and side effects. Controllers call services — they never perform IO directly.

See `references/services.md` for the full Effect Layer pattern, service structure, and runtime composition.

---

### Controllers

Location: `src/features/{feature}/application/controllers/`

Controllers own state and transitions. They delegate transforms and predicates to entities, and IO to services via the injected runtime.

See `references/state-management.md` for the full XState v5 pattern.

---

### Containers

Location: `src/features/{feature}/application/containers/`

Containers are the composition layer. Three responsibilities:

1. **Map state** from the controller via `useSelector` and tags
2. **Forward events** to the controller — unconditionally
3. **Compose** hooks, translations, and presentation components

**Rules:**
- One container per controller
- No logic — no transforms, no business rules
- No conditionals around events — forward unconditionally, let the controller decide
- Targeted `useSelector` — select only what this container needs
- Never pass `send` or raw `snapshot` to presentation components — extract values and create specific callbacks

```typescript
// ❌ Bad — leaks machine internals into presentation
<Sidebar snapshot={snapshot} send={send} />

// ✅ Good — extract values, create specific callbacks
const { sidebarCollapsed, currentRoute } = snapshot.context;
const handleToggleSidebar = useCallback(() => send({ type: 'TOGGLE_SIDEBAR' }), [send]);

<Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} currentRoute={currentRoute} />
```

**Folder naming:** The container folder name must match the exported component name **exactly**, including any suffix (e.g. `Container`). Never shorten the folder name.

```
application/containers/
  AuthGuardContainer/        ← exports AuthGuardContainer   ✅
  GlobalLoaderContainer/     ← exports GlobalLoaderContainer ✅

  AuthGuard/                 ← exports AuthGuardContainer   ❌ (name mismatch)
```

This keeps the folder path and the import name in sync — reading either one tells you the other without opening the file.

```typescript
// ✅ Forwards unconditionally
const onAction = useCallback(() => {
  actor.send({ type: "playlist.action" });
}, [actor]);

// ❌ Container deciding — belongs in the controller
const onAction = useCallback(() => {
  if (isEditing) actor.send({ type: "playlist.save" });
  else actor.send({ type: "playlist.cancel" });
}, [actor, isEditing]);
```

---

### Presentation

Location: `src/features/{feature}/presentation/`

Presentation components are UI only. They receive props and render. No state machines, no services, no business logic.

See `references/presentation.md` for folder structure and composition rules.

---

## File Structure

```
src/
├── effects.ts                          # App runtime — composed once here
└── features/{feature}/
    ├── application/
    │   ├── containers/                 # Composition layer
    │   └── controllers/               # State machines
    ├── domain/
    │   └── entities/                  # Pure functions
    ├── infrastructure/
    │   └── services/                  # Effect Layers — all IO
    │       ├── PlaylistService.ts
    │       ├── FolderService.ts
    │       └── index.ts               # Feature layer composition
    ├── presentation/                  # UI components
    └── types.ts                       # Public events (create only when needed)
```

**Import paths** — use absolute paths from `src/`:

```typescript
import * as playlistSelectionEntity from "src/features/{feature}/domain/entities/PlaylistSelectionEntity";
```

Relative paths are acceptable within the same feature for deeply nested files.

---

## Quick Check — Common Violations

**Logic in a container:**
```typescript
// ❌ Container deciding
if (isEditing) actor.send({ type: "playlist.save" });

// ✅ Controller decides — container forwards
actor.send({ type: "playlist.action", payload: { isEditing } });
```

**Side effect in an entity:**
```typescript
// ❌ Entity performing IO
export const fetchPlaylists = async (folderId: string) => {
  return await api.get(`/folders/${folderId}/playlists`);
};

// ✅ Entity is a pure transform
export const toPlaylistItems = (raw: RawPlaylist[]): PlaylistItem[] =>
  raw.map(r => ({ id: r.playlistId, label: r.playlistTitle ?? "Untitled" }));
```

**Layer skipping:**
```typescript
// ❌ Container importing an entity directly
import * as playlistEntity from "src/features/{feature}/domain/entities/PlaylistEntity";

// ✅ Container reads from controller state only
const playlists = useSelector(actor, s => s.context.playlists);
```

**Passing machine internals to presentation:**
```typescript
// ❌ Presentation receives send/snapshot — leaks machine contract into UI layer
<Sidebar snapshot={snapshot} send={send} />

// ✅ Container extracts values and creates callbacks
const collapsed = snapshot.context.sidebarCollapsed;
const onToggle = useCallback(() => send({ type: 'TOGGLE_SIDEBAR' }), [send]);
<Sidebar collapsed={collapsed} onToggle={onToggle} />
```
