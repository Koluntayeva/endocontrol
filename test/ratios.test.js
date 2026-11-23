'use strict';
// Approximate carb ratio per meal and sensitivity factor (public/ratios.js).
const test = require('node:test');
const assert = require('node:assert');
const R = require('../public/ratios.js');

const H = 3600e3, M = 60e3, T0 = Date.UTC(2026, 10, 19, 0);
const mg = x => Math.round(x * 18.0182);
// flat glucose with a few set points, linear in between
function curve(pts) { const out = []; for (let t = pts[0][0]; t <= pts[pts.length - 1][0]; t += 5 * M) { let k = 0; while (k < pts.length - 2 && pts[k + 1][0] <= t) k++; const [a, va] = pts[k], [b, vb] = pts[k + 1]; out.push([t, mg(va + (vb - va) * Math.min(1, (t - a) / (b - a)))]); } return out; }
const mealOf = x => x.mealType;

test('a meal saved as two entries counts once; a snack eaten on the fall is added to it', () => {
  const day1 = T0 + 10 * H, day2 = T0 + 4 * 24 * H + 11 * H;
  const entries = [...curve([[day1 - H, 7.4], [day1, 7.4], [day1 + 2 * H, 6], [day1 + 4 * H, 6.6]]),
    ...curve([[day2 - H, 4.9], [day2, 4.9], [day2 + 1.5 * H, 12], [day2 + 3 * H, 3.8], [day2 + 4 * H, 5.9]])];
  const treatments = [
    { mills: day1, carbs: 65, eventType: 'Carb Correction', mealType: 'breakfast' }, { mills: day1, insulin: 6, eventType: 'Correction Bolus' },
    { mills: day2, carbs: 44.9, insulin: 4.2, eventType: 'Meal Bolus', mealType: 'breakfast' },
    { mills: day2 + 2.9 * H, carbs: 5.7, eventType: 'Meal Bolus', mealType: 'snack' },
  ];
  const r = R.compute({ entries, treatments, mealOf, now: day2 + 6 * H, lo: 70 });
  const b = r.byMeal.breakfast;
  assert.equal(b.n, 2);
  assert.equal(b.items[1].carbs, 50.6, 'snack added to breakfast');
  assert.equal(b.items[1].low, true);
  assert.ok(Math.round(b.min) >= 10 && Math.round(b.max) <= 12, `${b.min}–${b.max}`);
  assert.equal(b.conf, 'low');
  assert.equal(r.byMeal.snack, null, 'a hypo snack is not a meal of its own');
  assert.equal(r.byMeal.lunch, null);
  assert.equal(r.isf.method, 'rule');
});

test('sensitivity is measured from a correction without food', () => {
  const t = T0 + 20 * H;
  const entries = curve([[t - H, 14], [t, 14], [t + 3 * H, 9.5], [t + 4 * H, 9.5]]);
  const r = R.compute({ entries, treatments: [{ mills: t, insulin: 2, eventType: 'Correction Bolus' }], mealOf, now: t + 5 * H });
  assert.equal(r.isf.method, 'measured');
  assert.ok(Math.abs(r.isf.value / 18.0182 - 2.25) < 0.1, String(r.isf.value / 18.0182));
});

test('a later correction does not drop the meal; a second meal bolus does', () => {
  const t = T0 + 12 * H;
  const entries = curve([[t, 6], [t + 5 * H, 6]]);
  const lunch = { mills: t, carbs: 52, insulin: 4, eventType: 'Meal Bolus', mealType: 'lunch' };
  let r = R.compute({ entries, mealOf, now: t + 6 * H, treatments: [lunch, { mills: t + 3.8 * H, insulin: .5, eventType: 'Correction Bolus' }] });
  assert.equal(r.byMeal.lunch.ratio, 13, '52 g ÷ 4 U = 1:13');
  assert.equal(r.byMeal.lunch.items[0].corrections[0].insulin, .5);
  r = R.compute({ entries, mealOf, now: t + 6 * H, treatments: [lunch, { mills: t + H, carbs: 20, insulin: 2, eventType: 'Meal Bolus', mealType: 'snack' }] });
  assert.equal(r.byMeal.lunch, null);
});

test('the family method: carbs ÷ bolus, then (carbs + snacks without a bolus) ÷ bolus', () => {
  const t = T0 + 9 * H;
  const entries = curve([[t, 6], [t + 5 * H, 6]]);
  const r = R.compute({ entries, mealOf, now: t + 6 * H, treatments: [
    { mills: t, carbs: 52, insulin: 4, eventType: 'Meal Bolus', mealType: 'breakfast' },
    { mills: t + 3 * H, carbs: 5, eventType: 'Meal Bolus', mealType: 'snack' }] });
  const m = r.byMeal.breakfast.items[0];
  assert.equal(m.base, 13); assert.equal(m.raw, 57 / 4); assert.equal(r.byMeal.breakfast.ratio, 14.25);
});
