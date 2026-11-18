'use strict';
// Creates two demo accounts with 30 days of realistic CGM data so you can try the app:
//   patient: demo@endocontrol.app / demo1234
//   doctor:  doctor@endocontrol.app / demo1234   (already has the demo patient in the list)
// Usage: node scripts/demo.js   (run once, then start the server)

process.removeAllListeners('warning');
const path = require('node:path');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const sec = require('../lib/security');
const dbm = require('../lib/db');
const ns = require('../lib/nsdata');

sec.initKey(DATA_DIR);
const db = dbm.open(DATA_DIR);

function user(email, name, role, extra = {}) {
  const old = db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (old) db.prepare('DELETE FROM users WHERE id=?').run(old.id);
  const secret = sec.newApiSecret();
  const r = db.prepare(`INSERT INTO users (email, pass_hash, name, role, patient_name, diabetes_type, lang, units, api_secret_enc, api_secret_sha1, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(email, sec.hashPassword('demo1234'), name, role, extra.patient_name || null, extra.diabetes_type || null,
    extra.lang || 'en', extra.units || 'mmol', sec.encrypt(secret), sec.sha1(secret), new Date().toISOString());
  return Number(r.lastInsertRowid);
}

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const pid = user('demo@endocontrol.app', 'Aigerim', 'patient', { patient_name: 'Alikhan (9)', diabetes_type: 't1', lang: 'ru', units: 'mmol' });
const did = user('doctor@endocontrol.app', 'Dr. Aizhan Nurlanova, pediatric endocrinologist', 'doctor', { lang: 'ru', units: 'mmol' });

const entries = [], treatments = [];
const now = Date.now();
const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 29);
for (let d = 0; d < 30; d++) {
  const day = start.getTime() + d * 864e5;
  const meals = [[7.5 + rnd(), 'Breakfast', 30 + rnd() * 25], [13 + rnd(), 'Lunch', 40 + rnd() * 30], [19 + rnd() * 1.5, 'Dinner', 35 + rnd() * 30]];
  const hypo = rnd() < 0.25, act = rnd() < 0.4 ? 16 + rnd() * 2 : null;
  for (const [h, , c] of meals) {
    const t = day + h * 3600e3;
    if (t > now) continue;
    treatments.push({ eventType: 'Meal Bolus', created_at: new Date(t).toISOString(), carbs: Math.round(c / 5) * 5, insulin: Math.round(c / 15 * 2) / 2, enteredBy: 'demo' });
  }
  if (day + 21 * 3600e3 < now) treatments.push({ eventType: 'Basal Insulin', created_at: new Date(day + 21 * 3600e3).toISOString(), insulin: 8, enteredBy: 'demo' });
  if (act && day + act * 3600e3 < now) treatments.push({ eventType: 'Exercise', created_at: new Date(day + act * 3600e3).toISOString(), duration: 45, notes: 'Football', enteredBy: 'demo' });
  let ar = 0;
  for (let i = 0; i < 288; i++) {
    const t = day + i * 5 * 60e3; if (t > now) break;
    const h = i / 12;
    let v = 135 + 25 * Math.exp(-((h - 6.5) ** 2) / 3);
    for (const [mh, , c] of meals) { const dt = (h - mh) * 60; if (dt > 0) { const x = dt / 65; v += c * 1.6 * x * Math.exp(1 - x); } }
    if (hypo) v -= 80 * Math.exp(-((h - 2.8) ** 2) / 1.1);
    if (act) v -= 40 * Math.exp(-((h - act - 0.7) ** 2) / 0.8);
    ar = ar * 0.94 + (rnd() - 0.5) * 9;
    v = Math.max(40, Math.min(400, v + ar));
    const prev = entries.length ? entries[entries.length - 1].sgv : v;
    const slope = (v - prev) / 5;
    const direction = slope > 3 ? 'DoubleUp' : slope > 2 ? 'SingleUp' : slope > 1 ? 'FortyFiveUp' : slope < -3 ? 'DoubleDown' : slope < -2 ? 'SingleDown' : slope < -1 ? 'FortyFiveDown' : 'Flat';
    entries.push({ type: 'sgv', date: t, sgv: Math.round(v), direction, device: 'Demo FreeStyle Libre 2' });
  }
}
ns.insertEntries(db, pid, entries, 'api');
ns.insertTreatments(db, pid, treatments);

const token = 'r-demo' + sec.randomToken(8);
db.prepare('INSERT INTO shares (token, user_id, label, created_at) VALUES (?,?,?,?)').run(token, pid, 'Dr. Nurlanova', Date.now());
db.prepare('INSERT INTO doctor_patients (doctor_id, share_token, added_at) VALUES (?,?,?)').run(did, token, Date.now() - 864e5);
db.prepare('INSERT INTO notes (user_id, author_id, kind, text, created_at) VALUES (?,?,?,?,?)').run(pid, pid, 'message', 'Night lows again around 3 a.m. Should we lower the basal dose?', Date.now() - 3 * 3600e3);

console.log(`Demo data created: ${entries.length} glucose values, ${treatments.length} diary entries.`);
console.log('Patient: demo@endocontrol.app / demo1234');
console.log('Doctor:  doctor@endocontrol.app / demo1234');
