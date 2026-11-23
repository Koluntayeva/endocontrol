'use strict';
// Cloud bridges: pull glucose from sensor-maker clouds when the patient's phone app already shares it.
//  - LibreLinkUp (FreeStyle Libre 1/2/3 via the LibreLink app's "follower" sharing)
//  - Dexcom Share (Dexcom G6/G7/ONE via the Dexcom app's Share feature)
//  - Another Nightscout site (pull mode)
// Protocol details are public facts about these services; this is an independent implementation.

const crypto = require('node:crypto');
const { insertEntries, insertTreatments, DIRECTIONS } = require('./nsdata');
const sec = require('./security');

const POLL_MS = 5 * 60e3;
// Nightscout is the family's own server and cheap to ask: once a minute, so a reading shows up soon after it lands there.
// The sensor clouds (LibreLinkUp, Dexcom Share) stay at 5 minutes so they do not block the account.
const POLL_EVERY = { nightscout: 60e3 };
const pollEvery = kind => POLL_EVERY[kind] || POLL_MS;
const sessions = new Map(); // `${userId}:${kind}` -> cached login

class BridgeError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }

async function http(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const text = await res.text();
    let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: res.status, body };
  } catch (e) {
    throw new BridgeError('network', e.message);
  } finally { clearTimeout(t); }
}

// ---------------- LibreLinkUp ----------------
const LLU_HOSTS = { EU: 'api-eu.libreview.io', EU2: 'api-eu2.libreview.io', US: 'api-us.libreview.io', DE: 'api-de.libreview.io', FR: 'api-fr.libreview.io',
  JP: 'api-jp.libreview.io', AP: 'api-ap.libreview.io', AU: 'api-au.libreview.io', AE: 'api-ae.libreview.io', CA: 'api-ca.libreview.io', LA: 'api-la.libreview.io', RU: 'api.libreview.ru', CN: 'api-cn.myfreestyle.cn' };
const LLU_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json', product: 'llu.ios', version: '4.16.0', 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)' };
const LLU_ARROWS = { 1: 'SingleDown', 2: 'FortyFiveDown', 3: 'Flat', 4: 'FortyFiveUp', 5: 'SingleUp' };

function lluTime(s) { // "11/13/2026 7:45:00 AM" in UTC (FactoryTimestamp)
  const m = /^(\d+)\/(\d+)\/(\d+) (\d+):(\d+):(\d+) (AM|PM)$/.exec(String(s || '').trim());
  if (!m) { const t = Date.parse(s); return Number.isFinite(t) ? t : null; }
  let h = +m[4] % 12; if (m[7] === 'PM') h += 12;
  return Date.UTC(+m[3], +m[1] - 1, +m[2], h, +m[5], +m[6]);
}

async function lluLogin(cfg) {
  let region = (cfg.region || 'EU').toUpperCase();
  for (let hop = 0; hop < 3; hop++) {
    const host = LLU_HOSTS[region];
    if (!host) throw new BridgeError('region', `Unknown region ${region}`);
    const r = await http(`https://${host}/llu/auth/login`, { method: 'POST', headers: LLU_HEADERS, body: JSON.stringify({ email: cfg.email, password: cfg.password }) });
    const b = r.body || {};
    if (b.data && b.data.redirect && b.data.region) { region = String(b.data.region).toUpperCase(); continue; }
    if (b.status === 4) throw new BridgeError('terms', 'Open the LibreLinkUp app and accept the new terms of use');
    if (r.status === 429) throw new BridgeError('rate_limited');
    const token = b.data && b.data.authTicket && b.data.authTicket.token;
    const uid = b.data && b.data.user && b.data.user.id;
    if (!token) throw new BridgeError('auth_failed', 'LibreLinkUp login failed: check e-mail, password and region');
    const auth = { host, token, accountId: crypto.createHash('sha256').update(String(uid)).digest('hex'), expires: (b.data.authTicket.expires || 0) * 1000 || Date.now() + 50 * 60e3 };
    const c = await http(`https://${host}/llu/connections`, { headers: { ...LLU_HEADERS, Authorization: `Bearer ${token}`, 'Account-Id': auth.accountId } });
    const list = (c.body && c.body.data) || [];
    if (!list.length) throw new BridgeError('no_connections', 'No patients shared with this LibreLinkUp account');
    auth.patientId = (cfg.patientId && list.find(p => p.patientId === cfg.patientId) || list[0]).patientId;
    return auth;
  }
  throw new BridgeError('region', 'Too many region redirects');
}

