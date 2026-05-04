const CryptoJS = require('crypto-js');
const { PAYLOAD_ENCRYPTION_KEY: SECRET_KEY } = require('../config/env');

// NOTE: this AES-CBC-via-passphrase scheme is kept for backwards
// compatibility with the existing frontend. Plan to migrate to
// AES-256-GCM in a coordinated frontend+backend release. The env
// validator in src/config/env.js guarantees SECRET_KEY is present;
// no insecure fallback string here.

/**
 * Encrypt payload
 */
function encryptPayload(data) {
  try {
    const jsonString = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonString, SECRET_KEY).toString();
    return { encrypted: encrypted };
  } catch (error) {
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt payload
 */
function decryptPayload(encryptedData) {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!jsonString) {
      throw new Error('Decryption produced empty result');
    }
    
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error('Decryption failed: ' + error.message);
  }
}

module.exports = {
  encryptPayload,
  decryptPayload,
};
