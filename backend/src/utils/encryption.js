const CryptoJS = require('crypto-js');
const crypto = require('crypto');
const { PAYLOAD_ENCRYPTION_KEY: SECRET_KEY } = require('../config/env');

// We support TWO payload-encryption schemes side-by-side so the
// frontend can be migrated independently:
//
//   v1 (legacy)  — CryptoJS AES-CBC with the OpenSSL passphrase KDF
//                  (MD5-based EVP_BytesToKey, 1 iteration, no MAC).
//                  This is what the current frontend ships.
//   v2           — AES-256-GCM with a per-message 12-byte random IV
//                  and a key derived from SECRET_KEY via SHA-256.
//                  Authenticated encryption: tampering is detected.
//
// decryptPayload() auto-detects v2 (looks like {"v":2,"iv":"...",
// "tag":"...","ct":"..."}) and falls back to v1 otherwise.
//
// encryptPayload() picks the scheme based on the PAYLOAD_ENCRYPTION_V2
// env flag — defaulting to v1 so this change is backwards compatible
// without frontend coordination. Set PAYLOAD_ENCRYPTION_V2=true once
// the frontend can produce/consume v2 ciphertexts.

const V2_ENABLED = process.env.PAYLOAD_ENCRYPTION_V2 === 'true';

function deriveV2Key(secret) {
  // 32 bytes for AES-256. SHA-256 of the env secret is deterministic,
  // server-side only, and avoids any key-rotation surprises that scrypt
  // with random salt would introduce for a shared symmetric scheme.
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function encryptV1(data) {
  const jsonString = JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(jsonString, SECRET_KEY).toString();
  return { encrypted };
}

function encryptV2(data) {
  const jsonString = JSON.stringify(data);
  const key = deriveV2Key(SECRET_KEY);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(jsonString, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: {
      v: 2,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ct: ct.toString('base64'),
    },
  };
}

function decryptV1(stringOrUnknown) {
  const decrypted = CryptoJS.AES.decrypt(stringOrUnknown, SECRET_KEY);
  const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
  if (!jsonString) throw new Error('Decryption produced empty result');
  return JSON.parse(jsonString);
}

function decryptV2(obj) {
  const key = deriveV2Key(SECRET_KEY);
  const iv = Buffer.from(obj.iv, 'base64');
  const tag = Buffer.from(obj.tag, 'base64');
  const ct = Buffer.from(obj.ct, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

function encryptPayload(data) {
  try {
    return V2_ENABLED ? encryptV2(data) : encryptV1(data);
  } catch (_err) {
    throw new Error('Encryption failed');
  }
}

function decryptPayload(encryptedData) {
  try {
    // v2 is an object: { v: 2, iv, tag, ct }
    if (encryptedData && typeof encryptedData === 'object' && encryptedData.v === 2) {
      return decryptV2(encryptedData);
    }
    // v1 is the CryptoJS string ciphertext.
    return decryptV1(encryptedData);
  } catch (error) {
    throw new Error('Decryption failed: ' + error.message);
  }
}

module.exports = {
  encryptPayload,
  decryptPayload,
  // Exported for tests / migration tooling. Don't import these in
  // production code paths — go through encrypt/decryptPayload above.
  _encryptV1: encryptV1,
  _encryptV2: encryptV2,
  _decryptV1: decryptV1,
  _decryptV2: decryptV2,
};
