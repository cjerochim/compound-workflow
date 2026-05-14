---
name: data-foundations
description: Enforce DB access boundaries, multi-tenant isolation (app-layer), and mutation integrity patterns for scalable SaaS (Postgres + Drizzle).
---

# Data Foundations (Multi-Tenant SaaS)

## Purpose

Establish enforceable, minimal, and scalable database patterns for multi-tenant SaaS systems.

These foundations are designed to:

- prevent architectural entropy
- enforce clear data boundaries
- preserve long-term velocity
- reduce security and compliance risk
- eliminate ambiguous implementation decisions

These patterns are non-negotiable in greenfield systems.

---

## Core Foundations

## 1. Application-Layer Tenant Isolation

### Principle

Tenant isolation is enforced at the application layer via a `createTenantDb()` wrapper. The database has a single access path (Cloudflare Workers API). There are no direct database connections from clients, no database-level access policies, views, or functions.

### Rules

- All workspace-scoped queries MUST go through `createTenantDb(db, workspaceId)`.
- Route handlers MUST NOT use the raw `db` client directly for workspace-scoped tables.
- The `createTenantDb` wrapper automatically applies `WHERE workspace_id = ?` to all workspace-scoped table operations.
- Reference tables and workspace resolution queries use `tenantDb.raw` (the unwrapped Drizzle client).
- Relationship-scoped tables (`carers`, `carer_pii`) are excluded from `createTenantDb` and accessed via explicit enrollment joins.

### createTenantDb() Wrapper Pattern

```typescript
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@careflow/db/schema";

/**
 * Creates a tenant-scoped database wrapper that automatically
 * applies workspace_id filtering to all workspace-scoped tables.
 *
 * Excluded tables (not workspace-scoped):
 * - carers, carer_pii (relationship-scoped via enrollment joins)
 * - support_categories, ndis_rates, pricing_versions (reference tables)
 */
export function createTenantDb(db: ReturnType<typeof drizzle>, workspaceId: string) {
  return {
    // Workspace-scoped query helpers
    query: {
      participants: {
        findMany: (opts?: { where?: SQL }) =>
          db.select().from(schema.participants)
            .where(and(eq(schema.participants.workspaceId, workspaceId), opts?.where)),
        findFirst: (opts: { where: SQL }) =>
          db.select().from(schema.participants)
            .where(and(eq(schema.participants.workspaceId, workspaceId), opts.where))
            .limit(1),
      },
      shifts: {
        findMany: (opts?: { where?: SQL }) =>
          db.select().from(schema.shifts)
            .where(and(eq(schema.shifts.workspaceId, workspaceId), opts?.where)),
      },
      // ... other workspace-scoped tables follow the same pattern
    },

    // Insert with automatic workspace_id injection
    insert: (table: WorkspaceScopedTable) => ({
      values: (data: Record<string, unknown>) =>
        db.insert(table).values({ ...data, workspaceId }),
    }),

    // Update with automatic workspace_id scoping
    update: (table: WorkspaceScopedTable) => ({
      set: (data: Record<string, unknown>) => ({
        where: (condition: SQL) =>
          db.update(table).set(data)
            .where(and(eq(table.workspaceId, workspaceId), condition)),
      }),
    }),

    // Raw Drizzle client for non-tenant operations
    raw: db,
  };
}
```

### Middleware Integration

```typescript
// Hono middleware — sets tenantDb on context after auth resolution
app.use("/api/v1/*", async (c, next) => {
  const db = c.get("db");
  const { workspaceId } = c.get("auth");
  const tenantDb = createTenantDb(db, workspaceId);
  c.set("tenantDb", tenantDb);
  await next();
});

// Route handler — uses tenantDb, never raw db
app.get("/api/v1/participants", async (c) => {
  const tenantDb = c.get("tenantDb");
  const participants = await tenantDb.query.participants.findMany();
  return c.json(participants);
});
```

### ESLint Enforcement

An ESLint rule MUST prevent raw `db` client usage in route handlers:

```typescript
// eslint-plugin-careflow rule: no-raw-db-in-handlers
// ❌ FORBIDDEN in route handlers:
const results = await db.select().from(participants);

// ✅ REQUIRED — use tenantDb:
const results = await tenantDb.query.participants.findMany();

// ✅ ALLOWED — raw db for reference tables and workspace resolution:
const rates = await tenantDb.raw.select().from(ndisRates);
```

---

## 2. Two-Tier Data Scoping

### Principle

Not all tables belong to a single tenant. Data scoping follows a two-tier model based on entity ownership.

### Tier 1: Workspace-Scoped Tables

