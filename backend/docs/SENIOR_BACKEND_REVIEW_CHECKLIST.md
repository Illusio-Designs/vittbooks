# Senior Backend Review – `backend/`

A practical, prioritized checklist for reviewing this Node.js / Express / Sequelize / MySQL / Redis multi‑tenant SaaS backend. Every item below was derived from an actual read of this repository (file paths and line numbers are real). Treat this as the master TODO before going to production.

> Stack detected: Express 5, Sequelize 6 (MySQL 2), Redis 5, JWT, bcryptjs, Helmet, express-rate-limit, Passport (Google OAuth), Multer, Bull, Razorpay, Socket.IO, Winston.

---

## 0. Severity legend

| Tag | Meaning |
| --- | --- |
| 🔴 **CRIT** | Fix before any production traffic. Exploitable or data-loss class. |
| 🟠 **HIGH** | Fix in the next release. Real risk under realistic conditions. |
| 🟡 **MED**  | Fix soon. Hardening / correctness debt. |
| 🟢 **LOW**  | Cleanup / polish. |

---

## 1. Secrets & Configuration

| # | Severity | File | Finding | Action |
|---|---|---|---|---|
| 1.1 | 🔴 CRIT | `src/utils/jwt.js:6`, `src/middleware/auth.js:23,99`, `src/websocket/socketServer.js:77` | `JWT_SECRET` falls back to the literal string `'your-secret-key-change-in-production'`. If the env var is missing in any environment, every token becomes forgeable. | Remove the fallback. Fail fast at boot if `JWT_SECRET` is not set or shorter than 32 bytes. |
| 1.2 | 🔴 CRIT | `src/utils/encryption.js:5` | `PAYLOAD_ENCRYPTION_KEY` falls back to `'fintranzact-default-encryption-key-change-this-in-production'`. | Same: fail fast, no fallback. |
| 1.3 | 🔴 CRIT | `src/middleware/tenant.js:201`, `src/services/tenantProvisioningService.js:883,893`, `src/seeders/001-admin-master-seeder.js:20` | `ENCRYPTION_KEY` falls back to `'default-key'`. Tenant DB passwords are encrypted with this. If env is missing once in prod, every tenant DB password is decryptable by anyone with code access. | Remove the fallback. Add a startup check. Rotate any password encrypted with the default key. |
| 1.4 | 🟠 HIGH | `.env.railway.example` | Sample shows `SESSION_SECRET`, `JWT_SECRET`, `ENCRYPTION_KEY` placeholders. Confirm none of these placeholder values were ever committed to a real `.env`. | `git log --all -p -- backend/.env*` and rotate anything that ever leaked. |
| 1.5 | 🟠 HIGH | `src/config/database.js:46`, `src/middleware/tenant.js:117` | DB host/user/password fall back to `localhost` / `root` / `''`. Silent misconfiguration risk on cloud. | Require `MYSQL_URL` (or all of `DB_HOST`/`DB_USER`/`DB_PASSWORD`). Throw on missing in production. |
| 1.6 | 🟡 MED | `server.js:22-29` | Logs which env vars are set. Verify no secret values are ever logged (currently OK, only `SET / NOT SET`). | Keep this discipline; add an ESLint rule against `logger.info(... process.env.X)` for secret-named keys. |
| 1.7 | 🟡 MED | repo-wide | Single shared `JWT_SECRET` for access + refresh tokens. Compromise of one ⇒ compromise of both. | Use distinct secrets, e.g. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. |

## 2. Authentication & Sessions

