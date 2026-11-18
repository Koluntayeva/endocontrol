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
