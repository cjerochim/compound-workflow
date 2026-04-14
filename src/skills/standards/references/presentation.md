# Presentation Reference

Presentation components are UI only — they receive props and render. Styling is handled with **Tailwind CSS** utility classes. Variant logic is handled with **CVA** (Class Variance Authority). Class merging is handled with **`cn()`**.

---

## CSS-Only Responsive Layout

**Use Tailwind responsive classes instead of JavaScript resize listeners.** Layout is a CSS concern, not a state machine concern.

```typescript
// ❌ Bad — JavaScript-driven layout
const isMobile = snapshot.context.isMobile; // state machine tracks breakpoint
useEffect(() => {
  const handler = () => send({ type: 'WINDOW_RESIZED', width: window.innerWidth });
  window.addEventListener('resize', handler);
}, [send]);
{isMobile ? <MobileDrawer /> : <Sidebar />}

// ✅ Good — CSS-only responsive layout
// No isMobile in machine context, no WINDOW_RESIZED event, no resize listeners
<button className="md:hidden">          {/* Only show on mobile */}
<div className="hidden md:block">       {/* Only show on desktop */}
```

Layout is a presentation concern. CSS handles responsive breakpoints without JavaScript overhead — no re-renders on resize, no state synchronisation issues.

---

## No Base Element CSS Overrides

**When using Tailwind's token-based design system, don't define base element styles (`a`, `h1`, `button`, etc.) with hardcoded values.**

```css
/* ❌ Bad — conflicts with Tailwind's token system */
a { color: #646cff; }
h1 { font-size: 3.2em; }
button { background-color: #1a1a1a; }

/* ✅ Good — use @layer base with semantic tokens */
@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

Base element styles with hex colors bypass the design token system and create inconsistencies. Use `@apply` with semantic tokens or utility classes.

---

## No Separate `styles.ts` Files

**With Tailwind CSS, inline Tailwind classes directly in JSX.** Do not create separate `styles.ts` files that export class strings.

```typescript
// ❌ Bad — separate styles.ts with namespace import
// styles.ts
export const overlay = 'fixed inset-0 z-50 bg-black/50';

// index.tsx
import * as S from './styles';
<div className={S.overlay} />

// ✅ Good — inline Tailwind classes directly in JSX
<div className="fixed inset-0 z-50 bg-black/50" />
```

Separate `styles.ts` files add indirection without benefit when using Tailwind. Classes are already semantic and self-documenting. Inline keeps component logic and styling co-located.

---

## Pure Presentation Rule

Presentation components must have **zero framework imports**. They accept only props — no router hooks, no auth hooks, no state machine references, no `Outlet`, no `Navigate`.

```tsx
// ✅ Pure — accepts children and a derived value as props
import type { ReactNode } from 'react'

interface AppLayoutProps { children: ReactNode }

export function AppLayout({ children }: AppLayoutProps) {
  return <div>{children}</div>
}
```

```tsx
// ✅ Pure — accepts extracted state as a prop, not the hook itself
interface GlobalLoaderProps { isNavigating: boolean }

export function GlobalLoader({ isNavigating }: GlobalLoaderProps) {
  if (!isNavigating) return null
  return <div className="..." />
}
```

```tsx
// ❌ Framework import in presentation — belongs in a container
import { Outlet, useNavigation } from 'react-router-dom'

export function AppLayout() {
  const navigation = useNavigation()   // router concern — wrong layer
  return <><GlobalLoader /><Outlet /></>
}
```

When a presentation component needs data that comes from a framework hook, create a corresponding container that calls the hook and passes the extracted value as a prop. The presentation component never knows where the value came from.

---

## Design Tokens

Design tokens are the foundation of the visual system. They are defined once in `tailwind.config` and consumed everywhere as Tailwind utility classes — never as raw values inline.

### Defining tokens

Tokens are defined in `tailwind.config.ts` under `theme.extend`. This is the single source of truth for colours, spacing, typography, and any other design decisions.

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--color-brand-primary)",
          secondary: "var(--color-brand-secondary)",
        },
        surface: {
          default: "var(--color-surface-default)",
          elevated: "var(--color-surface-elevated)",
          overlay: "var(--color-surface-overlay)",
        },
        content: {
          primary: "var(--color-content-primary)",
          secondary: "var(--color-content-secondary)",
          disabled: "var(--color-content-disabled)",
        },
        feedback: {
          error: "var(--color-feedback-error)",
          success: "var(--color-feedback-success)",
          warning: "var(--color-feedback-warning)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
    },
  },
};
```

The CSS custom properties are defined in the global stylesheet and can be swapped per theme.

### Consuming tokens

Always use Tailwind utility classes that reference tokens — never use raw hex values, `style` props, or arbitrary Tailwind values for anything that should be a token.

