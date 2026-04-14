---
name: financial-workflow-integrity
description: Enforce correct financial workflows using durable state, idempotency, immutability, and concurrency guards (Prisma + Postgres).
---

# Financial Workflow Integrity Standard (Prisma + Postgres)

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

- MUST represent money as integer minor units + currency (e.g. cents + ISO currency code).
- MUST NOT use floating point for monetary values.

---

## Core Data Model (Baseline)

### applications (or equivalent)

Required columns:

- `status` (enum)
- `current_step`
- `version` (int)
- `created_at`, `updated_at`

### Immutable submissions

Store what was submitted/approved against:

```sql
CREATE TABLE application_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  submission_no int NOT NULL,
  submitted_data jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, submission_no)
);
```

### Idempotency keys (request-level)

Rules:

- `request_hash` MUST be computed from a canonical, stable representation.
- Hash inputs MUST include: operation, entity id, actor/principal id, and any money fields (amount_minor, currency).
- If a key is re-used with a different hash, reject as misuse.

Recommended schema:

```sql
CREATE TYPE idempotency_status AS ENUM ('STARTED','SUCCEEDED','FAILED');

CREATE TABLE idempotency_keys (
  scope text NOT NULL,               -- e.g. "application.submit" / "payout.create" / "webhook.stripe"
  key text NOT NULL,                 -- client/provider idempotency key
  operation text NOT NULL,           -- explicit operation name
  entity_id uuid NULL,               -- entity being acted on (nullable for provider webhooks)
  principal_id text NULL,            -- user/admin/service principal identifier

  request_hash text NOT NULL,
  status idempotency_status NOT NULL DEFAULT 'STARTED',
  response jsonb NULL,               -- safe response only; MUST NOT contain secrets/PII

  expires_at timestamptz NOT NULL,   -- lease/ttl for STARTED recovery
  locked_at timestamptz NULL,
  locked_by text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);

CREATE INDEX idempotency_keys_status_idx ON idempotency_keys(status);
CREATE INDEX idempotency_keys_expires_at_idx ON idempotency_keys(expires_at);
```

### Step runs (side-effect idempotency)

Each step that causes an external effect MUST create a durable row first.

```sql
CREATE TYPE step_run_status AS ENUM ('STARTED','SUCCEEDED','FAILED');

CREATE TABLE workflow_step_runs (
  entity_id uuid NOT NULL,
  step_key text NOT NULL,

  status step_run_status NOT NULL DEFAULT 'STARTED',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count int NOT NULL DEFAULT 1,
  last_error text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (entity_id, step_key)
);
```

### Provider event dedupe (webhooks)

Always dedupe by provider event id.

```sql
CREATE TABLE provider_events (
  provider text NOT NULL,
  event_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NULL,
  PRIMARY KEY (provider, event_id)
);
```

---

## Optimistic Concurrency Standard

### Rule

Every transition MUST be:

- conditional on current status
- conditional on current version
- increments version

Example:

```sql
UPDATE applications
SET status = 'PROCESSING',
    version = version + 1,
    updated_at = now()
WHERE id = $1
  AND status = 'SUBMITTED'
  AND version = $2;
```

If 0 rows updated: treat as conflict.

- reload and no-op if already advanced
- never run side effects unless you won the transition

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

```sql
INSERT INTO workflow_step_runs (entity_id, step_key, metadata)
VALUES ($1, 'send_confirmation_email', '{}'::jsonb)
ON CONFLICT DO NOTHING;
```

Only proceed if insert succeeded.

Update the row to `SUCCEEDED` with provider ids in `metadata`.

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

## Prisma Models (Baseline)

```prisma
model Application {
  id          String @id @default(uuid()) @db.Uuid
  status      String
  currentStep String
  version     Int    @default(1)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  submissions ApplicationSubmission[]
  stepRuns    WorkflowStepRun[]
}

model ApplicationSubmission {
  id            String   @id @default(uuid()) @db.Uuid
  applicationId String   @db.Uuid
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  submissionNo  Int
  submittedData Json
  submittedAt   DateTime @default(now())

  @@unique([applicationId, submissionNo])
}

enum IdempotencyStatus {
  STARTED
  SUCCEEDED
  FAILED
}

model IdempotencyKey {
  scope       String
  key         String
  operation   String
  entityId    String?  @db.Uuid
  principalId String?

  requestHash String
  status      IdempotencyStatus @default(STARTED)
  response    Json?

  expiresAt   DateTime
  lockedAt    DateTime?
  lockedBy    String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@id([scope, key])
  @@index([status])
  @@index([expiresAt])
}

enum StepRunStatus {
  STARTED
  SUCCEEDED
  FAILED
}

model WorkflowStepRun {
  entityId      String @db.Uuid
  stepKey       String

  status        StepRunStatus @default(STARTED)
  metadata      Json          @default("{}")
  attemptCount  Int           @default(1)
  lastError     String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@id([entityId, stepKey])
}

model ProviderEvent {
  provider   String
  eventId    String
  receivedAt DateTime @default(now())
  payload    Json?

  @@id([provider, eventId])
}
```

---

## PR Review Checklist

- [ ] All state transitions are guarded by status + version.
- [ ] Any externally triggered financial action uses request-level idempotency.
- [ ] Idempotency scope includes actor/principal + operation + entity (prevents collisions).
- [ ] Every side effect has step-level idempotency with durable status/metadata.
- [ ] Submission/decision snapshots are immutable (edits create a new submission/version).
- [ ] Provider idempotency keys are used where supported.
- [ ] Webhooks dedupe by provider event id and are treated as duplicates.
- [ ] Audit events emitted for transitions and decisions (no sensitive payloads).

---

End of Skill.
