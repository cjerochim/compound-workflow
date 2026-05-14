---
name: audit-traceability
description: Append-only audit logging with actor attribution and correlation IDs for regulated/financial workflows (Drizzle + Postgres).
---

# Audit & Traceability Standard (Drizzle + Postgres)

## Purpose

Define an audit system that supports forensic reconstruction of actions, suitable for regulated/financial products (NDIS compliance, financial evidence workflows).

This skill focuses on:

- immutable append-only audit logs
- actor attribution with CareFlow domain roles
- correlation of events across requests and workflows
- tenant-scoped audit entries (workspace isolation)
- safe handling of sensitive information

---

## Non-Negotiable Rules

- MUST use append-only audit tables (no updates/deletes).
- MUST record actor type and actor identity (when available).
- MUST include correlation identifiers (request id / trace id / workflow run id).
- MUST NOT store plaintext PII in audit logs.
- MUST capture state transitions and decisions.
- MUST write audit entries in the same Drizzle transaction as the business mutation.
- MUST scope all audit entries to a workspace (`workspace_id` is not null).

---

## Data Model

### Drizzle Schema

Define the audit log table and actor type enum using Drizzle's `pgTable` and `pgEnum`:

```ts
import { pgTable, pgEnum, uuid, text, jsonb, timestamp, inet, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";
import { participants } from "./participants";

export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "admin",
  "member",
  "carer",
  "system",
]);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),

    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),

    actorType: auditActorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    participantId: uuid("participant_id").references(() => participants.id),

    correlationId: text("correlation_id"),
    requestIp: inet("request_ip"),
    userAgent: text("user_agent"),

    previousState: jsonb("previous_state"),
    newState: jsonb("new_state"),
    metadata: jsonb("metadata").notNull().default({}),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_workspace_idx").on(table.workspaceId),
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
    index("audit_log_created_idx").on(table.createdAt),
    index("audit_log_action_idx").on(table.action),
    index("audit_log_correlation_idx").on(table.correlationId),
    index("audit_log_actor_idx").on(table.actorId),
  ]
);
```

**Key schema decisions:**

- `workspace_id` (uuid, not null) — every audit entry belongs to a workspace. Tenant isolation is enforced at the application layer.
- `actor_id` (uuid, nullable, FK → `users.id`) — references the platform-owned `users` table, not external auth provider IDs. Nullable for system events where no user context exists.
- `participant_id` (uuid, nullable, FK → `participants.id`) — set when the action targets a specific participant. Null for workspace-level or system events.
- `entity_type` + `entity_id` — polymorphic reference to the business entity affected (e.g., `shift`, `invoice`, `budget`).

### Operational Enforcement (Append-Only)

Choose at least one:

- **DB permissions:** app role granted only INSERT/SELECT on audit tables
- **Triggers:** forbid UPDATE/DELETE with a raising trigger
- **Schema separation:** place audit tables in a dedicated schema with restricted roles

---

## Recommended `action` Taxonomy

Keep event names consistent and searchable. Use `ENTITY_ACTION` format:

### Shift lifecycle

- `SHIFT_CREATED`
- `SHIFT_UPDATED`
- `SHIFT_CLOCKED_IN`
- `SHIFT_CLOCKED_OUT`
- `SHIFT_APPROVED`
- `SHIFT_REJECTED`
- `SHIFT_QUERIED`

### Enrollment & participants

- `ENROLLMENT_CREATED`
- `ENROLLMENT_UPDATED`
- `ENROLLMENT_RATE_SET`
- `PARTICIPANT_ENROLLED`
- `PARTICIPANT_UPDATED`

### Financial

- `BUDGET_CREATED`
- `BUDGET_UPDATED`
- `BUDGET_SPEND_ADJUSTED`
- `INVOICE_CREATED`
- `INVOICE_FINALIZED`
- `PAYMENT_RECORDED`
- `PAYMENT_CONFIRMED`

### PII & security

