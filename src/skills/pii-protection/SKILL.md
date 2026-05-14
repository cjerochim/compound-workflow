---
name: pii-protection
description: Enforce PII table separation + envelope encryption + KEK rotation (Web Crypto API + Postgres + Drizzle).
---

# PII Protection & Encryption Standard (Web Crypto API + Postgres + Drizzle)

## Purpose

Provide an enforceable, production-grade standard for storing and handling PII in systems that may be regulated or financially sensitive.

This skill is designed to be followed as a build-time guardrail:

- clear rules (MUST / SHOULD / MUST NOT)
- concrete schema requirements (Drizzle ORM)
- concrete encryption + rotation approach (Web Crypto API)
- operational failure modes + runbooks
- Cloudflare Workers-native reference implementation

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
- AAD: Additional Authenticated Data. Binds ciphertext to record identity so blob swapping fails authentication.

---

## Non-Negotiable Rules (MUST / MUST NOT)

### Data placement

- MUST store PII outside primary business tables.
- MUST NOT store PII inside `draftData` or any general JSON blob in a business table.
- MUST store PII in a dedicated table (1:1 with owning entity) using encrypted columns.
- MUST keep audit logs free of plaintext PII.

### Encryption

- MUST use envelope encryption by default for PII at rest.
- MUST use an AEAD cipher (AES-256-GCM) via `crypto.subtle` for PII payload encryption.
- MUST generate a unique random IV/nonce per encryption via `crypto.getRandomValues()`.
- MUST bind ciphertext to record identity using AAD (additionalData parameter).
- MUST store `keyId` and `schemaVersion` per record.
- MUST NOT use deterministic encryption for general PII fields.
- MUST use `async/await` for all `crypto.subtle` operations (they return Promises).

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

## Required Postgres Schema (Drizzle)

### Recommended schema definition

```ts
import { pgTable, uuid, customType, text, integer, timestamp } from "drizzle-orm/pg-core";

// Custom bytea type for Drizzle
const bytea = customType<{ data: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

export const applicationPii = pgTable("application_pii", {
  applicationId: uuid("application_id")
    .primaryKey()
    .references(() => applications.id, { onDelete: "cascade" }),

  // Wrapped DEK (encrypted with KEK) - required for envelope encryption
  dekCiphertext: bytea("dek_ciphertext").notNull(),

  // PII payload encrypted with DEK (AES-256-GCM)
  piiCiphertext: bytea("pii_ciphertext").notNull(),

  // Key metadata
  kekKeyId: text("kek_key_id").notNull(), // e.g. "pii-kek-v3"
  schemaVersion: integer("schema_version").notNull().default(1),

  // Optional: integrity/ops metadata
  piiHash: text("pii_hash"), // hash of plaintext (for change detection) - do NOT use for lookups
  lastDecryptedAt: timestamp("last_decrypted_at", { withTimezone: true }), // optional, for ops

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("application_pii_kek_key_id_idx").on(table.kekKeyId),
]);
```

### Storage format requirements

- `dek_ciphertext` stores the wrapped DEK returned by KMS (opaque bytes as `Uint8Array`).
- `pii_ciphertext` stores a versioned AEAD blob described below.

---

## Ciphertext Format (PII Payload)

### Simplified blob format (greenfield)

Web Crypto AES-GCM returns ciphertext and auth tag concatenated, so the blob is simpler than Node.js layouts:

- 1 byte: format version (currently `0x01`)
- 12 bytes: IV/nonce (random per encryption)
- N+16 bytes: ciphertext with auth tag (Web Crypto returns `ciphertext || tag` concatenated)

Layout:

```
[ v1 (1) ][ iv (12) ][ ciphertextWithTag (N+16) ]
```

Why:

- Web Crypto concatenates ciphertext + tag automatically -- no manual tag handling
- Easy decoding with `Uint8Array.slice()`
- Supports future algorithm changes via the format version byte

---

## AAD (Associated Authenticated Data)

### AAD MUST include

Bind ciphertext to its intended record to prevent blob swapping:

- entity type
- entity id
- schema version

Recommended AAD string for CareFlow entities:

```
careflow_pii:{entity_type}:{entity_id}:{schema_version}
```

Examples:

```
careflow_pii:application:550e8400-e29b-41d4-a716-446655440000:1
careflow_pii:carer:7c9e6679-7425-40de-944b-e07fc1f90ae7:2
```

If a ciphertext blob is copied to another entity, decryption must fail authentication.

---

## Envelope Encryption Flow (Standard)

All `crypto.subtle` methods are async (return Promises). Every encrypt/decrypt function must use `async/await`.

### Encrypt (write/update PII)

1. Validate PII object against schema (zod).
2. Serialize to JSON bytes via `new TextEncoder().encode(json)`.
3. Generate random DEK: `crypto.getRandomValues(new Uint8Array(32))`.
4. Import DEK as CryptoKey: `crypto.subtle.importKey('raw', dek, 'AES-GCM', true, ['encrypt'])`.
5. Generate IV: `crypto.getRandomValues(new Uint8Array(12))`.
6. Encrypt with AAD: `crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, plaintext)`.
7. Build blob: `[version(1)][iv(12)][ciphertextWithTag(N+16)]`.
8. Wrap DEK using KEK via KMS (returns `dek_ciphertext`).
9. Store `dek_ciphertext`, `pii_ciphertext`, `kek_key_id`, `schema_version`.