```typescript
// ✅ Uses tokens via Tailwind classes
<div className="bg-surface-default text-content-primary rounded-md" />

// ❌ Raw value — not a token, not themeable
<div className="bg-[#1a1a2e] text-[#ffffff]" />

// ❌ Inline style — bypasses the token system entirely
<div style={{ backgroundColor: "#1a1a2e" }} />
```

---

## cn() — Class Merging Utility

`cn()` is the standard utility for composing and merging Tailwind classes. It combines `clsx` (conditional classes) with `tailwind-merge` (conflict resolution).

```typescript
// src/lib/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

Use `cn()` whenever classes are conditional or need to be merged from multiple sources:

```typescript
// ✅ Conditional classes
<div className={cn(
  "rounded-md px-4 py-2",
  isActive && "bg-brand-primary text-white",
  isDisabled && "opacity-50 cursor-not-allowed",
)} />

// ✅ Merging variant classes with overrides
<button className={cn(buttonVariants({ intent: "primary" }), className)} />
```

---

## CVA — Variant Definitions

CVA defines the variant logic for a component. CVA definitions live **below the component's JSX** in the same file — no separate file needed.

### Basic variant

```typescript
// FolderItem/index.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "src/lib/cn";

interface FolderItemProps extends VariantProps<typeof folderItemVariants> {
  label: string;
  className?: string;
}

export const FolderItem = ({ label, intent, size, className }: FolderItemProps) => (
  <div className={cn(folderItemVariants({ intent, size }), className)}>
    {label}
  </div>
);

// CVA definition — below the component
const folderItemVariants = cva(
  // Base classes — always applied
  "flex items-center gap-2 rounded-md transition-colors",
  {
    variants: {
      intent: {
        default: "bg-surface-default text-content-primary hover:bg-surface-elevated",
        active:  "bg-brand-primary text-white",
        ghost:   "text-content-secondary hover:bg-surface-overlay",
      },
      size: {
        sm: "px-2 py-1 text-sm",
        md: "px-3 py-2 text-base",
        lg: "px-4 py-3 text-lg",
      },
    },
    defaultVariants: {
      intent: "default",
      size: "md",
    },
  }
);
```

### Compound variants

Use `compoundVariants` when classes only apply under a specific combination of variants:

```typescript
const buttonVariants = cva("font-medium rounded-md transition-colors", {
  variants: {
    intent: {
      primary:   "bg-brand-primary text-white",
      secondary: "bg-surface-elevated text-content-primary",
      ghost:     "text-content-secondary",
    },
    size: {
      sm: "px-2 py-1 text-sm",
      md: "px-4 py-2 text-base",
    },
    disabled: {
      true:  "opacity-50 cursor-not-allowed",
      false: "",
    },
  },
  compoundVariants: [
    // Hover only applies when not disabled
    { intent: "primary",   disabled: false, class: "hover:bg-brand-secondary" },
    { intent: "secondary", disabled: false, class: "hover:bg-surface-overlay" },
  ],
  defaultVariants: {
    intent: "primary",
    size:   "md",
    disabled: false,
  },
});
```

### Required variants

When a variant must always be provided, use TypeScript utility types to make it required:

```typescript
type FolderItemVariantProps = VariantProps<typeof folderItemVariants>;

// Make `intent` required, keep everything else optional
interface FolderItemProps
  extends Omit<FolderItemVariantProps, "intent">,
    Required<Pick<FolderItemVariantProps, "intent">> {
  label: string;
  className?: string;
}
```

### CVA in compound components

In a compound component each sub-component owns its own CVA definition in its own file. Sub-components do not share CVA instances — each is self-contained.

```typescript
// FolderSelectorRoot/index.tsx
export const FolderSelectorRoot = ({ children, className }: FolderSelectorRootProps) => (
  <div className={cn(rootVariants(), className)}>{children}</div>
);

const rootVariants = cva("flex flex-col w-full bg-surface-default rounded-lg");

// FolderItem/index.tsx
export const FolderItem = ({ label, isActive, className }: FolderItemProps) => (
  <div className={cn(itemVariants({ isActive }), className)}>{label}</div>
);

const itemVariants = cva("flex items-center gap-2 px-3 py-2 rounded-md", {
  variants: {
    isActive: {
      true:  "bg-brand-primary text-white",
      false: "text-content-primary hover:bg-surface-elevated",
    },
  },
  defaultVariants: { isActive: false },
});
```

---

## Folder Structure

Every component lives in its own PascalCase folder under `src/features/{feature}/presentation/`.

### Simple component

A self-contained component with no sub-components. One file only:

```
FolderItem/
└── index.tsx        # component JSX + CVA definitions below
```

### Compound component

A larger component composed of multiple sub-components, exposed as a single public API via the barrel:

```
FolderSelector/
├── index.ts                      # barrel — Object.assign composition
├── FolderSelectorRoot/
│   └── index.tsx                 # root JSX + CVA below
├── FolderItem/
│   └── index.tsx                 # item JSX + CVA below
├── FolderActions/
│   ├── index.tsx                 # actions root JSX + CVA below
│   ├── FolderActionsAdd.tsx      # tightly related — stays in parent folder
│   └── FolderActionsMore.tsx     # tightly related — stays in parent folder
└── FolderSelectorCollapsed/
    └── index.tsx
