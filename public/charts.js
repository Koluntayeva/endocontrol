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

  let uid = 0;
  // Smooth path through points that never overshoots them (monotone cubic, Fritsch–Carlson),
  // so the curve shows no peak or dip that is not in the readings.
  function smooth(pts) {
    const n = pts.length;
    if (n < 2) return '';
    if (n === 2) return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`;
    const dx = [], m = [], tg = new Array(n);
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0] || 1e-6; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
    tg[0] = m[0]; tg[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) tg[i] = m[i - 1] * m[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += `C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + tg[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - tg[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
    }
    return d;
  }
  // Vertical colour ramp by glucose zone: very low · low · in range · high · very high.
  // Stops sit at the thresholds with a short blend, so the colour still marks the zone.
  function zoneStops(y, lo, hi, yTop, yBot) {
    const at = v => Math.min(1, Math.max(0, (y(v) - yTop) / (yBot - yTop)));
    const st = [[0, 'var(--vhigh)'], [at(250) - .02, 'var(--vhigh)'], [at(250) + .02, 'var(--high)'], [at(hi) - .015, 'var(--high)'], [at(hi) + .015, 'var(--in)'],
      [at(lo) - .015, 'var(--in2)'], [at(lo) + .015, 'var(--low)'], [at(54) - .01, 'var(--low)'], [at(54) + .01, 'var(--vlow)'], [1, 'var(--vlow)']];
    return st.map(([o, c]) => `<stop offset="${Math.min(1, Math.max(0, o)).toFixed(3)}" style="stop-color:${c}"/>`).join('');
  }

  // Line chart of glucose between `from` and `to` (ms). entries: [[t, mg, dir], …]
  function line(entries, from, to, o = {}) {
    const id = 'g' + (++uid);
    const W = 800, H = o.height || 280, L = 40, R = 14, T = o.markers === false ? 12 : 28, B = 26;
    const lo = o.lo || 70, hi = o.hi || 180, units = o.units || 'mg/dl';
    const yMax = Math.max(o.yMax || 300, ...entries.map(e => e[1] + 10)), yMin = 40;
    const x = t => L + (t - from) / (to - from) * (W - L - R);
    const y = v => T + (1 - (Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (H - T - B);
    const pts = entries.filter(e => e[0] >= from && e[0] <= to);
    let s = `<svg class="gchart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.label || 'glucose chart')}"
      data-from="${from}" data-to="${to}" data-l="${L}" data-r="${R}" data-w="${W}" data-units="${esc(units)}" data-lo="${lo}" data-hi="${hi}" data-ymaxv="${yMax}"
      data-pts="${pts.map(e => `${Math.round((e[0] - from) / 1000)},${e[1]},${e[2] ? (ARROWS[e[2]] || '') : ''}`).join(';')}">
      <defs>
        <linearGradient id="${id}s" gradientUnits="userSpaceOnUse" x1="0" y1="${T}" x2="0" y2="${H - B}">${zoneStops(y, lo, hi, T, H - B)}</linearGradient>
        <linearGradient id="${id}a" gradientUnits="userSpaceOnUse" x1="0" y1="${T}" x2="0" y2="${H - B}">${zoneStops(y, lo, hi, T, H - B)}</linearGradient>
        <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".7" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <mask id="${id}m"><rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}f)"/></mask>
        <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--in)" stop-opacity=".16"/><stop offset=".5" style="stop-color:var(--in)" stop-opacity=".08"/><stop offset="1" style="stop-color:var(--in)" stop-opacity=".16"/></linearGradient>
        <filter id="${id}g" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>`;
    // target band and thresholds (recessive)
    s += `<rect x="${L}" y="${y(hi)}" width="${W - L - R}" height="${y(lo) - y(hi)}" rx="10" fill="url(#${id}b)"/>`;
    for (const [v, c] of [[lo, 'var(--low)'], [hi, 'var(--high)']]) {
      s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${c}" stroke-opacity=".55" stroke-dasharray="2 5" stroke-linecap="round"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmtG(v, units)}</text>`;
    }
    // time grid
    const span = to - from, stepH = span <= 6 * 3600e3 ? 1 : span <= 12 * 3600e3 ? 2 : span <= 36 * 3600e3 ? 3 : 24;
    const t0 = new Date(from); t0.setMinutes(0, 0, 0);
    for (let t = t0.getTime(); t <= to; t += 3600e3) {
      const d = new Date(t);
      if (t < from || d.getHours() % stepH) continue;
      const lbl = stepH === 24 ? d.toLocaleDateString(o.locale, { day: '2-digit', month: '2-digit' }) : d.toLocaleTimeString(o.locale, { hour: '2-digit', minute: '2-digit' });
      s += `<line x1="${x(t)}" x2="${x(t)}" y1="${T}" y2="${H - B}" stroke="var(--line)" stroke-opacity=".6"/><text x="${x(t)}" y="${H - 8}" text-anchor="middle">${lbl}</text>`;
    }
    // runs split at gaps > 20 min
    const runs = []; let run = null;
    for (let i = 0; i < pts.length; i++) {
      if (!run || pts[i][0] - pts[i - 1][0] > 20 * 60e3) { run = []; runs.push(run); }
      run.push([x(pts[i][0]), y(pts[i][1])]);
    }
    const sw = o.thin ? 2.2 : 3;
    for (const r of runs) {
      if (r.length === 1) { s += `<circle cx="${r[0][0]}" cy="${r[0][1]}" r="3" fill="url(#${id}s)"/>`; continue; }
      const d = smooth(r);
      s += `<path d="${d}L${r[r.length - 1][0].toFixed(1)},${H - B}L${r[0][0].toFixed(1)},${H - B}Z" fill="url(#${id}a)" mask="url(#${id}m)" opacity=".7"/>`;
      if (!o.thin) s += `<path d="${d}" fill="none" stroke="url(#${id}s)" stroke-width="${sw + 5}" stroke-linecap="round" opacity=".35" filter="url(#${id}g)"/>`;
      s += `<path d="${d}" fill="none" stroke="url(#${id}s)" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    // the latest reading, pulsing when it is recent
    const last = pts[pts.length - 1];
    if (last && !o.thin) {
      const cx = x(last[0]), cy = y(last[1]), fresh = Date.now() - last[0] < 15 * 60e3;
      s += `<circle cx="${cx}" cy="${cy}" r="6" fill="${color(last[1], lo, hi)}" stroke="var(--card)" stroke-width="2.5"/>`;
      if (fresh) s += `<circle class="gpulse" cx="${cx}" cy="${cy}" r="6" fill="none" stroke="${color(last[1], lo, hi)}" stroke-width="2"/>`;
    }
    // diary markers: soft pills (insulin on top, carbs at the bottom)
    if (o.treatments && o.markers !== false) {
      for (const tr of o.treatments) {
        const t = tr.mills; if (t < from || t > to) continue;
        const cx = x(t);
        const pill = (yy, fill, txt, title) => `<g><title>${esc(title)}</title><line x1="${cx}" x2="${cx}" y1="${T}" y2="${H - B}" stroke="${fill}" stroke-opacity=".25" stroke-dasharray="2 4"/><rect x="${cx - 19}" y="${yy}" width="38" height="18" rx="9" fill="${fill}"/><text x="${cx}" y="${yy + 13}" text-anchor="middle" style="fill:#fff;font-size:10.5px;font-weight:800">${txt}</text></g>`;
        if (tr.carbs) s += pill(H - B - 21, 'var(--carb)', `${Math.round(tr.carbs)}g`, `${tr.eventType}: ${tr.carbs} g`);
        if (tr.insulin) s += pill(4, /basal/i.test(tr.eventType) ? '#64748b' : 'var(--ins)', `${+(+tr.insulin).toFixed(1)}U`, `${tr.eventType}: ${tr.insulin} U`);
        if (tr.glucose && !tr.carbs) { const g = tr.units === 'mmol' ? tr.glucose * MMOL : tr.glucose; s += `<circle cx="${cx}" cy="${y(g)}" r="5.5" fill="var(--card)" stroke="var(--text)" stroke-width="2"><title>BG ${fmtG(g, units)}</title></circle>`; }
        if (!tr.carbs && !tr.insulin && !tr.glucose) s += `<g><title>${esc(tr.eventType + (tr.notes ? ': ' + tr.notes : ''))}</title><circle cx="${cx}" cy="${T + 2}" r="5" fill="var(--accent)"/></g>`;
      }
    }
    // hover layer (filled in by the pointer handler below)
    s += `<g class="ghover" style="display:none"><line class="gx" y1="${T}" y2="${H - B}" stroke="var(--text)" stroke-opacity=".35"/><circle class="gdot" r="6" stroke="var(--card)" stroke-width="2.5"/></g>`;
    return s + '</svg>';
  }

  // Crosshair + tooltip for every glucose chart: snaps to the nearest reading.
  (function hover() {
    let tip = null;
    const hide = () => { if (tip) tip.style.display = 'none'; document.querySelectorAll('.gchart .ghover').forEach(g => { g.style.display = 'none'; }); };
    function move(e) {
      const svg = e.target.closest && e.target.closest('svg.gchart');
      if (!svg) return hide();
      const raw = svg.dataset.pts; if (!raw) return hide();
      const box = svg.getBoundingClientRect(), W = +svg.dataset.w, L = +svg.dataset.l, R = +svg.dataset.r;
      const from = +svg.dataset.from, to = +svg.dataset.to;
      const px = (e.clientX - box.left) / box.width * W;
      const tAt = from + (px - L) / (W - L - R) * (to - from);
      let best = null, bd = Infinity;
      for (const p of raw.split(';')) { const [ds, v, a] = p.split(','); const tt = from + ds * 1000, d = Math.abs(tt - tAt); if (d < bd) { bd = d; best = { t: tt, v: +v, a }; } }
      if (!best || bd > 30 * 60e3) return hide();
      const vb = svg.viewBox.baseVal, xx = L + (best.t - from) / (to - from) * (W - L - R);
      const yMin = 40, T = +svg.querySelector('.gx').getAttribute('y1'), Bt = +svg.querySelector('.gx').getAttribute('y2');
      const lo = +svg.dataset.lo, hi = +svg.dataset.hi;
      const g = svg.querySelector('.ghover'); g.style.display = '';
      g.querySelector('.gx').setAttribute('x1', xx); g.querySelector('.gx').setAttribute('x2', xx);
      const dot = g.querySelector('.gdot');
      // y on the chart's own scale (saved on the svg)
      const yMax = +svg.dataset.ymaxv || 300;
      const yy = T + (1 - (Math.min(Math.max(best.v, yMin), yMax) - yMin) / (yMax - yMin)) * (Bt - T);
      dot.setAttribute('cx', xx); dot.setAttribute('cy', yy); dot.setAttribute('fill', color(best.v, lo, hi));
      if (!tip) { tip = document.createElement('div'); tip.className = 'gtip'; document.body.appendChild(tip); }
      tip.textContent = '';
      const val = document.createElement('b'); val.textContent = `${fmtG(best.v, svg.dataset.units)} ${unitLabel(svg.dataset.units)} ${best.a || ''}`;
      const sub = document.createElement('span'); sub.textContent = new Date(best.t).toLocaleString(document.documentElement.lang || undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
      const key = document.createElement('i'); key.style.background = color(best.v, lo, hi);
      tip.append(key, val, sub);
      tip.style.display = 'flex';
      const sx = box.left + xx / vb.width * box.width, sy = box.top + yy / vb.height * box.height;
      const tw = tip.offsetWidth;
      tip.style.left = Math.min(innerWidth - tw - 8, Math.max(8, sx - tw / 2)) + 'px';
      tip.style.top = Math.max(8, sy - 54) + 'px';
    }
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', hide);
    addEventListener('scroll', hide, { passive: true });
  })();

  // Ambulatory Glucose Profile: percentiles by time of day.
  function agp(entries, o = {}) {
    const id = 'a' + (++uid);
    const W = 800, H = o.height || 260, L = 40, R = 14, T = 12, B = 26, lo = o.lo || 70, hi = o.hi || 180, units = o.units || 'mg/dl';
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
    const pl = k => idx.map(i => [x(i), y(P[i][k])]);
    const band = (a, b) => { const top = pl(b), bot = pl(a).reverse(); return smooth(top) + 'L' + smooth(bot).slice(1) + 'Z'; };
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="AGP"><defs>
      <linearGradient id="${id}s" gradientUnits="userSpaceOnUse" x1="0" y1="${T}" x2="0" y2="${H - B}">${zoneStops(y, lo, hi, T, H - B)}</linearGradient>
      <filter id="${id}g" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="4"/></filter></defs>`;
    s += `<rect x="${L}" y="${y(hi)}" width="${W - L - R}" height="${y(lo) - y(hi)}" rx="10" style="fill:var(--in)" fill-opacity=".09"/>`;
    for (const [v, c] of [[lo, 'var(--low)'], [hi, 'var(--high)']]) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${c}" stroke-opacity=".55" stroke-dasharray="2 5" stroke-linecap="round"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmtG(v, units)}</text>`;
    for (let h = 0; h <= 24; h += 3) s += `<text x="${L + h / 24 * (W - L - R)}" y="${H - 8}" text-anchor="middle">${String(h).padStart(2, '0')}:00</text>`;
    s += `<path d="${band(0, 4)}" fill="url(#${id}s)" opacity=".16"/><path d="${band(1, 3)}" fill="url(#${id}s)" opacity=".34"/>`;
    const med = smooth(pl(2));
    s += `<path d="${med}" fill="none" stroke="url(#${id}s)" stroke-width="8" opacity=".3" filter="url(#${id}g)"/><path d="${med}" fill="none" stroke="url(#${id}s)" stroke-width="3" stroke-linecap="round"/>`;
    return s + '</svg>';
  }

  // Daily time-in-range bars: rounded tops anchored to the baseline, coloured by status.
  function dailyBars(days, o = {}) {
    const W = 800, H = 160, L = 40, R = 14, T = 12, B = 24, bw = (W - L - R) / Math.max(days.length, 1);
    const y = v => T + (1 - v / 100) * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="TIR by day">`;
    for (const v of [0, 50, 100]) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-opacity=".7"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`;
    s += `<line x1="${L}" x2="${W - R}" y1="${y(70)}" y2="${y(70)}" stroke="var(--in)" stroke-dasharray="2 5" stroke-linecap="round"/><text x="${L - 6}" y="${y(70) + 4}" text-anchor="end">70%</text>`;
    days.forEach((d, i) => {
      const w = Math.max(4, bw - 6), xx = L + i * bw + (bw - w) / 2;
      if (d.st.n) {
        const top = y(d.st.tir), h = y(0) - top, r = Math.min(6, w / 2, h);
        const c = d.st.tir >= 70 ? 'var(--in)' : d.st.tir >= 50 ? 'var(--high)' : 'var(--low)';
        s += `<path d="M${xx},${y(0)}V${top + r}Q${xx},${top} ${xx + r},${top}H${xx + w - r}Q${xx + w},${top} ${xx + w},${top + r}V${y(0)}Z" style="fill:${c}" fill-opacity=".85"><title>${esc(d.label)}: ${d.st.tir.toFixed(0)}%</title></path>`;
      }
      if (days.length <= 16 || i % Math.ceil(days.length / 16) === 0) s += `<text x="${xx + w / 2}" y="${H - 7}" text-anchor="middle">${esc(d.short)}</text>`;
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
