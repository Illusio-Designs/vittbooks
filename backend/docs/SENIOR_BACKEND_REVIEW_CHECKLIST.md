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

### 2.4 ⚠️ Rate-limit store is in-memory

If you run more than one backend instance behind a load balancer, each
instance has its own counter. The effective limit becomes
`instances × max`. Switching to a Redis-backed store (using the
`rate-limit-redis` package, since you already run Redis) closes that
gap. This was not changed automatically because it adds a dependency
and only matters once you scale horizontally.

### 2.5 ⚠️ Audit the password-reset and Google-OAuth flows

These weren't changed, but please confirm:

- `forgot-password` returns the same response whether the email exists
  or not (don't leak account existence).
- Reset tokens are single-use, expire within ~30 minutes, and are
  hashed at rest (so a leaked DB doesn't grant resets).
- Google OAuth callback uses the `state` parameter (CSRF) and only
  links to an existing account when the email matches *and* the user
  is already logged in.

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

### 3.4 ⚠️ Audit every "find by id" for tenant scoping

This is the kind of bug a search-and-replace can't safely do. Every
controller that does `Model.findByPk(id)` or
`Model.findOne({ where: { id } })` must also include the caller's
`tenant_id` / `company_id` in the `where` clause — otherwise user A
can read user B's records by guessing ids.

Search command:

```bash
grep -rn "findByPk\|findOne" backend/src/controllers backend/src/services
```

For each hit, confirm the `where` clause restricts to the caller's
tenant. Adding a small base helper that injects this automatically
(e.g. `findScoped(req, Model, id)`) is the long-term fix.

---

## 4. Encryption

### 4.1 ⚠️ The request/response payload encryption (CryptoJS) is weak

**The current state.** `src/utils/encryption.js` uses CryptoJS's
"passphrase" mode, which derives an AES key from the secret using
MD5-based EVP_BytesToKey (1 iteration) and AES-CBC with no integrity
check. Modern bar: AES-256-GCM with a properly derived key.

**Why we didn't auto-fix it.** The frontend uses the same scheme to
talk to this backend. Switching algorithms here would break every
client until the frontend is shipped at the same time.

**What we did do.** Removed the hardcoded fallback so the app at least
won't run with a guessable key.

**What you should do next.** Plan a coordinated frontend + backend
release that switches both ends to AES-256-GCM (Node's built-in
`crypto`, no third-party lib needed).

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

### 5.2 ⚠️ Add `validator` as a real dependency

`src/middleware/sanitize.js` does `require('validator')`, but this
package isn't in `package.json` — it's only available transitively via
`express-validator`. One unrelated dependency upgrade can break input
sanitization site-wide.

**What we did.** Added `validator: ^13.12.0` to `dependencies`.

### 5.3 ⚠️ Reconsider the global "escape every string" sanitizer

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

This needs per-endpoint review, so it was not auto-fixed.

### 5.4 ⚠️ Many endpoints still have no schema validation

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

### 7.1 ⚠️ Connection pool max is 3 — too small for production

`src/config/database.js` and `src/config/masterDatabase.js` set
`pool.max = 3`. That's fine for a hobby instance; under real load
requests will queue. 10–20 per backend instance is normal, capped so
that `instances × pool.max` stays under MySQL `max_connections`.

### 7.2 ⚠️ Per-tenant connection manager — verify eviction

The tenant connection manager (`src/config/tenantConnectionManager.js`)
opens a separate MySQL connection per company on demand. Confirm:

- Total connections are capped (`MAX_TENANT_CONNECTIONS`).
- Idle connections are evicted.
- Errors close the connection (don't leak it back to the pool).

### 7.3 ⚠️ Wrap multi-table mutations in a transaction

For an accounting app, every write that touches more than one table
(voucher posting, ledger update, stock movement, commission accrual)
must be inside a single Sequelize transaction. Otherwise a crash mid-way
leaves the books inconsistent.

```bash
grep -rn "sequelize.transaction(" backend/src
```

Audit the critical services:
`voucherPostingService.js`, `inventoryService.js`,
`commissionService.js`.

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

### 8.1 ⚠️ Don't trust client-supplied MIME

`req.file.mimetype` is whatever the client said. For high-trust
contexts (DSC certificates, invoices), additionally check the file's
**magic bytes** server-side (`file-type` package) before storing.

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

### 9.2 ⚠️ Add timeouts and idempotency to outbound API calls

Outbound HTTP via `axios` (GST, e-invoice, e-way bill, Finbox,
Razorpay) has no default timeout. A hung remote will pin event-loop
slots forever. Recommended: a shared `axios.create({ timeout: 10000 })`
client, plus retry-with-jitter and an idempotency-key for any call
that has financial side effects.

### 9.3 ⚠️ Webhook idempotency

Razorpay can deliver the same webhook twice. Store processed event IDs
in Redis (or a small DB table) with a TTL, and short-circuit duplicates.

---

## 10. Logs, audit, privacy

### 10.1 ⚠️ Add a redacting log formatter

Make sure these never make it into log lines:
`password`, `token`, `secret`, `authorization` header,
`razorpay_signature`, `card`, `cvv`, full GSTIN/PAN/Aadhaar.

A Winston format that walks each log object and replaces matching keys
with `***` covers most accidents.

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

### 13.1 ⚠️ Multiple replicas will run each cron N times

`src/services/cronService.js` uses `node-cron` in-process. With more
than one backend instance, every job fires on every instance. Either:

- Run cron in a single dedicated worker, or
- Use Redis SETNX with a TTL to make jobs leader-elected, or
- Move scheduled work to Bull (already a dep) and run a single worker
  fleet for the queue.

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
