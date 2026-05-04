const {
  decryptPayload,
  encryptPayload,
  _encryptV1,
  _encryptV2,
} = require('../utils/encryption');
const logger = require('../utils/logger');

/**
 * Middleware to decrypt incoming requests.
 *
 * The wire format is `{ "encrypted": <ciphertext> }`. v1 ciphertext is
 * a CryptoJS string; v2 is an object `{ v: 2, iv, tag, ct }`. We detect
 * which version the client sent and remember it on the request so the
 * response can match.
 */
function decryptRequest(req, res, next) {
  if (req.method === 'OPTIONS') return next();

  try {
    if (req.body && req.body.encrypted) {
      const ciphertext = req.body.encrypted;
      // Remember which scheme the client used so encryptResponse can
      // mirror it. Falls through to "unknown" for malformed payloads;
      // decryptPayload will then throw 400 below.
      req._encryptionVersion =
        ciphertext && typeof ciphertext === 'object' && ciphertext.v === 2 ? 2 : 1;

      req.body = decryptPayload(ciphertext);
      req.isEncrypted = true;
      logger.info('Request decrypted successfully', {
        method: req.method,
        url: req.url,
        version: req._encryptionVersion,
      });
    }
    next();
  } catch (error) {
    logger.error('Decryption failed:', {
      error: error.message,
      method: req.method,
      url: req.url,
    });
    return res.status(400).json({ success: false, error: 'Invalid encrypted payload' });
  }
}

/**
 * Middleware to encrypt outgoing responses.
 *
 * Version selection (in order):
 *   1. If the request was encrypted, mirror its version (v1 in / v1 out,
 *      v2 in / v2 out). This is what the frontend expects.
 *   2. Else if the caller asked for an explicit version via
 *      `X-Encrypt-Response: v2` (or `true` for default), use that.
 *   3. Else if PAYLOAD_ENCRYPTION_V2=true, default to v2.
 *   4. Else v1.
 */
function encryptResponse(req, res, next) {
  if (req.method === 'OPTIONS') return next();

  const originalJson = res.json.bind(res);
  res.json = function (data) {
    const xEnc = (req.headers['x-encrypt-response'] || '').toString().toLowerCase();
    const wantsEncrypted = req.isEncrypted || xEnc === 'true' || xEnc === 'v1' || xEnc === 'v2';

    if (!wantsEncrypted) return originalJson(data);

    try {
      let payload;
      if (req._encryptionVersion === 2 || xEnc === 'v2') {
        payload = _encryptV2(data);
      } else if (req._encryptionVersion === 1 || xEnc === 'v1') {
        payload = _encryptV1(data);
      } else {
        payload = encryptPayload(data); // env-flag default
      }
      logger.info('Response encrypted successfully', {
        method: req.method,
        url: req.url,
        version: payload.encrypted && payload.encrypted.v === 2 ? 2 : 1,
      });
      return originalJson(payload);
    } catch (error) {
      logger.error('Response encryption failed:', {
        error: error.message,
        method: req.method,
        url: req.url,
      });
      // Fall back to unencrypted response so the client still gets
      // something rather than a hung request.
      return originalJson(data);
    }
  };

  next();
}

module.exports = {
  decryptRequest,
  encryptResponse,
};
