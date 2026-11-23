'use strict';
/* Approximate insulin-to-carb ratio (per meal) and insulin sensitivity factor from the diary and
   the sensor. Only a guide for the family and the doctor: the app never turns it into a dose.
   Glucose in mg/dL, times in ms. Shared by the browser and the tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Ratios = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MIN = 60e3, H = 3600e3;
  const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

  function valueAt(entries, t, tol = 20 * MIN) {
    let best = null, bd = tol + 1;
    for (const e of entries) { const d = Math.abs(e[0] - t); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
  const isBasal = x => /basal/i.test(x.eventType || '');
  const conf = n => (n >= 10 ? 'good' : n >= 5 ? 'medium' : n >= 2 ? 'low' : 'prelim');

  // o: { entries: [[ms, mg]], treatments: [{mills, carbs, insulin, eventType, mealType, foods}], mealOf(x) -> meal, now, days }
  function compute(o) {
    const now = o.now || Date.now(), from = now - (o.days || 30) * 24 * H;
    const raw = (o.treatments || []).filter(x => x.mills >= from && x.mills <= now).sort((a, b) => a.mills - b.mills);
    // Carbs and the bolus saved as two entries a few minutes apart are one meal.
    const used = new Set(), tr = [];
    for (const x of raw) {
      if (used.has(x)) continue;
      const lone = k => y => !used.has(y) && y !== x && Math.abs(y.mills - x.mills) <= 15 * MIN && y[k] > 0 && !(y[k === 'carbs' ? 'insulin' : 'carbs'] > 0) && !isBasal(y);
      if (x.carbs > 0 && !(x.insulin > 0)) { const b = raw.find(lone('insulin')); if (b) { used.add(b); tr.push({ ...x, insulin: +b.insulin, eventType: 'Meal Bolus', mealType: x.mealType || b.mealType }); continue; } }
      if (x.insulin > 0 && !(x.carbs > 0) && !isBasal(x)) { const c = raw.find(lone('carbs')); if (c) { used.add(c); tr.push({ ...c, insulin: +x.insulin, mills: Math.min(c.mills, x.mills), eventType: 'Meal Bolus', mealType: c.mealType || x.mealType }); continue; } }
      tr.push(x);
    }
    tr.sort((a, b) => a.mills - b.mills);
    const entries = (o.entries || []).filter(e => e[0] >= from - H);
    const mealOf = o.mealOf || (x => x.mealType || 'snack');

    // 1) meals with their own bolus, plus carb-only snacks eaten within 4 h after it (eaten on a fall: the dose had a margin)
    const meals = [];
    for (const m of tr) {
      if (!(m.carbs > 0 && m.insulin > 0) || isBasal(m)) continue;
      const end = m.mills + 4 * H;
      if (tr.some(x => x !== m && x.insulin > 0 && !isBasal(x) && x.mills > m.mills - 2 * H && x.mills < end)) continue; // stacked boluses: can't tell which did what
      const snacks = tr.filter(x => x.carbs > 0 && !(x.insulin > 0) && x.mills > m.mills + 20 * MIN && x.mills <= end);
      const carbs = +m.carbs + snacks.reduce((a, x) => a + +x.carbs, 0);
      const b0 = valueAt(entries, m.mills, 15 * MIN);
      // glucose 4 h later, or the latest reading from 3 h on when the sensor stopped earlier
      let b1 = valueAt(entries, end, 20 * MIN);
      if (!b1 && now - m.mills >= 3 * H) b1 = entries.filter(e => e[0] >= m.mills + 3 * H && e[0] <= end + 20 * MIN).pop() || null;
      const nadir = entries.filter(e => e[0] > m.mills && e[0] <= end).reduce((a, e) => (!a || e[1] < a[1] ? e : a), null);
      meals.push({ at: m.mills, meal: mealOf(m), carbs, ownCarbs: +m.carbs, insulin: +m.insulin, snacks: snacks.map(x => ({ at: x.mills, carbs: +x.carbs })), b0: b0 && b0[1], b1: b1 && b1[1], nadir: nadir && nadir[1], raw: carbs / m.insulin });
    }

    // 2) sensitivity: corrections without food (bolus, no carbs from 1 h before to 3 h after, glucose high at the start)
    const corr = [];
    for (const c of tr) {
      if (!(c.insulin > 0) || c.carbs > 0 || isBasal(c)) continue;
      if (tr.some(x => x !== c && ((x.carbs > 0 && x.mills > c.mills - H && x.mills < c.mills + 3 * H) || (x.insulin > 0 && !isBasal(x) && Math.abs(x.mills - c.mills) < 3 * H)))) continue;
      const a = valueAt(entries, c.mills, 15 * MIN), b = valueAt(entries, c.mills + 3 * H, 20 * MIN);
      if (a && b && a[1] > 150 && a[1] - b[1] > 0) corr.push((a[1] - b[1]) / c.insulin);
    }
    const rawAll = meals.map(m => m.raw);
    let isf, isfMethod;
    if (corr.length) { isf = median(corr); isfMethod = 'measured'; }
    else if (rawAll.length) { isf = median(rawAll) * 3.4; isfMethod = 'rule'; } // ≈ 1700/TDD ÷ 500/TDD
    else { isf = null; isfMethod = null; }

    // 3) per meal: carbs ÷ the insulin the food actually needed (the bolus, corrected by where glucose ended up)
    for (const m of meals) {
      m.adj = null;
      if (isf && m.b0 != null && m.b1 != null) { const need = m.insulin + (m.b1 - m.b0) / isf; if (need > 0.2) m.adj = m.carbs / need; }
      m.low = m.nadir != null && m.nadir < (o.lo || 70);
    }
    const byMeal = {};
    for (const k of MEALS) {
      const list = meals.filter(m => m.meal === k);
      if (!list.length) { byMeal[k] = null; continue; }
      const vals = list.flatMap(m => [m.raw, m.adj].filter(v => v != null && isFinite(v)));
      byMeal[k] = { ratio: median(vals), min: Math.min(...vals), max: Math.max(...vals), n: list.length, days: new Set(list.map(m => new Date(m.at).toDateString())).size, conf: conf(list.length), items: list };
    }
    return { byMeal, isf: isf ? { value: isf, method: isfMethod, n: corr.length, conf: isfMethod === 'measured' ? conf(corr.length) : 'rule' } : null, meals };
  }

  return { compute, MEALS };
});
