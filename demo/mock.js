'use strict';
/* In-browser demo backend: answers the app's /app/* requests without a server, with generated CGM data. */
(function () {
  window.EC_DEMO = true;
  const H = 3600e3, DAY = 864e5;
  let seq = 1;
  const rid = () => Math.random().toString(36).slice(2, 10);
  const secret = () => Array.from({ length: 16 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');

  function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
  // Deterministic glucose for a user and day, so "live" values keep arriving every 5 minutes.
  const dayCache = new Map();
  function genDay(u, dayStart) {
    const key = u.id + ':' + dayStart;
    if (dayCache.has(key)) return dayCache.get(key);
    const r = rng(u.seed * 7919 + Math.floor(dayStart / DAY));
    const meals = [[7.5 + r(), 'Breakfast', 30 + r() * 25], [13 + r(), 'Lunch', 40 + r() * 30], [19 + r() * 1.5, 'Dinner', 35 + r() * 30]];
    const hypo = r() < u.hypo, act = r() < 0.4 ? 16 + r() * 2 : null;
    const entries = [], tr = [];
    let ar = 0, prev = null;
    for (let i = 0; i < 288; i++) {
      const t = dayStart + i * 5 * 60e3, h = i / 12;
      let v = u.base + 25 * Math.exp(-((h - 6.5) ** 2) / 3);
      for (const [mh, , c] of meals) { const dt = (h - mh) * 60; if (dt > 0) { const x = dt / 65; v += c * u.sens * x * Math.exp(1 - x); } }
      if (hypo) v -= 80 * Math.exp(-((h - 2.8) ** 2) / 1.1);
      if (act) v -= 40 * Math.exp(-((h - act - 0.7) ** 2) / 0.8);
      ar = ar * 0.94 + (r() - 0.5) * 9;
      v = Math.round(Math.max(40, Math.min(400, v + ar)));
      const s = prev == null ? 0 : (v - prev) / 5; prev = v;
      entries.push([t, v, s > 3 ? 'DoubleUp' : s > 2 ? 'SingleUp' : s > 1 ? 'FortyFiveUp' : s < -3 ? 'DoubleDown' : s < -2 ? 'SingleDown' : s < -1 ? 'FortyFiveDown' : 'Flat']);
    }
    for (const [mh, , c] of meals) tr.push({ _id: 'g' + dayStart + mh, eventType: 'Meal Bolus', mills: dayStart + mh * H, created_at: new Date(dayStart + mh * H).toISOString(), carbs: Math.round(c / 5) * 5, insulin: Math.round(c / 15 * 2) / 2, enteredBy: u.device });
    tr.push({ _id: 'b' + dayStart, eventType: 'Basal Insulin', mills: dayStart + 21 * H, created_at: new Date(dayStart + 21 * H).toISOString(), insulin: 8, enteredBy: u.device });
    if (act) tr.push({ _id: 'a' + dayStart, eventType: 'Exercise', mills: dayStart + act * H, created_at: new Date(dayStart + act * H).toISOString(), duration: 45, notes: 'Football', enteredBy: u.device });
    const out = { entries, tr }; dayCache.set(key, out); return out;
  }
  const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  function series(u, from, to) {
    if (!u.dataFrom) return { entries: [], tr: [] };
    const a = Math.max(from, u.dataFrom), b = Math.min(to, Date.now());
    const E = [], T = [];
    for (let d = startOfDay(a); d < b; d += DAY) {
      const g = genDay(u, startOfDay(d + 2 * H));
      for (const e of g.entries) if (e[0] >= a && e[0] < b) E.push(e);
      for (const x of g.tr) if (x.mills >= a && x.mills < b) T.push(x);
    }
    for (const e of u.imported) if (e[0] >= from && e[0] < to) E.push(e);
    E.sort((x, y) => x[0] - y[0]);
    return { entries: E, tr: T };
  }

  // ---- demo state
  const users = [], shares = [], notes = [], links = [];
  function mkUser(o) {
    const u = { id: seq++, role: 'patient', lang: 'en', units: 'mmol', target_low: 70, target_high: 180, created_at: new Date().toISOString(), api_secret: secret(),
      seed: seq * 31, base: 135, sens: 1.6, hypo: 0.25, device: 'FreeStyle Libre 2', bridges: [], imported: [], diary: [], dataFrom: null, ...o };
    users.push(u); return u;
  }
  const P = mkUser({ email: 'demo@endocontrol.app', password: 'demo1234', name: 'Aigerim', patient_name: 'Alikhan (9)', diabetes_type: 't1', dataFrom: startOfDay(Date.now() - 89 * DAY) });
  P.bridges.push({ kind: 'librelinkup', status: 'ok', last_error: null, last_poll: Date.now(), last_data: Date.now() });
  const Dr = mkUser({ email: 'doctor@endocontrol.app', password: 'demo1234', name: 'Dr. Aizhan Nurlanova', role: 'doctor' });
  const tok0 = 'r-demo' + rid();
  shares.push({ token: tok0, user_id: P.id, label: 'Dr. Nurlanova', created_at: Date.now() - 20 * DAY, expires_at: null, revoked: 0 });
  links.push({ doctor_id: Dr.id, token: tok0, added_at: Date.now() - 20 * DAY });
  notes.push({ id: seq++, user_id: P.id, author_id: Dr.id, kind: 'conclusion', text: 'Time in range is close to the goal. Night lows around 3 a.m. on some days — reduce basal insulin by 1 U and check again in 2 weeks.', created_at: Date.now() - 6 * DAY });
  notes.push({ id: seq++, user_id: P.id, author_id: P.id, kind: 'message', text: 'Thank you! We reduced it. Can you look at the afternoon highs after school?', created_at: Date.now() - 3 * H });

  let session = null;
  const err = (status, code) => { const e = new Error(code); e.status = status; e.code = code; throw e; };
  const me = () => session || err(401, 'unauthorized');
  const pub = u => ({
    id: u.id, email: u.email, name: u.name, role: u.role, patient_name: u.patient_name, birth_year: null, diabetes_type: u.diabetes_type, lang: u.lang, units: u.units,
    target_low: u.target_low, target_high: u.target_high, created_at: u.created_at,
    upload: { base_url: 'https://endocontrol.example', api_secret: u.api_secret, xdrip_url: `https://${u.api_secret}@endocontrol.example/api/v1/` },
  });
  const shareOk = tk => { const s = shares.find(x => x.token === tk && !x.revoked && (!x.expires_at || x.expires_at > Date.now())); return s || err(404, 'share_not_found'); };
  const subject = q => q.get('share') ? users.find(u => u.id === shareOk(q.get('share')).user_id) : me();
  const patientInfo = u => ({ name: u.name, patient_name: u.patient_name, birth_year: null, diabetes_type: u.diabetes_type, units: u.units, target_low: u.target_low, target_high: u.target_high });

  const R = [];
  const on = (m, re, fn) => R.push([m, re, fn]);
  on('POST', /^\/app\/register$/, b => {
    if (users.some(u => u.email === String(b.email).toLowerCase())) err(409, 'email_taken');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || '')) err(400, 'bad_email');
    session = mkUser({ email: String(b.email).toLowerCase(), password: b.password, name: b.name, role: b.role === 'doctor' ? 'doctor' : 'patient', patient_name: b.patient_name, diabetes_type: b.diabetes_type, lang: b.lang, units: b.units === 'mg/dl' ? 'mg/dl' : 'mmol', base: 150, sens: 1.9, hypo: 0.15 });
    return { ok: true };
  });
  on('POST', /^\/app\/login$/, b => { const u = users.find(x => x.email === String(b.email).toLowerCase().trim() && x.password === b.password); if (!u) err(401, 'bad_credentials'); session = u; return { ok: true }; });
  on('POST', /^\/app\/logout$/, () => { session = null; return { ok: true }; });
  on('GET', /^\/app\/me$/, () => {
    const u = me(); const s = series(u, Date.now() - 2 * H, Date.now() + 60e3); const last = s.entries[s.entries.length - 1];
    u.bridges.forEach(b => { if (b.status === 'ok') { b.last_poll = Date.now(); b.last_data = last ? last[0] : null; } });
    const total = u.dataFrom ? Math.floor((Date.now() - u.dataFrom) / 3e5) + u.imported.length : u.imported.length;
    return { user: pub(u), bridges: u.bridges, last: last ? { date: last[0], sgv: last[1], direction: last[2], device: u.device, source: u.bridges[0] ? u.bridges[0].kind : 'csv' } : null, stored: total, app: { name: 'EndoControl (demo)', version: '0.1.0' } };
  });
  on('PUT', /^\/app\/me$/, b => { const u = me(); for (const k of ['name', 'patient_name', 'lang', 'units', 'target_low', 'target_high']) if (b[k] !== undefined && b[k] !== '') u[k] = b[k]; return { ok: true }; });
  on('POST', /^\/app\/me\/password$/, b => { const u = me(); if (b.current !== u.password) err(401, 'bad_credentials'); u.password = b.password; return { ok: true }; });
  on('POST', /^\/app\/me\/rotate-secret$/, () => { me().api_secret = secret(); return { ok: true }; });
  on('POST', /^\/app\/me\/delete$/, b => { const u = me(); if (b.password !== u.password) err(401, 'bad_credentials'); users.splice(users.indexOf(u), 1); session = null; return { ok: true }; });
  on('GET', /^\/app\/data$/, (b, q) => {
    const u = subject(q); const to = +q.get('to') || Date.now(), from = +q.get('from') || to - DAY;
    const s = series(u, from, to);
    const tr = [...s.tr, ...u.diary.filter(x => x.mills >= from && x.mills < to)].sort((a, c) => a.mills - c.mills);
    const wide = series(u, from - 15 * 60e3, to + 2.25 * 3600e3).entries;
    const near = (ms, tol) => wide.reduce((m, e) => Math.abs(e[0] - ms) <= tol && (!m || Math.abs(e[0] - ms) < Math.abs(m[0] - ms)) ? e : m, null);
    for (const x of tr) if (x.carbs > 0 || (x.insulin > 0 && !/basal/i.test(x.eventType))) { const a = near(x.mills, 15 * 60e3), c = near(x.mills + 2 * 3600e3, 10 * 60e3); if (a) x.bgAt = a[1]; if (c && x.mills + 2 * 3600e3 <= Date.now()) x.bg2h = c[1]; }
    return { from, to, entries: s.entries, treatments: tr, patient: patientInfo(u), readOnly: !!q.get('share') };
  });
  on('POST', /^\/app\/treatments$/, b => {
    const u = me(); const at = Date.parse(b.at) || Date.now();
    const it = { meal: 'Meal Bolus', snack: 'Meal Bolus', correction: 'Correction Bolus', basal: 'Basal Insulin', other: 'Bolus' }[b.insulinType] || (b.basal ? 'Basal Insulin' : 'Correction Bolus');
    const k = { meal: { eventType: 'Meal Bolus', carbs: b.carbs || undefined, insulin: b.insulin || undefined, preBolus: b.preBolus, mealType: b.mealType, glucose: b.glucose }, carbs: { eventType: 'Carb Correction', carbs: b.value }, insulin: { eventType: it, insulin: b.value, reason: b.insulinType !== 'basal' ? b.insulinType : undefined, insKind: b.insKind }, bg: { eventType: 'BG Check', glucose: b.value, units: 'mg/dl', bgContext: b.bgContext }, med: { eventType: 'Medication', meds: b.meds }, weight: { eventType: 'Weight', weight: b.value, fat: b.fat }, exercise: { eventType: 'Exercise', duration: b.value }, note: { eventType: 'Note' } }[b.kind];
    const x = { _id: 'u' + seq++, ...k, mills: at, created_at: new Date(at).toISOString(), notes: b.notes || undefined, enteredBy: 'EndoControl' };
    u.diary.push(x); return x;
  });
  on('PATCH', /^\/app\/treatments\/(.+)$/, (b, q, m) => { const x = me().diary.find(y => y._id === m[1]); if (x) x.mealType = b.mealType; return { ok: true }; });
  on('DELETE', /^\/app\/treatments\/(.+)$/, (b, q, m) => { const u = me(); u.diary = u.diary.filter(x => x._id !== m[1]); return { ok: true }; });
  on('POST', /^\/app\/bridges$/, b => {
    const u = me(); const c = b.config || {};
    if (b.kind === 'librelinkup' && (!c.email || !c.password)) err(400, 'missing_fields');
    if (b.kind === 'dexcom' && (!c.username || !c.password)) err(400, 'missing_fields');
    if (b.kind === 'nightscout' && !/^https:\/\//i.test(c.url || '')) err(400, 'bad_url');
    u.bridges = u.bridges.filter(x => x.kind !== b.kind);
    u.bridges.push({ kind: b.kind, status: 'ok', last_error: null, last_poll: Date.now(), last_data: Date.now() });
    if (b.kind === 'dexcom') u.device = 'Dexcom G7';
    if (!u.dataFrom) u.dataFrom = Date.now() - (b.kind === 'librelinkup' ? 12 * H : DAY);
    return { ok: true, count: b.kind === 'librelinkup' ? 144 : 288 };
  });
  on('DELETE', /^\/app\/bridges\/(.+)$/, (b, q, m) => { const u = me(); u.bridges = u.bridges.filter(x => x.kind !== m[1]); return { ok: true }; });
  on('POST', /^\/app\/import$/, (text, q) => {
    const u = me(); const { entries, detected } = window.ECCsv.parseCsv(text, q.get('tz_offset'));
    if (!entries.length) err(400, 'nothing_imported');
    for (const e of entries) u.imported.push([e.date, e.sgv, null]);
    return { imported: entries.length, detected };
  });
  on('GET', /^\/app\/shares$/, () => shares.filter(s => s.user_id === me().id && !s.revoked));
  on('POST', /^\/app\/shares$/, b => { const t = 'r-' + rid() + rid(); shares.push({ token: t, user_id: me().id, label: b.label || null, created_at: Date.now(), expires_at: b.days > 0 ? Date.now() + b.days * DAY : null, revoked: 0 }); return { token: t }; });
  on('DELETE', /^\/app\/shares\/(.+)$/, (b, q, m) => { const s = shares.find(x => x.token === m[1] && x.user_id === me().id); if (s) s.revoked = 1; return { ok: true }; });
  on('GET', /^\/app\/share\/(.+)$/, (b, q, m) => { const s = shareOk(decodeURIComponent(m[1])); return { patient: patientInfo(users.find(u => u.id === s.user_id)), label: s.label, expires_at: s.expires_at }; });
  on('GET', /^\/app\/patients$/, () => {
    const d = me();
    return links.filter(l => l.doctor_id === d.id).map(l => {
      const s = shares.find(x => x.token === l.token && !x.revoked); if (!s) return null;
      const u = users.find(x => x.id === s.user_id); if (!u) return null;
      const se = series(u, Date.now() - 14 * DAY, Date.now() + 60e3).entries;
      const n = se.length, inr = se.filter(e => e[1] >= u.target_low && e[1] <= u.target_high).length, low = se.filter(e => e[1] < u.target_low).length;
      const last = se[se.length - 1];
      return { token: l.token, added_at: l.added_at, ...patientInfo(u), last: last ? { date: last[0], sgv: last[1], direction: last[2] } : null, tir: n ? inr / n * 100 : null, tbr: n ? low / n * 100 : null,
        mean: n ? se.reduce((a, e) => a + e[1], 0) / n : null, messages: notes.filter(x => x.user_id === u.id && x.author_id === u.id && x.created_at > l.added_at).length };
    }).filter(Boolean);
  });
  on('POST', /^\/app\/patients$/, b => {
    const d = me(); let tk = String(b.token || '').trim(); const m = /[#/]s\/([\w-]+)/.exec(tk); if (m) tk = m[1];
    shareOk(tk); if (!links.some(l => l.doctor_id === d.id && l.token === tk)) links.push({ doctor_id: d.id, token: tk, added_at: Date.now() });
    return { ok: true, token: tk };
  });
  on('DELETE', /^\/app\/patients\/(.+)$/, (b, q, m) => { const d = me(); const i = links.findIndex(l => l.doctor_id === d.id && l.token === m[1]); if (i >= 0) links.splice(i, 1); return { ok: true }; });
  on('GET', /^\/app\/notes$/, (b, q) => {
    const u = subject(q);
    return notes.filter(n => n.user_id === u.id).sort((a, c) => a.created_at - c.created_at).map(n => { const a = users.find(x => x.id === n.author_id) || {}; return { ...n, author: a.name, author_role: a.role, mine: session && session.id === n.author_id }; });
  });
  on('POST', /^\/app\/notes$/, b => {
    const u = me(); let pid = u.id;
    if (b.share) { pid = shareOk(b.share).user_id; if (!links.some(l => l.doctor_id === u.id && l.token === b.share)) err(403, 'forbidden'); }
    notes.push({ id: seq++, user_id: pid, author_id: u.id, kind: b.kind === 'conclusion' && u.role === 'doctor' ? 'conclusion' : 'message', text: String(b.text || '').slice(0, 5000), created_at: Date.now() });
    return { ok: true };
  });

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, opt = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/app/')) return realFetch(input, opt);
    const method = (opt.method || 'GET').toUpperCase();
    let body = opt.body;
    if (body && (opt.headers || {})['Content-Type'] === 'application/json') body = JSON.parse(body);
    await new Promise(r => setTimeout(r, 60));
    for (const [m, re, fn] of R) {
      const mm = method === m && re.exec(url.pathname);
      if (!mm) continue;
      try { const out = fn(body || {}, url.searchParams, mm); return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
      catch (e) { return new Response(JSON.stringify({ status: e.status || 500, error: e.code || 'internal' }), { status: e.status || 500, headers: { 'Content-Type': 'application/json' } }); }
    }
    return new Response(JSON.stringify({ status: 404, error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  };
})();
