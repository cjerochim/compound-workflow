---
name: financial-workflow-integrity
description: Enforce correct financial workflows using durable state, idempotency, immutability, and concurrency guards (Drizzle + Postgres).
---

# Financial Workflow Integrity Standard (Drizzle + Postgres)

## Purpose

Provide a practical standard for building workflows that have financial outcomes or regulatory sensitivity. This skill focuses on correctness under:

- retries and duplicates
- concurrent executions
- long-running orchestration (queues / workflow engines)
- human approvals and external callbacks

---

## Non-Negotiable Rules (MUST / MUST NOT)

### State transitions

- MUST represent workflow progress with explicit states/statuses.
- MUST guard state transitions using optimistic concurrency or a lock with TTL.
- MUST treat the DB as the source of truth for business state.
- MUST NOT rely on workflow engine "runs once" as correctness.
- MUST NOT run side effects unless you won the transition.

### Idempotency

- MUST apply request-level idempotency to all externally triggered money-adjacent actions (submit, approve, payout, charge).
- MUST apply step-level idempotency to any side effect (email, webhook, CRM record, ledger entry).
- MUST enforce idempotency with DB unique constraints (not just checks in code).
- MUST scope idempotency to actor + operation + entity to prevent cross-user/cross-operation collisions.

### Immutability

- MUST snapshot submissions and financial decisions.
- MUST NOT mutate the canonical data that a decision was made on.
- MUST model edits as a new submission/version.

### Failure behavior

- MUST fail closed for financial actions when uncertain.
- MUST produce a deterministic outcome for retries (replay stored response where appropriate).

### Money representation

- MUST represent money as `numeric(10,2)` or `numeric(12,2)` in Postgres (exact decimal arithmetic).
- MUST NOT use floating point for monetary values.
- MUST use a decimal library (e.g. `decimal.js`, `big.js`) for arithmetic in application code — Drizzle returns `numeric` columns as `string` by default, which is safe for storage and transport but not for math.
- MUST store currency as ISO 4217 code alongside monetary amounts.

---

## Core Data Model (Baseline)

All schema examples use Drizzle ORM (`drizzle-orm/pg-core`).

### applications (or equivalent)

Required columns:

- `status` (pgEnum)
- `current_step` (text)
- `version` (integer, default 1)
- `created_at` (timestamp)

### Immutable submissions

Store what was submitted/approved against:

```typescript
import { pgTable, uuid, integer, jsonb, timestamp, unique } from "drizzle-orm/pg-core";

export const applicationSubmissions = pgTable(
  "application_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    submissionNo: integer("submission_no").notNull(),
    submittedData: jsonb("submitted_data").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.applicationId, table.submissionNo),
  ]
);
```

### Idempotency keys (request-level)

Rules:

- `request_hash` MUST be computed from a canonical, stable representation.
- Hash inputs MUST include: operation, entity id, actor/principal id, and any money fields (amount, currency).
- If a key is re-used with a different hash, reject as misuse.

Recommended schema:

```typescript
import { pgTable, pgEnum, text, uuid, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const idempotencyStatusEnum = pgEnum("idempotency_status", [
  "STARTED",
  "SUCCEEDED",
  "FAILED",
]);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    scope: text("scope").notNull(),                // e.g. "application.submit" / "payout.create" / "webhook.stripe"
    key: text("key").notNull(),                    // client/provider idempotency key
    operation: text("operation").notNull(),         // explicit operation name
    entityId: uuid("entity_id"),                   // entity being acted on (nullable for provider webhooks)
    principalId: text("principal_id"),              // user/admin/service principal identifier

    requestHash: text("request_hash").notNull(),
    status: idempotencyStatusEnum("status").notNull().default("STARTED"),
    response: jsonb("response"),                   // safe response only; MUST NOT contain secrets/PII

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),   // lease/ttl for STARTED recovery
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Composite primary key
    // Note: Drizzle uses .primaryKey() on columns or primaryKey() helper for composites
    index("idempotency_keys_status_idx").on(table.status),
    index("idempotency_keys_expires_at_idx").on(table.expiresAt),
  ]
);
// Primary key: (scope, key) — define via primaryKey({ columns: [table.scope, table.key] })
```

### Step runs (side-effect idempotency)

Each step that causes an external effect MUST create a durable row first.

```typescript
import { pgTable, pgEnum, uuid, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";

export const stepRunStatusEnum = pgEnum("step_run_status", [
  "STARTED",
  "SUCCEEDED",
  "FAILED",
]);

export const workflowStepRuns = pgTable(
  "workflow_step_runs",
  {
    entityId: uuid("entity_id").notNull(),
    stepKey: text("step_key").notNull(),

    status: stepRunStatusEnum("status").notNull().default("STARTED"),
    metadata: jsonb("metadata").notNull().default({}),
    attemptCount: integer("attempt_count").notNull().default(1),
    lastError: text("last_error"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Primary key: (entityId, stepKey) — define via primaryKey({ columns: [table.entityId, table.stepKey] })
);
```

### Provider event dedupe (webhooks)

