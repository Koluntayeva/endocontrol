'use strict';
// Keeps the demo accounts "live" on a public demo server: every 5 minutes each demo patient
// gets a new simulated glucose value. Patients whose data was seeded as stopped (last value
// older than 15 minutes) stay stopped, so the doctor's "no data" example keeps working.
// Usage: node scripts/demo-feed.js   (runs until stopped; only touches demo*@endocontrol.app)
process.removeAllListeners('warning');
const path = require('node:path');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const sec = require('../lib/security');
const dbm = require('../lib/db');
const ns = require('../lib/nsdata');

sec.initKey(DATA_DIR);
const db = dbm.open(DATA_DIR);
const STEP = 5 * 60e3;

function dir(slope) {
  return slope > 3 ? 'DoubleUp' : slope > 2 ? 'SingleUp' : slope > 1 ? 'FortyFiveUp'
    : slope < -3 ? 'DoubleDown' : slope < -2 ? 'SingleDown' : slope < -1 ? 'FortyFiveDown' : 'Flat';
}

function tick() {
  const now = Date.now();
  const users = db.prepare("SELECT id FROM users WHERE email LIKE 'demo%@endocontrol.app'").all();
  for (const { id } of users) {
    const last = db.prepare("SELECT date, sgv FROM entries WHERE user_id=? AND type='sgv' ORDER BY date DESC LIMIT 1").get(id);
    if (!last || now - last.date > 15 * 60e3 || now - last.date < STEP - 30e3) continue;
    const avg = db.prepare("SELECT AVG(sgv) a FROM entries WHERE user_id=? AND type='sgv' AND date>?").get(id, now - 864e5).a || 140;
    const h = new Date(now).getHours() + new Date(now).getMinutes() / 60;
    const target = avg + 35 * Math.sin((h - 9) / 24 * 2 * Math.PI * 3);
    const v = Math.round(Math.max(45, Math.min(380, last.sgv + (target - last.sgv) * 0.08 + (Math.random() - 0.5) * 10)));
    ns.insertEntries(db, id, [{ type: 'sgv', date: now, sgv: v, direction: dir((v - last.sgv) / 5), device: 'Demo' }], 'api');
  }
}

tick();
setInterval(tick, STEP);
console.log('Demo feed running: a new value for each live demo patient every 5 minutes.');