| # | Severity | File | Finding | Action |
|---|---|---|---|---|
| 2.1 | 🔴 CRIT | `src/middleware/auth.js:43-54` | When Redis is connected and the session is not found, the code logs a warning and **still allows the request**. The strict block is commented out. This nullifies session revocation and logout. | Enforce: if Redis is connected and no session → 401. Logout must mean logout. |
| 2.2 | 🟠 HIGH | `src/utils/jwt.js:138-187` | `refreshAccessToken` returns the same refresh token (`refreshToken: refreshToken`). No rotation. A leaked refresh token is valid until natural expiry. | Rotate refresh tokens on each refresh; revoke old `jti` server-side. |
| 2.3 | 🟠 HIGH | `src/middleware/auth.js:57-61` | `req.user = decoded` blindly trusts JWT‑embedded `role`, `tenant_id`, `company_id`. If a user’s role changes (downgraded / removed / suspended), they keep elevated access until token expiry (24h default). | On sensitive routes, re-check role/state from DB or use a short access-token TTL (5–15 min) + refresh rotation. |
| 2.4 | 🟠 HIGH | `src/app.js:33-40` | Single global rate limit of **1000 req / 15 min**, no tighter limit on `/api/auth/login`, `/api/auth/register`, password reset, or refresh. Brute force on credentials is feasible. | Add a stricter limiter (e.g. 5–10/min/IP+account) on auth endpoints. Track failures per email in Redis. |
| 2.5 | 🟠 HIGH | `src/app.js:33-40` | `express-rate-limit` defaults to in-memory store. Behind multiple instances, the limit becomes `instances × max`. | Use `rate-limit-redis` (Redis already a dep). |
| 2.6 | 🟡 MED | `src/utils/jwt.js:7-8` | `JWT_EXPIRES_IN=24h` default for access tokens is long. | 15m access / 7d refresh with rotation is the standard target. |
| 2.7 | 🟡 MED | `src/controllers/authController.js` | Confirm: account lockout after N failed logins; generic error messages (don’t reveal whether email exists); password complexity policy; password reset tokens are single-use, time-bound, hashed at rest. | Audit login / forgot-password / reset endpoints. |
| 2.8 | 🟡 MED | `src/config/passport.js` | Audit Google OAuth callback: state parameter (CSRF), nonce, account-linking rules (must require login before linking), email verification before granting access. | File-by-file audit. |

## 3. Authorization, Multi-tenant Isolation & IDOR

| # | Severity | File | Finding | Action |
|---|---|---|---|---|
| 3.1 | 🔴 CRIT | `src/middleware/tenant.js:30-36` | Tenant is resolved from `req.query.tenant_id` / `req.body.tenant_id` if subdomain/JWT didn’t supply it. After authentication, this lets an authenticated user point at **any** tenant id. | Never accept tenant id from query/body. Tenant must come from the JWT (or verified subdomain). The body fallback is for "admin operations" — gate those behind an explicit super-admin route+middleware. |
| 3.2 | 🔴 CRIT | `src/middleware/tenant.js:14-23` | `req.get('host')` is used to derive tenant. Without a known proxy chain & `trust proxy` correctly set, the `Host` header is attacker-controlled (Host header injection). | Pin `trust proxy` to the exact proxy hop (`app.set('trust proxy', 1)` is set, good). Validate the host against an allowlist before parsing subdomain. |
| 3.3 | 🟠 HIGH | `src/middleware/tenant.js:99-128` | `tenant.db_host`, `tenant.db_port`, `tenant.db_user` are read from the master DB and used to open MySQL connections. If the master DB is ever tampered with (or a bug lets a tenant write its own row), the backend will connect to attacker-controlled MySQL with backend creds → SSRF / credential theft. | Whitelist allowed DB hosts/ports. Reject any value not in the allowlist. Treat tenant-provided DB metadata as untrusted. |
| 3.4 | 🟠 HIGH | `src/middleware/role.js:20-22` | `super_admin` is a global wildcard everywhere. No per-resource ABAC. | OK for now, but document the rule and ensure no super_admin token is ever issued to non-staff. Consider scoped admin roles (read-only ops, support, billing). |
| 3.5 | 🟠 HIGH | repo-wide | Every controller that loads a record by `id` must verify `tenant_id`/`company_id` matches the caller. Audit each `findByPk` / `findOne` to ensure tenant scoping in the `where` clause. | Grep `findByPk(` and review each call site. Add a base repository helper that always injects `tenant_id`. |
| 3.6 | 🟡 MED | `src/middleware/auth.js:57-65` | `req.tenant_id` and `req.company_id` come from the JWT and are also overwritten by `tenant.js`. Two sources of truth. | Single source of truth (JWT-only) with a verification step in `tenant.js`, never an override. |

