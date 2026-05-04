/**
 * Lightweight file-type sniffing by magic bytes.
 *
 * Browsers (and `req.file.mimetype`) report whatever the client says.
 * For high-trust uploads — DSC certificates, signed invoices, anything
 * we render or pass to subprocesses — we sniff the actual file bytes
 * and compare to known signatures. This catches a malicious .html file
 * renamed to "logo.png", an executable hidden as a PDF, etc.
 *
 * Usage:
 *   const { detectMime, assertAllowedMime } = require('../utils/fileMagic');
 *
 *   // Inside a multer handler, after multer has written the file:
 *   const real = await detectMime(req.file.path);
 *   assertAllowedMime(real, ['image/png', 'image/jpeg']);
 */

const fs = require('fs');
const fsp = fs.promises;

const SIGNATURES = [
  // [mime, [byteOffset, hexBytesPrefix], ...optional more checks]
  { mime: 'image/jpeg', tests: [{ offset: 0, prefix: 'FFD8FF' }] },
  { mime: 'image/png',  tests: [{ offset: 0, prefix: '89504E470D0A1A0A' }] },
  { mime: 'image/gif',  tests: [{ offset: 0, prefix: '474946383761' }] },
  { mime: 'image/gif',  tests: [{ offset: 0, prefix: '474946383961' }] },
  { mime: 'image/webp', tests: [{ offset: 0, prefix: '52494646' }, { offset: 8, prefix: '57454250' }] },
  { mime: 'image/bmp',  tests: [{ offset: 0, prefix: '424D' }] },
  { mime: 'application/pdf', tests: [{ offset: 0, prefix: '25504446' }] }, // %PDF
  // ZIP-container family — Office (xlsx/docx) and plain ZIP all share PK\x03\x04
  { mime: 'application/zip', tests: [{ offset: 0, prefix: '504B0304' }] },
  // XML / Tally exports — simple text sniffing
  { mime: 'application/xml', tests: [{ offset: 0, prefix: '3C3F786D6C' }] }, // <?xml
  // PFX / PKCS#12 (DSC certificates) — DER, no fixed magic, fall back to extension
  // PEM cert — text starting with -----BEGIN
  { mime: 'application/x-pem-file', tests: [{ offset: 0, prefix: '2D2D2D2D2D424547494E' }] }, // -----BEGIN
];

const MAX_HEAD_BYTES = 64;

async function readHead(path) {
  const fh = await fsp.open(path, 'r');
  try {
    const buf = Buffer.alloc(MAX_HEAD_BYTES);
    const { bytesRead } = await fh.read(buf, 0, MAX_HEAD_BYTES, 0);
    return buf.slice(0, bytesRead);
  } finally {
    await fh.close();
  }
}

function matches(buf, tests) {
  return tests.every(({ offset, prefix }) => {
    const want = Buffer.from(prefix, 'hex');
    if (buf.length < offset + want.length) return false;
    return buf.slice(offset, offset + want.length).equals(want);
  });
}

/**
 * Detect MIME type by reading the file's first bytes.
 * Returns null when no known signature matches.
 */
async function detectMime(filePath) {
  let buf;
  try {
    buf = await readHead(filePath);
  } catch (_e) {
    return null;
  }
  for (const sig of SIGNATURES) {
    if (matches(buf, sig.tests)) return sig.mime;
  }
  // CSV / plain text has no magic — caller should rely on extension.
  return null;
}

/**
 * Throw a 400-status Error if the file's actual MIME isn't in the
 * allow list. Set `allowExtensionFallback` for file types that have no
 * stable magic bytes (CSV, plain text, raw certs).
 */
async function assertAllowedMime(filePath, allowedMimes, { allowExtensionFallback = false } = {}) {
  const detected = await detectMime(filePath);
  if (detected && allowedMimes.includes(detected)) return detected;
  if (allowExtensionFallback) return null;
  const err = new Error(
    `Uploaded file content does not match an allowed type` +
      (detected ? ` (detected: ${detected})` : ' (no recognised magic bytes)')
  );
  err.statusCode = 400;
  throw err;
}

module.exports = { detectMime, assertAllowedMime };
