---
name: presentation-composability
description: Enforce folder-per-component structure for tapesv3 presentation modules. Use when creating or refactoring components under src/features/tapesv3/presentation/.
---

# Presentation Composability

Enforce folder-per-component structure for tapesv3 presentation modules.

## When to Use

- Adding new presentation components to tapesv3
- Refactoring existing tapesv3 presentation into composable pieces
- Aligning new UI with established tapesv3 patterns

## Structure Rules

### One folder per composable

Each logical UI element gets its own subfolder (PascalCase):

```
presentation/FeatureName/
├── index.ts              # barrel
├── SubComponentA/
│   ├── index.tsx
│   └── styles.ts
├── SubComponentB/
│   ├── index.tsx
│   └── styles.ts
└── SubComponentC/
    └── index.tsx         # styles.ts optional if no styled components
```

### Barrel (`index.ts`)

Re-export from subfolders. Two patterns:

**Flat exports** (simple feature, independent components):

```typescript
export { SubComponentA } from "./SubComponentA";
export { SubComponentB } from "./SubComponentB";
```

**Compound component** (Root + subcomponents used together):

```typescript
export const FeatureName = Object.assign(RootComponent, {
  SubA: SubComponentA,
  SubB: SubComponentB,
});
```

### Component + styles

- `index.tsx`: component logic and JSX
- `styles.ts`: styled-components (or emotion) only
- Import: `import * as S from "./styles"` or `import { Root, Item } from "./styles"`

### Reference implementations

- `SharedTabsHeader` – compound pattern (Root.Action, Root.BackgroundPicker)
- `PanelClipsArtist`, `FolderSelector` – compound pattern
- `MultiSourceThreads` – flat exports (FilterBar, Message, Input, List)
- `TapesTabBarTabOptions` – flat exports

## Anti-patterns

- Single file with multiple components and inline styles
- `ComponentName.styles.ts` – use `styles.ts` in the component folder
- Barrel re-exporting from sibling files instead of subfolders
