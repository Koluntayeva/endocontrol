'use strict';
/* Glucose curve analysis shared by the server (data summary for the AI) and the browser
   (answers to questions about a meal or a time of day when the AI is not connected).
   All glucose values are mg/dL, times are epoch ms. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Explain = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MIN = 60e3, HOUR = 3600e3;

  // Reading closest to time t, within `tol` ms.
  function valueAt(points, t, tol = 12 * MIN) {
    let best = null, bd = Infinity;
    for (const p of points) { const d = Math.abs(p.t - t); if (d < bd) { bd = d; best = p; } if (p.t > t + tol) break; }
    return bd <= tol ? best : null;
  }

  // Rises of at least `minRise` mg/dL reached within 2 h of a low point: meals, mostly.
  // For each: start, peak, values 1/2/3 h after the start, the lowest point within 4 h
  // after the peak and the steepest fall rate over an hour after the peak.
  function rises(points, minRise = 30) {
    const out = [];
    let i = 0;
    while (i < points.length) {
      let lowIdx = i, found = -1;
      for (let j = i; j < points.length; j++) {
        if (points[j].v < points[lowIdx].v || points[j].t - points[lowIdx].t > 2 * HOUR) lowIdx = j;
        if (points[j].v - points[lowIdx].v >= minRise) { found = j; break; }
      }
      if (found < 0) break;
      let peakIdx = found;
      for (let k = found; k < points.length && points[k].t - points[found].t < 3 * HOUR; k++) {
        if (points[k].v > points[peakIdx].v) peakIdx = k;
        if (points[peakIdx].v - points[k].v > 25) break;
      }
      const start = points[lowIdx], peak = points[peakIdx];
      const after = points.filter(p => p.t > peak.t && p.t <= peak.t + 4 * HOUR);
      const nadir = after.reduce((m, p) => (!m || p.v < m.v ? p : m), null);
      let fallRate = 0;
      for (const p of after) {
        const q = valueAt(points, p.t + HOUR, 15 * MIN);
        if (q) fallRate = Math.max(fallRate, (p.v - q.v) / ((q.t - p.t) / HOUR));
      }
      out.push({
        start, peak, nadir, fallRate,
        at1: valueAt(points, start.t + HOUR), at2: valueAt(points, start.t + 2 * HOUR), at3: valueAt(points, start.t + 3 * HOUR),
      });
      const next = points.findIndex(p => p.t > peak.t + 30 * MIN);
      if (next < 0) break;
      i = next;
    }
    return out;
  }

  // The curve after a known moment (a logged meal): peak within 3 h, lowest point within 4 h after it.
  function fromTime(points, t0) {
    const start = valueAt(points, t0, 20 * MIN) || points.find(p => p.t >= t0 && p.t < t0 + 30 * MIN);
    if (!start) return null;
    const win = points.filter(p => p.t >= start.t && p.t <= t0 + 3 * HOUR);
    if (win.length < 3) return null;
    const peak = win.reduce((m, p) => (p.v > m.v ? p : m), win[0]);
    const after = points.filter(p => p.t > peak.t && p.t <= peak.t + 4 * HOUR);
    const nadir = after.reduce((m, p) => (!m || p.v < m.v ? p : m), null);
    let fallRate = 0;
    for (const p of after) { const q = valueAt(points, p.t + HOUR, 15 * MIN); if (q) fallRate = Math.max(fallRate, (p.v - q.v) / ((q.t - p.t) / HOUR)); }
    return { start, peak, nadir, fallRate };
  }

  // ------------------------------------------------------------- question answering
  const RX = {
    yesterday: /вчера|yesterday|кеше/i,
    dayBefore: /позавчера|day before yesterday|алдыңғы күні/i,
    breakfast: /завтрак|breakfast|таңғы/i,
    lunch: /обед|lunch|түскі/i,
    dinner: /ужин|dinner|supper|кешкі/i,
    night: /ноч|night|түн/i,
    fall: /сниж|пада|упал|опуст|drop|fall|low|гипо|hypo|төмен|түс/i,
    rise: /выс|подня|подним|рост|раст|rise|high|spike|peak|пик|жоғары|көтер/i,
    hours: /(\d+(?:[.,]\d+)?)\s*(?:-?х\s*)?(?:час|ч\b|h\b|hour|сағ)/i,
    clock: /(?:в|at|около|about|сағат)\s*(\d{1,2})(?:[:.](\d{2}))?/i,
    // "I added the food, have a look", "разбери еду", "посмотри последний приём пищи"
    look: /добав|ввел|ввела|записал|внес|внёс|посмотр|разбер|глян|провер|оцени|added|logged|look|check|review|қос|қара|тексер/i,
    food: /ед[аеуы]|еду|блюд|приём пищи|прием пищи|перекус|meal|food|snack|тамақ|ас\b/i,
  };

  // What was eaten and how the bolus was timed: the reasons a curve looks the way it does.
  function mealDetails(m, ep, spikeLow, ctx) {
    const { t, g } = ctx, out = [];
    const foods = Array.isArray(m.foods) ? m.foods.filter(f => f && f.name) : [];
    if (foods.length) {
      const sp = f => (ctx.foodSpeed ? ctx.foodSpeed(f) : null);
      const tot = foods.reduce((a, f) => a + (+f.c || 0), 0);
      const fast = foods.filter(f => sp(f) === 'fast').reduce((a, f) => a + (+f.c || 0), 0);
      // grams of protein/fat foods (meat, eggs, cheese, nuts…): under ~40 g they hardly slow a carb-rich meal
      const pfG = ctx.hasProteinFat ? foods.filter(f => ctx.hasProteinFat(f)).reduce((a, f) => a + (+f.g || 0), 0) : 999;
      out.push(t('exFoods', { items: foods.filter(f => +f.c > 0 || sp(f) === 'protein').sort((a, b) => (+b.c || 0) - (+a.c || 0))
        .map(f => `${f.name} — ${Math.round(+f.c || 0)} ${t('gCarbs')}${sp(f) === 'fast' ? ' ' + t('exFastTag') : sp(f) === 'slow' ? ' ' + t('exSlowTag') : ''}`).join(', ') }));
      if (tot > 0 && fast / tot >= 0.4) out.push(t('exFastShare', { p: Math.round(fast / tot * 100) }));
      if (tot >= 20 && fast / tot >= 0.4 && pfG < 40) out.push(t('exLittlePf'));
    }
    if (m.insulin > 0) {
      const pre = Number(m.preBolus);
      const ratio = m.carbs > 0 ? Math.round(m.carbs / m.insulin * 10) / 10 : null;
      out.push(t(Number.isFinite(pre) ? (pre > 0 ? 'exPreBefore' : pre < 0 ? 'exPreAfter' : 'exPreWith') : 'exPreUnknown', { n: Math.abs(pre), ins: +(+m.insulin).toFixed(1), r: ratio || '—' }));
    }
    if (m.glucose > 0) out.push(t('exBgBefore', { v: g(m.units === 'mmol' ? m.glucose * 18.0182 : m.glucose), u: ctx.unit }));
    if (m.notes) out.push(t('exNote', { text: String(m.notes).slice(0, 200) }));
    if (spikeLow) out.push(t('exSpikeLow', { v: g(ep.nadir.v), t: ctx.time(ep.nadir.t) }));
    if (ep && ep.peak.v > ctx.hi && foods.length) out.push(t(spikeLow ? 'exTipsSpikeLow' : 'exTipsSpike'));
    return out;
  }

  // Answers a question about one meal or moment. Returns null when the question is not
  // about a particular time, so the caller can use its general answer instead.
  // ctx: { entries: [[ms, mg]], treatments: [{mills, carbs, insulin, eventType}], now,
  //        lo, hi, t(key, vars), g(mg) -> string, unit, time(ms) -> "HH:MM", dayStart(ms, k) }
  function answer(q, ctx) {
    let meal = RX.breakfast.test(q) ? 'breakfast' : RX.lunch.test(q) ? 'lunch' : RX.dinner.test(q) ? 'dinner' : RX.night.test(q) ? 'night' : null;
    const clock = RX.clock.exec(q);
    const hrs = RX.hours.exec(q);
    const { t, g } = ctx;
    let dayOffset = RX.dayBefore.test(q) ? -2 : RX.yesterday.test(q) ? -1 : 0;
    const meals = (ctx.treatments || []).filter(x => x.carbs > 0 && x.eventType !== 'Temp Basal').sort((a, b) => a.mills - b.mills);
    // The meal asked about: by its label in the diary (a late breakfast at 11:30 is still breakfast),
    // or the last meal when the question is "I added the food, have a look".
    let anchor = null;
    if (meal && meal !== 'night') {
      const dd0 = ctx.dayStart(ctx.now, dayOffset), dd1 = ctx.dayStart(ctx.now, dayOffset + 1);
      const day = meals.filter(x => x.mills >= dd0 && x.mills < dd1);
      anchor = day.find(x => x.mealType === meal)
        || (meal === 'breakfast' ? day.find(x => !x.mealType || x.mealType === 'lunch') : null);
      if (anchor && meal === 'breakfast' && anchor.mealType !== 'breakfast' && new Date(anchor.mills).getHours() >= 13) anchor = null;
    } else if (!clock && !hrs && (RX.look.test(q) || RX.food.test(q))) {
      anchor = [...meals].reverse().find(x => x.mills <= ctx.now && ctx.now - x.mills < 12 * HOUR) || null;
      if (anchor) { meal = anchor.mealType || null; dayOffset = Math.round((ctx.dayStart(anchor.mills) - ctx.dayStart(ctx.now)) / 864e5); }
    }
    const timeAsked = anchor || meal || clock || hrs || /сегодня|today|бүгін|вчера|yesterday|кеше/i.test(q);
    if (!timeAsked) return null;
    const d0 = ctx.dayStart(ctx.now, dayOffset), d1 = ctx.dayStart(ctx.now, dayOffset + 1);
    const win = meal === 'breakfast' ? [5, 11] : meal === 'lunch' ? [11, 16] : meal === 'dinner' ? [16, 23] : meal === 'night' ? [0, 7]
      : clock ? [Math.max(0, +clock[1] - 1), Math.min(24, +clock[1] + 1)] : [0, 24];
    let w0 = d0 + win[0] * HOUR, w1 = Math.min(d0 + win[1] * HOUR, d1);
    if (anchor) { w0 = anchor.mills - 30 * MIN; w1 = anchor.mills + 4 * HOUR; }
    const when = t(dayOffset === 0 ? 'exToday' : dayOffset === -1 ? 'exYesterday' : 'exDayBefore');
    const mealName = t(meal ? 'ex_' + meal : anchor ? 'exMeal' : 'exPeriod');
    const points = ctx.entries.filter(e => e[0] >= d0 - 2 * HOUR && e[0] < d1 + 4 * HOUR).map(e => ({ t: e[0], v: e[1] }));
    const inWin = points.filter(p => p.t >= w0 && p.t < w1);
    if (!inWin.length) return t('exNoData', { when, meal: mealName });

    const out = [];
    const logged = (ctx.treatments || []).filter(x => x.mills >= (anchor ? anchor.mills - 30 * MIN : w0 - HOUR) && x.mills < w1 && (x.carbs > 0 || x.insulin > 0) && x.eventType !== 'Temp Basal');
    const firstLog = anchor || logged.find(x => x.carbs > 0) || logged[0];
    // The meal: the logged entry if there is one, otherwise the biggest rise that starts in the window.
    // A logged meal anchors the curve at its own time; otherwise take the biggest rise in the window.
    let ep = firstLog ? fromTime(points, firstLog.mills) : null;
    if (!ep) ep = rises(points, 25).filter(r => r.start.t >= w0 && r.start.t < w1).sort((a, b) => (b.peak.v - b.start.v) - (a.peak.v - a.start.v))[0] || null;
    const vals = inWin.map(p => p.v);

    if (!ep) {
      out.push(t('exNoRise', { meal: mealName, when, min: g(Math.min(...vals)), max: g(Math.max(...vals)), u: ctx.unit, from: ctx.time(w0), to: ctx.time(Math.min(w1, inWin[inWin.length - 1].t)) }));
    } else {
      out.push(t('exCurve', { meal: mealName, when, t0: ctx.time(ep.start.t), v0: g(ep.start.v), vp: g(ep.peak.v), tp: ctx.time(ep.peak.t), u: ctx.unit }));
      const n = hrs ? parseFloat(hrs[1].replace(',', '.')) : null;
      const base = firstLog ? firstLog.mills : ep.start.t;
      const marks = n ? [n] : [2, 3];
      for (const h of marks) { const p = valueAt(points, base + h * HOUR); if (p && p.t <= ctx.now) out.push(t('exAt', { n: String(h).replace('.', ','), t: ctx.time(p.t), v: g(p.v) })); }
      if (ep.nadir && ep.peak.v - ep.nadir.v >= 18) out.push(t('exFall', { tp: ctx.time(ep.peak.t), h: (Math.round((ep.peak.t - base) / HOUR * 2) / 2).toString().replace('.', ','), rate: g(ep.fallRate), vmin: g(ep.nadir.v), tmin: ctx.time(ep.nadir.t), u: ctx.unit }));
    }
    if (logged.length) out.push(t('exLogged', { items: logged.map(x => `${ctx.time(x.mills)} ${x.carbs > 0 ? t('exCarbs', { n: Math.round(x.carbs) }) : ''}${x.carbs > 0 && x.insulin > 0 ? ', ' : ''}${x.insulin > 0 ? t('exIns', { n: +(+x.insulin).toFixed(1) }) : ''}`).join('; ') }));
    else out.push(t('exNoDiary'));
    const spikeLow = ep && ep.peak.v > ctx.hi && ep.nadir && ep.nadir.v < ctx.lo;
    const details = firstLog ? mealDetails(firstLog, ep, spikeLow, ctx) : [];
    out.push(...details);
    const explained = spikeLow && firstLog; // the peak and the low are already explained above

    const asksFall = RX.fall.test(q), asksRise = RX.rise.test(q) && !asksFall;
    const fell = ep && ep.nadir && ep.peak.v - ep.nadir.v >= 18;
    if (explained) { /* nothing generic to add */ } else if (asksFall || (!asksRise && fell)) {
      if (ep && !fell) out.push(t('exNoFall'));
      out.push(t('exWhyFall'));
      if (ep && ep.nadir && ep.nadir.v < ctx.lo) out.push(t('exFallBelow', { v: g(ep.nadir.v), t: ctx.time(ep.nadir.t) }));
      else if (fell) out.push(t('exFallOk'));
      out.push(t('exFallCauses'));
    } else if (asksRise || (ep && ep.peak.v > ctx.hi)) {
      if (!(firstLog && Array.isArray(firstLog.foods) && firstLog.foods.length)) out.push(t('exRiseWhy'));
      if (meal === 'breakfast') out.push(t('exRiseMorning'));
    }
    if (ep && ep.nadir && ep.nadir.v < 70) out.push(t('exHypo'));
    out.push(t('exRepeat'));
    return out.join('\n\n');
  }

  return { rises, fromTime, valueAt, answer };
});
