'use strict';
/* Glucose alerts: fast fall, fast rise, a predicted low, low, very low and high.
   Pure logic shared by the browser and the tests; glucose in mg/dL, times in ms. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Alerts = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MIN = 60e3;
  const FAST = { DoubleDown: -3, SingleDown: -2, DoubleUp: 3, SingleUp: 2 }; // CGM arrows, mg/dL per minute

  // Rate of change in mg/dL per minute from the readings of the last 15 minutes (least squares).
  function rate(entries, now) {
    const pts = entries.filter(e => now - e[0] <= 16 * MIN).slice(-5);
    if (pts.length < 3 || pts[pts.length - 1][0] - pts[0][0] < 8 * MIN) return null;
    const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
    let num = 0, den = 0;
    for (const p of pts) { num += (p[0] - mx) * (p[1] - my); den += (p[0] - mx) ** 2; }
    return den ? num / den * MIN : null;
  }

  // The alert for the latest state, or null. entries: [[ms, mg, direction], …] sorted by time.
  // Levels: critical (very low), urgent (low, predicted low, fast fall), warn (fast rise, high).
  function check(entries, now, o = {}) {
    const lo = o.lo || 70, hi = o.hi || 180;
    const last = entries[entries.length - 1];
    if (!last || now - last[0] > 12 * MIN) return null; // no fresh reading
    const v = last[1], r = rate(entries, now), arrow = FAST[last[2]];
    const slope = r != null ? r : (arrow != null ? arrow : 0);
    const falling = slope <= -2 || (arrow != null && arrow < 0);
    const rising = slope >= 2 || (arrow != null && arrow > 0);
    const in20 = v + slope * 20;
    const base = { v, rate: slope, at: last[0] };
    if (v < 54) return { ...base, kind: 'verylow', level: 'critical' };
    if (v < lo) return { ...base, kind: 'low', level: 'urgent' };
    if (falling && in20 < lo) return { ...base, kind: 'fallsoon', level: 'urgent', in20 };
    if (falling) return { ...base, kind: 'fall', level: 'urgent' };
    if (rising && v >= 120) return { ...base, kind: 'rise', level: 'warn' };
    if (v > 250) return { ...base, kind: 'high', level: 'warn' };
    return null;
  }

  // Should this alert sound now? A kind is not repeated for `quiet` minutes unless it got worse.
  const RANK = { high: 1, rise: 1, fall: 2, fallsoon: 3, low: 4, verylow: 5 };
  function shouldFire(alert, memory, now, quietMin = 20) {
    if (!alert) return false;
    if (memory.snoozeUntil && now < memory.snoozeUntil && alert.level !== 'critical') return false;
    const prev = memory.last;
    if (!prev) return true;
    if (RANK[alert.kind] > RANK[prev.kind]) return true;
    if (prev.kind === alert.kind && now - prev.at < quietMin * MIN) return false;
    if (RANK[alert.kind] < RANK[prev.kind] && now - prev.at < quietMin * MIN) return false;
    return true;
  }

  return { rate, check, shouldFire };
});
