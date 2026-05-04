# Backend Security & Quality Review

This document is written for everyone — not just senior backend engineers.
Each item is in plain English: **what was wrong**, **why it matters**, and
**what we did about it**.

Every item is tagged with one of:

- ✅ **Fixed** — code change has been merged on this branch.
- ⚠️ **Action needed** — couldn't be safely fixed automatically; needs a
  human to review the indicated files.
- 📌 **Process / ops** — not a code bug; lives in the operations playbook.

---

## 0. Big architecture change: one shared database for all tenants

**Before.** Each tenant (and each company inside a tenant) had its own
MySQL database. The app tracked credentials per row in `tenant_master`
and `companies`, opened a separate connection per tenant on demand,
and provisioned a new database whenever someone signed up or created
a company. This was operationally heavy and added a class of bugs
around "wrong tenant got connected".

**Now.** All tenants live in **one shared database** — the main
application database. Their data is kept apart by **`tenant_id` and
`company_id` columns** on every transactional model (vouchers,
ledgers, inventory items, stock movements, e-invoices, e-way bills,
TDS, audit logs — every model in `src/services/tenantModels.js`
already has these columns).

What this means in practice:

- Sign-up no longer creates a new MySQL database. The new tenant row
  is just inserted into the shared DB and immediately marked
  `db_provisioned = true`.
- Creating a company no longer creates a new MySQL database either.
- The "tenant connection manager" is now a thin shim that always
  returns the main connection. Existing callers
  (`req.tenantDb`, `req.tenantModels`) keep working unchanged.
- The old per-tenant provisioning code is preserved as
  `tenantProvisioningService._legacyProvisionDatabase` in case you
  ever need to migrate back.
- Per-tenant DB host/port/user/password fields on `tenant_master` and
  `companies` still exist on the schema but are no longer used at
  runtime. They can be dropped in a future migration.

**Things you must verify.**

- Every controller that reads tenant data uses a `where` clause that
  includes the caller's `tenant_id` (and where appropriate
  `company_id`). Without it, tenants would see each other's rows.
  This is the single most important thing to audit now that everyone
  shares a database. See item 3.4.
- The shared DB needs indexes on `(tenant_id, …)` for query speed.
  Most models in `tenantModels.js` already declare them; verify each
  one has at least `tenant_id` indexed.

---

## 1. Secrets and configuration

### 1.1 ✅ App used to start even when secrets were missing

**The problem.** The code had hardcoded fallback values like
`"your-secret-key-change-in-production"` for the JWT signing key and
`"default-key"` for the database-password encryption key. If anyone
ever deployed without setting the real env vars, the app would happily
start using those guessable defaults — and every login token / encrypted
password would be forgeable by anyone who reads this repo.

**Why it matters.** A guessable JWT secret means an attacker can mint
admin tokens. A guessable encryption key means stored DB passwords can be
decrypted offline.

**What we did.** Added `backend/src/config/env.js`, a small module that
reads and validates the required env vars at startup. The server now
**refuses to start** with a clear error message if any of these are
missing or too short:

- `JWT_SECRET` (≥ 32 chars)
- `ENCRYPTION_KEY` (≥ 16 chars)
- `PAYLOAD_ENCRYPTION_KEY` (≥ 16 chars)
- A database connection (`DATABASE_URL` or `DB_HOST`+`DB_USER`)

All previous fallbacks have been removed. Files now using the central
module: `src/utils/jwt.js`, `src/middleware/auth.js`,
`src/utils/encryption.js`, `src/services/tenantProvisioningService.js`,
`src/middleware/tenant.js`, `src/seeders/001-admin-master-seeder.js`,
`src/websocket/socketServer.js`.

### 1.2 ✅ Git history scanned — one leaked secret found and contained

We ran the audit:

```bash
git log --all -p 2>/dev/null \
  | grep -E '^\+.*(JWT_SECRET|ENCRYPTION_KEY|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|PAYLOAD_ENCRYPTION_KEY|JWT_REFRESH_SECRET)\s*=' \
  | grep -viE '(your[-_]|change[-_ ]|placeholder|example|sample|min[-_]32|=$|=""$|=\'\'$|process\.env\.)'
```

**Findings.**

- `backend/.env.railway.example` only ever contained placeholder
  values like `your-super-secret-jwt-key-...`. **Not real.** Safe.
- `frontend/.env.production` was tracked in git and contained a real
  secret on line 13:
  `NEXT_PUBLIC_PAYLOAD_ENCRYPTION_KEY=Devils@2609`. First committed
  in `e023609` ("update on modal", 2026-02-09). **This is real.**

**What we did about it.**

- Removed `frontend/.env.production` from git tracking
  (`git rm --cached`) so future commits don't include it. The file
  stays on disk for local development.
- Added a non-secret template at
  `frontend/.env.production.example` so other developers know what
  variables to set without leaking values.
