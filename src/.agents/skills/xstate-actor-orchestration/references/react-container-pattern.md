# React Container Pattern for XState

Use containers as controllers and components as pure render units.

## 1. Container responsibilities

- Create or receive actor refs.
- Read state/context via `useSelector`.
- Map selected values into stable component props.
- Wire event handlers that send events to actors.

## 2. Presentational component responsibilities

- Receive props only.
- Render UI only.
- Avoid actor imports and machine knowledge.

## 3. `useSelector` guidance

- Prefer narrow selectors to limit rerenders.
- Select tags and derived values, not whole snapshots.
- Keep selectors deterministic and side-effect free.

## 4. `emit` + `useEffect` for fire-and-forget UI actions

- Use machine `emit(...)` to publish imperative signals (toast, navigation, analytics).
- Subscribe in container `useEffect`.
- Trigger UI side effects from emitted events, not from render paths.

Example pattern:

```ts
useEffect(() => {
  const sub = actorRef.on('ui.toast', (event) => {
    toast(event.message);
  });
  return () => sub.unsubscribe();
}, [actorRef]);
```

## 5. Composition guidance

- Container composes presentational components from selected state/context.
- Keep props cohesive; avoid passing entire context objects by default.
- Compose feature UI from multiple containers if actor boundaries differ.
