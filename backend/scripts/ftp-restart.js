// Touches <FTP_BASE_DIR>/tmp/restart.txt on the FTP server so Phusion
// Passenger (cPanel's Node runtime) recycles the app on the next request.
//
// Used by .github/workflows/backend-deploy-ftp.yml right after the FTP
// sync step. Can also be run locally for manual restarts:
//
//   FTP_HOST=ftp.example.com \
//   FTP_USER=cpaneluser \
//   FTP_PASSWORD=*** \
//   FTP_BASE_DIR=/Backend/ \
//   node scripts/ftp-restart.js
//
// Dependencies: basic-ftp, dotenv. The CI installs them transiently
// with `npm install --no-save` so they don't pollute package.json.

const path = require('path');
const { Readable } = require('stream');

try {
  require('dotenv').config();
} catch {
  // dotenv is optional - CI sets env vars directly.
}

const ftp = require('basic-ftp');

const {
  FTP_HOST,
  FTP_PORT = '21',
  FTP_USER,
  FTP_PASSWORD,
  FTP_SECURE = 'explicit', // 'explicit' = FTPS over port 21
  FTP_BASE_DIR = '/Backend/',
} = process.env;

if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
  console.error('Missing FTP_HOST / FTP_USER / FTP_PASSWORD env vars.');
  process.exit(1);
}

const secure =
  FTP_SECURE === 'true' || FTP_SECURE === 'explicit'
    ? true
    : FTP_SECURE === 'implicit'
    ? 'implicit'
    : false;

const remotePath = path.posix.join(FTP_BASE_DIR.replace(/\\/g, '/'), 'tmp', 'restart.txt');

(async () => {
  const client = new ftp.Client(30_000);
  client.ftp.verbose = false;
  try {
    await client.access({
      host: FTP_HOST,
      port: Number(FTP_PORT),
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure,
      secureOptions: { rejectUnauthorized: false },
    });

    // Ensure tmp/ exists (no-op if already there).
    const tmpDir = path.posix.dirname(remotePath);
    try {
      await client.ensureDir(tmpDir);
    } catch (e) {
      console.warn(`ensureDir(${tmpDir}) warned:`, e.message);
    }
    // ensureDir leaves us inside tmpDir on some servers - reset.
    await client.cd('/');

    const body = Buffer.from(`restart ${new Date().toISOString()}\n`);
    await client.uploadFrom(Readable.from([body]), remotePath);
    console.log(`Touched ${remotePath} - Passenger will recycle on next request.`);
  } catch (err) {
    console.error('FTP restart failed:', err.message);
    process.exit(2);
  } finally {
    client.close();
  }
})();