## 4. Cryptography

| # | Severity | File | Finding | Action |
|---|---|---|---|---|
| 4.1 | 🔴 CRIT | `src/utils/encryption.js:13` | `CryptoJS.AES.encrypt(jsonString, SECRET_KEY)` uses CryptoJS’s passphrase mode → derives key with **MD5-based EVP_BytesToKey** (1 iteration). No integrity (CBC, no MAC). Modern bar: AES-256-GCM with random IV and a properly derived key. | Replace with Node `crypto` AES-256-GCM, random 12-byte IV per message, key from KDF (e.g. HKDF) of the env secret. Encode `iv|tag|ciphertext` in base64. |
| 4.2 | 🟠 HIGH | `src/middleware/tenant.js:201`, `src/services/tenantProvisioningService.js:880-901` | DB-password encryption uses `aes-256-cbc` with `scryptSync(secret, 'salt', 32)`. **Hard-coded salt**, no MAC, CBC + ad-hoc parse-by-`split(':')`. | Move to AES-256-GCM. Use a random per-record salt stored alongside ciphertext, or move the secret to a KMS. |
| 4.3 | 🟠 HIGH | `src/middleware/payloadEncryption.js:51-74` | `encryptResponse` only wraps `res.json`. Anything sent via `res.send`, `res.end`, streaming, file download will bypass encryption. Confirm whether that's intentional. | Document the contract; don’t advertise "responses are encrypted" if some aren’t. |
| 4.4 | 🟡 MED | `src/utils/jwt.js` | Confirm `bcryptjs` cost factor (rounds) is ≥ 12 for password hashing. | Grep `bcrypt.hash`, ensure rounds ≥ 12 (10 is the library default — too low for 2026). |

## 5. Input Validation, Sanitization & Injection

| # | Severity | File | Finding | Action |
|---|---|---|---|---|
| 5.1 | 🟠 HIGH | `src/middleware/sanitize.js:1` | `require('validator')` — but `validator` is **not** a direct dependency in `package.json`; it's only available transitively via `express-validator`. One dependency upgrade can break the entire input pipeline at runtime. | Add `validator` to `dependencies` explicitly, or refactor to use `express-validator` sanitizers per-route. |
| 5.2 | 🟠 HIGH | `src/middleware/sanitize.js:25` | `validator.escape(validator.stripLow(...))` is run on **every string** in body/query/params, indiscriminately. This will HTML-escape data that should not be escaped (e.g. JSON values stored in DB, free-text notes, search queries containing `&`, `<`, `>`). It also doesn’t prevent SQL injection (Sequelize parameterization does). | Move sanitization/validation to per-route validators (`express-validator`) and only escape on output, not on input. Output context (HTML / JSON / SQL) determines the right encoding. |
| 5.3 | 🟠 HIGH | repo-wide | Audit every `sequelize.query(...)` or raw-string concatenation for SQL injection. Audit usages of `Op.literal`, `Sequelize.literal`. | Grep `\.query\(`, `Sequelize\.literal`, `Op\.literal`. |
| 5.4 | 🟠 HIGH | `src/app.js:43-44` | `express.json({ limit: '50mb' })` — 50 MB body limit on every endpoint is a DoS vector. | Set the global limit to a sane default (e.g. 1 MB). For specific upload endpoints, apply a higher limit or use multer streaming. |
| 5.5 | 🟡 MED | `src/validators/` | Only 5 validator files for ~45 controllers. Many endpoints likely have no schema validation. | Add `express-validator` rules per route (or move to Zod/Yup) and reject on invalid. |
| 5.6 | 🟡 MED | `src/app.js:53` | `app.use('/uploads', express.static(uploadDir))` — confirm filenames are sanitized server-side at upload (no `..`, no overwriting, no `*.html`, no executable mime). Confirm content-type/`X-Content-Type-Options` headers. | Inspect `src/config/multer.js` and `fileController.js`. |
| 5.7 | 🟡 MED | repo-wide | NoSQL/Mongo not in use, but Sequelize `where` objects from raw `req.body`/`req.query` can let users inject operators (`{$or: ...}`-style with `Op.*`). | Whitelist allowed filter keys per endpoint. |

