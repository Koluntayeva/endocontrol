'use strict';
// Smoke test: registration, Nightscout upload with api-secret, read-only share token.
const { test } = require('node:test');
const assert = require('node:assert');
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ec-'));
const { server } = require('../server');

test('register, upload like xDrip+, read via share token', async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const j = { 'Content-Type': 'application/json', 'X-EC': '1' };
  let r = await fetch(base + '/app/register', { method: 'POST', headers: j, body: JSON.stringify({ email: 't@e.st', password: 'abcd1234', name: 'T', consent: true }) });
  assert.equal(r.status, 200);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const me = await (await fetch(base + '/app/me', { headers: { cookie } })).json();
  const hash = crypto.createHash('sha1').update(me.user.upload.api_secret).digest('hex');
  r = await fetch(base + '/api/v1/entries', { method: 'POST', headers: { 'Content-Type': 'application/json', 'api-secret': hash }, body: JSON.stringify([{ type: 'sgv', sgv: 111, date: Date.now(), direction: 'Flat' }]) });
  assert.equal(r.status, 200);
  const share = await (await fetch(base + '/app/shares', { method: 'POST', headers: { ...j, cookie }, body: '{}' })).json();
  const list = await (await fetch(`${base}/api/v1/entries.json?token=${share.token}`)).json();
  assert.equal(list[0].sgv, 111);
  r = await fetch(`${base}/api/v1/entries?token=${share.token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"sgv":100}' });
  assert.equal(r.status, 401);
  server.close();
});

test('AI analyst answers mode off without an API key', async () => {
  delete process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_AUTH_TOKEN;
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const j = { 'Content-Type': 'application/json', 'X-EC': '1' };
  let r = await fetch(base + '/app/register', { method: 'POST', headers: j, body: JSON.stringify({ email: 'ai@e.st', password: 'abcd1234', name: 'A', consent: true }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  r = await fetch(base + '/app/ai', { method: 'POST', headers: { ...j, cookie }, body: JSON.stringify({ question: 'How was the week?' }) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).mode, 'off');
  r = await fetch(base + '/app/ai', { method: 'POST', headers: { ...j, cookie }, body: JSON.stringify({ question: '  ' }) });
  assert.equal(r.status, 400);
  r = await fetch(base + '/app/ai', { method: 'POST', headers: j, body: JSON.stringify({ question: 'x' }) });
  assert.equal(r.status, 401);
  server.close();
});

test('curve analysis finds a meal rise and the fall after it', () => {
  const { rises, answer } = require('../public/explain.js');
  const t0 = Date.UTC(2026, 0, 1, 7, 0); const pts = [];
  // flat 100, rise to 200 by +90 min, fall to 90 by +4 h
  for (let m = 0; m <= 300; m += 5) pts.push({ t: t0 + m * 60e3, v: m < 30 ? 100 : m <= 90 ? 100 + (m - 30) * (100 / 60) : Math.max(90, 200 - (m - 90) * 0.75) });
  const r = rises(pts);
  assert.equal(r.length, 1);
  assert.equal(r[0].peak.v, 200);
  assert.ok(r[0].nadir.v <= 100);
  const ctx = { entries: pts.map(p => [p.t, p.v]), treatments: [], now: t0 + 6 * 3600e3, lo: 70, hi: 180, t: k => k, g: v => String(Math.round(v)), unit: 'mg/dL', time: ms => new Date(ms).toISOString().slice(11, 16), dayStart: (ms, k = 0) => Date.UTC(2026, 0, 1 + k) };
  const text = answer('Why did glucose fall 2 hours after breakfast today?', ctx);
  assert.match(text, /exCurve/); assert.match(text, /exFall/); assert.match(text, /exWhyFall/);
  assert.equal(answer('What are ketones?', ctx), null);
});

test('meal entry: decimal dose with a comma, glucose at the meal and 2 h later from the sensor', async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const j = { 'Content-Type': 'application/json', 'X-EC': '1' };
  let r = await fetch(base + '/app/register', { method: 'POST', headers: j, body: JSON.stringify({ email: 'meal@e.st', password: 'abcd1234', name: 'M', consent: true }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const me = await (await fetch(base + '/app/me', { headers: { cookie } })).json();
  const hash = crypto.createHash('sha1').update(me.user.upload.api_secret).digest('hex');
  const meal = Date.now() - 3 * 3600e3;
  const entries = [];
  for (let m = -20; m <= 150; m += 5) entries.push({ type: 'sgv', date: meal + m * 60e3, sgv: m < 0 ? 110 : 110 + Math.min(m, 60) * 1.5 - Math.max(0, m - 60) * 1.2, direction: 'Flat' });
  await fetch(base + '/api/v1/entries', { method: 'POST', headers: { 'Content-Type': 'application/json', 'api-secret': hash }, body: JSON.stringify(entries) });
  r = await fetch(base + '/app/treatments', { method: 'POST', headers: { ...j, cookie }, body: JSON.stringify({ kind: 'meal', carbs: '45', insulin: '6,5', preBolus: 15, mealType: 'breakfast', at: new Date(meal).toISOString() }) });
  assert.equal(r.status, 200);
  const saved = await r.json();
  assert.equal(saved.insulin, 6.5); assert.equal(saved.carbs, 45); assert.equal(saved.glucose, 110); assert.equal(saved.mealType, 'breakfast');
  const d = await (await fetch(`${base}/app/data?from=${meal - 3600e3}&to=${Date.now()}`, { headers: { cookie } })).json();
  const x = d.treatments.find(t => t.eventType === 'Meal Bolus');
  assert.equal(x.bgAt, 110);
  assert.ok(Math.abs(x.bg2h - (110 + 90 - 60 * 1.2)) < 1, 'glucose 2 h after the meal');
  r = await fetch(base + '/app/treatments', { method: 'POST', headers: { ...j, cookie }, body: JSON.stringify({ kind: 'insulin', value: 'abc' }) });
  assert.equal(r.status, 400);
  server.close();
});

test('emergency helper reads only real glucose values from a message', () => {
  const U = require('../public/urgent.js');
  const cases = [['Почему сегодня через 2 часа после завтрака сахар начал снижаться?', null], ['сахар упал до 2,1 что делать?', 38], ['2,1', 38],
    ['сахар 3', 54], ['дала 15 г сока', null], ['вколола 6,5 ед', null], ['в 8:30 был завтрак', null], ['сахар 16 и рвота', 288],
    ['glucose 54 mg/dl', 54], ['уже 30 минут не поднимается', null], ['ребёнку 9 лет, сахар 2.8', 50], ['TIR 70% это хорошо?', null]];
  for (const [q, want] of cases) assert.equal(U.parseValue(q, true), want, q);
});

test('glucose alerts: fast fall, predicted low, fast rise, quiet repeats', () => {
  const A = require('../public/alerts.js');
  const now = Date.UTC(2026, 0, 1, 12);
  const series = (start, step, dir) => Array.from({ length: 4 }, (_, i) => [now - (3 - i) * 5 * 60e3, start + step * i, dir]);
  assert.equal(A.check(series(230, -15, 'SingleDown'), now).kind, 'fall');            // -3/min, still above 70 in 20 min
  assert.equal(A.check(series(120, -15, 'SingleDown'), now).kind, 'fallsoon');        // would reach < 70 in 20 min
  assert.equal(A.check(series(150, 15, 'SingleUp'), now).kind, 'rise');
  assert.equal(A.check(series(110, 1, 'Flat'), now), null);
  assert.equal(A.check(series(60, 0, 'Flat'), now).kind, 'low');
  assert.equal(A.check(series(50, 0, 'Flat'), now).level, 'critical');
  assert.equal(A.check(series(230, -15, 'SingleDown'), now + 30 * 60e3), null);       // stale reading
  const a = A.check(series(230, -15, 'SingleDown'), now);
  assert.equal(A.shouldFire(a, {}, now), true);
  assert.equal(A.shouldFire(a, { last: { kind: 'fall', at: now - 5 * 60e3 } }, now), false);
  assert.equal(A.shouldFire(A.check(series(60, 0, 'Flat'), now), { last: { kind: 'fall', at: now - 5 * 60e3 } }, now), true); // got worse
  assert.equal(A.shouldFire(a, { snoozeUntil: now + 60e3 }, now), false);
});

test('push: subscribe, a fast fall sends one alert in the user language, no repeat', async () => {
  const push = require('../lib/push'), ns = require('../lib/nsdata');
  const sent = [];
  push._setSender(async (sub, payload) => { sent.push({ sub, payload: JSON.parse(payload) }); return { statusCode: 201 }; });
  try {
    const { db } = require('../server');
    await new Promise(r => server.listen(0, r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const j = { 'Content-Type': 'application/json', 'X-EC': '1' };
    let r = await fetch(base + '/app/register', { method: 'POST', headers: j, body: JSON.stringify({ email: 'push@e.st', password: 'abcd1234', name: 'P', consent: true, lang: 'ru', units: 'mmol' }) });
    const cookie = r.headers.get('set-cookie').split(';')[0];
    r = await fetch(base + '/app/push/key', { headers: { cookie } });
    const k = await r.json();
    assert.equal(k.enabled, true); assert.ok(k.key.length > 40);
    r = await fetch(base + '/app/push/subscribe', { method: 'POST', headers: { ...j, cookie }, body: JSON.stringify({ endpoint: 'https://push.example/abc', keys: { p256dh: 'BPk', auth: 'au' } }) });
    assert.equal(r.status, 200);
    const me = await (await fetch(base + '/app/me', { headers: { cookie } })).json();
    const now = Date.now();
    ns.insertEntries(db, me.user.id, [0, 1, 2, 3].map(i => ({ type: 'sgv', date: now - (3 - i) * 5 * 60e3, sgv: 150 - 15 * i, direction: 'SingleDown' })), 'test');
    assert.equal(await push.checkAll(db, ns, now), 1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].sub.endpoint, 'https://push.example/abc');
    assert.equal(sent[0].payload.kind, 'fallsoon');
    assert.equal(sent[0].payload.url, '/#/ai/sos');
    assert.match(sent[0].payload.body, /Сахар быстро снижается: 5\.8 mmol\/L/);
    assert.equal(await push.checkAll(db, ns, now + 60e3), 0, 'no repeat a minute later');
    server.close();
  } finally { push._setSender(null); }
});
