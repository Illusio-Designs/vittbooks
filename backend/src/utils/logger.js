const winston = require('winston');
const path = require('path');

// Keys whose VALUE we always replace with [REDACTED]. Match is
// case-insensitive and tested against the literal key name. Add to
// this list any field that should never appear in logs.
const REDACT_KEY_PATTERNS = [
  /^password$/i,
  /^password_hash$/i,
  /^new_password$/i,
  /^old_password$/i,
  /password.*hash/i,
  /^token$/i,
  /^access_?token$/i,
  /^refresh_?token$/i,
  /^auth.*token$/i,
  /^id_?token$/i,
  /^secret$/i,
  /secret_?key/i,
  /^api[_-]?key$/i,
  /^client[_-]?secret$/i,
  /^webhook[_-]?secret$/i,
  /^encryption[_-]?key$/i,
  /^authorization$/i,
  /^cookie$/i,
  /^set[_-]?cookie$/i,
  /razorpay[_-]?signature/i,
  /^x[_-]razorpay[_-]signature$/i,
  /^card[_-]?number$/i,
  /^cvv$/i,
  /^cvc$/i,
  /^ssn$/i,
  /^aadhaar$/i,
  /^otp$/i,
];

// Substring patterns to mask inside string VALUES (regardless of key).
// The matched portion is replaced with [REDACTED].
const REDACT_VALUE_REPLACERS = [
  // Bearer tokens: "Bearer eyJ..." (very long opaque blobs)
  { regex: /Bearer\s+[A-Za-z0-9._\-+/=]{20,}/g, replacement: 'Bearer [REDACTED]' },
  // JWTs anywhere in the message: aaa.bbb.ccc with base64url segments.
  { regex: /eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, replacement: '[REDACTED_JWT]' },
];

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

function shouldRedactKey(key) {
  if (!key || typeof key !== 'string') return false;
  return REDACT_KEY_PATTERNS.some((re) => re.test(key));
}

function redactString(s) {
  let out = s;
  for (const r of REDACT_VALUE_REPLACERS) out = out.replace(r.regex, r.replacement);
  return out;
}

function redactValue(value, depth = 0) {
  if (depth > MAX_DEPTH || value == null) return value;
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (shouldRedactKey(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = redactValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

// Winston format that walks every log entry's metadata (and the message
// itself when it's an object/string) and replaces secret-looking values
// before they hit any transport.
const redactFormat = winston.format((info) => {
  if (typeof info.message === 'string') {
    info.message = redactString(info.message);
  } else if (info.message && typeof info.message === 'object') {
    info.message = redactValue(info.message);
  }
  for (const k of Object.keys(info)) {
    if (k === 'level' || k === 'message' || k === 'timestamp' || k === 'service') continue;
    if (shouldRedactKey(k)) info[k] = REDACTED;
    else info[k] = redactValue(info[k]);
  }
  return info;
})();

// Define log format
const logFormat = winston.format.combine(
  redactFormat,
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'fintranzact-backend' },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        redactFormat,
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  );
}

module.exports = logger;
