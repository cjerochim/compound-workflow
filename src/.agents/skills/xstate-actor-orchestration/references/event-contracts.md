# Event Contract Rules

## Event naming

Use namespaced, domain-specific names:
- `checkout.submit`
- `payment.authorized`
- `payment.declined`
- `fulfillment.timeout`

Avoid generic names unless they are machine-internal and local.

Use consistent namespace depth per bounded context:
- `<domain>.<action>` for simple flows (`cart.add`).
- `<domain>.<subdomain>.<action>` for larger systems (`checkout.payment.authorize`).

## Event typing

Define discriminated unions and keep payloads explicit.

```ts
type CheckoutEvent =
  | { type: 'checkout.submit'; cartId: string }
  | { type: 'payment.authorized'; txnId: string }
  | { type: 'payment.declined'; code: string; reason: string }
  | { type: 'checkout.cancel' };
```

For wildcard routing, declare namespace fallback variants in machine transitions and keep explicit types for domain events.

## Command vs fact

- Command events request behavior (`checkout.submit`).
- Fact events report outcomes (`payment.authorized`).

Keep this distinction explicit to simplify orchestration.

## Wildcard routing patterns

Use wildcard transitions for orchestration and fallback handling:
- `payment.*` to handle payment namespace events.
- `checkout.*` to route checkout namespace events.
- `*` as global fallback.

Use exact matches for business-critical transitions and wildcard matches for coarse routing.
Exact transitions take precedence over wildcard transitions.

Example:

```ts
createMachine({
  on: {
    'checkout.submit': { target: '.submitting' },
    'checkout.*': { actions: 'trackCheckoutNamespaceEvent' },
    'payment.*': { actions: 'routePaymentNamespaceEvent' },
    '*': { actions: 'trackUnhandledEvent' },
  },
});
```

Avoid putting domain success logic exclusively behind wildcard handlers.

## Error contract

Model expected business errors as typed events/states.
Use unexpected errors for fault handling paths.

## Versioning

When an event contract changes:
1. Add new event variant.
2. Support both versions temporarily in adapters.
3. Remove old variant after migration.
