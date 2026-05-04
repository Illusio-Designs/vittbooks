/**
 * Shared HTTP client for outbound API calls.
 *
 * Why this exists: by default `axios` has NO timeout. A hung remote
 * (GST API, e-invoice IRP, e-way bill, Razorpay, Finbox, etc.) will
 * keep an event-loop slot indefinitely and eventually starve the
 * backend. Routing every outbound call through this client gives us
 * a single place to set sane defaults and add retries / metrics later.
 *
 * Usage:
 *   const http = require('../utils/httpClient');
 *   const res = await http.get('https://api.example.com/...');
 *
 *   // For a service that talks to one host repeatedly:
 *   const finboxHttp = http.create({
 *     baseURL: process.env.FINBOX_BASE_URL,
 *     timeout: 30_000,
 *   });
 */

const axios = require('axios');
const logger = require('./logger');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.HTTP_DEFAULT_TIMEOUT_MS) || 10000;
const DEFAULT_MAX_REDIRECTS = parseInt(process.env.HTTP_DEFAULT_MAX_REDIRECTS) || 5;

function createInstance(overrides = {}) {
  const instance = axios.create({
    timeout: DEFAULT_TIMEOUT_MS,
    maxRedirects: DEFAULT_MAX_REDIRECTS,
    // Respond to non-2xx with a rejection (axios default behaviour, but
    // make it explicit so future config changes don't accidentally
    // swallow errors).
    validateStatus: (status) => status >= 200 && status < 300,
    ...overrides,
  });

  // Light error log — full request/response logging would be too noisy.
  // Service-level callers can add their own interceptors on top.
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const cfg = error.config || {};
      const status = error.response?.status;
      const url = cfg.url;
      const method = (cfg.method || 'GET').toUpperCase();
      if (error.code === 'ECONNABORTED') {
        logger.warn(`HTTP timeout after ${cfg.timeout || DEFAULT_TIMEOUT_MS}ms: ${method} ${url}`);
      } else if (status) {
        logger.warn(`HTTP ${status} from ${method} ${url}`);
      } else {
        logger.warn(`HTTP error on ${method} ${url}: ${error.message}`);
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

const sharedHttp = createInstance();

// Re-export the most useful axios surface so most callers can drop in
// the shared instance with a single-line require swap.
module.exports = sharedHttp;
module.exports.create = createInstance;
module.exports.DEFAULT_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