- `PII_ACCESSED`
- `PII_UPDATED`
- `PII_KEY_ROTATED`

### System

- `ALERT_GENERATED`
- `RATE_IMPORT_COMPLETED`
- `EMAIL_SENT`

---

## What to Store (and What Not to)

### Allowed in `previous_state` / `new_state`

- status values
- non-PII derived flags
- entity IDs and references
- workflow run IDs
- numeric amounts (if required and non-sensitive for context)
- pricing snapshots (agreed rate, official max rate)

### MUST NOT store

- names, emails, addresses, DOB
- NDIS numbers
- bank account numbers (BSB, account)
- free-text user input likely to contain PII

Instead store:

- field names changed
- hashes (where necessary)
- references to secure stores

Example metadata for PII update:

```json
{
  "fields_changed": ["ndis_number", "bank_bsb"],
  "schema_version": 1,
  "kek_key_id": "pii-kek-v4"
}
```

---

## Transactional Audit Pattern

### Rule

Every business mutation MUST write its audit entry in the same Drizzle transaction. This prevents "state changed but audit missing" scenarios.

### `createAuditLogger` Helper

Create a helper that accepts a Drizzle transaction and request context, returning a function to log audit entries:

```ts
import { type ExtractTablesWithRelations } from "drizzle-orm";
import { type PgTransaction, type PgQueryResultHKT } from "drizzle-orm/pg-core";
import { auditLog } from "@careflow/db/schema";

type AuditContext = {
  workspaceId: string;
  actorId: string | null;
  actorType: "admin" | "member" | "carer" | "system";
  correlationId: string;
  requestIp?: string;
  userAgent?: string;
};

type AuditEntry = {
  entityType: string;
  entityId: string;
  action: string;
  participantId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export function createAuditLogger(
  tx: PgTransaction<PgQueryResultHKT, Record<string, never>, ExtractTablesWithRelations<Record<string, never>>>,
  context: AuditContext
) {
  return async (entry: AuditEntry) => {
    await tx.insert(auditLog).values({
      workspaceId: context.workspaceId,
      actorId: context.actorId,
      actorType: context.actorType,
      correlationId: context.correlationId,
      requestIp: context.requestIp,
      userAgent: context.userAgent,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      participantId: entry.participantId ?? null,
      previousState: entry.previousState ?? null,
      newState: entry.newState ?? null,
      metadata: entry.metadata ?? {},
    });
  };
}
```

### Usage in a Route Handler

```ts
import { db } from "./db";
import { shifts, budgets } from "@careflow/db/schema";
import { createAuditLogger } from "./audit";
import { eq, and } from "drizzle-orm";

// Shift approval — audit entry in same transaction as business mutation
await db.transaction(async (tx) => {
  const log = createAuditLogger(tx, {
    workspaceId: auth.workspaceId,
    actorId: auth.userId,
    actorType: auth.orgRole, // "admin" | "member"
    correlationId: c.get("correlationId"),
  });

  // 1. Load previous state
  const [shift] = await tx
    .select()
    .from(shifts)
    .where(and(eq(shifts.id, shiftId), eq(shifts.status, "pending_approval")));

  if (!shift) throw new HTTPException(409, { message: "Shift not in pending_approval state" });

  // 2. Perform business mutation
  const [updated] = await tx
    .update(shifts)
    .set({
      status: "approved",
      approvedByUserId: auth.userId,
      approvedAt: new Date(),
      approvedUnitRate: body.approvedUnitRate,
      approvedCost: body.approvedCost,
    })
    .where(and(eq(shifts.id, shiftId), eq(shifts.status, "pending_approval")))
    .returning();

  // 3. Update budget atomically
  await tx
    .update(budgets)
    .set({ spentAmount: sql`${budgets.spentAmount} + ${body.approvedCost}` })
    .where(eq(budgets.id, shift.budgetId));

  // 4. Write audit entry in same transaction
  await log({
    entityType: "shift",
    entityId: shiftId,
    action: "SHIFT_APPROVED",
    participantId: shift.participantId,
    previousState: { status: shift.status },
    newState: { status: "approved", approvedCost: body.approvedCost },
    metadata: {
      approvalReasonCode: body.approvalReasonCode,
      budgetId: shift.budgetId,
    },
  });
});
```