## 6. Web / HTTP Hardening

| # | Severity | File | Finding | Action |
|---|---|---|---|---|
| 6.1 | 🟠 HIGH | `src/config/cors.js:62` | `origin.includes(mainDomain)` — **substring match**. If `mainDomain = "fintranzact.com"`, then `https://fintranzact.com.attacker.io` will be allowed. | Replace with strict suffix match: parse `new URL(origin).hostname`, then check `host === mainDomain || host.endsWith('.' + mainDomain)`. |
| 6.2 | 🟠 HIGH | `src/config/cors.js:69-71` | In any non-production `NODE_ENV`, **all origins are allowed**. If `NODE_ENV` is unset on a real environment, this opens CORS to the world. | Default to closed. Use an explicit `ALLOW_ANY_ORIGIN=true` flag for local dev. |
| 6.3 | 🟡 MED | `src/app.js:27-30` | `helmet({ contentSecurityPolicy: false })`. CSP disabled "for API" is fine, but ensure: HSTS on, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy` is appropriate for `/uploads`. | Audit final response headers from a production deployment. |
| 6.4 | 🟡 MED | `src/middleware/errorHandler.js:88-91` | If `NODE_ENV !== 'production'` the stack trace is returned in the response. If `NODE_ENV` is unset, stack traces leak. | Default to production behavior unless `NODE_ENV === 'development'`. |
| 6.5 | 🟡 MED | `src/app.js:21` | `trust proxy: 1` — fine when behind exactly one trusted proxy (Railway/CF). Document this assumption. Behind two layers, IPs in rate limits/audit logs will be wrong. | Document, and parameterize via env. |
| 6.6 | 🟢 LOW | `src/config/cors.js:90` | Methods include `OPTIONS` (good). `exposedHeaders` doesn’t include rate-limit headers — frontend can’t see them. | Optional: expose `RateLimit-*` headers. |

## 7. Database & Sequelize

| # | Severity | File | Finding | Action |
|---|---|---|---|---|
| 7.1 | 🟠 HIGH | `src/config/database.js:21-27` | Pool `max: 3`. For a multi-tenant API serving many concurrent users, this will queue or time out under modest load. | Tune (10–20 per instance is normal for MySQL). Measure under load. |
| 7.2 | 🟠 HIGH | repo-wide | Multi-tenant connection manager opens **per-company connections**. Verify it bounds total open connections (`MAX_TENANT_CONNECTIONS`), evicts idle ones, and closes them on errors — otherwise MySQL `max_connections` will exhaust under tenant churn. | Audit `src/config/tenantConnectionManager.js`. |
| 7.3 | 🟠 HIGH | repo-wide | Confirm that mutations spanning multiple tables (vouchers, ledgers, postings, stock) run inside a single Sequelize transaction with proper isolation and rollback on error. Inventory/accounting operations without transactions cause silent corruption. | Grep `sequelize.transaction(` and audit critical services (`voucherPostingService.js`, `inventoryService.js`, `commissionService.js`). |
| 7.4 | 🟠 HIGH | migrations | Audit migrations for: indexes on every foreign key, `tenant_id`+`company_id` indexes on tenant-scoped tables, `unique` constraints where business logic assumes them, `ON DELETE` rules, charset `utf8mb4`. | Walk `src/migrations/`. |
| 7.5 | 🟡 MED | `package.json:22` | `"db:fresh": "drop-all-tables.js && db:init"` is in the dev dependency scripts. Make sure it cannot be invoked in a production startup hook. | Add an `if (NODE_ENV === 'production') process.exit(1)` guard to `drop-all-tables.js`. |
| 7.6 | 🟡 MED | `server.js:88` | `syncDatabase()` runs at boot. Confirm it is **not** `sequelize.sync({ alter: true })` or `{ force: true }` in production — those modify schemas at startup. | Audit `src/utils/dbSync.js`. Use migrations only in production. |
| 7.7 | 🟡 MED | repo-wide | Confirm soft-delete semantics (`paranoid: true`) for financial records — accounting laws usually require append-only / audit-traceable history. | Check key models. |
| 7.8 | 🟢 LOW | repo-wide | Add a read-only DB user/role for reports if scaling later. | Future. |

## 8. File Uploads

Files: `src/config/multer.js`, `src/controllers/fileController.js`, `/uploads` static route in `src/app.js:53`.

- 🟠 HIGH — Validate MIME *and* file extension *and* magic bytes server-side. Don’t trust `req.file.mimetype`.
- 🟠 HIGH — Strip path components from filenames; generate server-side random filenames; never echo user-supplied filenames in `Content-Disposition` without quoting.
- 🟠 HIGH — Cap file size per route (`limits.fileSize`).
- 🟡 MED — Serve uploads from a separate domain or an S3-backed presigned URL flow rather than from the API origin (avoids cookie/CORS leakage).
- 🟡 MED — AV-scan or at minimum reject `*.html`, `*.svg` (XSS via SVG), `*.exe`, `*.js`.

## 9. Webhooks & Third-party Integrations

| # | Severity | File | Finding | Action |
|---|---|---|---|---|
| 9.1 | 🔴 CRIT | `src/controllers/razorpayWebhookController.js`, `src/routes/subscriptionRoutes.js` | Confirm Razorpay webhook signature is verified using `RAZORPAY_WEBHOOK_SECRET` **before** any DB mutation, and that the raw request body (not the JSON-parsed body) is used for the HMAC. With `express.json()` consuming the body, signature checks silently break. | Mount a raw-body parser on the webhook route only, then verify. |
| 9.2 | 🟠 HIGH | `src/services/eWayBillService.js`, `irpClient.js`, `gstApiService.js`, `finboxService.js` | Outbound API credentials. Confirm they are read from env, not logged on errors, and that retries don’t replay duplicate financial actions (idempotency keys). | Audit each service. |
| 9.3 | 🟠 HIGH | repo-wide | Outbound HTTP via `axios` — set timeouts (default is no timeout) and circuit-breakers. A hung GST/IRP endpoint will pin event-loop slots. | Add `axios.create({ timeout: 10_000 })`. |
| 9.4 | 🟡 MED | repo-wide | Webhook idempotency: store received webhook IDs / signatures in DB or Redis with TTL to ignore replays. | Add a `processed_webhooks` table or Redis SETNX. |

## 10. Logging, Audit & Privacy

| # | Severity | File | Finding | Action |
|---|---|---|---|---|
| 10.1 | 🟠 HIGH | repo-wide | Make sure `logger` never logs request bodies on auth, password change, payment endpoints. Logs commonly leak passwords, OTPs, JWTs, card data. | Add a logger formatter that redacts `password`, `token`, `secret`, `authorization`, `card`, `cvv`. |
| 10.2 | 🟠 HIGH | `src/middleware/audit.js` | Verify there is an immutable audit trail for: login success/failure, role changes, tenant suspension, financial postings, refunds. Audit table should be append-only, with `actor_user_id`, `tenant_id`, IP, UA, timestamp. | Audit the implementation. |
| 10.3 | 🟡 MED | repo-wide | Personal data (email, phone, GSTIN, PAN, TAN) — confirm log lines don’t print these. Add masking helpers. | Code review. |
| 10.4 | 🟡 MED | repo-wide | Define log retention. Don’t keep verbose logs forever (privacy + cost). | Ops runbook. |

## 11. Operational & Process

| # | Severity | Area | Finding | Action |
|---|---|---|---|---|
| 11.1 | 🟠 HIGH | startup | `server.js` continues after master DB init throws a `WebAssembly Out of memory` error (lines 60-70). Continuing in a half-initialized state can cause subtle failures later. | Crash and let the orchestrator (PM2/Railway) restart you. Don’t mask init failures. |
| 11.2 | 🟠 HIGH | reliability | `process.on('unhandledRejection')` (server.js:236-251) tries to “recover” from WASM OOM by ignoring the error. In Node, after `unhandledRejection` the process should be restarted, not continued. | Always exit non-zero on unhandled rejections in production. |
| 11.3 | 🟠 HIGH | secrets mgmt | `.env` is git-ignored — confirm there is no past commit that ever contained a real secret (`git log --all -p | grep -i 'JWT_SECRET\|ENCRYPTION_KEY\|RAZORPAY_KEY_SECRET'`). If yes, rotate. | Run check, rotate if needed. |
| 11.4 | 🟡 MED | CI | Add: `npm audit --production`, `eslint`, `prettier --check`, dependency licence check. There’s a `.github/` folder — verify a CI workflow exists. | Add or harden CI pipeline. |
| 11.5 | 🟡 MED | tests | No `test/` folder is present at the backend root. For a financial app, unit + integration tests on tax calc, voucher posting, ledger balancing are non-negotiable. | Plan a test strategy (Jest + supertest). |
| 11.6 | 🟡 MED | observability | Add request-id correlation, structured JSON logs, latency histograms, error rate, DB pool gauges, Redis health, Bull queue lengths. | Wire to Datadog / Grafana / Railway metrics. |
| 11.7 | 🟢 LOW | docs | The repo has many top-level `.md` docs but no single architecture/runbook for backend ops. | Consolidate into `backend/docs/`. |

## 12. WebSocket / Realtime

- 🟠 HIGH — `src/websocket/socketServer.js:77` re-uses the same `JWT_SECRET` fallback. Same fix as 1.1.
- 🟡 MED — Confirm authentication on every Socket.IO connection (`socket.handshake.auth.token`), enforce tenant scoping on every emitted room, and never broadcast across tenants.

## 13. Cron / Background Jobs

- 🟡 MED — `cronService` runs in-process. With multiple replicas, every job will run N times. Use a leader-election pattern (Redis SETNX with TTL) or move to Bull (already a dep) with a single worker fleet.
- 🟡 MED — Make every job idempotent. Log start/end and emit metrics. On failure, alert.

---

## Recommended fix order (first PR plan)

1. Remove all hardcoded fallbacks for `JWT_SECRET`, `ENCRYPTION_KEY`, `PAYLOAD_ENCRYPTION_KEY`. Fail fast at startup. *(items 1.1–1.3)*
2. Enforce session validation in `auth.js` when Redis is up. *(item 2.1)*
3. Tighten CORS: strict suffix match + closed-by-default in non-production. *(items 6.1–6.2)*
4. Lock tenant resolution to JWT/subdomain only; remove body/query fallback for non-admin routes. *(item 3.1)*
5. Per-route stricter rate limits on `/auth/*` and move limiter store to Redis. *(items 2.4–2.5)*
6. Replace CryptoJS payload encryption with AES-256-GCM via Node `crypto`. *(item 4.1)*
7. Razorpay webhook: raw-body + HMAC verification before any side effect. *(item 9.1)*
8. Reduce `express.json` global limit from 50 MB to 1 MB; raise per-route as needed. *(item 5.4)*
9. Add `validator` as a direct dependency or remove it; rework sanitize middleware. *(items 5.1–5.2)*
10. Audit all `findByPk` for tenant scoping. *(item 3.5)*

---

*Owner: backend team. Update this doc as items are closed; keep it as the living definition of "production-ready" for the backend.*