### Decrypt (read PII)

1. Load `dek_ciphertext`, `pii_ciphertext`, `kek_key_id`, `schema_version`.
2. Unwrap DEK using KMS + `kek_key_id`.
3. Import DEK as CryptoKey: `crypto.subtle.importKey('raw', dek, 'AES-GCM', false, ['decrypt'])`.
4. Parse blob: extract version byte, IV (12 bytes), ciphertextWithTag (remainder).
5. Decrypt with AAD: `crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, ciphertextWithTag)`.
6. Decode plaintext: `new TextDecoder().decode(decrypted)`.
7. Parse JSON.
8. Validate decrypted payload against schema version.

---

## Drizzle Schema Examples

### Business table (non-PII)

```ts
import { pgTable, pgEnum, uuid, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";

export const applicationStatusEnum = pgEnum("application_status", [
  "draft",
  "submitted",
  "processing",
  "awaiting_external",
  "awaiting_review",
  "approved",
  "rejected",
  "failed",
]);

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  workspaceId: uuid("workspace_id").notNull(),

  status: applicationStatusEnum("status").notNull().default("draft"),
  currentStep: text("current_step").notNull().default("start"),
  draftData: jsonb("draft_data").notNull().default({}), // MUST be non-PII only

  version: integer("version").notNull().default(1),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

---

## Reference Implementation (TypeScript / Web Crypto API)

### PII Schema (zod)

Version your schema explicitly.

```ts
import { z } from "zod";