async function pollLibre(key, cfg) {
  let s = sessions.get(key);
  if (!s || s.expires < Date.now() + 60e3) { s = await lluLogin(cfg); sessions.set(key, s); }
  const r = await http(`https://${s.host}/llu/connections/${s.patientId}/graph`, { headers: { ...LLU_HEADERS, Authorization: `Bearer ${s.token}`, 'Account-Id': s.accountId } });
  if (r.status === 401) { sessions.delete(key); throw new BridgeError('auth_failed', 'Session expired'); }
  const d = r.body && r.body.data;
  if (!d) throw new BridgeError('bad_response', 'Unexpected LibreLinkUp response');
  const rows = [...(d.graphData || [])];
  const cur = d.connection && (d.connection.glucoseMeasurement || d.connection.glucoseItem);
  if (cur) rows.push({ ...cur, current: true });
  return rows.map(x => ({
    type: 'sgv', date: lluTime(x.FactoryTimestamp || x.Timestamp), sgv: x.ValueInMgPerDl ?? x.Value,
    direction: x.current ? (LLU_ARROWS[x.TrendArrow] || 'NOT COMPUTABLE') : undefined, device: 'LibreLinkUp',
  })).filter(e => e.date && e.sgv);
}

// ---------------- Dexcom Share ----------------
const DEX_HOSTS = { us: 'share2.dexcom.com', ous: 'shareous1.dexcom.com', jp: 'share.dexcom.jp' };
const DEX_APP_ID = 'd89443d2-327c-4a6f-89e5-496bbb0317db';
const DEX_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'Dexcom Share/3.0.2.11' };

async function dexLogin(cfg) {
  const host = DEX_HOSTS[cfg.region || 'ous'] || DEX_HOSTS.ous;
  const base = `https://${host}/ShareWebServices/Services`;
  const a = await http(`${base}/General/AuthenticatePublisherAccount`, { method: 'POST', headers: DEX_HEADERS, body: JSON.stringify({ accountName: cfg.username, password: cfg.password, applicationId: DEX_APP_ID }) });
  if (a.status !== 200 || typeof a.body !== 'string') throw new BridgeError('auth_failed', 'Dexcom login failed: check username, password and region');
  const l = await http(`${base}/General/LoginPublisherAccountById`, { method: 'POST', headers: DEX_HEADERS, body: JSON.stringify({ accountId: a.body, password: cfg.password, applicationId: DEX_APP_ID }) });
  if (l.status !== 200 || typeof l.body !== 'string' || /^0{8}-/.test(l.body)) throw new BridgeError('auth_failed', 'Dexcom login failed');
  return { base, sessionId: l.body, expires: Date.now() + 8 * 3600e3 };
}
function dexDate(s) { const m = /Date\((\d+)/.exec(String(s)); return m ? Number(m[1]) : null; }

async function pollDexcom(key, cfg, lastData) {
  let s = sessions.get(key);
  if (!s || s.expires < Date.now()) { s = await dexLogin(cfg); sessions.set(key, s); }
  const minutes = Math.min(1440, Math.max(10, Math.ceil((Date.now() - (lastData || 0)) / 60e3) + 5));
  const q = new URLSearchParams({ sessionId: s.sessionId, minutes, maxCount: Math.ceil(minutes / 5) });
  const r = await http(`${s.base}/Publisher/ReadPublisherLatestGlucoseValues?${q}`, { method: 'POST', headers: DEX_HEADERS, body: '' });
  if (r.status !== 200 || !Array.isArray(r.body)) { sessions.delete(key); throw new BridgeError('auth_failed', 'Dexcom session rejected'); }
  return r.body.map(x => ({
    type: 'sgv', date: dexDate(x.WT) || dexDate(x.ST), sgv: x.Value,
    direction: typeof x.Trend === 'number' ? DIRECTIONS[x.Trend] : String(x.Trend || ''), device: 'Dexcom Share',
  })).filter(e => e.date && e.sgv);
}

// ---------------- Nightscout (pull from another site) ----------------
async function pollNightscout(key, cfg, lastData) {
  const base = String(cfg.url || '').replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) throw new BridgeError('bad_url', 'Nightscout URL must start with https://');
  const q = new URLSearchParams({ count: '2000', 'find[date][$gt]': String(lastData || Date.now() - 14 * 864e5) });
  const headers = { Accept: 'application/json' };
  if (cfg.token) q.set('token', cfg.token);
  if (cfg.secret) headers['api-secret'] = sec.sha1(cfg.secret);
  const r = await http(`${base}/api/v1/entries/sgv.json?${q}`, { headers });
  if (r.status === 401) throw new BridgeError('auth_failed', 'Nightscout refused the token or secret');
  if (!Array.isArray(r.body)) throw new BridgeError('bad_response', 'Unexpected Nightscout response');
  const entries = r.body.map(e => ({ ...e, device: e.device || 'Nightscout' }));
  // Treatments too (meals, boluses, basal, exercise, notes): without them the analyst cannot
  // tell when a meal was eaten or insulin was given. Re-reading 6 h back is safe: rows upsert.
  const since = new Date(lastData ? lastData - 6 * 3600e3 : Date.now() - 14 * 864e5).toISOString();
  const tq = new URLSearchParams({ count: '1000', 'find[created_at][$gte]': since });
  if (cfg.token) tq.set('token', cfg.token);
  const t = await http(`${base}/api/v1/treatments.json?${tq}`, { headers });
  entries.treatments = Array.isArray(t.body) ? t.body.map(d => { const { secret, token, ...rest } = d; return rest; }) : [];
  return entries;
}

