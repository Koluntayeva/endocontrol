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
