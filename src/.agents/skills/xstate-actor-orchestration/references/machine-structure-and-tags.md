# Machine Structure and Tags

Use structure as the primary control-flow model.

## 1. Scope with nested states

- Use parent/child states to limit where events are handled.
- Keep transitions local to the smallest valid scope.
- Move shared transitions to parent states when behavior is intentionally shared.

## 2. Choose parallel vs sequential intentionally

- Use parallel states when regions are independent and can progress concurrently.
- Use sequential states when one stage must complete before another can start.
- Do not force sequential flow for unrelated concerns.

## 3. Model flow with states, not booleans

- Do not use boolean flags to represent machine mode (`isLoading`, `isSaving`, `hasError`).
- Represent each mode with explicit states/substates and tags.
- Keep booleans only for raw domain facts that do not encode control flow.

## 4. Use tags for declarative UI state selection

- Add tags for stable UI concerns (e.g., `busy`, `error`, `success`, `canRetry`).
- In React, derive render behavior from `snapshot.hasTag(...)` and selectors.
- Keep tags semantic and durable across refactors.

## 5. Namespace-aware routing strategy

- Prefer exact event transitions for business-critical behavior.
- Add namespace wildcards for orchestration routing:
- `billing.*`
- `checkout.*`
- `*` fallback
- Keep wildcard handlers observability-focused unless intentionally routing.