**Key points:**

- `db.transaction()` auto-rolls back on throw — if audit insert fails, the business mutation also rolls back.
- The `createAuditLogger` factory binds the transaction and request context once. Callers only provide event-specific data.
- Multiple audit entries can be written within a single transaction (e.g., shift approval + budget adjustment).

If a change spans systems and cannot be fully transactional, emit an event/outbox entry and write a compensating audit record when the change is finalized.

---

## Correlation IDs

### Minimum requirement

- Every inbound request has a `correlation_id` (UUID).
- Generate per request or accept from `X-Correlation-ID` header.
- Propagate `correlation_id` across:
  - workflow runs
  - queue messages
  - downstream calls

Store correlation ID in audit logs. All audit entries from the same request share the same correlation ID.

---

## Actor Attribution

### CareFlow actor types

| Actor type | Description |
|-----------|-------------|
| `admin` | Org administrators — full workspace access, can approve shifts, manage PII, view audit logs |
| `member` | Staff/team members — can create shifts, manage enrollments, limited by role |
| `carer` | Care workers — can view own shifts, clock in/out. Independent entities enrolled to participants. |
| `system` | Automated processes — scheduled workers, cron jobs, background tasks. No user context. |

Always include `actor_type`. Include `actor_id` where available (references `users.id`).

For `system` events, `actor_id` is null. The `metadata` field should identify the system process (e.g., `{ "process": "enrollment_expiry_check", "cron_trigger": "daily" }`).

---

## Privileged Access Auditing (PII Views)

If you allow staff/support access to PII, log `PII_ACCESSED` with:

- `actor_id` (the user who accessed PII)
- `actor_type` (must be `admin`)
- `entity_type` + `entity_id` (the PII record accessed)
- `participant_id` (if applicable)
- `correlation_id`
- `metadata.reason_code` or `metadata.ticket_id` (if applicable)

This is critical for NDIS compliance and regulated contexts.

---

## Retention & Redaction

Retention is policy-dependent:

- Audit logs SHOULD be retained for 7 years for NDIS financial evidence and compliance records.
- PII may be deleted/redacted earlier per data retention policy.

Design so you can delete/redact PII while keeping audit entries (audit entries never contain plaintext PII).

---

## Failure Modes

### Audit write fails

For critical actions (shift approval, payment recording, invoice finalization, PII access):

- **Fail closed** — the Drizzle transaction rolls back the business mutation along with the failed audit write. No state change occurs without a corresponding audit record.

For non-critical actions:

- Queue an audit repair job
- Still emit an incident/security event (no PII)

Define which events are critical. At minimum: all financial mutations, all PII access, all approval/rejection decisions.

---

## PR Review Checklist

- [ ] Audit row added for all state transitions.
- [ ] Audit row added for all approvals/decisions.
- [ ] No plaintext PII stored in audit.
- [ ] `correlation_id` propagated and persisted.
- [ ] Audit write is inside the same `db.transaction()` as the business mutation.
- [ ] `workspace_id` set on all audit entries (not null).
- [ ] `actor_id` references `users.id` (not external auth provider IDs).
- [ ] `participant_id` set when action targets a specific participant.
- [ ] Privileged access events audited (PII views, admin actions).
- [ ] Append-only is enforced (permissions and/or triggers).
- [ ] System events include process identification in `metadata`.

---

## References

- Drizzle ORM transactions: https://orm.drizzle.team/docs/transactions
- Drizzle ORM insert: https://orm.drizzle.team/docs/insert
- Drizzle ORM `pgTable` / `pgEnum`: https://orm.drizzle.team/docs/schemas

---

End of Skill.
