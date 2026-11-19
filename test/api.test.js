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
