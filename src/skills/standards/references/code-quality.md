# Code Quality Reference

## Readable, Flat Control Flow

Code should be scannable top to bottom without mental stack tracking. The reader should never need to hold multiple branches in their head simultaneously.

### Early Exits

Return early for each case. Each branch is independent and complete.

```typescript
// ❌ Nested conditionals with else-if
export const createAction = (params) => {
  if (params.pendingFolder) {
    return { metadata: { createFolder: params.pendingFolder, mode: "create" } };
  } else if (params.existingFolder) {
    return { metadata: { targetFolder: params.existingFolder, mode: "existing" } };
  } else {
    throw new Error("Invalid params");
  }
};

// ✅ Flat early exits
export const createAction = (params) => {
  if (params.pendingFolder) {
    return { metadata: { createFolder: params.pendingFolder, mode: "create" } };
  }
  if (params.existingFolder) {
    return { metadata: { targetFolder: params.existingFolder, mode: "existing" } };
  }
  throw new Error("Invalid params");
};
```

### Rules

- **No `else` or `else-if`** — `else-if` is a code smell indicating a missed early exit opportunity
- **No conditional spreading** — `...(condition && { prop: value })` obscures intent and mutates implicitly
- **No nested ternaries** — a single ternary for a simple inline value is acceptable; nesting is not
- **No `let` variables modified in conditionals** — use pure transforms instead

---

## Immutable Transforms

Data operations return new values. Never mutate existing objects or arrays.

```typescript
// ❌ Mutation
const updatePlaylist = (playlists, id, label) => {
  const playlist = playlists.find(p => p.id === id);
  playlist.label = label; // mutates
  return playlists;
};

// ✅ Immutable transform
const updatePlaylist = (playlists, id, label) =>
  playlists.map(p => p.id === id ? { ...p, label } : p);
```

---

## Error Handling

### Always Throw on Unexpected State

Unexpected states must throw. Silent returns hide bugs and data inconsistencies.

```typescript
// ❌ Silent return — hides bugs
if (!playlist) return;

// ✅ Throw — makes failures visible
if (!playlist) throw new Error("Playlist not found");
```

### Suppress Only With Documented Intent

If suppressing an error is the right call, document why. A suppress with no comment is never acceptable.

```typescript
// ❌ Silent suppress — intent unknown
try {
  doSomething();
} catch {}

// ✅ Intent explicit
try {
  setPreference(value);
} catch {
  // localStorage unavailable in SSR context — safe to ignore
}
```

---

## Validation Boundary

Validate at the boundary between layers. Controllers validate runtime inputs before passing to entities. Entities validate inbound data from the backend as part of the transform — applying defaults and ensuring shape correctness.

### Controller Validates Runtime Inputs

```typescript
// Controller validates before calling entity
if (!ctx.activeTabId || !ctx.activeFolderId) {
  throw new Error("Active tab ID and folder ID are required");
}
const playlist = ctx.availablePlaylists.find(p => p.id === evt.payload.playlistId);
if (!playlist) throw new Error("Playlist not found");

// Entity receives clean, validated data
const action = tapesActionEntity.createApplyPlaylistActionForFolder({
  playlist,
  activeTabId: ctx.activeTabId,
  activeFolderId: ctx.activeFolderId,
});
```

### Entity Validates Inbound Backend Data

Entities are the data boundary for backend responses. Apply defaults and ensure correct shape as part of the transform — protect the UI from unexpected or missing values.

```typescript
// Entity applies defaults as part of transform
export const toPlaylistItem = (raw: RawPlaylist): PlaylistItem => ({
  id: raw.playlistId,
  label: raw.playlistTitle ?? "Untitled",
  isActive: raw.isActive ?? false,
});
```

### Make Parameters Required

When inputs are always validated at call sites, make them required. TypeScript catches missing parameters at compile time, removing redundant runtime checks.

```typescript
// ✅ Required — validated at call site, TypeScript enforces
export const createAction = ({
  playlist,
  activeFolderId,
}: {
  playlist: InputOption;
  activeFolderId: string;
}) => {
  // No runtime check needed — caller is responsible
};
```

---

## Quick Check — Common Violations

**`else`/`else-if` instead of early exits:**
```typescript
// ❌ Nested conditionals
if (a) { return x; } else if (b) { return y; } else { throw ... }

// ✅ Flat early exits
if (a) return x;
if (b) return y;
throw new Error("Unexpected state");
```

**Conditional spreading:**
```typescript
// ❌ Obscures intent
const action = { ...(condition && { prop: value }) };

// ✅ Explicit branch
if (condition) return { ...base, prop: value };
return base;
```

**Silent error suppression:**
```typescript
// ❌ No intent documented
try { doSomething(); } catch {}

// ✅ Intent explicit
try { doSomething(); } catch {
  // SSR context — localStorage unavailable, safe to ignore
}
```

**Silent return on unexpected state:**
```typescript
// ❌ Hides bugs
if (!playlist) return;

// ✅ Makes failures visible
if (!playlist) throw new Error("Playlist not found");
```