Tables with a `workspace_id` column. All queries filtered automatically by `createTenantDb()`.

**Tables:** `users`, `participants`, `shifts`, `enrollments`, `enrollment_rates`, `budgets`, `invoices`, `invoice_lines`, `payments`, `documents`, `task_templates`, `shift_tasks`, `audit_log`

```typescript
// Workspace-scoped — createTenantDb handles filtering
const shifts = await tenantDb.query.shifts.findMany({
  where: eq(schema.shifts.status, "pending_approval"),
});
```

### Tier 2: Relationship-Scoped Tables

Tables without `workspace_id`. Accessed only via joins through workspace-scoped tables (enrollments).

**Tables:** `carers`, `carer_pii`

Carers are independent entities that can span multiple workspaces. Access is scoped through enrollment relationships — a carer is visible within a workspace only if they have an active enrollment for a participant in that workspace.

```typescript
// Relationship-scoped — explicit enrollment join required
const carers = await tenantDb.raw
  .select({ carer: schema.carers })
  .from(schema.carers)
  .innerJoin(schema.enrollments, eq(schema.carers.id, schema.enrollments.carerId))
  .innerJoin(schema.participants, eq(schema.enrollments.participantId, schema.participants.id))
  .where(eq(schema.participants.workspaceId, workspaceId));
```

### Reference Tables (Global, No Scoping)

Tables with no tenant context. Accessible to any authenticated request.

**Tables:** `support_categories`, `ndis_rates`, `pricing_versions`

```typescript
// Reference data — use tenantDb.raw, no workspace filtering
const rates = await tenantDb.raw.select().from(schema.ndisRates)
  .where(eq(schema.ndisRates.pricingVersionId, versionId));
```

---

## 3. Provider-Agnostic Auth Resolution

### Principle

The platform owns user identity. The auth provider (Clerk) is an implementation detail resolved at the boundary. Domain tables never reference external auth provider IDs directly.

### Resolution Flow

```
Clerk JWT
  → extract sub (external_auth_id) + org_id (external_org_id)
  → workspaces lookup: WHERE external_org_id = org_id AND auth_provider = 'clerk'
    → internal workspace_id
  → users lookup: WHERE external_auth_id = sub AND auth_provider = 'clerk'
    → internal user_id
  → all downstream code uses user_id + workspace_id (never Clerk IDs)
```

### Rules

- All FKs reference `users.id` (uuid), never external auth IDs.
- The `users` table stores `external_auth_id` + `auth_provider` for lookup. The `workspaces` table stores `external_org_id` + `auth_provider`.
- Auto-provision: if workspace or user doesn't exist on first auth, create the record (just-in-time provisioning).
- Role is read from the JWT `org_role` claim, not stored in the database.

---

## 4. Mutation Integrity

### Principle

All writes must be safe, auditable, and repeatable.

### Required Patterns

#### Transactional Mutations

All business mutations MUST execute within a Drizzle transaction. Audit log writes happen inside the same transaction.

```typescript
const result = await db.transaction(async (tx) => {
  // Business mutation
  const [shift] = await tx.update(schema.shifts)
    .set({ status: "approved", approvedByUserId: userId })
    .where(and(
      eq(schema.shifts.id, shiftId),
      eq(schema.shifts.workspaceId, workspaceId),
      eq(schema.shifts.status, "pending_approval"), // optimistic lock
    ))
    .returning();

  if (!shift) throw new ConflictError("Shift already processed");

  // Audit log in same transaction
  await tx.insert(schema.auditLog).values({
    actorId: userId,
    actorType: "admin",
    workspaceId,
    entityType: "shift",
    entityId: shiftId,
    action: "approve",
    previousState: { status: "pending_approval" },
    newState: { status: "approved" },
    correlationId,
  });

  return shift;
});
// Auto-rollback on throw — no partial writes
```

#### Audit Logging

- Single append-only `audit_log` table.
- Every mutation writes an audit record within the same transaction.
- Logs survive soft deletes and anonymisation.

Minimum audit fields:

- `actor_id` (uuid FK → users.id, nullable for system events)
- `actor_type` (admin | member | carer | system)
- `workspace_id` (not null — all events occur within a workspace)
- `participant_id` (nullable — system events have no participant context)
- `entity_type`
- `entity_id`
- `action`
- `correlation_id`
- `created_at`

#### Idempotency

- External mutations require idempotency keys.
- Enforced with unique constraints.
- Replays return stored result.

#### Concurrency Control — Optimistic Locking

Use optimistic locking via condition in the `WHERE` clause. An empty `returning()` array indicates a conflict.