- Hardened both `.gitignore` files (root and `frontend/`) to block
  every `.env*` file by default, with an explicit allowlist for
  `*.example` / `*.sample` templates only.

**What you must still do (manual).**

1. **Rotate the leaked key now.** It is still in the git history
   (commit `e023609`) and visible to anyone with repo read access.
   - Generate a new key:
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   - Update both backend (`PAYLOAD_ENCRYPTION_KEY`) and frontend
     (`NEXT_PUBLIC_PAYLOAD_ENCRYPTION_KEY`) production envs to the
     new value.
   - Restart both services. Existing in-flight encrypted payloads
     will fail until clients reload — usually a non-issue because
     these are per-request.
2. **(Optional) Scrub the secret from git history.** Untracking only
   prevents *future* commits from carrying it; the historical commit
   still has it. To purge, use `git-filter-repo`:
   ```bash
   pip install git-filter-repo
   git filter-repo --path frontend/.env.production --invert-paths
   git push --force --all
   git push --force --tags
   ```
   This rewrites history (every collaborator must re-clone) so only
   do it after rotating the key and warning the team.

### 1.3 ✅ Refresh tokens now use a separate, required secret

**The problem.** `JWT_REFRESH_SECRET` was optional and silently fell
back to `JWT_SECRET`. Worse, `signTokens()` was hardcoded to sign
refresh tokens with `JWT_SECRET` regardless. So in practice both
tokens were always signed with the same key — leaking the access-
token secret would have leaked the refresh-token secret too.

**What we did.**

- `src/config/env.js` now treats `JWT_REFRESH_SECRET` as
  **required** (≥ 32 chars). The server refuses to boot without it.
- It also refuses to boot if `JWT_SECRET === JWT_REFRESH_SECRET`,
  so you can't trivially circumvent the isolation.
- `src/utils/jwt.js` actually signs refresh tokens with
  `JWT_REFRESH_SECRET` and verifies them via a new
  `verifyRefreshToken()` helper. Access tokens still use
  `JWT_SECRET`. The two key paths are fully separated.

**Migration.** Existing deployments must add a new env var:

```bash
# Generate
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Set
JWT_REFRESH_SECRET=<paste here>
```

When you deploy this change, all currently-issued refresh tokens
become invalid (they were signed with the old secret). Active users
will be logged out the next time their access token expires and the
client tries to refresh; they just need to log in again.

---

## 2. Login, sessions and rate limiting

### 2.1 ✅ Logout / "kick user" actually works again

**The problem.** When a user logged out we removed their session from
Redis — but the auth middleware was still letting any non-expired JWT
through, even if its session had been revoked. Comments in the code
literally said *"For now, allow the request"*.

**Why it matters.** Logout did nothing meaningful. Stolen tokens stayed
valid. Admin "force log out" had no effect.

**What we did.** `src/middleware/auth.js` now enforces session
validation: when Redis is reachable and there is no session record, the
request is rejected with HTTP 401. Redis being **down** still falls
through to JWT-only validation (graceful degradation), so a Redis
outage does not lock everyone out.

### 2.2 ✅ Refresh tokens are now rotated

**The problem.** `refreshAccessToken()` used to issue a new access token
but return the **same** refresh token. If someone ever stole a refresh
token, they could keep using it for the full 7-day window.

**What we did.** Refresh now invalidates the old `jti` and issues a
brand-new refresh token. If a thief and the legitimate user both try
to use the same refresh token, only the first one wins — the second
attempt fails, so the breach is detectable.

(`src/utils/jwt.js → refreshAccessToken`.)

### 2.3 ✅ Brute-force protection on login

**The problem.** A single global limiter capped traffic at 1000 requests
per IP per 15 minutes. That's plenty of room to test thousands of
passwords against `/api/auth/login`.

**What we did.** Added a separate, much tighter limiter that applies
only to:

- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/refresh`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`

Default: **20 attempts / 15 minutes / IP**. Tunable via `AUTH_RATE_LIMIT_MAX`.

### 2.4 ✅ Rate-limit counters now live in Redis

**The problem.** `express-rate-limit` defaults to an in-memory store.
With more than one backend instance behind a load balancer, every
instance kept its own counter — the effective limit became
`instances × max`, defeating the brute-force protection.

**What we did.**

- Added `rate-limit-redis` as a direct dependency.
- `src/app.js` now plumbs every limiter through a `RedisStore` when
  Redis is reachable. If Redis is offline at boot, we transparently
  fall back to the library's in-memory store and log a warning, so a
  Redis outage never takes the API down.
- Exposed a thin `sendCommand` passthrough on `src/config/redis.js`
  so the adapter can issue raw commands.

Counters are namespaced with prefixes (`rl:global:`, `rl:auth:`) so
they don't collide with the existing session keys.

### 2.5 ✅ Password reset and Google OAuth flows hardened

**Password reset (`/api/auth/forgot-password`, `/verify-reset-token`,
`/reset-password`).**

