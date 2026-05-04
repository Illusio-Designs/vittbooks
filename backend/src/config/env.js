/**
 * Environment validation
 *
 * Loads and validates the required secrets and configuration at boot.
 * The app will refuse to start if anything critical is missing or weak.
 *
 * Why: previously several modules silently fell back to hardcoded
 * placeholder secrets (e.g. "your-secret-key-change-in-production").
 * If the real env var was ever missing in any environment, every issued
 * token / encrypted blob would be forgeable. We fail fast instead.
 */

if (process.env.NODE_ENV !== 'production') {
  // In production, the platform injects env vars directly.
  require('dotenv').config();
}

const isProduction = process.env.NODE_ENV === 'production';

const errors = [];

function require_(name, { minLength = 0 } = {}) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    errors.push(`Missing required environment variable: ${name}`);
    return undefined;
  }
  if (minLength && value.length < minLength) {
    errors.push(
      `Environment variable ${name} is too short (got ${value.length} chars, need at least ${minLength})`
    );
  }
  return value;
}

// Secrets — must always be present, regardless of environment.
const JWT_SECRET = require_('JWT_SECRET', { minLength: 32 });
const ENCRYPTION_KEY = require_('ENCRYPTION_KEY', { minLength: 16 });
const PAYLOAD_ENCRYPTION_KEY = require_('PAYLOAD_ENCRYPTION_KEY', { minLength: 16 });

// Refresh token secret — falls back to JWT_SECRET if not set, but warn.
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

// Database — at least one of the two forms must be configured.
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const hasDbVars = Boolean(process.env.DB_HOST && process.env.DB_USER);
if (!hasDatabaseUrl && !hasDbVars) {
  errors.push(
    'Database is not configured: set DATABASE_URL, or set DB_HOST and DB_USER (and DB_PASSWORD if your DB requires one)'
  );
}

if (errors.length > 0) {
  // Use console.error directly: logger may not be initialized yet at this point.
  console.error('\n[ENV] Configuration error — server will not start:');
  for (const e of errors) console.error('  - ' + e);
  console.error(
    '\nFix the missing variables in your .env (or your platform\'s environment settings) and restart.\n'
  );
  process.exit(1);
}

if (isProduction && !process.env.JWT_REFRESH_SECRET) {
  console.warn(
    '[ENV] JWT_REFRESH_SECRET not set; using JWT_SECRET for refresh tokens. ' +
      'Set a separate JWT_REFRESH_SECRET in production for stronger isolation.'
  );
}

module.exports = {
  isProduction,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  ENCRYPTION_KEY,
  PAYLOAD_ENCRYPTION_KEY,
};
