# Responsibility Gates

Apply these gates as default guidance in planning and review.
Use pragmatic judgment and allow justified deviations when context requires.

## MUST Gates

1. Feature placement:
- Frontend feature code is placed in `src/features/<feature-name>/` using the canonical layer layout.

2. Presentation purity:
- `presentation/components` remain composable and controlled/pure.
- UI components do not perform API calls or domain decision logic.

3. Container ownership:
- `application/containers` own composition, state wiring, translations, and context wiring.

4. Controller ownership:
- `application/controller` contains XState machine controllers for feature state flow.
- Any advanced orchestration patterns defer to `xstate-actor-orchestration`.

5. Domain isolation:
- `domain/entities` owns domain entities and related core domain representation.

6. Infrastructure isolation:
- `infrastructure/services` and `infrastructure/mock-services` own IO integrations and test/mock adapters.

## SHOULD Gates

1. Reuse hooks for common access patterns instead of duplicating wiring logic.
2. Keep files single-purpose and avoid multi-layer mixing in one module.
3. Keep naming consistent with feature and domain language.

## Planning Gate

- Use applicable MUST gates to inform acceptance criteria.

## Review Gate

- MUST violations are high-priority by default.
- SHOULD violations are non-blocking unless repeated patterns create maintainability risk.