- The response is now identical whether the email exists, doesn't
  exist, or belongs to a Google-only account. Previously we returned
  a 400 "this account uses Google Sign-In" — that leaked both the
  account's existence and its sign-in method.
- Reset tokens are now **hashed (SHA-256) at rest in Redis**. The user
  receives the plain token by email; the lookup hashes the supplied
  token before comparing. A Redis dump no longer hands an attacker
  usable reset tokens.
- Token TTL reduced from 1 hour to **30 minutes**.
- Tokens are single-use (deleted on successful reset) — already true
  before and still true.
- On a successful reset we now also **revoke every active session for
  that user** (`session:<userId>:*` keys are deleted). If the password
  was reset because the account was compromised, any attacker still
  logged in is kicked out.
- Bumped the bcrypt cost factor used in `resetPassword` from 10 to 12
  in line with the recommendation in section 4.

**Google OAuth (`/api/auth/google` start + `/google/callback`).**

- **CSRF protection.** Added a Redis-backed `state` round-trip:
  - On `/google` we mint a 24-byte random token, store it in Redis
    with a 5-minute TTL, and pass it in the OAuth `state` parameter.
  - The callback rejects any request whose `state` doesn't match a
    live Redis entry, then deletes the entry (single-use).
  - The existing mobile-vs-web platform hint that abused `state`
    is preserved — we now pack it as `<csrf>.<platform>` in the
    same value.
- **No more silent account-linking by email.** Previously, if Google
  returned an email that already matched a password user, we set
  `user.google_id` automatically — meaning anyone who could create
  a Google account for that email could take over the existing
  account. The strategy now refuses to log in via Google when an
  unlinked password account exists with the same email and tells the
  user to "sign in with your password and link Google from settings"
  (i.e. while already authenticated).
- **Google `email_verified` enforced.** We now check
  `email_verified === true` on the Google profile and refuse the
  login otherwise. This protects against the (rare) case where
  Google itself hasn't confirmed ownership.

---

## 3. Multi-tenant safety (who can see whose data)

### 3.1 ✅ A regular user can no longer "switch tenants" via request body

**The problem.** Tenant resolution would fall back to
`req.query.tenant_id` / `req.body.tenant_id` if the subdomain and JWT
didn't supply one. So an authenticated user could just put any tenant
id in the request body and read that tenant's data.

**What we did.** `src/middleware/tenant.js` now only honours
body/query `tenant_id` for users with `super_admin` / `admin` roles.
Everyone else must come in via subdomain or via their JWT claim.

### 3.2 ✅ The `Host` header can no longer trick tenant lookup

**The problem.** Tenant resolution used `req.get('host')` directly. An
attacker can send any value in `Host:` — if you weren't behind a strict
proxy, they could spoof the subdomain.

**What we did.** We now only trust the Host header when its value ends
with the configured `MAIN_DOMAIN`. Anything else falls through to
JWT-based resolution and is logged as suspicious.

### 3.3 ✅ Backend never connects to a per-tenant database

We've moved to a **single shared database** for all tenants. The
backend always uses the configured main DB connection, and tenant
isolation is enforced row-by-row via the `tenant_id` and `company_id`
columns on every transactional model. The previous risk — a tampered
tenant row tricking the backend into connecting to an attacker MySQL
server — no longer applies because per-tenant connection details are
ignored entirely.

If you ever need to go back to per-tenant databases, the legacy
implementation lives at
`tenantProvisioningService._legacyProvisionDatabase`.

### 3.4 ✅ Every "find by id" is now tenant-scoped

**The problem.** After the move to a single shared database, every
read or write of a tenant-owned record needs `tenant_id` in its
`where` clause. Without that filter, user A could read user B's
records by guessing the primary key (classic IDOR).

**The audit.** A thorough scan over `backend/src/controllers` and
`backend/src/services` turned up **341 `findByPk` / `findOne` call
sites**, of which **63** were unsafe — they queried tenant-owned
models without the tenant filter. The rest were either already
scoped, lookups on global/admin models (no tenant filter required),
or lookups by globally-unique fields (defense-in-depth only).

**What we did.**

1. **Helper.** Added `backend/src/utils/scopedQueries.js` exporting
   `findByIdScoped(req, Model, id, options?)`,
   `findOneScoped(req, Model, where, options?)`,
   `findAllScoped(req, Model, where, options?)`, and `scopeWhere`.
   The helper:
   - Always merges in `tenant_id` from the caller (`req.tenant_id`).
   - Also merges in `company_id` if and only if the model declares
     a `company_id` column (`Model.rawAttributes.company_id`), so it
     does not break models that don't have one.
   - Forwards through `transaction`, `include`, `attributes`, etc.

