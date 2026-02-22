---
name: pii-protection-prisma
description: Enforce PII table separation + envelope encryption + KEK rotation for Prisma + Postgres.
---

# PII Protection & Encryption Standard (Prisma + Postgres)

## Purpose

Provide an enforceable, production-grade standard for storing and handling PII in systems that may be regulated or financially sensitive.

This skill is designed to be followed as a build-time guardrail:

- clear rules (MUST / SHOULD / MUST NOT)
- concrete schema requirements
- concrete encryption + rotation approach
- operational failure modes + runbooks
- Prisma + Postgres reference implementation

---

## Scope

Applies to any system that stores or processes:

- identity information (name, DOB, address, document ids)
- contact details (email/phone) when linked to an individual
- government identifiers
- bank identifiers (BSB/account), tax identifiers
- uploaded documents containing personal information
- free-text fields where users may provide personal info

---

## Definitions

- PII: personally identifiable information.
- DEK: Data Encryption Key. Random per-record symmetric key used to encrypt PII payload.
- KEK: Key Encryption Key. A master key stored in a KMS used to wrap (encrypt) DEKs.
- Envelope Encryption: Encrypt data with a DEK; encrypt the DEK with a KEK; store encrypted DEK + ciphertext.

---

## Non-Negotiable Rules (MUST / MUST NOT)

### Data placement

- MUST store PII outside primary business tables.
- MUST NOT store PII inside `applications.draftData` or any general JSON blob in a business table.
- MUST store PII in a dedicated table (1:1 with owning entity) using encrypted columns.
- MUST keep audit logs free of plaintext PII.

### Encryption

- MUST use envelope encryption by default for PII at rest.
- MUST use an AEAD cipher (AES-256-GCM) for PII payload encryption.
- MUST generate a unique random IV/nonce per encryption.
- MUST bind ciphertext to record identity using AAD (Associated Authenticated Data).
- MUST store `keyId` and `schemaVersion` per record.
- MUST NOT use deterministic encryption for general PII fields.

### Key management

- MUST store KEKs in a KMS or secure secret manager (not the DB).
- MUST support multiple active key versions for decryption.
- MUST support key rotation without downtime.

### Logging & analytics

- MUST NOT log decrypted PII.
- MUST NOT emit PII to analytics pipelines.
- MUST implement structured redaction for logs and error reporting.

---

## Architecture: Table Separation

### What belongs in the business table

Keep only non-sensitive business state:

- lifecycle status, steps
- timestamps
- risk flags / derived fields (non-PII)
- foreign keys / references

### What belongs in the PII table

- encrypted payload (ciphertext)
- encrypted DEK
- key metadata (key id, versions)
- schema version
- timestamps

### Draft vs submitted data

If your workflow has drafts:

- MUST keep draft PII encrypted the same way as submitted PII.
- MUST NOT keep draft PII in general draft JSON.

Practical approach:

- `applications.draftData` -> non-PII draft fields only
- `application_pii` -> encrypted PII payload including draft PII

---

## Required Postgres Schema

### Recommended DDL (bytea for ciphertext)

```sql
CREATE TABLE application_pii (
  application_id uuid PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,

  -- Wrapped DEK (encrypted with KEK) - required for envelope encryption
  dek_ciphertext bytea NOT NULL,

  -- PII payload encrypted with DEK (AES-256-GCM)
  pii_ciphertext bytea NOT NULL,

  -- Key metadata
  kek_key_id text NOT NULL,          -- e.g. "pii-kek-v3"
  schema_version int NOT NULL DEFAULT 1,

  -- Optional: integrity/ops metadata
  pii_hash text NULL,                 -- hash of plaintext (for change detection) - do NOT use for lookups
  last_decrypted_at timestamptz NULL, -- optional, for ops; do not over-collect

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX application_pii_kek_key_id_idx ON application_pii(kek_key_id);
```

### Storage format requirements

- `dek_ciphertext` stores the wrapped DEK returned by KMS (opaque bytes).
- `pii_ciphertext` stores a versioned AEAD blob described below.

