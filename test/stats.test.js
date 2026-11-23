'use strict';
// Glucose variability helpers from public/charts.js (MAGE, MODD).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = { window: {}, document: { addEventListener() { } }, addEventListener() { } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'charts.js'), 'utf8'), sandbox);
const C = sandbox.window.Charts;
const T0 = Date.UTC(2026, 0, 1), STEP = 5 * 60e3;
const series = (n, f) => Array.from({ length: n }, (_, i) => [T0 + i * STEP, f(i)]);

test('MAGE follows the size of real swings and ignores a flat line', () => {
  const swings = series(288 * 3, i => 140 + 60 * Math.sin(i / 288 * 2 * Math.PI * 3)); // 3 swings a day, 120 mg/dL peak to nadir
  const m = C.mage(swings);
  assert.ok(m > 100 && m <= 120, 'MAGE ' + m);
  assert.strictEqual(C.mage(series(100, () => 120)), 0);
  assert.strictEqual(C.mage(series(5, i => i)), null);
});

test('MODD compares the same time on consecutive days', () => {
  const same = series(288 * 2, i => 100 + (i % 288) / 4); // identical days
  assert.ok(C.modd(same) < 0.01);
  const shifted = series(288 * 2, i => (i < 288 ? 100 : 130)); // second day 30 higher
  assert.ok(Math.abs(C.modd(shifted) - 30) < 0.01);
  assert.strictEqual(C.modd(series(200, () => 100)), null); // less than a day
});
