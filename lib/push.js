'use strict';
// Web Push: glucose alerts that reach the phone or computer even when the app is closed.
// Every minute the server checks the latest readings of users who turned push on, using the
// same rules as the app (public/alerts.js), and sends a notification in the user's language.
// VAPID keys are generated once and kept in DATA_DIR/vapid.json (or VAPID_PUBLIC_KEY /
// VAPID_PRIVATE_KEY in the environment).

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Alerts = require('../public/alerts.js');

let webpush = null;
try { webpush = require('web-push'); } catch { webpush = null; }

let keys = null;
// The sender can be replaced in tests.
let send = (sub, body, opts) => webpush.sendNotification(sub, body, opts);
const _setSender = fn => { send = fn || ((sub, body, opts) => webpush.sendNotification(sub, body, opts)); };
function init(dataDir, subject) {
  if (!webpush) return false;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const file = path.join(dataDir, 'vapid.json');
    try { keys = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {
      keys = webpush.generateVAPIDKeys();
      fs.writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
    }
  }
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  return true;
}
const enabled = () => Boolean(webpush && keys);
const publicKey = () => keys && keys.publicKey;

// The app's translations, loaded in a sandbox (i18n.js is written for the browser).
let I18N = null;
function i18n() {
  if (I18N) return I18N;
  const sandbox = { window: {}, navigator: { language: 'en' }, localStorage: { getItem() { return null; }, setItem() { } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'i18n.js'), 'utf8'), sandbox);
  I18N = sandbox.window.I18N;
  return I18N;
}

const KEY = { verylow: 'alVeryLow', low: 'alLow', fallsoon: 'alFallSoon', fall: 'alFall', rise: 'alRise', high: 'alHigh' };
function message(alert, user) {
  const I = i18n(), lang = user.lang || 'en';
  const mmol = user.units === 'mmol';
  const g = mg => mmol ? (mg / 18.0182).toFixed(1) : String(Math.round(mg));
  return {
    title: I.t(lang, alert.level === 'critical' ? 'pushTitleCritical' : 'pushTitle'),
    body: I.t(lang, KEY[alert.kind], { v: g(alert.v), u: mmol ? 'mmol/L' : 'mg/dL', lo: g(user.target_low || 70) }),
  };
}

async function sendTo(db, userId, payload) {
  const subs = db.prepare('SELECT * FROM push_subs WHERE user_id=?').all(userId);
  let sent = 0;
  for (const s of subs) {
    try {
      await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload),
        { TTL: 900, urgency: payload.level === 'warn' ? 'normal' : 'high' });
      sent++;
    } catch (e) {
      // The browser dropped this subscription: forget it.
      if (e && (e.statusCode === 404 || e.statusCode === 410)) db.prepare('DELETE FROM push_subs WHERE id=?').run(s.id);
      else console.warn('[push]', e && (e.statusCode || e.message));
    }
  }
  return sent;
}

// One pass over everyone with push turned on.
async function checkAll(db, ns, now = Date.now()) {
  if (!enabled()) return 0;
  const users = db.prepare(`SELECT DISTINCT u.id, u.lang, u.units, u.target_low, u.target_high FROM users u JOIN push_subs p ON p.user_id = u.id WHERE u.role = 'patient'`).all();
  let n = 0;
  for (const u of users) {
    const entries = ns.entriesRange(db, u.id, now - 40 * 60e3, now + 60e3).filter(e => Number.isFinite(e.sgv)).map(e => [e.date, e.sgv, e.direction || null]);
    const alert = Alerts.check(entries, now, { lo: u.target_low, hi: u.target_high });
    const st = db.prepare('SELECT * FROM alert_state WHERE user_id=?').get(u.id) || {};
    const memory = { last: st.last_kind ? { kind: st.last_kind, at: st.last_at } : null, snoozeUntil: st.snooze_until || 0 };
    if (!Alerts.shouldFire(alert, memory, now)) continue;
    db.prepare(`INSERT INTO alert_state (user_id, last_kind, last_at, snooze_until) VALUES (?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET last_kind=excluded.last_kind, last_at=excluded.last_at`).run(u.id, alert.kind, now, st.snooze_until || 0);
    const m = message(alert, u);
    if (await sendTo(db, u.id, { ...m, kind: alert.kind, level: alert.level, tag: 'glucose', url: /low|fall/.test(alert.kind) ? '/#/ai/sos' : '/#/ai' })) n++;
  }
  return n;
}

function snooze(db, userId, minutes = 30) {
  db.prepare(`INSERT INTO alert_state (user_id, snooze_until) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET snooze_until=excluded.snooze_until`).run(userId, Date.now() + minutes * 60e3);
}

let timer = null;
function start(db, ns) {
  if (timer || !enabled()) return;
  let running = false;
  timer = setInterval(async () => {
    if (running) return; running = true;
    try { await checkAll(db, ns); } catch (e) { console.warn('[push] check failed:', e.message); } finally { running = false; }
  }, 60e3);
  timer.unref();
}

module.exports = { init, enabled, publicKey, sendTo, checkAll, snooze, start, message, _setSender };