---

## Ciphertext Format (PII Payload)

### PII payload encryption format (recommended)

Store as `bytea` with explicit layout:

- 1 byte: format version (currently `0x01`)
- 12 bytes: IV/nonce (random per encryption)
- 16 bytes: auth tag (GCM)
- N bytes: ciphertext

Layout:

```
[ v1 ][ iv (12) ][ tag (16) ][ ciphertext (N) ]
```

Why:

- easy decoding
- supports future algorithm changes via the format version byte

---

## AAD (Associated Authenticated Data)

### AAD MUST include

Bind ciphertext to its intended record to prevent blob swapping:

- `application_id`
- `schema_version`

Recommended AAD string:

```
application_pii:{application_id}:{schema_version}
```

If a ciphertext blob is copied to another `application_id`, decryption must fail authentication.

---

## Envelope Encryption Flow (Standard)

### Encrypt (write/update PII)

1. Validate PII object against schema (zod).
2. Serialize to JSON bytes.
3. Generate random DEK (32 bytes).
4. Encrypt JSON bytes with DEK using AES-256-GCM (with AAD).
5. Wrap DEK using KEK via KMS (returns `dek_ciphertext`).
6. Store `dek_ciphertext`, `pii_ciphertext`, `kek_key_id`, `schema_version`.

### Decrypt (read PII)

1. Load `dek_ciphertext`, `pii_ciphertext`, `kek_key_id`, `schema_version`.
2. Unwrap DEK using KMS + `kek_key_id`.
3. Decrypt `pii_ciphertext` using DEK and computed AAD.
4. Parse JSON.
5. Validate decrypted payload against schema version.

---

## Prisma Models (Production Baseline)

```prisma
model Application {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @db.Uuid

  status      ApplicationStatus @default(DRAFT)
  currentStep String            @default("start")
  draftData   Json              @default("{}") // MUST be non-PII only

  version     Int               @default(1)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  pii         ApplicationPII?
}

model ApplicationPII {
  applicationId String      @id @db.Uuid
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  dekCiphertext Bytes
  piiCiphertext Bytes

  kekKeyId      String
  schemaVersion Int         @default(1)

  piiHash       String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([kekKeyId])
}

enum ApplicationStatus {
  DRAFT
  SUBMITTED
  PROCESSING
  AWAITING_EXTERNAL
  AWAITING_REVIEW
  APPROVED
  REJECTED
  FAILED
}
```

---

## Reference Implementation (TypeScript)

### PII Schema (zod)

Version your schema explicitly.

```ts
import { z } from "zod";

export const PiiV1 = z.object({
  fullName: z.string().min(1),
  dob: z.string().min(4), // prefer ISO date string; validate more strictly in real code
  address: z.object({
    line1: z.string().min(1),
    suburb: z.string().min(1),
    postcode: z.string().min(3),
    country: z.string().min(2),
  }),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  governmentId: z.string().optional(),
  bank: z
    .object({
      bsb: z.string().optional(),
      accountNumber: z.string().optional(),
    })
    .optional(),
});
export type PiiV1Type = z.infer<typeof PiiV1>;
```

### Crypto helpers (AES-256-GCM)

Use Node `crypto` for AEAD. Keep it isolated in a module.

```ts
import crypto from "crypto";

const IV_LEN = 12;
const TAG_LEN = 16;
const FORMAT_V1 = 0x01;

export function encryptAesGcm(params: {
  key: Buffer; // 32 bytes
  plaintext: Buffer;
  aad: Buffer;
}): Buffer {
  if (params.key.length !== 32) throw new Error("DEK must be 32 bytes");
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", params.key, iv);
  cipher.setAAD(params.aad);
  const ciphertext = Buffer.concat([cipher.update(params.plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([Buffer.from([FORMAT_V1]), iv, tag, ciphertext]);
}

export function decryptAesGcm(params: {
  key: Buffer;
  blob: Buffer;
  aad: Buffer;
}): Buffer {
  const version = params.blob.readUInt8(0);
  if (version !== FORMAT_V1) throw new Error(`Unsupported ciphertext version: ${version}`);

  const iv = params.blob.subarray(1, 1 + IV_LEN);
  const tag = params.blob.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ciphertext = params.blob.subarray(1 + IV_LEN + TAG_LEN);

  const decipher = crypto.createDecipheriv("aes-256-gcm", params.key, iv);
  decipher.setAAD(params.aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
```