Always dedupe by provider event id.

```typescript
import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const providerEvents = pgTable(
  "provider_events",
  {
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb("payload"),
  },
  // Primary key: (provider, eventId) — define via primaryKey({ columns: [table.provider, table.eventId] })
);
```

---

## Optimistic Concurrency Standard

### Rule

Every transition MUST be:

- conditional on current status
- conditional on current version
- increments version

### Drizzle pattern

Use Drizzle's `.update().set().where(and(...)).returning()` to atomically attempt the transition. An empty result array means the transition was lost to a concurrent writer.

```typescript
import { eq, and, sql } from "drizzle-orm";

const [updated] = await db
  .update(applications)
  .set({
    status: "PROCESSING",
    version: sql`${applications.version} + 1`,
    updatedAt: new Date(),
  })
  .where(
    and(
      eq(applications.id, applicationId),
      eq(applications.status, "SUBMITTED"),
      eq(applications.version, expectedVersion)
    )
  )
  .returning();

if (!updated) {
  // Conflict: another writer already transitioned this row.
  // Reload and decide: no-op if already advanced, or return 409.
  throw new ConflictError("Application already transitioned");
}

// Only run side effects AFTER winning the transition.
```

Key points:

- `.returning()` returns the updated rows. An empty array means zero rows matched — treat as conflict.
- Never run side effects unless you won the transition.
- Reload the row after a conflict to decide whether to no-op (already advanced) or reject.

---

## Drizzle Transactions

Use `db.transaction()` to group state transitions and side-effect guards into a single atomic unit. Drizzle transactions auto-rollback on throw.

```typescript
const result = await db.transaction(async (tx) => {
  // 1. Win the state transition
  const [updated] = await tx
    .update(applications)
    .set({
      status: "APPROVED",
      version: sql`${applications.version} + 1`,
    })
    .where(
      and(
        eq(applications.id, applicationId),
        eq(applications.status, "PENDING_APPROVAL"),
        eq(applications.version, expectedVersion)
      )
    )
    .returning();

  if (!updated) {
    throw new ConflictError("Transition lost");
  }

  // 2. Write audit log within the same transaction
  await tx.insert(auditLog).values({
    entityType: "application",
    entityId: applicationId,
    action: "approved",
    actorId: userId,
    workspaceId,
    previousState: { status: "PENDING_APPROVAL" },
    newState: { status: "APPROVED" },
    correlationId,
  });

  // 3. Guard side effects within the same transaction
  const [stepClaimed] = await tx
    .insert(workflowStepRuns)
    .values({
      entityId: applicationId,
      stepKey: "send_approval_email",
    })
    .onConflictDoNothing()
    .returning();

  return { updated, stepClaimed };
});

// 4. Only run external side effects AFTER successful commit
if (result.stepClaimed) {
  await sendApprovalEmail(result.updated);
}
```

Key points:

- The transaction auto-rolls back if any statement throws.
- Combine state transition + audit log + step claim in one transaction.
- External side effects (email, webhook) run AFTER the transaction commits, never inside it.

---

## Request-Level Idempotency Standard

### When required

Any operation initiated by:

- HTTP request from client
- webhook from provider
- job replays
- admin actions

...that could result in a financial or user-impacting outcome.

### Pattern

1. Compute `request_hash` from canonical payload.
2. Claim key by inserting `idempotency_keys` row (or transitioning an expired STARTED row under a lease).
3. If insert conflicts:
   - load existing row
   - if hash mismatch => reject (key reuse attempt)
   - if SUCCEEDED => return stored response
   - if STARTED (not expired) => return "in progress" / retry-after
   - if FAILED => return deterministic failure (optionally allow explicit retry with a new key)
4. After claim succeeds:
   - perform action
   - set status SUCCEEDED and store safe response

Never perform the action before claiming the key.

### Drizzle example

```typescript
import { eq, and } from "drizzle-orm";

// Claim the idempotency key
const [claimed] = await db
  .insert(idempotencyKeys)
  .values({
    scope: "invoice.finalize",
    key: idempotencyKey,
    operation: "finalize",
    entityId: invoiceId,
    principalId: userId,
    requestHash: computedHash,
    expiresAt: new Date(Date.now() + 5 * 60_000), // 5 min TTL
  })
  .onConflictDoNothing()
  .returning();

if (!claimed) {
  // Key already exists — load and decide
  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.scope, "invoice.finalize"),
        eq(idempotencyKeys.key, idempotencyKey)
      )
    );

  if (existing.requestHash !== computedHash) {
    throw new BadRequestError("Idempotency key reuse with different payload");
  }
  if (existing.status === "SUCCEEDED") {
    return existing.response; // Replay stored response
  }
  if (existing.status === "STARTED") {
    throw new ConflictError("Operation in progress");
  }
  // FAILED — return deterministic failure
  throw new OperationFailedError(existing.response);
}

// Key claimed — proceed with the action
```

---

## Step-Level Idempotency Standard

### When required

Any step that causes a side effect:

- send email
- create external record
- write ledger entry
- publish event
- call webhook

### Pattern

