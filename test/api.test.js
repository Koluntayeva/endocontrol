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

test('food diary: food search, a meal with its foods, photo needs the AI', async () => {
  const F = require('../public/foods.js');
  assert.equal(F.search('плов', 'ru')[0].id, 'plov');
  assert.equal(F.carbs(F.BY_ID.rice, 150), 42);
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const j = { 'Content-Type': 'application/json', 'X-EC': '1' };
  let r = await fetch(base + '/app/register', { method: 'POST', headers: j, body: JSON.stringify({ email: 'food@e.st', password: 'abcd1234', name: 'F', consent: true }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  r = await fetch(base + '/app/treatments', { method: 'POST', headers: { ...j, cookie }, body: JSON.stringify({ kind: 'meal', mealType: 'lunch', carbs: 62, insulin: '4,5', preBolus: 15,
    foods: [{ id: 'plov', name: 'Плов с мясом', g: 250, c: 50 }, { id: 'bread_white', name: 'Хлеб', g: 25, c: 12 }], at: new Date().toISOString() }) });
  assert.equal(r.status, 200);
  const d = await (await fetch(`${base}/app/data?from=${Date.now() - 3600e3}&to=${Date.now() + 60e3}`, { headers: { cookie } })).json();
  const meal = d.treatments.find(x => x.eventType === 'Meal Bolus');
  assert.equal(meal.foods.length, 2); assert.equal(meal.foods[0].name, 'Плов с мясом'); assert.equal(meal.insulin, 4.5); assert.equal(meal.mealType, 'lunch');
  delete process.env.ANTHROPIC_API_KEY;
  r = await fetch(base + '/app/food/photo', { method: 'POST', headers: { ...j, cookie }, body: JSON.stringify({ image: 'data:image/jpeg;base64,AAAA' }) });
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'ai_needed');
  r = await fetch(base + '/app/food/photo', { method: 'POST', headers: { ...j, cookie }, body: JSON.stringify({ image: 'not an image' }) });
  assert.equal(r.status, 400);
  server.close();
});

test('diary: insulin with its purpose, a meter reading with context, medicines, weight', async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const j = { 'Content-Type': 'application/json', 'X-EC': '1' };
  let r = await fetch(base + '/app/register', { method: 'POST', headers: j, body: JSON.stringify({ email: 'rec@e.st', password: 'abcd1234', name: 'R', consent: true }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const post = (body, min) => fetch(base + '/app/treatments', { method: 'POST', headers: { ...j, cookie }, body: JSON.stringify({ ...body, at: new Date(Date.now() - min * 60e3).toISOString() }) });
  assert.equal((await post({ kind: 'insulin', value: '1,5', insulinType: 'snack' }, 50)).status, 200);
  assert.equal((await post({ kind: 'insulin', value: 8, insulinType: 'basal' }, 40)).status, 200);
  assert.equal((await post({ kind: 'bg', value: 112, bgContext: 'before' }, 30)).status, 200);
  assert.equal((await post({ kind: 'med', meds: [{ name: 'Парацетамол', dose: '1 таб.' }, { name: '' }] }, 20)).status, 200);
  assert.equal((await post({ kind: 'weight', value: '31,4', fat: 18 }, 10)).status, 200);
  assert.equal((await post({ kind: 'med', meds: [] }, 5)).status, 400);
  assert.equal((await post({ kind: 'weight', value: 0 }, 5)).status, 400);
  const d = await (await fetch(`${base}/app/data?from=${Date.now() - 3600e3}&to=${Date.now() + 60e3}`, { headers: { cookie } })).json();
  const by = e => d.treatments.find(x => x.eventType === e);
  assert.equal(by('Meal Bolus').reason, 'snack'); assert.equal(by('Meal Bolus').insulin, 1.5);
  assert.equal(by('Basal Insulin').insulin, 8);
  assert.equal(by('BG Check').bgContext, 'before');
  assert.deepEqual(by('Medication').meds, [{ name: 'Парацетамол', dose: '1 таб.' }]);
  assert.equal(by('Weight').weight, 31.4); assert.equal(by('Weight').fat, 18);
  server.close();
});

test('notifications log: alerts worked out from the readings, without repeats', () => {
  const A = require('../public/alerts.js');
  const M = 60e3, T = Date.UTC(2026, 0, 1), es = [];
  for (let i = 0; i < 40; i++) es.push([T + i * 5 * M, i < 20 ? 120 : i < 30 ? 120 - (i - 20) * 9 : 50, null]); // slow fall into a long low
  for (let i = 40; i < 100; i++) es.push([T + i * 5 * M, i < 50 ? 120 : 270, null]);                        // back in range, then a long high
  const kinds = A.history(es, { lo: 70, hi: 180 }).map(a => a.kind);
  assert.deepEqual(kinds.slice(0, 2), ['low', 'verylow']);
  assert.equal(kinds.filter(k => k === 'verylow').length, 2, 'a low still there after 45 minutes is logged again, not every reading');
  assert.ok(kinds.filter(k => k === 'high').length <= 2, 'a long high is not logged every reading');
});

test('diary: a meal saved under the wrong meal can be moved to another one', async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const j = { 'Content-Type': 'application/json', 'X-EC': '1' };
  let r = await fetch(base + '/app/register', { method: 'POST', headers: j, body: JSON.stringify({ email: 'move@e.st', password: 'abcd1234', name: 'M', consent: true }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  r = await fetch(base + '/app/treatments', { method: 'POST', headers: { ...j, cookie }, body: JSON.stringify({ kind: 'meal', mealType: 'lunch', carbs: 45, insulin: 4, foods: [{ name: 'Манная каша', g: 150, c: 23 }], at: new Date().toISOString() }) });
  const saved = await r.json();
  r = await fetch(base + '/app/treatments/' + saved._id, { method: 'PATCH', headers: { ...j, cookie }, body: JSON.stringify({ mealType: 'breakfast' }) });
  assert.equal(r.status, 200);
  assert.equal((await fetch(base + '/app/treatments/' + saved._id, { method: 'PATCH', headers: { ...j, cookie }, body: JSON.stringify({ mealType: 'brunch' }) })).status, 400);
  assert.equal((await fetch(base + '/app/treatments/999999', { method: 'PATCH', headers: { ...j, cookie }, body: JSON.stringify({ mealType: 'dinner' }) })).status, 404);
  const d = await (await fetch(`${base}/app/data?from=${Date.now() - 3600e3}&to=${Date.now() + 60e3}`, { headers: { cookie } })).json();
  const m = d.treatments.find(x => x._id === saved._id);
  assert.equal(m.mealType, 'breakfast'); assert.equal(m.foods[0].name, 'Манная каша'); assert.equal(m.carbs, 45);
  server.close();
});

test('plate builder: the page is served and a plate is saved as a meal with each food\'s КБЖУ', async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await (await fetch(base + '/plate.html')).text();
  assert.match(page, /plate\.js/); assert.doesNotMatch(page, /<script>/, 'no inline scripts (CSP)');
  const vm = require('node:vm'); const sb = { window: {} }; vm.runInNewContext(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'foods-plate.js'), 'utf8').replace('var PLATE_FOODS', 'window.PLATE_FOODS'), sb);
  const foods = sb.window.PLATE_FOODS; assert.ok(foods.length >= 140); assert.equal(new Set(foods.map(f => f.id)).size, foods.length);
  assert.ok(foods.every(f => f.c >= 0 && f.c <= 100 && f.k >= 0 && f.cell.length === 3));
  const j = { 'Content-Type': 'application/json', 'X-EC': '1' };
  let r = await fetch(base + '/app/register', { method: 'POST', headers: j, body: JSON.stringify({ email: 'plate@e.st', password: 'abcd1234', name: 'P', consent: true }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  r = await fetch(base + '/app/treatments', { method: 'POST', headers: { ...j, cookie }, body: JSON.stringify({ kind: 'meal', mealType: 'dinner', carbs: 33.5, insulin: 0, at: new Date().toISOString(),
    foods: [{ id: 'plate-mash', name: 'Пюре картофельное', g: 200, c: 29, k: 212, p: 5, f: 8.4 }, { id: 'plate-cutlet', name: 'Котлета', g: 50, c: 4.5, k: 115, p: 7, f: 8 }] }) });
  assert.equal(r.status, 200);
  const d = await (await fetch(`${base}/app/data?from=${Date.now() - 3600e3}&to=${Date.now() + 60e3}`, { headers: { cookie } })).json();
  const m = d.treatments.find(x => x.mealType === 'dinner');
  assert.equal(m.carbs, 33.5); assert.deepEqual(m.foods[0], { id: 'plate-mash', name: 'Пюре картофельное', g: 200, c: 29, k: 212, p: 5, f: 8.4 });
  server.close();
});

test('bridges: Nightscout is polled every minute, sensor clouds every 5 minutes', () => {
  const B = require('../lib/bridges');
  assert.equal(B.pollEvery('nightscout'), 60e3);
  assert.equal(B.pollEvery('librelinkup'), 5 * 60e3);
  assert.equal(B.pollEvery('dexcom'), 5 * 60e3);
});

test('diary: a saved entry can be edited — time, meal, grams of each food, carbs, bolus, note', async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const j = { 'Content-Type': 'application/json', 'X-EC': '1' };
  let r = await fetch(base + '/app/register', { method: 'POST', headers: j, body: JSON.stringify({ email: 'edit@e.st', password: 'abcd1234', name: 'E', consent: true }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const H = { ...j, cookie }, t0 = Date.now() - 3 * 3600e3;
  r = await fetch(base + '/app/treatments', { method: 'POST', headers: H, body: JSON.stringify({ kind: 'meal', mealType: 'lunch', carbs: 50, insulin: 4, preBolus: 15, at: new Date(t0).toISOString(),
    foods: [{ name: 'Плов', g: 250, c: 45, p: 16, f: 21 }, { name: 'Сок', g: 50, c: 5 }] }) });
  const id = (await r.json())._id;
  const at2 = new Date(t0 - 30 * 60e3).toISOString();
  r = await fetch(base + '/app/treatments/' + id, { method: 'PATCH', headers: H, body: JSON.stringify({ at: at2, mealType: 'breakfast', carbs: 36, insulin: 3.5, preBolus: 0, notes: 'поправила граммы',
    foods: [{ name: 'Плов', g: 200, c: 36, p: 12.8, f: 16.8 }] }) });
  assert.equal(r.status, 200);
  const e = await r.json();
  assert.equal(e.mills, Date.parse(at2)); assert.equal(e.mealType, 'breakfast'); assert.equal(e.carbs, 36); assert.equal(e.insulin, 3.5);
  assert.equal(e.preBolus, 0); assert.equal(e.notes, 'поправила граммы'); assert.equal(e.foods.length, 1); assert.equal(e.foods[0].g, 200);
  // a meal can't be emptied, and a bad number is refused
  assert.equal((await fetch(base + '/app/treatments/' + id, { method: 'PATCH', headers: H, body: JSON.stringify({ carbs: 0, insulin: 0 }) })).status, 400);
  assert.equal((await fetch(base + '/app/treatments/' + id, { method: 'PATCH', headers: H, body: JSON.stringify({ insulin: 'много' }) })).status, 400);
  // the old "move to another meal" call still works
  assert.equal((await fetch(base + '/app/treatments/' + id, { method: 'PATCH', headers: H, body: JSON.stringify({ mealType: 'dinner' }) })).status, 200);
  server.close();
});