```typescript
const [updated] = await tx.update(schema.shifts)
  .set({ status: "approved" })
  .where(and(
    eq(schema.shifts.id, shiftId),
    eq(schema.shifts.status, "pending_approval"), // guard condition
  ))
  .returning();

if (!updated) {
  // Conflict — another request already processed this shift
  throw new ConflictError("Concurrent modification detected");
}
```

---

## Schema Conventions

### Drizzle Schema Definition

All schemas use Drizzle ORM with `drizzle-orm/pg-core`:

```typescript
import { pgTable, pgEnum, uuid, text, timestamp, numeric, boolean, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

// Enum definition
export const shiftStatusEnum = pgEnum("shift_status", [
  "scheduled", "in_progress", "pending_approval",
  "approved", "rejected", "queried", "cancelled",
]);

// Table definition with constraint callback syntax
export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  participantId: uuid("participant_id").notNull().references(() => participants.id),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id),
  status: shiftStatusEnum("status").notNull().default("scheduled"),
  agreedUnitRate: numeric("agreed_unit_rate", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("shifts_workspace_id_idx").on(table.workspaceId),
  index("shifts_participant_id_idx").on(table.participantId),
  index("shifts_enrollment_id_idx").on(table.enrollmentId),
]);
```

### Required Columns

All workspace-scoped tables MUST include:

- `id uuid primary key` (`.defaultRandom()`)
- `workspace_id uuid not null` (FK → workspaces.id)
- `created_at timestamptz not null` (`.defaultNow()`)
- optional: `deleted_at timestamptz` (soft delete)

### Naming Conventions

- Tables: `snake_case`
- Columns: `snake_case` (in SQL), `camelCase` (in Drizzle TypeScript)
- Primary keys: `id uuid`
- Tenant column: `workspace_id`
- Enums: `pgEnum` with descriptive name

### Indexes

- Index `workspace_id` on all workspace-scoped tables
- Unique constraints for business invariants
- Partial indexes for active rows when soft deleting
- Composite unique indexes where business rules require them

### Connection Pattern

- Use `pg.Client` per request (Hyperdrive handles pooling externally)
- NEVER use `pg.Pool` — Hyperdrive provides connection pooling. Double-pooling is wasteful.
- Drizzle transactions: `db.transaction(async (tx) => { ... })` — auto-rollback on throw

### Constraint Callback Syntax

Drizzle uses array-returning callbacks for table constraints:

```typescript
// ✅ Correct — array syntax
(table) => [
  index("shifts_workspace_id_idx").on(table.workspaceId),
  uniqueIndex("shifts_unique_idx").on(table.enrollmentId, table.serviceDate),
]

// ❌ Wrong — object syntax (deprecated)
(table) => ({
  workspaceIdx: index("shifts_workspace_id_idx").on(table.workspaceId),
})
```

---

## Sensitive Data Strategy (Optional Foundation)

If handling PII:

- Store PII in a separate table (e.g. `participant_pii`, `carer_pii`)
- Restrict access to admin role only
- Never expose PII through general list endpoints
- Use anonymisation instead of hard delete
- Encrypt at rest via envelope encryption (see `pii-protection` skill)

---

## Definition of Done for New Entity

For every new tenant entity:

1. Drizzle schema defined (`pgTable` in `packages/db/src/schema/`).
2. `workspace_id` column added with FK and not-null constraint (workspace-scoped tables).
3. Index on `workspace_id` added.
4. All queries go through `createTenantDb()` wrapper (workspace-scoped) or explicit enrollment joins (relationship-scoped).
5. Audit logging integrated — writes in same transaction as business mutation.
6. Required indexes added (workspace_id, business-key uniques, composite indexes).
7. Integration tests verify workspace isolation (workspace A cannot access workspace B data).

No entity is considered complete without all of the above.

---

## Philosophy

These foundations are designed to:

- remove ambiguity
- reduce regression risk
- protect tenant data
- enable long-term speed
- prevent multi-year architectural decay

Clear boundaries enable compounding velocity.

---

## References

- Drizzle ORM schema declaration: https://orm.drizzle.team/docs/sql-schema-declaration
- Drizzle column types (Postgres): https://orm.drizzle.team/docs/column-types/pg
- Drizzle transactions: https://orm.drizzle.team/docs/transactions
- Drizzle indexes and constraints: https://orm.drizzle.team/docs/indexes-constraints
- Cloudflare Hyperdrive: https://developers.cloudflare.com/hyperdrive/
- Cloudflare Workers: https://developers.cloudflare.com/workers/
