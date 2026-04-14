---
name: data-foundations
description: Enforce DB access boundaries, multi-tenant isolation (RLS), and mutation integrity patterns for scalable SaaS (Postgres + Prisma).
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

## 1. Data Access Boundary

### Principle

Tables are internal implementation details.

### Rules

- Reads occur only through `v_*` views.
- Writes occur only through `fn_*` functions.
- Application roles cannot directly access base tables.
- Base tables are not part of the public contract.

### Enforcement

- `REVOKE` direct table privileges from app roles.
- `GRANT SELECT` on views only.
- `GRANT EXECUTE` on mutation functions only.

Notes:

- If `fn_*` functions use `SECURITY DEFINER`, they MUST set a safe `search_path` and MUST enforce tenant/actor context inside the function.

### Naming Conventions

- Tables: `snake_case`
- Views: `v_<entity>`
- Functions: `fn_<verb>_<entity>`
- Primary keys: `id uuid`
- Tenant tables include: `workspace_id`

---

## 2. Multi-Tenant Isolation

### Principle

Tenant isolation is enforced at the database layer.

### Requirements

- Every tenant table includes `workspace_id`.
- RLS is enabled on all tenant tables.
- Policies validate membership using `app.user_id` (request-scoped context).

### Application Requirement

Every request MUST:

1. Verify JWT.
2. Begin a transaction.
3. Set `app.user_id` using `set_config(..., true)` (transaction-local).
4. Execute queries inside that transaction.

Failure to set context MUST result in failure.

Implementation notes:

- Prefer `SELECT set_config('app.user_id', '<uuid>', true);` at the start of each transaction.
- Policies should use `current_setting('app.user_id', true)` and fail closed when missing.

---

## 3. Mutation Integrity

### Principle

All writes must be safe, auditable, and repeatable.

### Required Patterns

#### Audit Logging

- Single append-only `audit_log` table.
- Every mutation function inserts an audit record.
- Logs survive soft deletes and anonymisation.

Minimum audit fields:

- actor_user_id
- workspace_id
- entity_type
- entity_id
- action
- occurred_at

#### Idempotency

- External mutations require idempotency keys.
- Enforced with unique constraints.
- Replays return stored result.

#### Concurrency Control

Use one of:

- optimistic locking (version column)
- advisory locks for serialized workflows

Concurrency control MUST live inside mutation functions.

---

## Schema Conventions

All tenant tables MUST include:

- `id uuid primary key`
- `workspace_id uuid`
- `created_at timestamptz`
- `updated_at timestamptz`
- optional: `deleted_at timestamptz`

Indexes:

- index `workspace_id`
- unique constraints for business invariants
- partial indexes for active rows when soft deleting

---

## Sensitive Data Strategy (Optional Foundation)

If handling PII:

- store PII in a separate table (e.g. `user_pii`)
- restrict access via roles
- never expose PII through general views
- use anonymisation instead of hard delete
- introduce field-level encryption only if required by threat model or regulation

---

## Definition of Done for New Entity

For every new tenant entity:

1. Base table created.
2. RLS enabled with policy.
3. View created (`v_<entity>`).
4. Mutation functions created (`fn_*`).
5. Audit logging integrated.
6. Grants/revokes applied.
7. Required indexes added.

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