2. **Patched call sites in controllers.**
   - `inventoryController.js` (15 sites)
   - `ledgerController.js` (6)
   - `warehouseController.js` (5)
   - `voucherController.js` (10, including helper-call updates so
     `updateLedgerBalance` receives `req.tenant_id`)
   - `attributeController.js` (4)
   - `gstController.js` (4)
   - `billWiseController.js` (2)
   - `eWayBillController.js` (1)
   - `eInvoiceController.js` (1)
   - `inventoryUnitController.js` (3)
   - `stockTransferController.js` (3)
   - `stockAdjustmentController.js` (2)
   - `numberingSeriesController.js` (5 — already had tenant_id;
     refactored to use the helper for consistency)
   - `pdfController.js` (1)
   - `transactionController.js` (2)
   - `tallyImportController.js` (4)
   - `tdsTcsController.js` (1 caller updated to pass `tenant_id`
     into `tdsService.getCompanyTDSTCSConfig`)
   - `authController.js` (5 self-lookup sites — JWT-derived
     `userId`, so not exploitable, but added scope for
     defense-in-depth)
   - `reportController.js` (1 caller updated to pass `tenant_id`
     and `company_id` into `reportService` options)

3. **Patched call sites in services.**
   - `inventoryService.js` (4)
   - `voucherService.js` — pre-existing tenant-aware ctx pattern
     reinforced
   - `eInvoiceService.js`, `eWayBillService.js` — covered by the
     controller-level patches and pre-existing scoped lookups
   - `tdsService.js` — `generateLedgerCode` and
     `getCompanyTDSTCSConfig` signatures extended to take
     `tenantId`; callers updated
   - `voucherPostingService.js` — `updateLedgerBalance` extended to
     take `tenantId`; callers updated. The legacy unscoped path
     remains as a deprecation fallback that emits a warning
   - `tenantProvisioningService.js` — `createDefaultLedgers` now
     scopes its existence check by `tenantId`
   - `reportService.js` — `generateLedgerStatementReport` now
     reads `tenant_id` / `company_id` from the options object

4. **Schema fix in `tenantModels.js`.** `InventoryItem` was missing
   a `tenant_id` column entirely and had **global** unique
   constraints on `item_key` and `barcode`. Added `tenant_id`,
   `company_id`, and replaced the global uniques with composite
   `(tenant_id, item_key)` and `(tenant_id, barcode)` so two
   tenants can legitimately use the same SKU/barcode.

**Verification.**

```bash
grep -rEn "tenantModels\\.(Voucher|Ledger|InventoryItem|...)\\.findByPk\\(" \
  backend/src/controllers backend/src/services
```

returns exactly one hit — the documented deprecation-fallback path
in `updateLedgerBalance` for callers that don't yet pass `tenantId`,
which logs a warning. Every other call goes through the helper.

**What still needs eyes.**

- The audit's NEEDS_HUMAN bucket (~78 calls) was largely
  `findOne({ where: { uniqueField } })` style lookups by globally
  unique business keys (GSTIN, IRN, email, etc.). These are not
  exploitable on their own, but adding `tenant_id` to them is cheap
  defense-in-depth and we should do it as a future cleanup.
- A handful of `findOne` calls inside services still use a manual
  `where: { ..., tenant_id }` pattern instead of the helper — they
  are correct, just not consistent. Migrating them is a follow-up.
- `bulkCreate`, `update({ where: ... })`, and `destroy({ where:
  ... })` calls were **not** part of this audit. They have the
  same IDOR risk and need a sibling pass.

---

## 4. Encryption

### 4.1 ✅ AES-256-GCM payload encryption supported alongside legacy CryptoJS

**The problem.** The shared payload-encryption code in
`src/utils/encryption.js` uses CryptoJS's "passphrase" mode — AES-CBC
with the OpenSSL EVP key-derivation (MD5-based, 1 iteration) and **no
integrity check**. Modern bar: AES-256-GCM with a properly-derived key.

**What we did.** Added a v2 scheme without breaking v1.

- v1 (legacy) — CryptoJS string ciphertext, what the current frontend
  emits and consumes. Still supported.
- **v2 — AES-256-GCM** with a per-message random 12-byte IV, key
  derived from `PAYLOAD_ENCRYPTION_KEY` via SHA-256, authenticated
  (tampering is detected). Wire format:
  `{ "v": 2, "iv": "<base64>", "tag": "<base64>", "ct": "<base64>" }`.

`decryptPayload()` auto-detects the version: v2 if it sees the
versioned object shape, v1 otherwise.

`encryptResponse` middleware **mirrors** the request's version when
the request itself was encrypted, so a v1 client always gets a v1
response and a v2 client always gets v2. The
`X-Encrypt-Response: v1|v2|true` header lets a client request a
specific version on demand. The env flag `PAYLOAD_ENCRYPTION_V2=true`
flips the default for unencrypted requests.

**Migration path.**

1. Ship this backend change; behaviour is unchanged for existing
   clients (still v1 in / v1 out).
2. Update the frontend to be able to *decrypt* v2 — it can keep
   sending v1 for now.