### KMS interface (KEK wrap/unwrap)

You will integrate a KMS provider (AWS KMS, Azure Key Vault, GCP KMS). Keep it behind an interface.

```ts
export interface KekProvider {
  /** Wraps (encrypts) a DEK under the specified KEK key version. */
  wrapDek(params: { kekKeyId: string; dek: Buffer }): Promise<Buffer>;
  /** Unwraps (decrypts) a wrapped DEK using the specified KEK key version. */
  unwrapDek(params: { kekKeyId: string; wrappedDek: Buffer }): Promise<Buffer>;
}
```

### End-to-end encrypt/decrypt

```ts
import { PiiV1 } from "./piiSchema";
import { encryptAesGcm, decryptAesGcm } from "./crypto";
import crypto from "crypto";

function aadFor(applicationId: string, schemaVersion: number): Buffer {
  return Buffer.from(`application_pii:${applicationId}:${schemaVersion}`, "utf8");
}

export async function encryptPiiRecord(params: {
  applicationId: string;
  schemaVersion: number;
  kekKeyId: string;
  pii: unknown;
  kek: KekProvider;
}): Promise<{ dekCiphertext: Buffer; piiCiphertext: Buffer; piiHash: string }> {
  // Validate
  const parsed = PiiV1.parse(params.pii);

  const plaintext = Buffer.from(JSON.stringify(parsed), "utf8");
  const dek = crypto.randomBytes(32);

  const piiCiphertext = encryptAesGcm({
    key: dek,
    plaintext,
    aad: aadFor(params.applicationId, params.schemaVersion),
  });

  const dekCiphertext = await params.kek.wrapDek({ kekKeyId: params.kekKeyId, dek });

  // Optional: hash for change detection (NOT for searching)
  const piiHash = crypto.createHash("sha256").update(plaintext).digest("hex");

  return { dekCiphertext, piiCiphertext, piiHash };
}

export async function decryptPiiRecord(params: {
  applicationId: string;
  schemaVersion: number;
  kekKeyId: string;
  dekCiphertext: Buffer;
  piiCiphertext: Buffer;
  kek: KekProvider;
}): Promise<unknown> {
  const dek = await params.kek.unwrapDek({
    kekKeyId: params.kekKeyId,
    wrappedDek: params.dekCiphertext,
  });

  const plaintext = decryptAesGcm({
    key: dek,
    blob: params.piiCiphertext,
    aad: aadFor(params.applicationId, params.schemaVersion),
  });

  const obj = JSON.parse(plaintext.toString("utf8"));

  // Validate against schema version (example uses v1)
  return PiiV1.parse(obj);
}
```

---

## Prisma Usage Patterns

### Write/update PII (upsert)

- Encrypt in application code.
- Store ciphertext + wrapped DEK.
- Never store plaintext at rest.

```ts
await prisma.applicationPII.upsert({
  where: { applicationId },
  create: {
    applicationId,
    dekCiphertext,
    piiCiphertext,
    kekKeyId,
    schemaVersion,
    piiHash,
  },
  update: {
    dekCiphertext,
    piiCiphertext,
    kekKeyId,
    schemaVersion,
    piiHash,
  },
});
```

### Read PII (explicit, controlled)

Avoid `include: { pii: true }` as a default. Only include PII in carefully scoped code paths.

```ts
const row = await prisma.applicationPII.findUnique({ where: { applicationId } });
if (!row) return null;

const pii = await decryptPiiRecord({
  applicationId,
  schemaVersion: row.schemaVersion,
  kekKeyId: row.kekKeyId,
  dekCiphertext: row.dekCiphertext,
  piiCiphertext: row.piiCiphertext,
  kek,
});
```