export const PiiV1 = z.object({
  fullName: z.string().min(1),
  dob: z.string().min(4),
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

### Uint8Array helpers

```ts
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Concatenate multiple Uint8Arrays into a single Uint8Array. */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
```

### Crypto helpers (AES-256-GCM via Web Crypto API)

All functions are async. Keep crypto isolated in a module.

```ts
const IV_LEN = 12;
const FORMAT_V1 = 0x01;

export async function encryptAesGcm(params: {
  key: Uint8Array; // 32 bytes (raw DEK)
  plaintext: Uint8Array;
  aad: Uint8Array;
}): Promise<Uint8Array> {
  if (params.key.length !== 32) throw new Error("DEK must be 32 bytes");

  // Import raw key bytes as CryptoKey
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    params.key,
    "AES-GCM",
    false,
    ["encrypt"],
  );

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));

  // Encrypt -- Web Crypto returns ciphertext || authTag concatenated
  const ciphertextWithTag = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: params.aad },
      cryptoKey,
      params.plaintext,
    ),
  );

  // Build blob: [version(1)][iv(12)][ciphertextWithTag(N+16)]
  return concatBytes(new Uint8Array([FORMAT_V1]), iv, ciphertextWithTag);
}

export async function decryptAesGcm(params: {
  key: Uint8Array; // 32 bytes (raw DEK)
  blob: Uint8Array;
  aad: Uint8Array;
}): Promise<Uint8Array> {
  const version = params.blob[0];
  if (version !== FORMAT_V1)
    throw new Error(`Unsupported ciphertext version: ${version}`);

  const iv = params.blob.slice(1, 1 + IV_LEN);
  const ciphertextWithTag = params.blob.slice(1 + IV_LEN);

  // Import raw key bytes as CryptoKey
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    params.key,
    "AES-GCM",
    false,
    ["decrypt"],
  );

  // Decrypt -- Web Crypto handles tag verification internally
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: params.aad },
      cryptoKey,
      ciphertextWithTag,
    ),
  );

  return plaintext;
}
```

### KMS interface (KEK wrap/unwrap)

You will integrate a KMS provider (AWS KMS, Azure Key Vault, GCP KMS, Cloudflare Workers Secrets). Keep it behind an interface.

```ts
export interface KekProvider {
  /** Wraps (encrypts) a DEK under the specified KEK key version. */
  wrapDek(params: { kekKeyId: string; dek: Uint8Array }): Promise<Uint8Array>;
  /** Unwraps (decrypts) a wrapped DEK using the specified KEK key version. */
  unwrapDek(params: { kekKeyId: string; wrappedDek: Uint8Array }): Promise<Uint8Array>;
}
```

### End-to-end encrypt/decrypt

```ts
import { PiiV1 } from "./piiSchema";
import { encryptAesGcm, decryptAesGcm } from "./crypto";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function aadFor(entityType: string, entityId: string, schemaVersion: number): Uint8Array {
  return encoder.encode(
    `careflow_pii:${entityType}:${entityId}:${schemaVersion}`,
  );
}

export async function encryptPiiRecord(params: {
  entityType: string;
  entityId: string;
  schemaVersion: number;
  kekKeyId: string;
  pii: unknown;
  kek: KekProvider;
}): Promise<{ dekCiphertext: Uint8Array; piiCiphertext: Uint8Array; piiHash: string }> {
  // Validate
  const parsed = PiiV1.parse(params.pii);

  const plaintext = encoder.encode(JSON.stringify(parsed));
  const dek = crypto.getRandomValues(new Uint8Array(32));

  const piiCiphertext = await encryptAesGcm({
    key: dek,
    plaintext,
    aad: aadFor(params.entityType, params.entityId, params.schemaVersion),
  });

  const dekCiphertext = await params.kek.wrapDek({
    kekKeyId: params.kekKeyId,
    dek,
  });

  // Optional: hash for change detection (NOT for searching)
  const hashBytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", plaintext),
  );
  const piiHash = Array.from(hashBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { dekCiphertext, piiCiphertext, piiHash };
}

export async function decryptPiiRecord(params: {
  entityType: string;
  entityId: string;
  schemaVersion: number;
  kekKeyId: string;
  dekCiphertext: Uint8Array;
  piiCiphertext: Uint8Array;
  kek: KekProvider;
}): Promise<unknown> {
  const dek = await params.kek.unwrapDek({
    kekKeyId: params.kekKeyId,
    wrappedDek: params.dekCiphertext,
  });

  const plaintext = await decryptAesGcm({
    key: dek,
    blob: params.piiCiphertext,
    aad: aadFor(params.entityType, params.entityId, params.schemaVersion),
  });

  const obj = JSON.parse(decoder.decode(plaintext));

  // Validate against schema version (example uses v1)
  return PiiV1.parse(obj);
}
```

---

## Drizzle Usage Patterns

### Write/update PII (upsert)

- Encrypt in application code.
- Store ciphertext + wrapped DEK.
- Never store plaintext at rest.

```ts
import { eq } from "drizzle-orm";
import { applicationPii } from "./schema";

// After encrypting:
await db
  .insert(applicationPii)
  .values({
    applicationId,
    dekCiphertext,
    piiCiphertext,
    kekKeyId,
    schemaVersion,
    piiHash,
  })
  .onConflictDoUpdate({
    target: applicationPii.applicationId,
    set: {
      dekCiphertext,
      piiCiphertext,
      kekKeyId,
      schemaVersion,
      piiHash,
      updatedAt: new Date(),
    },
  });
```

### Read PII (explicit, controlled)

Only load PII in carefully scoped code paths. Avoid eager joins that pull PII by default.

```ts
import { eq } from "drizzle-orm";
import { applicationPii } from "./schema";

const row = await db
  .select()
  .from(applicationPii)
  .where(eq(applicationPii.applicationId, applicationId))
  .then((rows) => rows[0] ?? null);

if (!row) return null;

const pii = await decryptPiiRecord({
  entityType: "application",
  entityId: applicationId,
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

```sql
SELECT count(*) FROM application_pii WHERE kek_key_id != 'pii-kek-v4';
-- must reach 0 before retiring v1..v3
```

---

## Failure Modes & Required Behavior

### Decryption fails (auth tag / AAD mismatch)

Likely causes:

- wrong entity id/AAD
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
- log only metadata (schemaVersion, entityId), never the plaintext

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

- encrypt->decrypt roundtrip (async)
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
- [ ] Encryption uses AES-256-GCM via `crypto.subtle` with random IV.
- [ ] AAD includes entity type, entity identity, and schema version.
- [ ] `kek_key_id` and `schema_version` stored.
- [ ] No decrypted PII logged or sent to analytics.
- [ ] Rotation path documented for any key change.
- [ ] All crypto operations use `async/await` (no synchronous crypto).
- [ ] `Uint8Array` used throughout -- no `Buffer`.

---

## Anti-Patterns (MUST NOT)

- Storing plaintext PII in DB "temporarily"
- Using DB-native encryption only (without app-layer envelope encryption)
- Deterministic encryption for general PII
- Reusing IVs
- Omitting AAD
- Storing keys in DB or code
- Returning decrypted PII via broad eager joins by default
- Using the server-side `require("crypto")` built-in (unavailable in Workers)
- Using the `Buffer` class (unavailable in Workers)
- Using synchronous crypto patterns (Web Crypto is Promise-based)

---

## Notes on DB Permissions

Table-level enforcement options:

- separate DB roles + separate connections, or
- a service boundary where only a dedicated service can access `application_pii`

If you cannot enforce via DB roles today:

- enforce via strict repository modules + code review
- add automated lint checks for forbidden table access patterns
- plan a path to split DB roles later

---

## References

- MDN SubtleCrypto: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
- MDN SubtleCrypto.encrypt: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt
- MDN SubtleCrypto.decrypt: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/decrypt
- MDN SubtleCrypto.importKey: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey
- MDN SubtleCrypto.wrapKey: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/wrapKey
- MDN SubtleCrypto.unwrapKey: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/unwrapKey
- Cloudflare Workers Web Crypto: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- Drizzle ORM schema declaration: https://orm.drizzle.team/docs/sql-schema-declaration
- Drizzle PG column types: https://orm.drizzle.team/docs/column-types/pg

---

End of Skill.
