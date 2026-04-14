---
name: audit-traceability
description: Append-only audit logging with actor attribution and correlation IDs for regulated/financial workflows (Prisma + Postgres).
---

# Audit & Traceability Standard (Prisma + Postgres)

## Purpose

Define an audit system that supports forensic reconstruction of actions, suitable for regulated/financial products.

This skill focuses on:

- immutable append-only audit logs
- actor attribution
- correlation of events across services
- safe handling of sensitive information

---

## Non-Negotiable Rules

- MUST use append-only audit tables (no updates/deletes).
- MUST record actor type and actor identity (when available).
- MUST include correlation identifiers (request id / trace id / workflow run id).
- MUST NOT store plaintext PII in audit logs.
- MUST capture state transitions and decisions.
- MUST ensure audit writes happen in the same transaction as the business change when feasible.

---

## Data Model

### application_audit_log (baseline)

```sql
CREATE TYPE audit_actor_type AS ENUM ('USER','SYSTEM','ADMIN','WORKFLOW');

CREATE TABLE application_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

  event_type text NOT NULL,
  actor_type audit_actor_type NOT NULL,
  actor_id text NULL,

  correlation_id text NULL,
  request_ip inet NULL,
  user_agent text NULL,

  previous_state jsonb NULL,
  new_state jsonb NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX application_audit_app_idx ON application_audit_log(application_id);
CREATE INDEX application_audit_created_idx ON application_audit_log(created_at);
CREATE INDEX application_audit_event_idx ON application_audit_log(event_type);
CREATE INDEX application_audit_correlation_idx ON application_audit_log(correlation_id);
```

Operational enforcement options (choose at least one):

- DB permissions: app role granted only INSERT/SELECT on audit tables
- triggers: forbid UPDATE/DELETE with a raising trigger
- schema separation: place audit tables in a dedicated schema with restricted roles

---

## Recommended `event_type` taxonomy

Keep it consistent and searchable:

- `APPLICATION_CREATED`
- `DRAFT_UPDATED`
- `SUBMITTED`
- `STATUS_CHANGED`
- `PII_UPDATED` (no plaintext)
- `REVIEW_APPROVED`
- `REVIEW_REJECTED`
- `PAYMENT_AUTHORIZED`
- `PAYMENT_CAPTURED`
- `NOTIFICATION_SENT`
- `ADMIN_VIEWED_PII` (if applicable)

---

## What to Store (and What Not to)

### Allowed in `previous_state` / `new_state`

- status
- current step
- non-PII derived flags
- submission ids
- workflow run ids
- numeric amounts only if required and non-sensitive for your context

### MUST NOT store

- names, emails, addresses, DOB
- identity document numbers
- bank account numbers
- free-text user input likely to contain PII

Instead store:

- field names changed
- hashes (where necessary)
- references to secure stores

Example metadata for PII update:

```json
{
  "fields_changed": ["address", "dob"],
  "schema_version": 1,
  "kek_key_id": "pii-kek-v4"
}
```

---

## Transactional Audit Pattern

### Rule

If you update business state, write the audit row in the same DB transaction when possible.

Pattern (conceptual):

1. Load previous state (minimal, non-PII)
2. Perform version-guarded update to business table
3. Insert audit row referencing previous/new state + metadata

This prevents "state changed but audit missing" scenarios.

If a change spans systems and cannot be fully transactional, emit an event/outbox entry and write a compensating audit record when the change is finalized.

---

## Correlation IDs

### Minimum requirement

- Every inbound request has a `correlation_id` (UUID or equivalent).
- Propagate `correlation_id` across:
  - workflow runs
  - queue messages
  - downstream calls

Store correlation id in audit logs and idempotency rows.

---

## Actor Attribution

### Standard actor model

- `USER`: authenticated end user
- `ADMIN`: internal staff with elevated privilege
- `SYSTEM`: background job/service
- `WORKFLOW`: orchestrator run id

Always include `actor_type`. Include `actor_id` where available.

---

## Privileged Access Auditing (PII Views)

If you allow staff/support access, log `ADMIN_VIEWED_PII` with:

- admin id
- reason code / ticket id
- application id
- correlation id

This is critical for regulated contexts.

---

## Retention & Redaction

Retention is policy-dependent:

- audit logs are often retained long-term
- PII may be deleted/redacted earlier

Design so you can delete/redact PII while keeping audit entries (audit has no plaintext PII).

---

## Failure Modes

### Audit write fails

For critical actions:

- fail closed (do not change business state without audit)

For non-critical actions:

- queue an audit repair job
- still emit an incident/security event (no PII)

Define which events are critical.

---

## Prisma Models (Baseline)

```prisma
enum AuditActorType {
  USER
  SYSTEM
  ADMIN
  WORKFLOW
}

model ApplicationAuditLog {
  id            String @id @default(uuid()) @db.Uuid
  applicationId String @db.Uuid

  eventType     String
  actorType     AuditActorType
  actorId       String?

  correlationId String?
  requestIp     String? @db.Inet
  userAgent     String?

  previousState Json?
  newState      Json?
  metadata      Json   @default("{}")

  createdAt     DateTime @default(now())

  @@index([applicationId])
  @@index([createdAt])
  @@index([eventType])
  @@index([correlationId])
}
```

---

## PR Review Checklist

- [ ] Audit row added for all state transitions.
- [ ] Audit row added for all approvals/decisions.
- [ ] No plaintext PII stored in audit.
- [ ] `correlation_id` propagated and persisted.
- [ ] Privileged access events audited (if applicable).
- [ ] Append-only is enforced (permissions and/or triggers).

---

End of Skill.
