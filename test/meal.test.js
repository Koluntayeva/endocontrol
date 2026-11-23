'use strict';
// The analyst explains a meal from the diary: found by its label, with what was eaten and when the bolus went in.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../public/explain.js');
const F = require('../public/foods.js');
const OFF = require('../lib/openfood.js');

const sb = { window: {}, navigator: { language: 'ru' }, localStorage: { getItem() { return null; }, setItem() { } } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'i18n.js'), 'utf8'), sb);
const I = sb.window.I18N;
const H = 3600e3, M = 60e3;
const day = new Date(2026, 10, 23).getTime();          // local midnight
const at = (h, m = 0) => day + h * H + m * M;
const mmol = x => Math.round(x * 18.0182);

// 4.8 before the meal, a peak of 12 about 1.5 h later, a low of 3.7 three hours after the meal
const curve = [[0, 4.8], [11, 4.8], [11.5, 4.0], [11.75, 7.5], [12, 10.3], [12.5, 12.0], [13, 10.5], [13.5, 8.2], [14, 4.4], [14.25, 3.7], [14.5, 5.3]];
const entries = [];
for (let tm = at(0); tm <= at(14, 40); tm += 5 * M) {
  const h = (tm - day) / H; let k = 0; while (k < curve.length - 2 && curve[k + 1][0] <= h) k++;
  const [h0, v0] = curve[k], [h1, v1] = curve[k + 1];
  entries.push([tm, mmol(v0 + (v1 - v0) * Math.min(1, (h - h0) / (h1 - h0)))]);
}
const meal = { mills: at(11, 9), eventType: 'Meal Bolus', carbs: 44.9, insulin: 4.2, preBolus: 15, mealType: 'lunch', glucose: 88, notes: 'пауза 10 минут',
  foods: [{ name: 'голубика', g: 58, c: 4.9 }, { name: 'манная каша', g: 101, c: 23.6 }, { name: 'яблоко', g: 137, c: 15.6 }, { name: 'хлебцы гречневые', g: 12, c: 0.8 }, { name: 'сыр babybel', g: 20, c: 0 }] };
const ctx = { entries, treatments: [meal], now: at(14, 45), lo: 70, hi: 180, t: (k, v) => I.t('ru', k, v), g: mg => (mg / 18.0182).toFixed(1), unit: 'ммоль/л',
  time: ms => new Date(ms).toTimeString().slice(0, 5), dayStart: (ms, k = 0) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + k); return d.getTime(); },
  foodSpeed: F.speedOf, hasProteinFat: F.hasProteinFat };

test('a late breakfast logged after 11:00 is still found when asked about breakfast', () => {
  const a = E.answer('разбери завтрак', ctx);
  assert.match(a, /11:09/);
  assert.doesNotMatch(a, /нет записей о еде/);
  assert.match(a, /манная каша/);
  assert.match(a, /быстрыми/);                 // share of fast carbs
  assert.match(a, /Сначала высокий пик, потом низкий/);
  assert.match(a, /пауза 10 минут/);            // the note is shown
});

test('"I added the food, have a look" analyses the last meal', () => {
  const a = E.answer('добавила информацию о еде посмотри', ctx);
  assert.ok(a, 'an answer, not the generic review');
  assert.match(a, /11:09/); assert.match(a, /манная каша/);
});

test('food list: speed of carbs and protein for typed names', () => {
  assert.equal(F.speedOf({ name: 'манная каша' }), 'fast');
  assert.equal(F.speedOf({ name: 'гречка' }), 'slow');
  assert.equal(F.match({ name: 'голубика' }).id, 'blueberry');
  assert.equal(F.hasProteinFat({ name: 'сыр babybel' }), true);
  assert.ok(F.LIST.length >= 240);
  assert.equal(new Set(F.LIST.map(f => f.id)).size, F.LIST.length, 'ids are unique');
});

test('Open Food Facts: labels become foods, the service being busy falls back to the classic search', async () => {
  const calls = [];
  const fake = async url => {
    calls.push(url);
    if (url.includes('search.openfoodfacts')) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({ products: [
      { code: '1', product_name: 'Творожок &quot;Агуша&quot;', brands: 'Агуша', nutriments: { carbohydrates_100g: 13.2 }, serving_quantity: 100 },
      { code: '2', product_name: 'Без углеводов на этикетке', nutriments: {} }] }) };
  };
  const items = await OFF.search('творожок тест', 'ru', fake);
  assert.equal(calls.length, 2);
  assert.deepEqual(items.map(f => [f.name, f.c, f.serving]), [['Творожок "Агуша"', 13.2, 100]]);
});
