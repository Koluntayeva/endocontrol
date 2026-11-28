'use strict';
process.removeAllListeners('warning');
// Adds 13 more demo patients to the demo doctor's list. Run after scripts/demo.js.
const path = require('node:path');
const APP = path.join(__dirname, '..');
const sec = require(APP + '/lib/security'), dbm = require(APP + '/lib/db'), ns = require(APP + '/lib/nsdata');
const DATA_DIR = process.env.DATA_DIR || path.join(APP, 'data');
sec.initKey(DATA_DIR); const db = dbm.open(DATA_DIR);
const did = db.prepare("SELECT id FROM users WHERE email='doctor@endocontrol.app'").get().id;
db.prepare("UPDATE notes SET text='Ночью снова низкие около 3 часов. Может, уменьшить базальный?' WHERE text LIKE 'Night lows%'").run();
let seed = 99; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
// [parent, child, base mg/dL, swing, hypo chance, data stops N hours ago, message, days since added]
const P = [
  ['Гульнара', 'Амина (7)', 150, 1.0, 0.15, 0, 'Добрый день! Прикрепила отчёт за неделю, после школы сахар высокий.', 2],
  ['Ерлан', 'Данияр (12)', 185, 1.4, 0.05, 0, null, 5],
  ['Мадина', 'Сафия (5)', 120, 1.1, 0.45, 0, 'Сегодня ночью было 2,6, дали сок. Что делать?', 1],
  ['Асель', 'Тимур (14)', 210, 1.6, 0.1, 0, null, 9],
  ['Жанар', 'Аружан (10)', 140, 0.8, 0.1, 0, null, 12],
  ['Нурлан', 'Арсен (8)', 145, 1.0, 0.2, 7, null, 4],
  ['Айгуль', 'Милана (6)', 160, 1.2, 0.25, 0, 'Мы заболели, температура 38,5, сахар держится высоко.', 3],
  ['Самал', 'Әлихан (11)', 135, 0.7, 0.05, 0, null, 20],
  ['Динара', 'Ясмин (9)', 175, 1.3, 0.15, 0, null, 7],
  ['Бауыржан', 'Нурасыл (13)', 155, 1.1, 0.3, 30, null, 15],
  ['Алия', 'Камила (4)', 130, 1.3, 0.35, 0, null, 6],
  ['Олжас', 'Ерасыл (16)', 230, 1.5, 0.02, 0, 'Подросток перестал записывать еду, как быть?', 8],
  ['Карлыгаш', 'Айша (3)', 145, 1.4, 0.2, 0, null, 25],
];
const now = Date.now();
P.forEach(([parent, child, base, swing, hypoP, stopH, msg, addedD], k) => {
  const email = `demo${k + 2}@endocontrol.app`;
  const old = db.prepare('SELECT id FROM users WHERE email=?').get(email); if (old) db.prepare('DELETE FROM users WHERE id=?').run(old.id);
  const s = sec.newApiSecret();
  const uid = Number(db.prepare(`INSERT INTO users (email, pass_hash, name, role, patient_name, diabetes_type, lang, units, api_secret_enc, api_secret_sha1, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(email, sec.hashPassword('demo1234'), parent, 'patient', child, 't1', 'ru', 'mmol', sec.encrypt(s), sec.sha1(s), new Date().toISOString()).lastInsertRowid);
  const end = now - stopH * 3600e3, E = [], T = [];
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 20);
  for (let d = 0; d < 21; d++) {
    const day = start.getTime() + d * 864e5;
    const meals = [[7.5 + rnd(), 30 + rnd() * 25], [13 + rnd(), 40 + rnd() * 30], [19 + rnd() * 1.5, 35 + rnd() * 30]];
    const hypo = rnd() < hypoP;
    for (const [h, c] of meals) { const t = day + h * 3600e3; if (t < end) T.push({ eventType: 'Meal Bolus', created_at: new Date(t).toISOString(), carbs: Math.round(c / 5) * 5, insulin: Math.round(c / 15 * 2) / 2, enteredBy: 'demo' }); }
    let ar = 0;
    for (let i = 0; i < 288; i++) {
      const t = day + i * 300e3; if (t > end) break;
      const h = i / 12; let v = base + 20 * Math.exp(-((h - 6.5) ** 2) / 3);
      for (const [mh, c] of meals) { const dt = (h - mh) * 60; if (dt > 0) { const x = dt / 65; v += c * 1.6 * swing * x * Math.exp(1 - x); } }
      if (hypo) v -= (base - 45) * Math.exp(-((h - 2.8) ** 2) / 1.1);
      ar = ar * 0.94 + (rnd() - 0.5) * 9 * swing; v = Math.max(40, Math.min(400, v + ar));
      const prev = E.length ? E[E.length - 1].sgv : v, sl = (v - prev) / 5;
      E.push({ type: 'sgv', date: t, sgv: Math.round(v), direction: sl > 2 ? 'SingleUp' : sl > 1 ? 'FortyFiveUp' : sl < -2 ? 'SingleDown' : sl < -1 ? 'FortyFiveDown' : 'Flat', device: 'Demo' });
    }
  }
  ns.insertEntries(db, uid, E, 'api'); ns.insertTreatments(db, uid, T);
  const token = 'r-demo' + sec.randomToken(8);
  db.prepare('INSERT INTO shares (token, user_id, label, created_at) VALUES (?,?,?,?)').run(token, uid, 'Dr. Nurlanova', now);
  db.prepare('INSERT INTO doctor_patients (doctor_id, share_token, added_at) VALUES (?,?,?)').run(did, token, now - addedD * 864e5);
  if (msg) db.prepare('INSERT INTO notes (user_id, author_id, kind, text, created_at) VALUES (?,?,?,?,?)').run(uid, uid, 'message', msg, now - (1 + k) * 1800e3);
});
console.log('added', P.length);
