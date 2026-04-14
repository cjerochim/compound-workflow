# Services Reference

Services own all IO and side effects. Nothing outside `infrastructure/services/` performs IO — no `fetch`, no `localStorage`, no async calls. Controllers call services; they never perform IO directly.

The service layer is implemented using **Effect Layers** — typed, composable units that declare their dependencies and provide an implementation.

---

## Service Structure

Each service file has three exports:

1. **The service tag** — the interface, defined using `Context.Tag`
2. **The live Layer** — the implementation, defined using `Layer.succeed`
3. **The Effect programs** the controller will run

```typescript
// PlaylistService.ts
import { Context, Effect, Layer } from "effect";

// 1. Service tag — defines the interface
export class PlaylistService extends Context.Tag("PlaylistService")<
  PlaylistService,
  {
    readonly fetchPlaylists: (folderId: string) => Effect.Effect<Playlist[], ApiError>;
    readonly savePlaylist: (playlist: Playlist) => Effect.Effect<void, ApiError>;
  }
>() {}

// 2. Live Layer — provides the implementation
export const PlaylistServiceLive = Layer.succeed(PlaylistService, {
  fetchPlaylists: (folderId) =>
    Effect.tryPromise({
      try: () => api.get(`/folders/${folderId}/playlists`),
      catch: (e) => new ApiError({ cause: e }),
    }),
  savePlaylist: (playlist) =>
    Effect.tryPromise({
      try: () => api.post("/playlists", playlist),
      catch: (e) => new ApiError({ cause: e }),
    }),
});
```

---

## Feature Layer Composition

Each feature composes its service Layers into a single export from `infrastructure/services/index.ts`:

```typescript
// infrastructure/services/index.ts
import { Layer } from "effect";
import { PlaylistServiceLive } from "./PlaylistService";
import { FolderServiceLive } from "./FolderService";

export const FeatureServicesLive = Layer.mergeAll(
  PlaylistServiceLive,
  FolderServiceLive,
);
```

---

## App Runtime Composition

All feature layers are composed once at the app level in `src/effects.ts`. This is the only place the runtime is constructed.

```typescript
// src/effects.ts
import { ManagedRuntime, Layer } from "effect";
import { FeatureServicesLive } from "src/features/{feature}/infrastructure/services";
import { OtherFeatureServicesLive } from "src/features/other/infrastructure/services";

const AppLayer = Layer.mergeAll(
  FeatureServicesLive,
  OtherFeatureServicesLive,
);

export const AppRuntime = ManagedRuntime.make(AppLayer);
export type AppServices = Layer.Layer.Success<typeof AppLayer>;
```

The runtime is then injected into the root controller via XState v5 `input` — see `references/state-management.md` for the injection pattern.

---

## File Structure

```
src/
├── effects.ts                         # App runtime — composed once here, never elsewhere
└── features/{feature}/
    └── infrastructure/
        └── services/
            ├── PlaylistService.ts     # Service tag + live Layer
            ├── FolderService.ts       # Service tag + live Layer
            └── index.ts              # Feature layer composition
```

---

## Rules

- Services own all IO — no `fetch`, `localStorage`, or async calls outside `infrastructure/services/`
- Return `Effect` types, never raw `Promise`
- One service per concern — `PlaylistService.ts` vs `FolderService.ts`
- Feature layers composed in `services/index.ts`
- App runtime composed in `src/effects.ts` only — never inside a feature or machine

---

## Quick Check — Common Violations

**IO performed directly in a controller:**
```typescript
// ❌ Controller doing IO
actions: assign({
  playlists: async () => {
    const res = await fetch("/api/playlists");
    return res.json();
  },
})

// ✅ Controller calls the service via the injected runtime
invoke: {
  src: "fetchPlaylists",
  input: ({ context }) => ({
    runtime: context.runtime,
    folderId: context.activeFolderId,
  }),
}
```

**Raw Promise returned from a service:**
```typescript
// ❌ Returns a Promise — loses typed errors and composability
export const PlaylistServiceLive = Layer.succeed(PlaylistService, {
  fetchPlaylists: async (folderId) => api.get(`/folders/${folderId}/playlists`),
});

// ✅ Returns an Effect — typed errors, composable
export const PlaylistServiceLive = Layer.succeed(PlaylistService, {
  fetchPlaylists: (folderId) =>
    Effect.tryPromise({
      try: () => api.get(`/folders/${folderId}/playlists`),
      catch: (e) => new ApiError({ cause: e }),
    }),
});
```

**Runtime constructed inside a machine:**
```typescript
// ❌ Machine owns the runtime — never do this
context: {
  runtime: ManagedRuntime.make(AppLayer),
}

// ✅ Runtime injected from outside via input
context: ({ input }) => ({
  runtime: input.runtime,
})
```

**Feature services bypassing their index:**
```typescript
// ❌ App runtime imports individual services directly
import { PlaylistServiceLive } from "src/features/{feature}/infrastructure/services/PlaylistService";

// ✅ App runtime imports the composed feature layer
import { FeatureServicesLive } from "src/features/{feature}/infrastructure/services";
```
