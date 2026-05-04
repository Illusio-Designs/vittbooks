/**
 * CORS Configuration
 * Supports environment variables and dynamic domain matching
 */

// Get main domain from environment or default to fintranzact.com
const mainDomain = process.env.MAIN_DOMAIN || process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'fintranzact.com';

// Build allowed origins list from environment variables and defaults
const ALLOWED_ORIGINS = [
  // Environment variable origins
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  // Localhost origins for development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://admin.localhost:3000',
  'http://admin.localhost:3001',
  'http://client.localhost:3000',
  'http://client.localhost:3001',
  // Production origins - main domain
  `https://${mainDomain}`,
  `http://${mainDomain}`,
  `https://www.${mainDomain}`,
  `http://www.${mainDomain}`,
  // Production origins - API subdomain
  `https://api.${mainDomain}`,
  `http://api.${mainDomain}`,
  // Production origins - client subdomain
  `https://client.${mainDomain}`,
  `http://client.${mainDomain}`,
  // Production origins - admin subdomain
  `https://admin.${mainDomain}`,
  `http://admin.${mainDomain}`,
].filter(Boolean); // Remove undefined values

/**
 * Origin validation.
 *
 * Rules (in order):
 *   1. No Origin header → allow (mobile apps, curl, server-to-server).
 *   2. Origin is on the static allowlist → allow.
 *   3. Origin's hostname equals or is a sub-domain of the main domain → allow.
 *   4. Origin is localhost / 127.0.0.1 / 0.0.0.0 / *.localhost → allow.
 *   5. Otherwise → reject (regardless of NODE_ENV).
 *
 * Notes:
 * - We parse the Origin with `new URL(...)` and compare the *hostname* only.
 *   This prevents "evil-mydomain.com.attacker.io"-style substring bypasses.
 * - Non-production no longer auto-allows everything — set CORS_ORIGIN to
 *   add legit dev origins. localhost is always permitted.
 */
function validateOrigin(origin, callback) {
  if (!origin) return callback(null, true);

  let host;
  try {
    host = new URL(origin).hostname;
  } catch (_err) {
    return callback(new Error('Invalid Origin'));
  }

  if (ALLOWED_ORIGINS.includes(origin)) {
    return callback(null, true);
  }

  if (host === mainDomain || host.endsWith('.' + mainDomain)) {
    return callback(null, true);
  }

  const isLocalhost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost');
  if (isLocalhost) {
    return callback(null, true);
  }

  if (process.env.DEBUG_CORS === 'true' || process.env.NODE_ENV !== 'production') {
    console.warn(`[CORS] Rejected origin: ${origin} (host=${host}, mainDomain=${mainDomain})`);
  }
  return callback(new Error('Not allowed by CORS'));
}

/**
 * CORS configuration
 */
const corsConfig = {
  origin: validateOrigin,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Company-Id',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'X-Encrypt-Response'
  ],
  exposedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
};

module.exports = {
  corsConfig,
  validateOrigin,
  ALLOWED_ORIGINS,
};