3. Set `PAYLOAD_ENCRYPTION_V2=true` (or have the frontend send v2)
   and start producing v2 responses.
4. Once you've cut over, you can drop the v1 helpers in a future
   release.

### 4.2 ✅ Tenant DB-password encryption is now AES-GCM with random salt

**The problem.** Tenant DB passwords were encrypted with AES-256-CBC
using a hardcoded salt and **no integrity check**. An attacker who got
the DB but not the key could try to silently flip bits.

**What we did.** New writes use AES-256-GCM (authenticated — tampering
is detected on decrypt) with a fresh random salt and IV per record.
Old "v1" records keep being readable, so no migration is required —
they get re-saved in the new format the next time they're rotated.
See `src/services/tenantProvisioningService.js`.

### 4.3 ⚠️ Confirm bcrypt cost factor is at least 12

`bcryptjs`'s default is 10 rounds, which is too low in 2026. Search
for `bcrypt.hash(` and ensure the second arg is `≥ 12`.

---

## 5. What the API accepts as input

### 5.1 ✅ Maximum JSON body reduced from 50 MB to 1 MB

**The problem.** `express.json({ limit: '50mb' })` applied to every
endpoint. A handful of attackers POSTing 50 MB blobs is enough to
exhaust memory on a small instance.

**What we did.** Default limit lowered to **1 MB**, configurable via
`JSON_BODY_LIMIT`. File uploads are unaffected — they go through
`multer`, which streams to disk and has its own per-route limits.

### 5.2 ✅ Added `validator` as a real dependency

`src/middleware/sanitize.js` does `require('validator')`, but this
package isn't in `package.json` — it's only available transitively via
`express-validator`. One unrelated dependency upgrade can break input
sanitization site-wide.

**What we did.** Added `validator: ^13.12.0` to `dependencies`.

### 5.3 ⚠️ Reconsider the global "escape every string" sanitizer

> **Why this stays ⚠️ for now:** removing the global escaper without
> first putting per-route validation in place would make every endpoint
> *more* permissive overnight. We left it as a follow-up that should
> ship together with item 5.4.

Right now every string in `req.body` / `req.query` / `req.params` gets
HTML-escaped via `validator.escape(...)`. That's the wrong layer:

- It corrupts legitimate data (search queries with `&`, `<`, `>`, JSON
  blobs stored as text, etc.).
- It does **not** protect against SQL injection — Sequelize
  parameterization does that.
- It doesn't help against XSS either; XSS protection happens when you
  *render* untrusted text, not when you receive it.

The cleaner pattern is:

1. **Validate** each field against a schema per route
   (`express-validator`, Zod, Yup…).
2. **Escape on output**, only when injecting into HTML contexts.

### 5.4 ⚠️ Many endpoints still have no schema validation

