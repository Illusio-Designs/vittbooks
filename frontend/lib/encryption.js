/**
 * Frontend payload encryption.
 *
 * Mirrors the backend in `backend/src/utils/encryption.js`:
 *
 *   v1 (legacy)  — CryptoJS AES-CBC with the OpenSSL passphrase KDF.
 *                  Wire format: { encrypted: "<CryptoJS-string>" }
 *   v2           — AES-256-GCM with a per-message random 12-byte IV
 *                  and a key derived from PAYLOAD_ENCRYPTION_KEY via
 *                  SHA-256. Authenticated (tampering is detected).
 *                  Wire format:
 *                    { encrypted: { v:2, iv:"<base64>", tag:"<base64>", ct:"<base64>" } }
 *
 * decryptPayload auto-detects the version. encryptPayload defaults to
 * v1 to keep working with older deploys; flip with
 * `NEXT_PUBLIC_PAYLOAD_ENCRYPTION_V2=true` once the backend has the
 * matching support deployed (it does, on this repo).
 *
 * No hardcoded fallback secret. If `NEXT_PUBLIC_PAYLOAD_ENCRYPTION_KEY`
 * is missing at runtime, calling encrypt/decrypt will throw with a
 * clear message.
 */

import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.NEXT_PUBLIC_PAYLOAD_ENCRYPTION_KEY;
const V2_ENABLED = process.env.NEXT_PUBLIC_PAYLOAD_ENCRYPTION_V2 === 'true';

function ensureSecret() {
  if (!SECRET_KEY || typeof SECRET_KEY !== 'string') {
    throw new Error(
      'NEXT_PUBLIC_PAYLOAD_ENCRYPTION_KEY is not configured. Set it in your environment ' +
        'and restart the build (it must match the backend PAYLOAD_ENCRYPTION_KEY).'
    );
  }
}

// --- Base64 helpers (browser-safe, also work in Node 16+) ---
function b64encode(uint8) {
  if (typeof Buffer !== 'undefined') return Buffer.from(uint8).toString('base64');
  let s = '';
  for (let i = 0; i < uint8.byteLength; i++) s += String.fromCharCode(uint8[i]);
  // eslint-disable-next-line no-undef
  return btoa(s);
}
function b64decode(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  // eslint-disable-next-line no-undef
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- v1 (CryptoJS, sync) ---

function encryptV1Sync(data) {
  ensureSecret();
  const jsonString = JSON.stringify(data);
  const ciphertext = CryptoJS.AES.encrypt(jsonString, SECRET_KEY).toString();
  return { encrypted: ciphertext };
}

function decryptV1Sync(stringOrUnknown) {
  ensureSecret();
  const decrypted = CryptoJS.AES.decrypt(stringOrUnknown, SECRET_KEY);
  const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
  if (!jsonString) throw new Error('Decryption produced empty result');
  return JSON.parse(jsonString);
}

// --- v2 (AES-256-GCM via Web Crypto, async) ---

async function deriveV2Key() {
  ensureSecret();
  const subtle = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle)
    || (typeof window !== 'undefined' && window.crypto && window.crypto.subtle);
  if (!subtle) {
    throw new Error('Web Crypto (crypto.subtle) is not available in this environment');
  }
  const enc = new TextEncoder().encode(SECRET_KEY);
  const hash = await subtle.digest('SHA-256', enc);
  return subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptV2(data) {
  const subtle = globalThis.crypto.subtle;
  const key = await deriveV2Key();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(JSON.stringify(data));
  const buf = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc));
  // Web Crypto AES-GCM appends the 16-byte auth tag to the ciphertext.
  // The backend expects them as separate fields so they round-trip cleanly.
  const tag = buf.slice(buf.length - 16);
  const ct = buf.slice(0, buf.length - 16);
  return {
    encrypted: {
      v: 2,
      iv: b64encode(iv),
      tag: b64encode(tag),
      ct: b64encode(ct),
    },
  };
}

async function decryptV2(obj) {
  const subtle = globalThis.crypto.subtle;
  const key = await deriveV2Key();
  const iv = b64decode(obj.iv);
  const tag = b64decode(obj.tag);
  const ct = b64decode(obj.ct);
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct, 0);
  combined.set(tag, ct.length);
  const buf = await subtle.decrypt({ name: 'AES-GCM', iv }, key, combined);
  const json = new TextDecoder().decode(buf);
  return JSON.parse(json);
}

// --- Public async API ---

/**
 * Encrypt payload before sending. Returns `{ encrypted: ... }`.
 * Async because v2 uses Web Crypto.
 */
export async function encryptPayload(data) {
  if (V2_ENABLED) return encryptV2(data);
  return encryptV1Sync(data);
}

/**
 * Decrypt response from server. Auto-detects v1 vs v2.
 */
export async function decryptPayload(encryptedData) {
  if (encryptedData && typeof encryptedData === 'object' && encryptedData.v === 2) {
    return decryptV2(encryptedData);
  }
  return decryptV1Sync(encryptedData);
}

// Legacy synchronous helpers — exposed for any caller that absolutely
// cannot await (you should not need these in new code). Both pin to v1.
export function encryptPayloadSync(data) { return encryptV1Sync(data); }
export function decryptPayloadSync(data) { return decryptV1Sync(data); }