const POLLERS = { librelinkup: pollLibre, dexcom: pollDexcom, nightscout: pollNightscout };

async function runOne(db, b) {
  const key = `${b.user_id}:${b.kind}`;
  const now = Date.now();
  try {
    const cfg = JSON.parse(sec.decrypt(b.config_enc));
    const docs = await POLLERS[b.kind](key, cfg, b.last_data);
    const saved = insertEntries(db, b.user_id, docs, b.kind);
    if (docs.treatments && docs.treatments.length) insertTreatments(db, b.user_id, docs.treatments);
    const newest = saved.reduce((m, e) => Math.max(m, e.date), b.last_data || 0);
    db.prepare('UPDATE bridges SET status=\'ok\', last_error=NULL, last_poll=?, last_data=? WHERE user_id=? AND kind=?').run(now, newest || null, b.user_id, b.kind);
    return { ok: true, count: saved.length };
  } catch (e) {
    const code = e instanceof BridgeError ? e.code : 'internal';
    db.prepare('UPDATE bridges SET status=\'error\', last_error=?, last_poll=? WHERE user_id=? AND kind=?').run(`${code}: ${String(e.message).slice(0, 300)}`, now, b.user_id, b.kind);
    return { ok: false, code, message: e.message };
  }
}

let running = false;
function start(db, log = console) {
  const tick = async () => {
    if (running) return; running = true;
    try {
      const now = Date.now();
      // a few seconds of slack so a one-minute poll does not slip to every other tick
      const due = db.prepare('SELECT * FROM bridges').all().filter(b => b.last_poll == null || b.last_poll <= now - pollEvery(b.kind) + 5e3);
      for (const b of due) {
        const r = await runOne(db, b);
        if (!r.ok) log.warn(`[bridge] user ${b.user_id} ${b.kind}: ${r.code}`);
        // be polite to sensor clouds: back off harder after auth errors
        if (!r.ok && r.code === 'auth_failed') db.prepare('UPDATE bridges SET last_poll=? WHERE user_id=? AND kind=?').run(Date.now() + 25 * 60e3, b.user_id, b.kind);
      }
    } finally { running = false; }
  };
  setInterval(tick, 60e3).unref();
  setTimeout(tick, 5e3).unref();
}

function forget(userId, kind) { sessions.delete(`${userId}:${kind}`); }

module.exports = { start, runOne, forget, pollEvery, LLU_HOSTS: Object.keys(LLU_HOSTS), DEX_REGIONS: Object.keys(DEX_HOSTS) };