```

Sub-components that belong to the same concern stay in the parent folder as named exports. Only promote to a subfolder when independently meaningful.

---

## Barrel Pattern

The `index.ts` barrel assembles the public API of the compound component. It is composition only — no component definitions, no logic, no CVA.

```typescript
// FolderSelector/index.ts
import { FolderSelectorRoot } from "./FolderSelectorRoot";
import { FolderItem } from "./FolderItem";
import { FolderActions, FolderActionsAdd, FolderActionsMore } from "./FolderActions";
import { FolderSelectorCollapsed } from "./FolderSelectorCollapsed";
import { FolderSelectorExpanded } from "./FolderSelectorExpanded";

export const FolderSelector = Object.assign(FolderSelectorRoot, {
  Folder:      FolderItem,
  Actions:     FolderActions,
  ActionsAdd:  FolderActionsAdd,
  ActionsMore: FolderActionsMore,
  Collapsed:   FolderSelectorCollapsed,
  Expanded:    FolderSelectorExpanded,
});
```

Usage at the call site makes relationships explicit:

```typescript
<FolderSelector>
  <FolderSelector.Collapsed />
  <FolderSelector.Expanded>
    <FolderSelector.Folder intent="active" label="My Playlist" />
  </FolderSelector.Expanded>
</FolderSelector>
```

### Rules

- Relative imports only — the barrel imports from its own subfolders, never from outside the component boundary
- No logic in the barrel — composition only
- What's in `Object.assign` is the public API — if it's not in the barrel, it's internal
- No `styles.ts` — styling belongs in the component file via CVA and Tailwind

---

## className Prop

All components accept an optional `className` prop for overrides at the call site. Always merge with `cn()` — never concatenate strings directly.

```typescript
interface FolderItemProps extends VariantProps<typeof folderItemVariants> {
  className?: string;
}

export const FolderItem = ({ intent, size, className }: FolderItemProps) => (
  <div className={cn(folderItemVariants({ intent, size }), className)} />
);
```

This allows containers to apply layout-specific classes without breaking the component's internal variant logic.

---

## Quick Check — Common Violations

**Raw value instead of a token:**
```typescript
// ❌
<div className="bg-[#1a1a2e] text-[14px]" />

// ✅
<div className="bg-surface-default text-sm" />
```

**CVA in a separate file:**
```typescript
// ❌ Separate variants.ts file
import { buttonVariants } from "./variants";

// ✅ CVA defined below the component in the same file
export const Button = ({ intent }: ButtonProps) => (
  <button className={buttonVariants({ intent })} />
);
const buttonVariants = cva("...", { variants: { intent: { ... } } });
```

**String concatenation instead of cn():**
```typescript
// ❌ Class conflicts not resolved
className={`${baseClasses} ${isActive ? "bg-brand-primary" : ""}`}

// ✅
className={cn(baseClasses, isActive && "bg-brand-primary")}
```

**Styles outside the component file:**
```typescript
// ❌ styles.ts with styled components
import { Base, BaseContent } from "./styles";

// ✅ Tailwind classes inline, CVA below the component
<div className={cn(rootVariants(), className)} />
```

**Barrel importing from outside component boundary:**
```typescript
// ❌
import { FolderItem } from "src/features/other/presentation/FolderItem";

// ✅
import { FolderItem } from "./FolderItem";
```

**Variant logic inline in JSX instead of CVA:**
```typescript
// ❌ Variant logic scattered through JSX
<div className={`rounded-md ${intent === "primary" ? "bg-brand-primary text-white" : "bg-surface-default text-content-primary"}`} />

// ✅ Variant logic in CVA, JSX stays clean
<div className={cn(itemVariants({ intent }), className)} />
```

**JavaScript-driven responsive layout:**
```typescript
// ❌ Resize listener + state machine tracking breakpoint
const isMobile = snapshot.context.isMobile;
{isMobile ? <MobileDrawer /> : <Sidebar />}

// ✅ CSS-only
<div className="hidden md:block"><Sidebar /></div>
<div className="md:hidden"><MobileDrawer /></div>
```

**Base element styles with hardcoded values:**
```css
/* ❌ Bypasses token system */
a { color: #646cff; }
button { background-color: #1a1a1a; }

/* ✅ Use @layer base with semantic tokens */
@layer base {
  body { @apply bg-background text-foreground; }
}
```

**Separate `styles.ts` file:**
```typescript
// ❌
import * as S from './styles';
<div className={S.overlay} />

// ✅
<div className="fixed inset-0 z-50 bg-black/50" />
```
