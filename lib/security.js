'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

let KEY = null;

// The server key encrypts sensor-cloud passwords and API secrets at rest.
// Set SECRET_KEY (64 hex chars) in production; otherwise one is generated in the data folder.
function initKey(dataDir) {
  let hex = process.env.SECRET_KEY;
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'secret.key');
  if (!hex) {
    if (fs.existsSync(file)) hex = fs.readFileSync(file, 'utf8').trim();
    else {
      hex = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(file, hex, { mode: 0o600 });
    }
  }
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('SECRET_KEY must be 64 hex characters');
  KEY = Buffer.from(hex, 'hex');
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
}
function decrypt(blob) {
  const [iv, tag, enc] = blob.split('.').map(s => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

// Passwords: scrypt with a per-user salt.
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${h.toString('base64')}`;
}
function verifyPassword(pw, stored) {
  const [alg, s, h] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const want = Buffer.from(h, 'base64');
  const got = crypto.scryptSync(pw, Buffer.from(s, 'base64'), want.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(want, got);
}

const sha1 = s => crypto.createHash('sha1').update(String(s)).digest('hex');
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const sha512 = s => crypto.createHash('sha512').update(String(s)).digest('hex');
const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');

// Human-friendly API secret for uploaders (Nightscout requires at least 12 characters).
function newApiSecret() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(16);
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}

// Simple in-memory rate limiter (per key, sliding window).
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now);
  buckets.set(key, arr);
  return arr.length <= max;
}
setInterval(() => { const now = Date.now(); for (const [k, a] of buckets) if (!a.some(t => now - t < 3600e3)) buckets.delete(k); }, 600e3).unref();

const _resetRateLimits = () => buckets.clear();   // tests only
module.exports = { initKey, encrypt, decrypt, hashPassword, verifyPassword, sha1, sha256, sha512, randomToken, newApiSecret, rateLimit, _resetRateLimits };
