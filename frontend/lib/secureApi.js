import { encryptPayload, decryptPayload } from './encryption';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finvera.illusiodesigns.agency/api';

/**
 * Internal helper — turn the data into a JSON string, encrypting it
 * first when `encrypt` is true. Encryption is async (v2 uses Web
 * Crypto), so the whole pipeline returns a Promise.
 */
async function buildBody(data, encrypt) {
  if (!encrypt) return JSON.stringify(data);
  const wrapper = await encryptPayload(data);
  return JSON.stringify(wrapper);
}

async function maybeDecrypt(result) {
  if (result && result.encrypted) return decryptPayload(result.encrypted);
  return result;
}

function authHeaders(token, encryptResponse) {
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(encryptResponse && { 'X-Encrypt-Response': 'true' }),
  };
}

async function readError(response) {
  const fallback = { error: `Request failed with status ${response.status}` };
  const data = await response.json().catch(() => fallback);
  const err = new Error(data.error || data.message || fallback.error);
  err.status = response.status;
  err.body = data;
  return err;
}

/**
 * Secure API client with automatic encryption/decryption.
 *
 * Encryption is async (Web Crypto / AES-GCM in v2 mode), so every
 * method here returns a Promise. Auth context — Bearer token, the
 * X-Encrypt-Response header — is injected automatically.
 */
export const secureAPI = {
  async post(endpoint, data, options = {}) {
    const { token, encrypt = true } = options;
    const body = await buildBody(data, encrypt);
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: authHeaders(token, encrypt),
      body,
    });
    if (!response.ok) throw await readError(response);
    return maybeDecrypt(await response.json());
  },

  async get(endpoint, options = {}) {
    const { token, encrypt = false } = options;
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers: authHeaders(token, encrypt),
    });
    if (!response.ok) throw await readError(response);
    return maybeDecrypt(await response.json());
  },

  async put(endpoint, data, options = {}) {
    const { token, encrypt = true } = options;
    const body = await buildBody(data, encrypt);
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: authHeaders(token, encrypt),
      body,
    });
    if (!response.ok) throw await readError(response);
    return maybeDecrypt(await response.json());
  },

  async delete(endpoint, options = {}) {
    const { token } = options;
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: authHeaders(token, false),
    });
    if (!response.ok) throw await readError(response);
    return maybeDecrypt(await response.json());
  },
};

/**
 * Regular API without encryption (for non-sensitive endpoints).
 * Same interface as secureAPI but `encrypt` is forced off.
 */
export const regularAPI = {
  post: (endpoint, data, token) => secureAPI.post(endpoint, data, { token, encrypt: false }),
  get:  (endpoint, token) => secureAPI.get(endpoint, { token, encrypt: false }),
  put:  (endpoint, data, token) => secureAPI.put(endpoint, data, { token, encrypt: false }),
  delete: (endpoint, token) => secureAPI.delete(endpoint, { token }),
};