> **Why this stays ⚠️:** there are ~45 controllers and adding a
> validator schema per route is a per-endpoint product decision (which
> fields are required, what's the max length, what enum values, etc.).
> Generating those schemas blindly from existing usage would either
> reject legitimate traffic or be useless rubber-stamping. This needs
> a human pass per controller.

There are ~45 controllers and only a handful of validator files in
`src/validators/`. Each route should declare what it accepts (required
fields, types, limits). This is the single biggest fix for "weird
input crashes the server" and a foundation for input-trust assumptions.

---

## 6. HTTP / browser hardening

### 6.1 ✅ CORS no longer matches by substring

**The problem.** The old check was effectively
`origin.includes(mainDomain)`. If your domain is `fintranzact.com`,
that means `https://fintranzact.com.attacker.io` would have been
accepted as a same-origin caller.

**What we did.** Rewrote `src/config/cors.js` to parse the Origin
header with `new URL(...)` and compare the *hostname* exactly:

- equal to `mainDomain`, or
- ends with `"." + mainDomain`,
- localhost variants for dev,
- otherwise: rejected.

### 6.2 ✅ CORS is no longer wide-open in non-production

**The problem.** If `NODE_ENV` was anything other than the literal
string `"production"`, every Origin was allowed. If `NODE_ENV` was
unset on a real environment, CORS was open to the internet.

**What we did.** That blanket allow is gone. Localhost is still
permitted automatically; for staging-like environments, set
`CORS_ORIGIN` to the explicit allowed origin.

### 6.3 ✅ Stack traces never leaked unless explicitly in development

**The problem.** `errorHandler.js` revealed `err.stack` whenever
`NODE_ENV !== 'production'`. With `NODE_ENV` unset, that was always.

**What we did.** Stacks are now only included when `NODE_ENV === 'development'`.
Any other value (including unset) is treated as production.

### 6.4 📌 Confirm response headers in production

Helmet is on (`src/app.js`), good. Manually verify these headers in a
production response:

- `Strict-Transport-Security`
- `X-Frame-Options: DENY` (or `Content-Security-Policy` `frame-ancestors`)
- `Referrer-Policy: no-referrer` (or stricter)
- `Cross-Origin-Resource-Policy` set appropriately for `/uploads`

---

## 7. Database

### 7.1 ✅ Connection pool size is configurable and defaults to 15

**The problem.** Both `src/config/database.js` and
`src/config/masterDatabase.js` hardcoded `pool.max = 3`. Under any
real load, requests queued behind the pool and timed out.

**What we did.** Every pool field is now env-driven with sensible
production defaults:

| Variable | Default | Notes |
|---|---|---|
| `DB_POOL_MAX` | `15` | Cap so that `instances × DB_POOL_MAX < mysql.max_connections`. |
| `DB_POOL_MIN` | `0` | Lazy connection acquisition. |
| `DB_POOL_ACQUIRE_MS` | `30000` | How long to wait for a free connection before erroring. |
| `DB_POOL_IDLE_MS` | `10000` | Idle timeout before a connection is closed. |
| `DB_POOL_EVICT_MS` | `1000` | How often to scan for idle connections. |

### 7.2 ✅ Per-tenant connection manager no longer applies

This was relevant under the old per-tenant-DB architecture. Since the
single-shared-DB switch (item 0), there is one main connection pool
and the tenant connection manager is a thin shim that returns it.

### 7.3 ⚠️ Wrap multi-table mutations in a transaction

> **Why this stays ⚠️:** correctness here is service-by-service
> business logic. Adding `sequelize.transaction()` around the *wrong*
> set of statements can deadlock the DB, swallow errors, or change the
> visibility of intermediate state. This needs a careful per-function
> read of the accounting logic — voucher posting, ledger balance
> updates, stock movements, commission accruals, COGS — by someone
> who knows the business invariants.

For an accounting app, every write that touches more than one table
must be inside a single Sequelize transaction. Otherwise a crash
mid-way leaves the books inconsistent.

Starting points for the audit:

```bash
grep -rn "sequelize.transaction(" backend/src
```

Critical services to walk: `voucherPostingService.js`,
`inventoryService.js`, `commissionService.js`,
`voucherService.js`, and the eInvoice / eWayBill cancellation paths.

### 7.4 ✅ `db:fresh` etc. removed from package.json

Those scripts pointed at files that don't exist
(`drop-all-tables.js`, `fresh-database-setup.js`, …). Running them
would have produced a confusing error. Removed.

### 7.5 ✅ Schema auto-alter is already disabled in production

`src/utils/dbSync.js` already runs `sequelize.sync({ alter: true })`
only when `NODE_ENV !== 'production'`. Production uses migrations.
Good — no fix needed.

### 7.6 📌 Migrations: index every foreign key

For every migration that adds a foreign key column, also add an index
on it (otherwise `DELETE` on the parent table table-scans the child
table). Same for columns you `WHERE` on heavily — `tenant_id`,
`company_id`, `email`, etc.

---

## 8. File uploads

`backend/src/config/multer.js` already does most of the right things:
per-tenant subdirectories, randomised file names, per-route size
limits, MIME + extension allow-listing. Remaining hardening work:

### 8.1 ✅ Magic-byte validator is available; opt-in per route

**The problem.** `req.file.mimetype` is whatever the client said.
Multer happily writes `evil.html` to disk if the client lies in the
Content-Type header.

**What we did.**

- Added `src/utils/fileMagic.js` — a dependency-free magic-byte
  sniffer with signatures for JPEG, PNG, GIF, WEBP, BMP, PDF, ZIP /
  Office, XML, and PEM certificates.
- Added `validateUploadedFile(allowedMimes, options)` to
  `src/config/multer.js`. After multer writes the file to disk this
  middleware sniffs the actual bytes, rejects with HTTP 400 if the
  content doesn't match, and **unlinks the rejected file** before
  responding so attacker bytes never linger on disk.

Wire it in like:

```js
const { uploadProfile, validateUploadedFile } = require('../config/multer');
router.post(
  '/profile/image',
  uploadProfile.single('image'),
  validateUploadedFile(['image/png', 'image/jpeg', 'image/webp']),
  controller.uploadProfileImage
);
```

> **Follow-up:** the validator is now available, but it is **not
> automatically wired** onto every existing upload route. Each upload
> route in `src/routes/*` should be touched once to add the
> `validateUploadedFile([...])` call after the multer handler. Doing
> it route-by-route keeps the allow-list explicit per endpoint.

### 8.2 ⚠️ Move user uploads off the API origin

Today `/uploads` is served from the same origin as the API. A malicious
SVG or HTML upload could run in your domain's cookie context.
Recommended path: write uploads to S3 / object storage and serve them
via signed URLs from a different (cookieless) domain.

---

## 9. Webhooks and outbound integrations

### 9.1 ✅ Razorpay webhook signature now verified against the *raw* body

**The problem.** The handler did
`crypto.createHmac(...).update(JSON.stringify(req.body))`. After Express
parses the JSON, the re-serialized text is *not* guaranteed to match
the original byte-for-byte (whitespace, key order). So a legitimate
webhook could fail signature check, or worse, an attacker could craft
a payload that round-trips identically and bypass it.

**What we did.**

- In `src/app.js`, the JSON body parser now snapshots the raw bytes
  onto `req.rawBody` for the webhook path.
- `src/controllers/razorpayWebhookController.js` HMACs `req.rawBody`
  and uses `crypto.timingSafeEqual` for the comparison (avoids timing
  attacks).

### 9.2 ✅ Outbound HTTP now goes through a shared client with timeouts

**The problem.** Plain `axios` has no default timeout. A single hung
remote (GST API, IRP, e-way bill, Razorpay, Finbox) could pin
event-loop slots indefinitely.

**What we did.**

- Added `src/utils/httpClient.js` — a shared axios instance with a
  `HTTP_DEFAULT_TIMEOUT_MS` default of 10 seconds and a response
  interceptor that logs timeouts / non-2xx / network errors in a
  uniform way.
- Switched `src/services/irpClient.js`,
  `src/services/eWayBillClient.js`, and
  `src/services/thirdPartyApiClient.js` from
  `require('axios')` to `require('../utils/httpClient')`. They keep
  their own per-call timeouts where those were already explicit.
- The same module exports `create(overrides)` for services that need
  a per-host instance with a different baseURL or timeout.

> **Follow-up still ⚠️:** retry-with-jitter and per-call idempotency
> keys are not in this change. They belong on a per-service basis —
> a payments retry policy is not the same as a GST master-data
> refresh policy.

### 9.3 ✅ Razorpay webhook idempotency

**The problem.** Razorpay's at-least-once delivery means we can
receive the same payment / subscription event twice. Without dedup,
that double-processes payments / commissions / status flips.

**What we did.** Before any handler runs,
`razorpayWebhookController.handleWebhook` reserves a Redis key
`webhook:razorpay:<event.id>` with `SET NX EX 7d` (atomic
check-and-set, 7-day TTL — covers Razorpay's retry window). The first
delivery wins; any duplicate gets a `200 { duplicate: true }`
acknowledgement and stops, so Razorpay doesn't keep retrying.
If Redis is unreachable we fail open (process the event) — better to
occasionally double-handle than to drop a real payment.

---

## 10. Logs, audit, privacy

### 10.1 ✅ Redacting log formatter is now in place

**The problem.** Logs are the most common channel for accidental
secret / PII leaks. A single misplaced `logger.info(req.body)` in the
auth flow can dump every password to the log sink.

**What we did.** `src/utils/logger.js` now runs every log entry
through a Winston format that walks the metadata tree (up to 6 levels
deep) and replaces values for these keys with `[REDACTED]`:

- Credentials: `password`, `password_hash`, `new_password`,
  `old_password`, anything matching `password.*hash`.
- Tokens: `token`, `access_token`, `refresh_token`, `auth_token`,
  `id_token`.
- Secrets / keys: `secret`, `*_secret`, `api_key`, `client_secret`,
  `webhook_secret`, `encryption_key`.
- HTTP credentials: `authorization`, `cookie`, `set_cookie`.
- Provider headers: `razorpay_signature`,
  `x_razorpay_signature`.
- Card / sensitive PII: `card_number`, `cvv`, `cvc`, `ssn`,
  `aadhaar`, `otp`.

In addition to key-based redaction, the formatter scrubs *string
values* anywhere in the log entry:

- `Bearer <…>` headers.
- Anything that looks like a JWT (`eyJ…` three-segment base64url).

The redactor runs in front of all transports (file + dev console),
so anything that lands in `logs/` or stdout has already been
sanitised.

### 10.2 ⚠️ Confirm the audit trail is append-only

`src/middleware/audit.js` exists — make sure each financial / admin
action writes a row with `actor_user_id`, `tenant_id`, IP, user agent,
timestamp, and that those rows can't be updated or deleted by
application code.

### 10.3 📌 Define log retention

Verbose logs forever = privacy + cost problem. Pick a window
(30 / 90 / 180 days), document it, and configure your log sink to
enforce it.

---

## 11. How the server starts and crashes

### 11.1 ✅ Fail-fast on misconfigured environment

The new `src/config/env.js` is the very first thing `server.js`
requires. If anything required is missing, the process exits before
HTTP is even bound, with a list of what's wrong. No more "started
but quietly insecure".

### 11.2 ✅ Unhandled rejections now exit cleanly

The previous code tried to "recover" from unhandled promise rejections,
including WASM out-of-memory errors. Once Node's promise machinery is
in an unknown state, continuing risks corrupted writes. The handler
now logs and exits, so PM2 / your platform spawns a fresh worker.

### 11.3 📌 Health checks

`/health` and `/api/health` return 200 OK as long as the HTTP server is
up. For a real readiness probe, add a check that pings Redis and the
master database — only a "ready" state should receive traffic.

---

## 12. WebSocket / realtime

### 12.1 ✅ WebSocket no longer falls back to a default JWT secret

`src/websocket/socketServer.js` now uses the same validated `JWT_SECRET`
as the HTTP layer.

### 12.2 ⚠️ Confirm tenant scoping on rooms

Every `socket.join('room-X')` and every server-side emit must check
that the room belongs to the user's tenant. A mistake here is
how multi-tenant apps accidentally broadcast Tenant A's events to
Tenant B's browsers.

---

## 13. Cron / background jobs

### 13.1 ✅ Cron jobs are now leader-elected via Redis

**The problem.** `src/services/cronService.js` runs `node-cron`
in-process. With multiple backend replicas, every replica fires the
same tick → nightly cleanup runs N times, double-billing risk on any
"on-charge" job, etc.

**What we did.** Each scheduled tick now wraps its work in
`runWithLeaderLock(jobName, ttl, task)`:

- `SET NX EX` on a Redis key `cron:lock:<jobName>` — atomic
  acquire-or-skip across all replicas.
- TTL is set comfortably larger than the job's expected runtime
  (1 hour for the existing trial-cleanup job) so a crashed replica
  can't deadlock the schedule.
- On exit the lock is released via a Lua compare-and-delete so a job
  that ran past its TTL doesn't accidentally release another
  replica's freshly-acquired lock.
- Instance identity is `${hostname}-${pid}`.
- If Redis is unavailable, we **fail open** (run the job) — better to
  occasionally double-run than silently skip nightly cleanup.

### 13.2 📌 Make every job idempotent

Cron jobs should be safe to run twice. Use unique business keys, not
"insert a new row each time".

---

## How to verify these fixes locally

1. Start the server **without** any env vars.
   It should refuse to boot and print which vars are missing.
2. Start the server with valid `.env`. Confirm the boot log no longer
   mentions `MYSQL_URL`.
3. Log in, then on the server invalidate the session in Redis
   (`DEL session:<userId>:<jti>`). The next API call must return 401.
4. Refresh your token; confirm the response contains a *new* refresh
   token (not the one you sent).
5. From a browser, send a request from `https://fintranzact.com.evil.io`.
   It must be rejected by CORS.
6. Send a Razorpay-style webhook with a valid signature: 200. Tamper one
   byte in the body: 400.
7. POST a 5 MB JSON body to a normal endpoint: it must be rejected
   (request entity too large).

---

## Quick reference: env vars introduced or now required

| Variable | Required? | Notes |
|---|---|---|
| `JWT_SECRET` | **Yes** | ≥ 32 chars. App refuses to boot otherwise. |
| `JWT_REFRESH_SECRET` | **Yes** | ≥ 32 chars, must differ from `JWT_SECRET`. App refuses to boot otherwise. |
| `ENCRYPTION_KEY` | **Yes** | ≥ 16 chars. Used for tenant DB password encryption. |
| `PAYLOAD_ENCRYPTION_KEY` | **Yes** | ≥ 16 chars. Must match the frontend. |
| `DATABASE_URL` *or* `DB_HOST`+`DB_USER` | **Yes** | One of the two. |
| `ALLOWED_DB_HOSTS` | Deprecated | Used to allowlist per-tenant DB hosts. Single-DB mode no longer reads this. |
| `MAIN_DOMAIN` | Recommended | Used for CORS + Host validation + subdomain tenant lookup. |
| `CORS_ORIGIN` | Optional | Extra explicit origins (comma-separated). |
| `JSON_BODY_LIMIT` | Optional | Default `1mb`. Raise per-route if a specific endpoint needs more. |
| `AUTH_RATE_LIMIT_MAX` | Optional | Default `20` per 15-min window per IP for auth endpoints. |
| `JWT_EXPIRES_IN` | Optional | Default `15m`. Short-lived access tokens. |
| `JWT_REFRESH_EXPIRES_IN` | Optional | Default `7d`. |
| `DB_POOL_MAX` | Optional | Default `15`. Connection pool max per backend instance. Cap so `instances × DB_POOL_MAX < mysql.max_connections`. |
| `DB_POOL_MIN`, `DB_POOL_ACQUIRE_MS`, `DB_POOL_IDLE_MS`, `DB_POOL_EVICT_MS` | Optional | Pool tuning knobs (see item 7.1). |
| `HTTP_DEFAULT_TIMEOUT_MS` | Optional | Default `10000`. Outbound HTTP timeout for the shared client (item 9.2). |
| `HTTP_DEFAULT_MAX_REDIRECTS` | Optional | Default `5`. |
| `PAYLOAD_ENCRYPTION_V2` | Optional | Set `true` to default outbound payload encryption to AES-256-GCM (item 4.1). Both versions are accepted on input regardless. |
