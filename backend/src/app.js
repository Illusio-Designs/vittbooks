
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const passport = require('passport');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const sanitizeInput = require('./middleware/sanitize');
const { uploadDir } = require('./config/multer');
const { decryptRequest, encryptResponse } = require('./middleware/payloadEncryption');
const { corsConfig, validateOrigin } = require('./config/cors');
const redisClient = require('./config/redis');
const logger = require('./utils/logger');

// Initialize passport configuration
require('./config/passport');

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// CORS configuration - must be before other middleware
app.use(cors(corsConfig));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable CSP for API
}));

// Rate limiting — backed by Redis when available so that multiple backend
// instances behind a load balancer share a single counter. Falls back to
// the express-rate-limit default in-memory store if Redis is offline.
function buildRateLimitStore(prefix) {
  if (!redisClient || !redisClient.isConnected || !redisClient.isConnected()) {
    return undefined; // use the library's in-memory MemoryStore
  }
  try {
    const { RedisStore } = require('rate-limit-redis');
    return new RedisStore({
      // Adapter: rate-limit-redis expects a function that runs raw commands
      // against the Redis client. node-redis v4 exposes sendCommand().
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix,
    });
  } catch (err) {
    logger.warn(`[rate-limit] Falling back to in-memory store (${err.message})`);
    return undefined;
  }
}

// Global (light) limiter — slows obvious abuse.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRateLimitStore('rl:global:'),
});
app.use(limiter);

// Tighter limiter on authentication endpoints — blunts credential stuffing
// and brute force. Login + register + refresh + password reset share the bucket.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  message: 'Too many authentication attempts. Please wait a few minutes and try again.',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRateLimitStore('rl:auth:'),
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Body parsing middleware. Default to a small limit; specific upload routes
// use multer (which streams) so this does not affect file uploads.
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '1mb';

// IMPORTANT: webhooks need the *raw* request body so that HMAC signatures
// can be verified byte-for-byte. JSON.stringify(req.body) does not preserve
// key order or whitespace and therefore breaks signature checks. We register
// a verify hook that snapshots the raw bytes onto req.rawBody for these paths.
const RAW_BODY_PATHS = ['/api/subscriptions/webhook'];
app.use(
  express.json({
    limit: JSON_BODY_LIMIT,
    verify: (req, _res, buf) => {
      if (RAW_BODY_PATHS.includes(req.originalUrl) || RAW_BODY_PATHS.includes(req.path)) {
        req.rawBody = Buffer.from(buf);
      }
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

// Initialize Passport
app.use(passport.initialize());

// Input sanitization
app.use(sanitizeInput);

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadDir));

// Payload encryption/decryption middleware (optional)
app.use(decryptRequest);
app.use(encryptResponse);

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler for undefined routes
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
