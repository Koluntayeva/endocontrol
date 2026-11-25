'use strict';
// EndoControl — a lightweight, multi-user, Nightscout-compatible glucose platform.
// Requires Node.js 22.5+ (uses the built-in node:sqlite). The only npm dependency,
// @anthropic-ai/sdk, is optional: it powers the AI analyst when ANTHROPIC_API_KEY is set.

process.removeAllListeners('warning');
process.on('warning', w => { if (w.name !== 'ExperimentalWarning') console.warn(w); });

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

// Settings such as ANTHROPIC_API_KEY can live in a .env file next to server.js (never committed).
// Variables already set in the environment win.
try { if (fs.existsSync(path.join(__dirname, '.env'))) process.loadEnvFile(path.join(__dirname, '.env')); }
catch (e) { console.warn('.env could not be read:', e.message); }

const dbm = require('./lib/db');
const sec = require('./lib/security');
const ns = require('./lib/nsdata');
const bridges = require('./lib/bridges');
const { parseCsv } = require('./lib/csvimport');
const ai = require('./lib/ai');
const push = require('./lib/push');
const openfood = require('./lib/openfood');

const PORT = Number(process.env.PORT || 1337);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const APP_NAME = process.env.APP_NAME || 'EndoControl';
const VERSION = require('./package.json').version;
const SESSION_DAYS = 30;
const PUBLIC_DIR = path.join(__dirname, 'public');

sec.initKey(DATA_DIR);
const db = dbm.open(DATA_DIR);
// Web Push (glucose alerts with the app closed). The subject is how push services reach the operator.
push.init(DATA_DIR, process.env.VAPID_SUBJECT || (/^https:/.test(PUBLIC_URL) ? PUBLIC_URL : 'mailto:admin@localhost'));

// ------------------------------------------------------------------ helpers
class HttpError extends Error { constructor(status, code, msg) { super(msg || code); this.status = status; this.code = code; } }
const bad = (code, msg) => new HttpError(400, code, msg);

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const payload = isBuf || typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': isBuf || typeof body === 'string' ? (headers['Content-Type'] || 'text/plain; charset=utf-8') : 'application/json; charset=utf-8', ...headers });
  res.end(payload);
}

function readBody(req, limit = 5e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new HttpError(413, 'too_large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
async function jsonBody(req, limit) {
  const raw = await readBody(req, limit);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw bad('bad_json'); }
}
function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
const isHttps = req => req.headers['x-forwarded-proto'] === 'https' || !!req.socket.encrypted;
function baseUrl(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  return `${isHttps(req) ? 'https' : 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}
const clientIp = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

// ------------------------------------------------------------------ sessions
function createSession(res, req, userId) {
  const token = sec.randomToken(32);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)').run(sec.sha256(token), userId, Date.now() + SESSION_DAYS * 864e5);
  res.setHeader('Set-Cookie', `ec_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${isHttps(req) ? '; Secure' : ''}`);
}
function sessionUser(req) {
  const t = cookies(req).ec_session;
  if (!t) return null;
  const row = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').get(sec.sha256(t), Date.now());
  return row || null;
}
setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()), 3600e3).unref();

// ------------------------------------------------------------------ Nightscout-style auth
// api-secret header / ?secret= (SHA-1 hex of the user's API secret, as Nightscout uploaders send it) -> read+write
// ?token= / Authorization: Bearer <share token> -> read only
function nsAuth(req, url, body) {
  let secret = req.headers['api-secret'] || url.searchParams.get('secret');
  if (!secret && body) {
    if (Array.isArray(body) && body[0] && body[0].secret) secret = body[0].secret;
    else if (body.secret) secret = body.secret;
  }
  if (secret) {
    secret = String(secret).trim();
    const hash = /^[0-9a-f]{40}$/i.test(secret) ? secret.toLowerCase() : sec.sha1(secret); // also accept the plain secret
    const u = db.prepare('SELECT * FROM users WHERE api_secret_sha1 = ?').get(hash);
    if (u) return { user: u, write: true };
  }
  let token = url.searchParams.get('token');
  const authz = String(req.headers.authorization || '');
  if (!token && authz.startsWith('Bearer ')) token = authz.slice(7).trim();
  if (!token && body && !Array.isArray(body) && body.token) token = body.token;
  if (token) {
    const s = shareByToken(token);
    if (s) return { user: db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id), write: false };
  }
  return null;
}
function shareByToken(token) {
  const s = db.prepare('SELECT * FROM shares WHERE token = ? AND revoked = 0').get(String(token));
  if (!s || (s.expires_at && s.expires_at < Date.now())) return null;
  return s;
}

// ------------------------------------------------------------------ validation
const LANGS = ['en', 'zh', 'es', 'ar', 'pt', 'id', 'fr', 'ja', 'ru', 'de', 'kk', 'tr', 'hi', 'ko'];
const emailOk = e => typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const str = (v, max = 200) => typeof v === 'string' ? v.trim().slice(0, max) : '';
function checkPassword(p) {
  if (typeof p !== 'string' || p.length < 8 || p.length > 200) throw bad('weak_password');
  if (!/[A-Za-z\p{L}]/u.test(p) || !/\d/.test(p)) throw bad('weak_password');
}
function publicUser(u, req) {
  const secret = sec.decrypt(u.api_secret_enc);
  const base = baseUrl(req);
  const host = base.replace(/^https?:\/\//, '');
  return {
    id: u.id, email: u.email, name: u.name, role: u.role, patient_name: u.patient_name, birth_year: u.birth_year, diabetes_type: u.diabetes_type,
    lang: u.lang, units: u.units, target_low: u.target_low, target_high: u.target_high, created_at: u.created_at,
    upload: {
      base_url: base, api_secret: secret,
      xdrip_url: `${base.startsWith('https') ? 'https' : 'http'}://${secret}@${host}/api/v1/`,
    },
  };
}

