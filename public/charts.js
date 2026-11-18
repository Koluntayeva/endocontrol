'use strict';
// Glucose maths and SVG charts. All glucose values are stored in mg/dL and converted for display.
(function () {
  const MMOL = 18.0182;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function fmtG(mg, units) {
    if (mg == null || !Number.isFinite(mg)) return '—';
    return units === 'mmol' ? (mg / MMOL).toFixed(1) : String(Math.round(mg));
  }
  const unitLabel = u => u === 'mmol' ? 'mmol/L' : 'mg/dL';

  function color(mg, lo = 70, hi = 180) {
    return mg < 54 ? 'var(--vlow)' : mg < lo ? 'var(--low)' : mg <= hi ? 'var(--in)' : mg <= 250 ? 'var(--high)' : 'var(--vhigh)';
  }

  // International consensus CGM metrics (Battelino et al., Diabetes Care 2019).
  function stats(vals, lo = 70, hi = 180) {
    const v = vals.filter(x => x != null);
    const n = v.length;
    if (!n) return { n: 0 };
    let vl = 0, l = 0, inr = 0, h = 0, vh = 0, s = 0, mn = Infinity, mx = -Infinity;
    for (const x of v) { s += x; mn = Math.min(mn, x); mx = Math.max(mx, x); if (x < 54) vl++; else if (x < lo) l++; else if (x <= hi) inr++; else if (x <= 250) h++; else vh++; }
    const mean = s / n, sd = Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / n);
    return { n, vlow: vl / n * 100, low: l / n * 100, tir: inr / n * 100, high: h / n * 100, vhigh: vh / n * 100, tbr: (vl + l) / n * 100, tar: (h + vh) / n * 100,
      mean, sd, cv: sd / mean * 100, gmi: 3.31 + 0.02392 * mean, min: mn, max: mx };
  }

  const ARROWS = { DoubleUp: '⇈', SingleUp: '↑', FortyFiveUp: '↗', Flat: '→', FortyFiveDown: '↘', SingleDown: '↓', DoubleDown: '⇊' };

  // Line chart of glucose between `from` and `to` (ms). entries: [[t, mg, dir], …]
  function line(entries, from, to, o = {}) {
    const W = 800, H = o.height || 280, L = 40, R = 10, T = o.markers === false ? 10 : 26, B = 24;
    const lo = o.lo || 70, hi = o.hi || 180, units = o.units || 'mg/dl';
    const yMax = Math.max(o.yMax || 300, ...entries.map(e => e[1] + 10)), yMin = 40;
    const x = t => L + (t - from) / (to - from) * (W - L - R);
    const y = v => T + (1 - (Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.label || 'glucose chart')}">`;
    s += `<rect x="${L}" y="${y(hi)}" width="${W - L - R}" height="${y(lo) - y(hi)}" fill="var(--in-soft)"/>`;
    for (const [v, c] of [[lo, 'var(--low)'], [hi, 'var(--in)'], [250, 'var(--high)']]) {
      s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${c}" stroke-dasharray="4 4"/><text x="${L - 5}" y="${y(v) + 4}" text-anchor="end">${fmtG(v, units)}</text>`;
    }
    // time grid
    const span = to - from, stepH = span <= 6 * 3600e3 ? 1 : span <= 12 * 3600e3 ? 2 : span <= 36 * 3600e3 ? 3 : 24;
    const t0 = new Date(from); t0.setMinutes(0, 0, 0);
    for (let t = t0.getTime(); t <= to; t += 3600e3) {
      const d = new Date(t);
      if (t < from || d.getHours() % stepH) continue;
      const lbl = stepH === 24 ? d.toLocaleDateString(o.locale, { day: '2-digit', month: '2-digit' }) : d.toLocaleTimeString(o.locale, { hour: '2-digit', minute: '2-digit' });
      s += `<line x1="${x(t)}" x2="${x(t)}" y1="${T}" y2="${H - B}" stroke="var(--line)"/><text x="${x(t)}" y="${H - 7}" text-anchor="middle">${lbl}</text>`;
    }
    // segments (break on gaps > 20 min), coloured by range
    let run = null; const runs = [];
    for (let i = 0; i < entries.length; i++) {
      const [t, v] = entries[i];
      if (t < from || t > to) { run = null; continue; }
      const prev = entries[i - 1];
      const c = color(v, lo, hi);
      if (!run || !prev || t - prev[0] > 20 * 60e3 || run.c !== c) {
        run = { c, pts: prev && run && t - prev[0] <= 20 * 60e3 && prev[0] >= from ? [[prev[0], prev[1]]] : [] }; runs.push(run);
      }
      run.pts.push([t, v]);
    }
    for (const r of runs) {
      if (r.pts.length === 1) s += `<circle cx="${x(r.pts[0][0])}" cy="${y(r.pts[0][1])}" r="2.5" fill="${r.c}"/>`;
      else s += `<polyline points="${r.pts.map(p => x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ')}" fill="none" stroke="${r.c}" stroke-width="${o.thin ? 2 : 2.6}" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    // diary markers
    if (o.treatments && o.markers !== false) {
      for (const tr of o.treatments) {
        const t = tr.mills; if (t < from || t > to) continue;
        const cx = x(t);
        if (tr.carbs) s += `<g><title>${esc(tr.eventType)}: ${tr.carbs} g</title><rect x="${cx - 16}" y="${H - B - 18}" width="32" height="16" rx="4" fill="var(--carb)"/><text x="${cx}" y="${H - B - 6}" text-anchor="middle" style="fill:#fff;font-size:10px;font-weight:700">${Math.round(tr.carbs)}g</text></g>`;
        if (tr.insulin) s += `<g><title>${esc(tr.eventType)}: ${tr.insulin} U</title><rect x="${cx - 16}" y="4" width="32" height="16" rx="4" fill="${/basal/i.test(tr.eventType) ? '#475569' : 'var(--ins)'}"/><text x="${cx}" y="16" text-anchor="middle" style="fill:#fff;font-size:10px;font-weight:700">${+tr.insulin.toFixed(1)}U</text></g>`;
        if (tr.glucose) { const g = tr.units === 'mmol' ? tr.glucose * MMOL : tr.glucose; s += `<circle cx="${cx}" cy="${y(g)}" r="5" fill="#fff" stroke="var(--text)" stroke-width="2"><title>BG ${fmtG(g, units)}</title></circle>`; }
        if (!tr.carbs && !tr.insulin && !tr.glucose) s += `<g><title>${esc(tr.eventType + (tr.notes ? ': ' + tr.notes : ''))}</title><circle cx="${cx}" cy="${T + 2}" r="5" fill="var(--accent)"/></g>`;
      }
    }
    return s + '</svg>';
  }

  // Ambulatory Glucose Profile: percentiles by time of day.
  function agp(entries, o = {}) {
    const W = 800, H = o.height || 260, L = 40, R = 10, T = 10, B = 24, lo = o.lo || 70, hi = o.hi || 180, units = o.units || 'mg/dl';
    const bins = Array.from({ length: 96 }, () => []);
    for (const [t, v] of entries) { const d = new Date(t); bins[Math.floor((d.getHours() * 60 + d.getMinutes()) / 15)].push(v); }
    const pct = (a, p) => { const i = (a.length - 1) * p, l = Math.floor(i); return a[l] + (a[Math.ceil(i)] - a[l]) * (i - l); };
    const P = bins.map((_, i) => {
      const v = [];
      for (let j = -2; j <= 2; j++) v.push(...bins[(i + j + 96) % 96]);
      if (v.length < 5) return null;
      v.sort((a, b) => a - b);
      return [.05, .25, .5, .75, .95].map(q => pct(v, q));
    });
    const idx = P.map((p, i) => p ? i : -1).filter(i => i >= 0);
    if (idx.length < 10) return `<div class="muted small">${esc(o.empty || '—')}</div>`;
    const yMax = 350, yMin = 40;
    const x = i => L + (i / 95) * (W - L - R), y = v => T + (1 - (Math.min(v, yMax) - yMin) / (yMax - yMin)) * (H - T - B);
    const band = (a, b) => idx.map(i => `${x(i)},${y(P[i][a])}`).join(' ') + ' ' + idx.map(i => `${x(i)},${y(P[i][b])}`).reverse().join(' ');
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="AGP">`;
    s += `<rect x="${L}" y="${y(hi)}" width="${W - L - R}" height="${y(lo) - y(hi)}" fill="var(--in-soft)"/>`;
    for (const v of [lo, hi]) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--in)" stroke-dasharray="4 4"/><text x="${L - 5}" y="${y(v) + 4}" text-anchor="end">${fmtG(v, units)}</text>`;
    for (let h = 0; h <= 24; h += 3) s += `<text x="${L + h / 24 * (W - L - R)}" y="${H - 7}" text-anchor="middle">${String(h).padStart(2, '0')}:00</text>`;
    s += `<polygon points="${band(0, 4)}" fill="var(--accent)" opacity=".15"/><polygon points="${band(1, 3)}" fill="var(--accent)" opacity=".32"/>`;
    s += `<polyline points="${idx.map(i => `${x(i)},${y(P[i][2])}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.6"/>`;
    return s + '</svg>';
  }

  // Daily time-in-range bars.
  function dailyBars(days, o = {}) {
    const W = 800, H = 150, L = 40, R = 10, T = 10, B = 22, bw = (W - L - R) / Math.max(days.length, 1);
    const y = v => T + (1 - v / 100) * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="TIR by day">`;
    for (const v of [0, 50, 70, 100]) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 70 ? 'var(--in)' : 'var(--line)'}" ${v === 70 ? 'stroke-dasharray="4 4"' : ''}/><text x="${L - 5}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`;
    days.forEach((d, i) => {
      const xx = L + i * bw + bw * .15, w = bw * .7;
      if (d.st.n) s += `<rect x="${xx}" y="${y(d.st.tir)}" width="${w}" height="${y(0) - y(d.st.tir)}" rx="2" fill="${d.st.tir >= 70 ? 'var(--in)' : d.st.tir >= 50 ? 'var(--high)' : 'var(--low)'}"><title>${esc(d.label)}: ${d.st.tir.toFixed(0)}%</title></rect>`;
      if (days.length <= 16 || i % Math.ceil(days.length / 16) === 0) s += `<text x="${xx + w / 2}" y="${H - 6}" text-anchor="middle">${esc(d.short)}</text>`;
    });
    return s + '</svg>';
  }

  function tirBlock(st, t, units, lo, hi) {
    const f = v => fmtG(v, units);
    const rows = [[t('veryHigh'), `>${f(250)}`, st.vhigh, 'var(--vhigh)', '<5%'], [t('high'), `${f(hi + 1)}–${f(250)}`, st.high, 'var(--high)', '<25%'],
      [t('inRange'), `${f(lo)}–${f(hi)}`, st.tir, 'var(--in)', '>70%'], [t('low'), `${f(54)}–${f(lo - 1)}`, st.low, 'var(--low)', '<4%'], [t('veryLow'), `<${f(54)}`, st.vlow, 'var(--vlow)', '<1%']];
    return `<div class="tir"><div class="tirbar">${rows.map(r => `<div style="flex:${Math.max(r[2], .6)};background:${r[3]}"></div>`).join('')}</div>
      <div class="tirleg">${rows.map(r => `<div><i style="background:${r[3]}"></i>${esc(r[0])} <span class="muted tiny">${r[1]}</span><b>${r[2] < 10 ? r[2].toFixed(1) : r[2].toFixed(0)}%</b><span class="muted tiny" style="width:38px;text-align:end">${r[4]}</span></div>`).join('')}</div></div>`;
  }

  window.Charts = { MMOL, fmtG, unitLabel, color, stats, ARROWS, line, agp, dailyBars, tirBlock, esc };
})();