```typescript
const [stepClaimed] = await tx
  .insert(workflowStepRuns)
  .values({
    entityId: applicationId,
    stepKey: "send_confirmation_email",
    metadata: {},
  })
  .onConflictDoNothing()
  .returning();

// Only proceed if insert succeeded (row was claimed)
if (!stepClaimed) {
  return; // Already executed — skip
}

// Execute the side effect
const result = await sendEmail(/* ... */);

// Mark as succeeded with provider metadata
await tx
  .update(workflowStepRuns)
  .set({
    status: "SUCCEEDED",
    metadata: { messageId: result.id },
    updatedAt: new Date(),
  })
  .where(
    and(
      eq(workflowStepRuns.entityId, applicationId),
      eq(workflowStepRuns.stepKey, "send_confirmation_email")
    )
  );
```

---

## External Systems & Provider Idempotency

If your provider supports idempotency (e.g. payments):

- MUST pass an idempotency key to the provider
- MUST also enforce idempotency internally (do not fully trust providers)

Store provider identifiers (payment id, message id, etc.) in `workflow_step_runs.metadata` for reconciliation.

---

## Human-in-the-loop Approvals

### Standard pattern

- `AWAITING_REVIEW` state represents a durable wait
- approval action itself is idempotent + concurrency guarded
- decision is immutable and audited

Model:

- `review_decisions` table with unique `(application_id, decision_no)`
- store approver id, timestamp, reason codes
- store the submission id/version being decided on

---

## External Callbacks / Webhooks

### Rules

- Always treat callbacks as duplicates.
- Validate signature, timestamp, and replay protection if available.
- Insert into `provider_events` first; if conflict, no-op.
- Apply request-level idempotency on callback processing scope if you execute multiple sub-actions.
- Update business state via version-guarded transitions.

### Drizzle example

```typescript
import { eq, and } from "drizzle-orm";

// Dedupe by provider event id
const [eventClaimed] = await db
  .insert(providerEvents)
  .values({
    provider: "stripe",
    eventId: stripeEvent.id,
    payload: stripeEvent,
  })
  .onConflictDoNothing()
  .returning();

if (!eventClaimed) {
  // Already processed — return 200 to provider
  return new Response("OK", { status: 200 });
}

// Process the event within a transaction
await db.transaction(async (tx) => {
  // Version-guarded state transition
  const [updated] = await tx
    .update(payments)
    .set({
      status: "CONFIRMED",
      version: sql`${payments.version} + 1`,
      bankReference: stripeEvent.data.charge_id,
    })
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.status, "PENDING"),
        eq(payments.version, expectedVersion)
      )
    )
    .returning();

  if (!updated) {
    throw new ConflictError("Payment already transitioned");
  }

  // Audit log within the same transaction
  await tx.insert(auditLog).values({
    entityType: "payment",
    entityId: paymentId,
    action: "confirmed_via_webhook",
    actorId: null, // system event
    workspaceId,
    correlationId,
  });
});
```

---

## Failure Modes

### Workflow step partially succeeds

Example: email sent but DB update failed.

Mitigation:

- `workflow_step_runs` is the source of truth for "was it done?"
- store provider message id
- retries become no-op (or resume from durable state)

### Conflicting transitions

Mitigation:

- only the winner of version-guarded transition proceeds
- others reload and exit

### Stuck STARTED idempotency key

Mitigation:

- enforce `expires_at` and define a recovery path
- recovery MUST be lease-based (update-if-expired) to avoid multiple recoveries
- include manual override with audit trail

---

## Safe-by-default Outcome Policy

For money-adjacent actions:

- prefer returning "in progress" over executing twice
- prefer failing closed over guessing
- require manual intervention when state is ambiguous

---

## PR Review Checklist

- [ ] All state transitions are guarded by status + version using Drizzle `and(eq(...), eq(...))`.
- [ ] Optimistic locking uses `.returning()` and checks for empty result array to detect conflicts.
- [ ] State transitions and audit writes occur within a single `db.transaction()`.
- [ ] Any externally triggered financial action uses request-level idempotency.
- [ ] Idempotency scope includes actor/principal + operation + entity (prevents collisions).
- [ ] Every side effect has step-level idempotency with durable status/metadata.
- [ ] Submission/decision snapshots are immutable (edits create a new submission/version).
- [ ] Provider idempotency keys are used where supported.
- [ ] Webhooks dedupe by provider event id and are treated as duplicates.
- [ ] Audit events emitted for transitions and decisions (no sensitive payloads).
- [ ] Money stored as `numeric(10,2)` or `numeric(12,2)` — never floating point.
- [ ] Numeric values from Drizzle (returned as `string`) use a decimal library for arithmetic.

---

## References

- Drizzle update: https://orm.drizzle.team/docs/update
- Drizzle transactions: https://orm.drizzle.team/docs/transactions
- Drizzle operators (`and`, `eq`, `sql`): https://orm.drizzle.team/docs/operators
- Drizzle pgTable / pgEnum: https://orm.drizzle.team/docs/sql-schema-declaration

---

End of Skill.