// ------------------------------------------------------------------ app (web UI) API
const routes = [];
const route = (method, pattern, handler, opts = {}) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, opts });

function requireUser(ctx) { if (!ctx.user) throw new HttpError(401, 'unauthorized'); return ctx.user; }

// Which patient's data may this request read? own account, a share token, or (for doctors) a saved share.
function subjectFor(ctx) {
  const token = ctx.url.searchParams.get('share');
  if (token) {
    const s = shareByToken(token);
    if (!s) throw new HttpError(404, 'share_not_found');
    return { userId: s.user_id, write: false, share: s };
  }
  const u = requireUser(ctx);
  return { userId: u.id, write: true };
}

route('POST', '/app/register', async ctx => {
  const b = await jsonBody(ctx.req);
  if (!sec.rateLimit('reg:' + clientIp(ctx.req), 10, 3600e3)) throw new HttpError(429, 'rate_limited');
  const email = str(b.email).toLowerCase();
  if (!emailOk(email)) throw bad('bad_email');
  checkPassword(b.password);
  const name = str(b.name, 100); if (!name) throw bad('name_required');
  if (!b.consent) throw bad('consent_required');
  const role = b.role === 'doctor' ? 'doctor' : 'patient';
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw new HttpError(409, 'email_taken');
  const secret = sec.newApiSecret();
  const lang = LANGS.includes(b.lang) ? b.lang : 'en';
  const units = b.units === 'mmol' ? 'mmol' : 'mg/dl';
  const r = db.prepare(`INSERT INTO users (email, pass_hash, name, role, patient_name, birth_year, diabetes_type, lang, units, timezone, api_secret_enc, api_secret_sha1, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(email, sec.hashPassword(b.password), name, role, str(b.patient_name, 100) || null,
    Number.isInteger(b.birth_year) && b.birth_year > 1900 && b.birth_year <= new Date().getFullYear() ? b.birth_year : null,
    ['t1', 't2', 'gestational', 'other'].includes(b.diabetes_type) ? b.diabetes_type : null, lang, units, str(b.timezone, 60) || null,
    sec.encrypt(secret), sec.sha1(secret), new Date().toISOString());
  createSession(ctx.res, ctx.req, Number(r.lastInsertRowid));
  return { ok: true };
});

route('POST', '/app/login', async ctx => {
  const b = await jsonBody(ctx.req);
  const email = str(b.email).toLowerCase();
  if (!sec.rateLimit('login:' + clientIp(ctx.req), 30, 900e3) || !sec.rateLimit('login:' + email, 10, 900e3)) throw new HttpError(429, 'rate_limited');
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!u || !sec.verifyPassword(String(b.password || ''), u.pass_hash)) throw new HttpError(401, 'bad_credentials');
  createSession(ctx.res, ctx.req, u.id);
  return { ok: true };
});

route('POST', '/app/logout', async ctx => {
  const t = cookies(ctx.req).ec_session;
  if (t) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sec.sha256(t));
  ctx.res.setHeader('Set-Cookie', 'ec_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return { ok: true };
});

route('GET', '/app/me', async ctx => {
  const u = requireUser(ctx);
  const br = db.prepare('SELECT kind, status, last_error, last_poll, last_data FROM bridges WHERE user_id=?').all(u.id);
  const last = db.prepare('SELECT date, sgv, direction, device, source FROM entries WHERE user_id=? AND type=\'sgv\' ORDER BY date DESC LIMIT 1').get(u.id);
  const count = db.prepare('SELECT COUNT(*) n, MIN(date) first FROM entries WHERE user_id=?').get(u.id);
  return { user: publicUser(u, ctx.req), bridges: br, last: last || null, stored: count.n, first: count.first, app: { name: APP_NAME, version: VERSION } };
});

route('PUT', '/app/me', async ctx => {
  const u = requireUser(ctx); const b = await jsonBody(ctx.req);
  const lo = Number(b.target_low), hi = Number(b.target_high);
  db.prepare(`UPDATE users SET name=?, patient_name=?, lang=?, units=?, target_low=?, target_high=?, birth_year=?, diabetes_type=? WHERE id=?`).run(
    str(b.name, 100) || u.name, b.patient_name !== undefined ? (str(b.patient_name, 100) || null) : u.patient_name,
    LANGS.includes(b.lang) ? b.lang : u.lang, b.units === 'mmol' || b.units === 'mg/dl' ? b.units : u.units,
    lo >= 50 && lo <= 120 ? Math.round(lo) : u.target_low, hi >= 120 && hi <= 300 && hi > lo ? Math.round(hi) : u.target_high,
    Number.isInteger(b.birth_year) ? b.birth_year : u.birth_year, ['t1', 't2', 'gestational', 'other'].includes(b.diabetes_type) ? b.diabetes_type : u.diabetes_type, u.id);
  return { ok: true };
});

route('POST', '/app/me/password', async ctx => {
  const u = requireUser(ctx); const b = await jsonBody(ctx.req);
  if (!sec.verifyPassword(String(b.current || ''), u.pass_hash)) throw new HttpError(401, 'bad_credentials');
  checkPassword(b.password);
  db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(sec.hashPassword(b.password), u.id);
  return { ok: true };
});

route('POST', '/app/me/rotate-secret', async ctx => {
  const u = requireUser(ctx);
  const secret = sec.newApiSecret();
  db.prepare('UPDATE users SET api_secret_enc=?, api_secret_sha1=? WHERE id=?').run(sec.encrypt(secret), sec.sha1(secret), u.id);
  return { ok: true };
});

route('POST', '/app/me/delete', async ctx => {
  const u = requireUser(ctx); const b = await jsonBody(ctx.req);
  if (!sec.verifyPassword(String(b.password || ''), u.pass_hash)) throw new HttpError(401, 'bad_credentials');
  db.prepare('DELETE FROM users WHERE id=?').run(u.id);
  ctx.res.setHeader('Set-Cookie', 'ec_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return { ok: true };
});

// Data export (portability): CSV of all glucose values
route('GET', '/app/export.csv', async ctx => {
  const u = requireUser(ctx);
  const rows = db.prepare('SELECT date, sgv, direction, device, source FROM entries WHERE user_id=? AND type=\'sgv\' ORDER BY date').all(u.id);
  const csv = 'timestamp_utc,glucose_mg_dl,glucose_mmol_l,direction,device,source\n' +
    rows.map(r => [new Date(r.date).toISOString(), r.sgv, (r.sgv / 18.0182).toFixed(1), r.direction || '', JSON.stringify(r.device || ''), r.source || ''].join(',')).join('\n');
  return { raw: csv, type: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="glucose-export.csv"' } };
});

// Glucose + diary for charts (own data, or via ?share=token)
route('GET', '/app/data', async ctx => {
  const s = subjectFor(ctx);
  const to = Number(ctx.url.searchParams.get('to')) || Date.now() + 60e3;
  const from = Math.max(Number(ctx.url.searchParams.get('from')) || to - 864e5, to - 120 * 864e5);
  const e = ns.entriesRange(db, s.userId, from, to);
  const t = db.prepare('SELECT * FROM treatments WHERE user_id=? AND created_at>=? AND created_at<? ORDER BY created_at').all(s.userId, from, to).map(ns.formatTreatment);
  // Meals and boluses get the sensor glucose at that moment and 2 hours later, filled in automatically.
  const meals = t.filter(x => x.carbs > 0 || (x.insulin > 0 && !/basal/i.test(x.eventType)));
  if (meals.length) {
    const around = ns.entriesRange(db, s.userId, meals[0].mills - 15 * 60e3, meals[meals.length - 1].mills + 2.25 * 3600e3);
    const nearest = (ms, tol) => { let best = null; for (const x of around) { const d = Math.abs(x.date - ms); if (d <= tol && (!best || d < Math.abs(best.date - ms))) best = x; } return best; };
    for (const x of meals) {
      const a = nearest(x.mills, 15 * 60e3), b2 = nearest(x.mills + 2 * 3600e3, 10 * 60e3);
      if (a) x.bgAt = a.sgv;
      if (b2) x.bg2h = b2.sgv;
    }
  }
  const u = db.prepare('SELECT name, patient_name, birth_year, diabetes_type, units, target_low, target_high FROM users WHERE id=?').get(s.userId);
  return { from, to, entries: e.map(x => [x.date, x.sgv, x.direction || null]), treatments: t, patient: u, readOnly: !s.write };
});

// ---- AI analyst (Claude). Off without an API key: the client then shows its rule-based analysis.
route('GET', '/app/ai', async ctx => { requireUser(ctx); return { enabled: ai.enabled() }; });

const aiRoute = async ctx => {
  const u = requireUser(ctx);
  const s = subjectFor(ctx);
  const b = await jsonBody(ctx.req, 1e5);
  const question = str(b.question, 2000);
  if (!question) throw bad('empty_question');
  if (!ai.enabled()) return { mode: 'off' };
  if (!ai.allow(u.id)) throw new HttpError(429, 'ai_limit');
  try {
    return { mode: 'ai', ...(await ai.ask(db, ns, s.userId, { question, history: b.history, lang: str(b.lang, 16), tz: str(b.tz, 64) })) };
  } catch (e) {
    const [status, code] = ai.errorCode(e);
    console.error('AI:', e && e.message);
    throw new HttpError(status, code);
  }
};
route('POST', '/app/ai', aiRoute);

// ---- Web Push subscriptions
route('GET', '/app/push/key', async ctx => { requireUser(ctx); return { enabled: push.enabled(), key: push.publicKey() || null }; });
route('POST', '/app/push/subscribe', async ctx => {
  const u = requireUser(ctx); const b = await jsonBody(ctx.req, 1e4);
  const endpoint = str(b.endpoint, 1000), p256dh = str(b.keys && b.keys.p256dh, 200), auth = str(b.keys && b.keys.auth, 100);
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) throw bad('bad_subscription');
  db.prepare(`INSERT INTO push_subs (user_id, endpoint, p256dh, auth, created_at) VALUES (?,?,?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth`).run(u.id, endpoint, p256dh, auth, Date.now());
  return { ok: true };
});
route('POST', '/app/push/unsubscribe', async ctx => {
  const u = requireUser(ctx); const b = await jsonBody(ctx.req, 1e4);
  db.prepare('DELETE FROM push_subs WHERE user_id=? AND endpoint=?').run(u.id, str(b.endpoint, 1000));
  return { ok: true };
});
route('POST', '/app/push/test', async ctx => {
  const u = requireUser(ctx);
  if (!push.enabled()) throw new HttpError(503, 'push_off');
  const user = db.prepare('SELECT lang, units, target_low FROM users WHERE id=?').get(u.id);
  const m = push.message({ kind: 'fall', level: 'urgent', v: 92 }, user);
  const sent = await push.sendTo(db, u.id, { title: m.title, body: m.body, kind: 'test', level: 'urgent', tag: 'test', url: '/#/settings' });
  if (!sent) throw new HttpError(404, 'push_none');
  return { ok: true, sent };
});
route('POST', '/app/push/snooze', async ctx => { const u = requireUser(ctx); push.snooze(db, u.id, 30); return { ok: true }; });

// ---- food photo recognition (needs the AI): items with estimated grams and carbs
// Packaged foods from Open Food Facts when our own list has nothing (the label's carbs per 100 g).
route('GET', '/app/food/search', async ctx => {
  requireUser(ctx);
  const q = ctx.url.searchParams.get('q') || '', lang = (ctx.url.searchParams.get('lang') || 'ru').slice(0, 5);
  try { return { source: 'Open Food Facts', license: 'ODbL', items: await openfood.search(q, lang) }; }
  catch (e) { return { source: 'Open Food Facts', items: [], error: 'unavailable' }; }
});
route('POST', '/app/food/photo', async ctx => {
  const u = requireUser(ctx);
  const b = await jsonBody(ctx.req, 8e6);
  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ''));
  if (!m) throw bad('bad_image');
  if (!ai.enabled()) throw new HttpError(503, 'ai_needed');
  if (!ai.allow(u.id)) throw new HttpError(429, 'ai_limit');
  try { return await ai.recognizeFood(m[3], m[1], str(b.lang, 16)); }
  catch (e) { const [status, code] = ai.errorCode(e); console.error('Food photo:', e && e.message); throw new HttpError(status, code); }
});

route('POST', '/app/treatments', async ctx => {
  const u = requireUser(ctx); const b = await jsonBody(ctx.req);
  const at = ns.toMillis(b.at) ?? Date.now();
  // Decimal doses may come as "6,5".
  const n = v => { const x = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v); return Number.isFinite(x) && x >= 0 ? x : undefined; };
  const insulinType = { meal: 'Meal Bolus', snack: 'Meal Bolus', correction: 'Correction Bolus', basal: 'Basal Insulin', other: 'Bolus' }[b.insulinType] || (b.basal ? 'Basal Insulin' : 'Correction Bolus');
  const pick = (v, list) => (list.includes(v) ? v : undefined);
  const meds = Array.isArray(b.meds) ? b.meds.slice(0, 10).map(m => ({ name: str(m && m.name, 80), dose: str(m && m.dose, 40) || undefined })).filter(m => m.name) : [];
  const kinds = {
    // A meal with its carbs and bolus in one entry (Nightscout "Meal Bolus"; preBolus = minutes the bolus came before the meal).
    meal: { eventType: 'Meal Bolus', carbs: n(b.carbs), insulin: n(b.insulin) || undefined, preBolus: Number.isFinite(+b.preBolus) ? +b.preBolus : undefined, mealType: ['breakfast', 'lunch', 'dinner', 'snack'].includes(b.mealType) ? b.mealType : undefined,
      // the foods that make up the meal: name, grams, carbs
      foods: Array.isArray(b.foods) && b.foods.length ? b.foods.slice(0, 30).map(f => ({ id: str(f && f.id, 40) || undefined, name: str(f && f.name, 80), g: n(f && f.g) || 0, c: n(f && f.c) || 0, k: n(f && f.k), p: n(f && f.p), f: n(f && f.f) })).filter(f => f.name) : undefined },
    carbs: { eventType: 'Carb Correction', carbs: n(b.value) },
    // reason: what the dose was for (meal, snack, correction, other); insKind 'other' for a mixed or unusual insulin
    insulin: { eventType: insulinType, insulin: n(b.value), reason: pick(b.insulinType, ['meal', 'snack', 'correction', 'other']), insKind: pick(b.insKind, ['other']) },
    // bgContext: when the finger-prick was taken
    bg: { eventType: 'BG Check', glucose: n(b.value), glucoseType: 'Finger', units: 'mg/dl', bgContext: pick(b.bgContext, ['fasting', 'before', 'after', 'bedtime', 'night', 'random']) },
    med: { eventType: 'Medication', meds },
    weight: { eventType: 'Weight', weight: n(b.value), fat: n(b.fat) },
    exercise: { eventType: 'Exercise', duration: n(b.value) || undefined },
    note: { eventType: 'Note' },
  };
  const k = kinds[b.kind]; if (!k) throw bad('bad_kind');
  if (b.kind === 'meal' && !(k.carbs > 0) && !(k.insulin > 0)) throw bad('empty_entry');
  if (b.kind === 'med' && !meds.length) throw bad('empty_entry');
  if (b.kind === 'weight' && !(k.weight > 0 && k.weight < 400)) throw bad('bad_number');
  if (b.kind === 'weight' && k.fat !== undefined && !(k.fat < 80)) throw bad('bad_number');
  if (['carbs', 'insulin', 'bg'].includes(b.kind) && k[b.kind === 'bg' ? 'glucose' : b.kind] === undefined) throw bad('bad_number');
  // Glucose at the moment of the meal: the value typed in, otherwise the sensor reading nearest to that time.
  if (b.kind === 'meal') {
    const g = n(b.glucose);
    if (g) Object.assign(k, { glucose: g, glucoseType: 'Finger', units: 'mg/dl' });
    else {
      const near = ns.entriesRange(db, u.id, at - 15 * 60e3, at + 15 * 60e3).sort((a, c) => Math.abs(a.date - at) - Math.abs(c.date - at))[0];
      if (near) Object.assign(k, { glucose: near.sgv, glucoseType: 'Sensor', units: 'mg/dl' });
    }
  }
  const doc = { ...k, created_at: new Date(at).toISOString(), notes: str(b.notes, 1000) || undefined, enteredBy: APP_NAME };
  return ns.insertTreatments(db, u.id, [doc])[0];
});
// Edit a saved entry: time, meal, carbs, insulin, bolus timing, glucose, the foods and their grams, the note.
// Only the fields sent are changed; the rest stays as it was.
route('PATCH', '/app/treatments/:id', async ctx => {
  const u = requireUser(ctx); const b = await jsonBody(ctx.req);
  const row = db.prepare('SELECT * FROM treatments WHERE id=? AND user_id=?').get(Number(ctx.params.id), u.id);
  if (!row) throw new HttpError(404, 'not_found');
  let extra = {}; try { extra = JSON.parse(row.extra || '{}') || {}; } catch { extra = {}; }
  const n = v => { if (v === null || v === '') return null; const x = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v); return Number.isFinite(x) && x >= 0 ? x : undefined; };
  const set = { created_at: row.created_at, carbs: row.carbs, insulin: row.insulin, glucose: row.glucose, notes: row.notes };
  if ('mealType' in b) { if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(b.mealType)) throw bad('bad_meal'); extra.mealType = b.mealType; }
  if ('at' in b) { const t = ns.toMillis(b.at); if (!t || t > Date.now() + 3600e3) throw bad('bad_time'); set.created_at = t; }
  for (const k of ['carbs', 'insulin', 'glucose']) if (k in b) { const v = n(b[k]); if (v === undefined || (k !== 'glucose' && v > 1000)) throw bad('bad_number'); set[k] = v; }
  if ('notes' in b) set.notes = str(b.notes, 1000) || null;
  if ('preBolus' in b) { if (b.preBolus === null) delete extra.preBolus; else if (Number.isFinite(+b.preBolus)) extra.preBolus = +b.preBolus; }
  if ('duration' in b) { const v = n(b.duration); if (v === undefined) throw bad('bad_number'); extra.duration = v || undefined; }
  if ('foods' in b) {
    extra.foods = Array.isArray(b.foods) && b.foods.length ? b.foods.slice(0, 30).map(f => ({ id: str(f && f.id, 40) || undefined, name: str(f && f.name, 80), g: n(f && f.g) || 0, c: n(f && f.c) || 0, k: n(f && f.k) ?? undefined, p: n(f && f.p) ?? undefined, f: n(f && f.f) ?? undefined })).filter(f => f.name) : undefined;
  }
  if (row.event_type === 'Meal Bolus' && !(set.carbs > 0) && !(set.insulin > 0)) throw bad('empty_entry');
  try {
    db.prepare('UPDATE treatments SET created_at=?, carbs=?, insulin=?, glucose=?, notes=?, extra=? WHERE id=?')
      .run(set.created_at, set.carbs ?? null, set.insulin ?? null, set.glucose ?? null, set.notes, JSON.stringify(extra), row.id);
  } catch (e) { if (/UNIQUE/i.test(e.message)) throw bad('time_taken', 'Another entry of this kind already has that exact time'); throw e; }
  return ns.formatTreatment(db.prepare('SELECT * FROM treatments WHERE id=?').get(row.id));
});
route('DELETE', '/app/treatments/:id', async ctx => {
  const u = requireUser(ctx);
  db.prepare('DELETE FROM treatments WHERE id=? AND user_id=?').run(Number(ctx.params.id), u.id);
  return { ok: true };
});

// Cloud bridges
const BRIDGE_KINDS = ['librelinkup', 'dexcom', 'nightscout'];
route('POST', '/app/bridges', async ctx => {
  const u = requireUser(ctx); const b = await jsonBody(ctx.req);
  if (!sec.rateLimit('bridge:' + u.id, 12, 3600e3)) throw new HttpError(429, 'rate_limited');
  if (!BRIDGE_KINDS.includes(b.kind)) throw bad('bad_kind');
  const c = b.config || {};
  let cfg;
  if (b.kind === 'librelinkup') { if (!emailOk(c.email) || !c.password) throw bad('missing_fields'); cfg = { email: c.email, password: String(c.password), region: str(c.region, 4).toUpperCase() || 'EU' }; }
  if (b.kind === 'dexcom') { if (!c.username || !c.password) throw bad('missing_fields'); cfg = { username: str(c.username), password: String(c.password), region: ['us', 'ous', 'jp'].includes(c.region) ? c.region : 'ous' }; }
  if (b.kind === 'nightscout') { if (!/^https:\/\//i.test(c.url || '')) throw bad('bad_url'); cfg = { url: str(c.url, 300), token: str(c.token, 200) || undefined, secret: c.secret ? String(c.secret) : undefined }; }
  db.prepare(`INSERT INTO bridges (user_id, kind, config_enc, status) VALUES (?,?,?,'pending')
    ON CONFLICT(user_id, kind) DO UPDATE SET config_enc=excluded.config_enc, status='pending', last_error=NULL, last_poll=NULL`).run(u.id, b.kind, sec.encrypt(JSON.stringify(cfg)));
  bridges.forget(u.id, b.kind);
  const row = db.prepare('SELECT * FROM bridges WHERE user_id=? AND kind=?').get(u.id, b.kind);
  const result = await bridges.runOne(db, row);
  return result;
});
route('DELETE', '/app/bridges/:kind', async ctx => {
  const u = requireUser(ctx);
  db.prepare('DELETE FROM bridges WHERE user_id=? AND kind=?').run(u.id, ctx.params.kind);
  bridges.forget(u.id, ctx.params.kind);
  return { ok: true };
});

// CSV import (LibreView, Dexcom Clarity, Medtronic CareLink, Eversense, glucometer exports …)
route('POST', '/app/import', async ctx => {
  const u = requireUser(ctx);
  const text = await readBody(ctx.req, 30e6);
  const { entries, detected } = parseCsv(text, ctx.url.searchParams.get('tz_offset'));
  if (!entries.length) throw bad('nothing_imported', detected.error || 'No glucose rows recognised');
  const saved = ns.insertEntries(db, u.id, entries, 'csv');
  return { imported: saved.length, detected };
});

// Sharing with doctors / family (read-only links; also usable as Nightscout ?token=)
route('GET', '/app/shares', async ctx => {
  const u = requireUser(ctx);
  return db.prepare('SELECT token, label, created_at, expires_at FROM shares WHERE user_id=? AND revoked=0 ORDER BY created_at DESC').all(u.id);
});
route('POST', '/app/shares', async ctx => {
  const u = requireUser(ctx); const b = await jsonBody(ctx.req);
  const days = Number(b.days);
  const token = 'r-' + sec.randomToken(12);
  db.prepare('INSERT INTO shares (token, user_id, label, created_at, expires_at) VALUES (?,?,?,?,?)').run(token, u.id, str(b.label, 100) || null, Date.now(), days > 0 ? Date.now() + days * 864e5 : null);
  return { token };
});
route('DELETE', '/app/shares/:token', async ctx => {
  const u = requireUser(ctx);
  db.prepare('UPDATE shares SET revoked=1 WHERE token=? AND user_id=?').run(ctx.params.token, u.id);
  return { ok: true };
});
route('GET', '/app/share/:token', async ctx => {
  const s = shareByToken(ctx.params.token);
  if (!s) throw new HttpError(404, 'share_not_found');
  const u = db.prepare('SELECT name, patient_name, birth_year, diabetes_type, units, target_low, target_high FROM users WHERE id=?').get(s.user_id);
  return { patient: u, label: s.label, expires_at: s.expires_at };
});

// Doctor workspace: patients added by share link
route('GET', '/app/patients', async ctx => {
  const u = requireUser(ctx);
  const rows = db.prepare(`SELECT dp.share_token token, dp.added_at, u.id uid, u.name, u.patient_name, u.birth_year, u.diabetes_type, u.units, u.target_low, u.target_high
    FROM doctor_patients dp JOIN shares s ON s.token = dp.share_token AND s.revoked = 0 AND (s.expires_at IS NULL OR s.expires_at > ?)
    JOIN users u ON u.id = s.user_id WHERE dp.doctor_id = ? ORDER BY dp.added_at DESC`).all(Date.now(), u.id);
  const now = Date.now(), since = now - 14 * 864e5, day = now - 864e5;
  return rows.map(r => {
    const lo = r.target_low || 70, hi = r.target_high || 180;
    const st = db.prepare(`SELECT COUNT(*) n, SUM(sgv BETWEEN ? AND ?) inr, SUM(sgv < ?) low, AVG(sgv) mean FROM entries WHERE user_id=? AND type='sgv' AND date>=?`).get(lo, hi, lo, r.uid, since);
    const d1 = db.prepare(`SELECT MIN(sgv) min, SUM(sgv < ?) low FROM entries WHERE user_id=? AND type='sgv' AND date>=?`).get(lo, r.uid, day);
    const last = db.prepare('SELECT date, sgv, direction FROM entries WHERE user_id=? AND type=\'sgv\' ORDER BY date DESC LIMIT 1').get(r.uid);
    // Unread: messages from the family after the doctor last opened this patient's messages.
    const read = db.prepare('SELECT read_at FROM doctor_reads WHERE doctor_id=? AND user_id=?').get(u.id, r.uid);
    const unread = db.prepare('SELECT COUNT(*) n FROM notes WHERE user_id=? AND author_id<>? AND created_at > ?').get(r.uid, u.id, Math.max(r.added_at, read ? read.read_at : 0)).n;
    delete r.uid;
    return { ...r, last: last || null, tir: st.n ? st.inr / st.n * 100 : null, tbr: st.n ? st.low / st.n * 100 : null, mean: st.mean,
      min24: d1.min ?? null, lows24: d1.low || 0, messages: unread };
  });
});
route('POST', '/app/patients', async ctx => {
  const u = requireUser(ctx); const b = await jsonBody(ctx.req);
  let token = str(b.token, 300);
  const m = /[#/]s\/([\w-]+)/.exec(token) || /token=([\w-]+)/.exec(token); if (m) token = m[1];
  const s = shareByToken(token); if (!s) throw new HttpError(404, 'share_not_found');
  db.prepare('INSERT OR IGNORE INTO doctor_patients (doctor_id, share_token, added_at) VALUES (?,?,?)').run(u.id, token, Date.now());
  return { ok: true, token };
});
route('POST', '/app/patients/:token/read', async ctx => {
  const u = requireUser(ctx);
  if (!db.prepare('SELECT 1 FROM doctor_patients WHERE doctor_id=? AND share_token=?').get(u.id, ctx.params.token)) throw new HttpError(403, 'forbidden');
  const s = shareByToken(ctx.params.token); if (!s) throw new HttpError(404, 'share_not_found');
  db.prepare(`INSERT INTO doctor_reads (doctor_id, user_id, read_at) VALUES (?,?,?) ON CONFLICT(doctor_id, user_id) DO UPDATE SET read_at=excluded.read_at`).run(u.id, s.user_id, Date.now());
  return { ok: true };
});
route('DELETE', '/app/patients/:token', async ctx => {
  const u = requireUser(ctx);
  db.prepare('DELETE FROM doctor_patients WHERE doctor_id=? AND share_token=?').run(u.id, ctx.params.token);
  return { ok: true };
});

// Messages & conclusions between patient/family and doctor
route('GET', '/app/notes', async ctx => {
  const s = subjectFor(ctx);
  return db.prepare('SELECT n.id, n.kind, n.text, n.created_at, n.author_id, a.name author, a.role author_role FROM notes n JOIN users a ON a.id = n.author_id WHERE n.user_id=? ORDER BY n.created_at').all(s.userId)
    .map(n => ({ ...n, mine: ctx.user ? n.author_id === ctx.user.id : false }));
});
route('POST', '/app/notes', async ctx => {
  const u = requireUser(ctx); const b = await jsonBody(ctx.req);
  const text = str(b.text, 5000); if (!text) throw bad('empty');
  let patientId = u.id;
  if (b.share) {
    const s = shareByToken(b.share); if (!s) throw new HttpError(404, 'share_not_found');
    if (!db.prepare('SELECT 1 FROM doctor_patients WHERE doctor_id=? AND share_token=?').get(u.id, b.share)) throw new HttpError(403, 'forbidden');
    patientId = s.user_id;
  }
  const kind = b.kind === 'conclusion' && u.role === 'doctor' ? 'conclusion' : 'message';
  db.prepare('INSERT INTO notes (user_id, author_id, kind, text, created_at) VALUES (?,?,?,?,?)').run(patientId, u.id, kind, text, Date.now());
  return { ok: true };
});

// ------------------------------------------------------------------ Nightscout v1 API
const nsRoutes = [];
const nsRoute = (method, pattern, handler) => nsRoutes.push({ method, re: new RegExp('^/api/v1' + pattern + '$'), handler });
const ext = p => p.replace(/\.(json|txt|csv|tsv)$/, '');
function nsSend(ctx, list) {
  const wantsText = /\.(txt|csv|tsv)$/.test(ctx.url.pathname) || (!/\.json$/.test(ctx.url.pathname) && !String(ctx.req.headers.accept || '').includes('json') && /entries/.test(ctx.url.pathname) && ctx.req.method === 'GET' && String(ctx.req.headers.accept || '').includes('text/plain'));
  if (wantsText) return { raw: ns.entriesAsText(list), type: 'text/plain; charset=utf-8' };
  return list;
}
function nsNeed(ctx, write) {
  if (!ctx.ns) throw new HttpError(401, 'unauthorized', 'Unauthorized');
  if (write && !ctx.ns.write) throw new HttpError(401, 'unauthorized', 'Read-only token cannot write');
  return ctx.ns.user;
}
function statusPayload(ctx) {
  const u = ctx.ns && ctx.ns.user;
  const units = u ? u.units : 'mg/dl';
  const now = new Date();
  return {
    status: 'ok', name: APP_NAME, version: `15.0.0-${APP_NAME.toLowerCase()}.${VERSION}`, serverTime: now.toISOString(), serverTimeEpoch: now.getTime(),
    apiEnabled: true, careportalEnabled: true, boluscalcEnabled: false,
    settings: { units, timeFormat: 24, customTitle: APP_NAME, theme: 'default', language: u ? u.lang : 'en', enable: ['careportal', 'rawbg', 'iob', 'cob'], authDefaultRoles: 'denied',
      thresholds: { bgHigh: 260, bgTargetTop: u ? u.target_high : 180, bgTargetBottom: u ? u.target_low : 70, bgLow: 55 } },
    extendedSettings: {}, authorized: ctx.ns ? { sub: u.email, permissionGroups: [[ctx.ns.write ? '*' : '*:*:read']] } : null,
  };
}
nsRoute('GET', '/status(\\.json)?', ctx => statusPayload(ctx));
nsRoute('GET', '/verifyauth', ctx => {
  const ok = !!ctx.ns;
  return { canRead: ok, canWrite: ok && ctx.ns.write, isAdmin: ok && ctx.ns.write, message: ok ? 'OK' : 'UNAUTHORIZED', rolefound: ok ? 'FOUND' : 'NOTFOUND', permissions: ok ? 'ROLE' : 'DEFAULT' };
});
nsRoute('GET', '/entries/current(\\.json)?', ctx => nsSend(ctx, ns.queryEntries(db, nsNeed(ctx).id, new URLSearchParams({ count: '1' }), 'sgv')));
nsRoute('GET', '/entries(?:\\.(?:json|txt|csv|tsv))?(?:/(?<spec>[^/]+))?', ctx => {
  const u = nsNeed(ctx);
  const spec = ctx.params.spec ? ext(ctx.params.spec) : null;
  if (spec && /^[0-9]+$/.test(spec)) {
    const r = db.prepare('SELECT * FROM entries WHERE user_id=? AND id=?').get(u.id, Number(spec));
    return r ? [ns.queryEntries(db, u.id, new URLSearchParams({ 'find[date]': String(r.date), count: '1' }))[0]].filter(Boolean) : [];
  }
  return nsSend(ctx, ns.queryEntries(db, u.id, ctx.url.searchParams, spec && ['sgv', 'mbg', 'cal'].includes(spec) ? spec : null));
});
nsRoute('POST', '/entries(\\.json)?/?', ctx => {
  const u = nsNeed(ctx, true);
  const docs = Array.isArray(ctx.body) ? ctx.body : [ctx.body];
  if (docs.length > 50000) throw bad('too_many');
  return ns.insertEntries(db, u.id, docs, 'api').map(e => ({ ...e, dateString: new Date(e.date).toISOString() }));
});
nsRoute('DELETE', '/entries(?:/(?<spec>[^/]+))?', ctx => {
  const u = nsNeed(ctx, true);
  const spec = ctx.params.spec ? ext(ctx.params.spec) : null;
  if (spec && /^[0-9]+$/.test(spec)) db.prepare('DELETE FROM entries WHERE user_id=? AND id=?').run(u.id, Number(spec));
  return { ok: 1 };
});
nsRoute('GET', '/treatments(\\.json)?', ctx => ns.queryTreatments(db, nsNeed(ctx).id, ctx.url.searchParams));
nsRoute('POST', '/treatments(\\.json)?/?', ctx => {
  const u = nsNeed(ctx, true);
  return ns.insertTreatments(db, u.id, Array.isArray(ctx.body) ? ctx.body : [ctx.body]);
});
nsRoute('PUT', '/treatments(\\.json)?/?', ctx => {
  const u = nsNeed(ctx, true);
  return ns.insertTreatments(db, u.id, Array.isArray(ctx.body) ? ctx.body : [ctx.body]);
});
nsRoute('DELETE', '/treatments/(?<id>[^/]+)', ctx => {
  const u = nsNeed(ctx, true);
  db.prepare('DELETE FROM treatments WHERE user_id=? AND id=?').run(u.id, Number(ext(ctx.params.id)));
  return { ok: 1 };
});
nsRoute('GET', '/devicestatus(\\.json)?', ctx => ns.queryDeviceStatus(db, nsNeed(ctx).id, ctx.url.searchParams));
nsRoute('POST', '/devicestatus(\\.json)?/?', ctx => {
  const u = nsNeed(ctx, true);
  return ns.insertDeviceStatus(db, u.id, Array.isArray(ctx.body) ? ctx.body : [ctx.body]);
});
nsRoute('GET', '/profile(\\.json)?', ctx => {
  const u = nsNeed(ctx);
  const mmol = u.units === 'mmol';
  const v = x => mmol ? Math.round(x / 18.0182 * 10) / 10 : x;
  return [{ _id: 'default', defaultProfile: 'Default', startDate: '2000-01-01T00:00:00.000Z', units: u.units, mills: 0,
    store: { Default: { units: u.units, timezone: u.timezone || 'UTC', dia: 4, carbratio: [{ time: '00:00', value: 10 }], sens: [{ time: '00:00', value: v(50) }], basal: [{ time: '00:00', value: 0 }],
      target_low: [{ time: '00:00', value: v(u.target_low) }], target_high: [{ time: '00:00', value: v(u.target_high) }], carbs_hr: 20, delay: 20 } } }];
});

// ------------------------------------------------------------------ static files
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
function serveStatic(req, res, pathname) {
  let p = path.normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  if (p.includes('..')) return send(res, 400, 'Bad path');
  let file = path.join(PUBLIC_DIR, p || 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  const ext = path.extname(file);
  const body = fs.readFileSync(file);
  send(res, 200, body, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' });
}

// ------------------------------------------------------------------ server
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://local');
  const pathname = url.pathname.replace(/\/{2,}/g, '/');
  try {
    // ---- Nightscout API (CORS open: auth is by header/token, never by cookie)
    if (pathname.startsWith('/api/v1/') || pathname === '/api/v1') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, api-secret, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') return send(res, 204, '');
      const body = ['POST', 'PUT'].includes(req.method) ? await jsonBody(req, 20e6) : null;
      const ctx = { req, res, url, body, ns: nsAuth(req, url, body), params: {} };
      // never store credentials that some uploaders put inside the documents
      if (Array.isArray(body)) body.forEach(d => { if (d && typeof d === 'object') { delete d.secret; delete d.token; } });
      else if (body && typeof body === 'object') { delete body.secret; delete body.token; }
      const r = nsRoutes.find(r => r.method === req.method && r.re.test(pathname));
      if (!r) return send(res, 404, { status: 404, message: 'Not found' });
      ctx.params = (r.re.exec(pathname).groups) || {};
      const out = await r.handler(ctx);
      if (out && out.raw !== undefined) return send(res, 200, out.raw, { 'Content-Type': out.type });
      return send(res, 200, out);
    }
    // ---- App API
    if (pathname.startsWith('/app/')) {
      if (req.method !== 'GET' && req.headers['x-ec'] !== '1') throw new HttpError(403, 'csrf');
      const r = routes.find(r => r.method === req.method && r.re.test(pathname));
      if (!r) throw new HttpError(404, 'not_found');
      const ctx = { req, res, url, user: sessionUser(req), params: r.re.exec(pathname).groups || {} };
      const out = await r.handler(ctx);
      res.setHeader('Cache-Control', 'no-store');
      if (out && out.raw !== undefined) return send(res, 200, out.raw, { 'Content-Type': out.type, ...(out.headers || {}) });
      return send(res, 200, out);
    }
    if (pathname === '/healthz') return send(res, 200, { ok: true, version: VERSION });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return serveStatic(req, res, pathname);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { status: e.status, error: e.code, message: e.message });
    console.error(e);
    return send(res, 500, { status: 500, error: 'internal' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`${APP_NAME} ${VERSION} listening on http://localhost:${PORT}`);
    bridges.start(db);
    push.start(db, ns);
  });
}
module.exports = { server, db };
