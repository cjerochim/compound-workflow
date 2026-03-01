# Functional Domain and Entity Transform Patterns

Use these rules for domain/entity object transformation code used by machines.

## Core rules

1. Keep transforms pure.
- Accept input data and return next data.
- Do not mutate input objects.
- Do not perform IO in transforms.

2. Keep transforms outside machine config where possible.
- Prefer `domain/` or `entities/` modules for reusable transform logic.
- Keep actions/guards small and orchestration-focused.

3. Prefer immutable updates.
- Return new objects/arrays.
- Keep output shape predictable and typed.

4. Prefer early returns over nested `if/else`.
- Exit quickly for invalid or terminal branches.
- Keep the main success path linear.

## Example

```ts
type Payment = { amount: number; currency: string; status: 'new' | 'authorized' };

export function authorizePayment(payment: Payment, limit: number): Payment {
  if (payment.amount <= 0) return payment;
  if (payment.amount > limit) return payment;
  if (payment.status === 'authorized') return payment;

  return {
    ...payment,
    status: 'authorized',
  };
}
```

## Machine integration pattern

- Use machine actions to call pure transforms.
- Keep action code thin:
- Read current context.
- Call pure transform.
- Assign returned value.

## Testing expectations

- Unit test transform modules directly without actor runtime.
- Cover edge conditions first.
- Keep golden-path and failure-path tests explicit.