---

## Key Rotation (KEK Rotation)

### Requirements

- MUST support decrypt with old and new KEK key versions.
- MUST encrypt new writes with the latest KEK version.
- MUST provide a migration plan to re-wrap DEKs and (optionally) re-encrypt payloads.

### Standard rotation phases

1. Introduce new KEK (e.g. v4) in KMS.
2. Deploy app that:
   - wraps new DEKs under v4
   - unwraps DEKs under v1..v4 as needed
3. Migrate existing rows.

#### Migration Option A: Re-wrap DEK only (preferred)

- unwrap DEK using old KEK
- wrap same DEK with new KEK
- update `dek_ciphertext`, `kek_key_id`
- no need to re-encrypt `pii_ciphertext` (payload stays encrypted under DEK)

#### Migration Option B: Full re-encrypt (rare)

- decrypt payload
- generate new DEK
- encrypt payload
- wrap new DEK

Use only if you suspect DEK exposure or require periodic payload re-encryption.

### Rotation completeness check

- query: `SELECT count(*) FROM application_pii WHERE kek_key_id != 'pii-kek-v4';`
- must reach 0 before retiring v1..v3

---

## Failure Modes & Required Behavior

### Decryption fails (auth tag / AAD mismatch)

Likely causes:

- wrong application id/AAD
- ciphertext corruption
- tampering

Required behavior:

- treat as security incident signal
- return safe error (no payload leakage)
- emit security event (not containing PII)

### KMS unwrap fails

Likely causes:

- missing permissions
- wrong key id
- key disabled/rotated incorrectly

Required behavior:

- fail closed (do not proceed)
- alert immediately
- degrade endpoints that require PII

### Schema validation fails after decryption

Likely causes:

- schema drift
- historical bad data

Required behavior:

- surface a controlled "data format invalid" error
- provide migration path
- log only metadata (schemaVersion, appId), never the plaintext

---

## Query & Search Guidance

### You cannot query encrypted PII

Accept this. Do not design SQL queries that need plaintext PII.

### Allowed patterns

- Store derived, non-sensitive fields outside encryption:
  - `country_code`, `age_band`, `risk_flag`
- Store hashed lookup tokens for controlled dedupe:
  - `email_hash = sha256(lowercase(email))` (still sensitive; treat as restricted)

If you add hash fields:

- keep them out of analytics
- restrict access like PII
- document their purpose

---

## Tests (Minimum)

### Crypto correctness tests

- encrypt->decrypt roundtrip
- AAD mismatch fails decrypt
- swapped ciphertext across ids fails decrypt
- corrupted blob fails decrypt
- version byte unsupported fails decrypt

### Storage tests

- PII never present in business table after writes
- logs redact/omit PII

### Rotation tests

- decrypt old key id works
- re-wrap migration updates `kek_key_id` and keeps data readable

---

## PR Review Checklist (Enforcement)

- [ ] No PII fields added to business tables.
- [ ] No PII added to `draftData` JSON.
- [ ] Encryption uses AES-256-GCM with random IV.
- [ ] AAD includes record identity + schema version.
- [ ] `kek_key_id` and `schema_version` stored.
- [ ] No decrypted PII logged or sent to analytics.
- [ ] Rotation path documented for any key change.

---

## Anti-Patterns (MUST NOT)

- Storing plaintext PII in DB "temporarily"
- Using DB-native encryption only (without app-layer envelope encryption)
- Deterministic encryption for general PII
- Reusing IVs
- Omitting AAD
- Storing keys in DB or code
- Returning decrypted PII via broad "include" queries by default

---

## Notes on DB Permissions with Prisma

Prisma commonly uses one DB user. Table-level enforcement requires:

- separate DB roles + separate Prisma clients, or
- a service boundary where only a dedicated service can access `application_pii`

If you cannot enforce via DB roles today:

- enforce via strict repository modules + code review
- add automated lint checks for forbidden includes
- plan a path to split DB roles later

---

End of Skill.
