'use strict';
/* EndoControl web app — vanilla JS single-page app (no build step). */
(function () {
  const C = window.Charts, I = window.I18N;
  const esc = C.esc;
  const $ = s => document.querySelector(s);
  // Thin line icons (24px grid, 1.7 stroke, currentColor) for the bottom menu and quick actions.
  const ICONS = {
    home: '<path d="M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
    diary: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 7.5h6M9 11.5h6M9 15.5h3.5"/>',
    reports: '<path d="M4 4v16h16"/><path d="m7.5 14.5 3.5-4.5 3 3 5-6.5"/>',
    ai: '<path d="M11 3.5 12.9 8.6 18 10.5l-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    school: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3V11"/><path d="M21.5 9v5.5"/>',
    share: '<path d="M6 3.5H5v5.5a4.5 4.5 0 0 0 9 0V3.5h-1"/><path d="M9.5 13.5v1.5a5 5 0 0 0 10 0v-2.5"/><circle cx="19.5" cy="10.5" r="2"/>',
    settings: '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>',
    patients: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.3a5 5 0 0 1 5 5.2"/>',
    meal: '<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10"/><path d="M17.5 3c-2 0-3.5 2.6-3.5 5.6S15.5 13 17.5 13v8"/>',
    insulin: '<path d="m17.5 3 3.5 3.5M15.5 5 19 8.5"/><path d="M17.2 6.8 7.5 16.5 5 19l1.5 1.5L9 18l9.7-9.7"/><path d="m10 11 3 3M12.5 8.5l3 3"/>',
    bg: '<path d="M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    exercise: '<path d="M3 12h4l2.5-6.5 5 13L17 12h4"/>',
    note: '<path d="M4.5 19.5h4l11-11a2.1 2.1 0 0 0-3-3l-11 11z"/><path d="m14.5 7 2.5 2.5"/>',
    sensor: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
    pump: '<rect x="4" y="6" width="12" height="13" rx="3"/><path d="M8 10h4M16 9.5h2a2 2 0 0 1 2 2V14"/><path d="M20 14c0 3-2 5-5 5"/>',
    moon: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    chat: '<path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17.5h-1A1.5 1.5 0 0 1 3 16V7a1.5 1.5 0 0 1 1.5-1.5z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    left: '<path d="m14.5 6-6 6 6 6"/>', right: '<path d="m9.5 6 6 6-6 6"/>',
  };
  // One page header for every screen: a line icon in a tinted circle, the title and a short line.
  const pageHead = (ic, title, sub, tone = 'sky', extra = '') => `<div class="phead ${tone}"><span class="pico">${icon(ic)}</span><div class="grow"><h1>${title}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${extra}</div>`;
  const icon = n => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const IMG = n => (window.EC_IMG && window.EC_IMG[n]) || '/img/' + n + '.webp';
  // A colourful page header with an illustration: tone = violet | yellow | peach | sky | blue.
  const banner = (tone, img, title, text, extra = '') => `<div class="banner ${tone}"><div class="btxt"><h1>${title}</h1>${text ? `<p>${esc(text)}</p>` : ''}${extra}</div><img src="${IMG(img)}" alt="" loading="lazy"></div>`;
  const S = { me: null, lang: I.detect(), units: 'mg/dl', timer: null };

  // ------------------------------------------------------------ i18n
  const t = (k, vars) => I.t(S.lang, k, vars);
  function setLang(l) {
    S.lang = l; I.save(l);
    document.documentElement.lang = l;
    document.documentElement.dir = I.rtl(l) ? 'rtl' : 'ltr';
    $('#langSel').value = l;
  }
  const locale = () => I.locale(S.lang);
  const fmtTime = ms => new Date(ms).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (ms, o = { day: '2-digit', month: '2-digit', year: 'numeric' }) => new Date(ms).toLocaleDateString(locale(), o);
  const fmtDT = ms => `${fmtDate(ms, { day: '2-digit', month: 'short' })} ${fmtTime(ms)}`;
  const G = mg => C.fmtG(mg, S.units);
  const UL = () => C.unitLabel(S.units);
  const toMg = v => S.units === 'mmol' ? Math.round(parseFloat(String(v).replace(',', '.')) * C.MMOL) : Math.round(parseFloat(v));
  function ago(ms) {
    const m = Math.round((Date.now() - ms) / 60e3);
    if (m < 1) return t('justNow');
    if (m < 60) return t('minAgo', { n: m });
    const h = Math.round(m / 60); if (h < 48) return t('hAgo', { n: h });
    return fmtDT(ms);
  }

  // ------------------------------------------------------------ api
  async function api(method, path, body, raw) {
    const opt = { method, headers: { 'X-EC': '1' }, credentials: 'same-origin' };
    if (body !== undefined) { if (raw) { opt.body = body; opt.headers['Content-Type'] = 'text/csv'; } else { opt.body = JSON.stringify(body); opt.headers['Content-Type'] = 'application/json'; } }
    const r = await fetch(path, opt);
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('json') ? await r.json() : await r.text();
    if (!r.ok) { const e = new Error(data && data.error || 'error'); e.code = data && data.error; e.status = r.status; e.detail = data && data.message; throw e; }
    return data;
  }
  const errText = e => (e && e.code && I.has(S.lang, 'e_' + e.code)) ? t('e_' + e.code) : (e && e.detail) || t('e_generic');

  // ------------------------------------------------------------ hypo timer (15 min), shown on every page
  const HT = { key: 'ec_hypo_timer', tick: null, onDone: null, rang: false };
  function htEnd() { try { return Number(localStorage.getItem(HT.key)) || 0; } catch { return 0; } }
  function htSet(v) { try { if (v) localStorage.setItem(HT.key, String(v)); else localStorage.removeItem(HT.key); } catch { /* private mode: timer lives until reload */ HT.mem = v; } }
  function startHypoTimer(min = 15) {
    htSet(Date.now() + min * 60e3); HT.rang = false;
    try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch { /* not supported */ }
    hypoTimerDraw();
  }
  function beep() {
    try {
      const A = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7, 1.4, 1.75, 2.1].forEach(d => {
        const o = A.createOscillator(), g = A.createGain(); o.frequency.value = 880; o.connect(g); g.connect(A.destination);
        g.gain.setValueAtTime(0.0001, A.currentTime + d); g.gain.exponentialRampToValueAtTime(0.3, A.currentTime + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, A.currentTime + d + 0.25); o.start(A.currentTime + d); o.stop(A.currentTime + d + 0.3);
      });
    } catch { /* no audio */ }
  }
  function hypoTimerDraw() {
    let el = $('#hypotimer');
    let end = htEnd() || HT.mem || 0;
    if (end && Date.now() - end > 30 * 60e3) { htSet(0); end = 0; } // forgotten long ago
    if (!end) { if (el) el.remove(); clearInterval(HT.tick); HT.tick = null; return; }
    if (!el) { el = document.createElement('div'); el.id = 'hypotimer'; el.className = 'hypotimer no-print'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    const left = end - Date.now();
    if (left > 0) {
      const m = Math.floor(left / 60e3), sec = Math.floor((left % 60e3) / 1000);
      el.classList.remove('done');
      el.innerHTML = `<span>${esc(t('tmLeft', { m: `${m}:${String(sec).padStart(2, '0')}` }))}</span><button type="button" class="tmx">${esc(t('tmCancel'))}</button>`;
    } else {
      if (!HT.rang) {
        HT.rang = true; el.classList.add('done'); beep();
        try { if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]); } catch { /* no vibration */ }
        try { if (window.Notification && Notification.permission === 'granted') new Notification('EndoControl', { body: t('tmDone'), requireInteraction: true }); } catch { /* no notifications */ }
        if (HT.onDone && HT.onDone()) return;
      }
      el.innerHTML = `<span>${esc(t('tmDone'))}</span><a class="btn sm" href="#/ai" id="tmcheck">${esc(t('tmCheck'))}</a><button type="button" class="tmx">${esc(t('tmCancel'))}</button>`;
      el.querySelector('#tmcheck').onclick = () => { S.pendingRecheck = true; htSet(0); hypoTimerDraw(); };
    }
    el.querySelector('.tmx').onclick = () => { htSet(0); HT.mem = 0; hypoTimerDraw(); };
    if (!HT.tick) HT.tick = setInterval(hypoTimerDraw, 1000);
  }

  // ------------------------------------------------------------ glucose alerts (while the app is open)
  const AL_KEY = 'ec_alerts', AL_MEM = 'ec_alert_mem';
  const alPrefs = () => { try { return Object.assign({ on: true, voice: true, sound: true }, JSON.parse(localStorage.getItem(AL_KEY) || '{}')); } catch { return { on: true, voice: true, sound: true }; } };
  const alSave = p => { try { localStorage.setItem(AL_KEY, JSON.stringify(p)); } catch { /* not kept */ } };
  const alMem = () => { try { return JSON.parse(localStorage.getItem(AL_MEM) || '{}'); } catch { return {}; } };
  const alMemSave = m => { try { localStorage.setItem(AL_MEM, JSON.stringify(m)); } catch { /* not kept */ } };
  const SPEECH = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', tr: 'tr-TR', pt: 'pt-BR', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA', hi: 'hi-IN', id: 'id-ID' };
  function say(text) {
    try {
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = SPEECH[S.lang] || 'en-US'; u.rate = 0.95;
      const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith(S.lang));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch { /* no speech */ }
  }
  function tone(kind) {
    try {
      const A = new (window.AudioContext || window.webkitAudioContext)();
      // falling: three descending tones; rising: two ascending; critical: fast repeated high tone
      const seq = kind === 'verylow' ? [[1047, 0], [1047, .22], [1047, .44], [1047, .66], [1047, .88]]
        : /low|fall/.test(kind) ? [[880, 0], [740, .3], [587, .6]] : [[523, 0], [784, .3]];
      for (const [f, d] of seq) {
        const o = A.createOscillator(), g = A.createGain(); o.frequency.value = f; o.connect(g); g.connect(A.destination);
        g.gain.setValueAtTime(0.0001, A.currentTime + d); g.gain.exponentialRampToValueAtTime(0.35, A.currentTime + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, A.currentTime + d + 0.22); o.start(A.currentTime + d); o.stop(A.currentTime + d + 0.25);
      }
    } catch { /* no audio */ }
  }
  const spokenNum = mg => { const x = G(mg); return ['ru', 'kk', 'de', 'es', 'fr', 'tr', 'pt', 'id'].includes(S.lang) ? x.replace('.', ',') : x; };
  function alertText(a, spoken) {
    const { lo } = targets(S.me && S.me.user);
    const u = spoken ? t(S.units === 'mmol' ? 'alUnitMmol' : 'alUnitMg') : UL();
    return t({ verylow: 'alVeryLow', low: 'alLow', fallsoon: 'alFallSoon', fall: 'alFall', rise: 'alRise', high: 'alHigh' }[a.kind], { v: spoken ? spokenNum(a.v) : G(a.v), u, lo: spoken ? spokenNum(lo) : G(lo) });
  }
  function showAlert(a, opts = {}) {
    const prefs = alPrefs();
    let el = $('#galert');
    if (!el) { el = document.createElement('div'); el.id = 'galert'; el.setAttribute('role', 'alert'); document.body.appendChild(el); }
    el.className = 'galert no-print lv-' + a.level;
    el.innerHTML = `<div class="gtxt">${esc(alertText(a))}</div><div class="gbtns"><button type="button" class="btn sm" data-al="help">${esc(t('alWhat'))}</button>
      <button type="button" class="btn ghost sm" data-al="snooze">${esc(t('alSnooze'))}</button><button type="button" class="tmx" data-al="ok" aria-label="${esc(t('alOk'))}">✕</button></div>`;
    document.body.classList.add('has-galert');
    const close = () => { el.remove(); document.body.classList.remove('has-galert'); try { speechSynthesis.cancel(); } catch { /* none */ } };
    el.querySelector('[data-al=ok]').onclick = close;
    el.querySelector('[data-al=snooze]').onclick = () => { const m = alMem(); m.snoozeUntil = Date.now() + 30 * 60e3; alMemSave(m); close(); };
    el.querySelector('[data-al=help]').onclick = () => {
      close();
      S.pendingQuestion = /low|fall/.test(a.kind) ? { q: t('urSos'), force: true } : { q: t('alAskRise') };
      if (location.hash.startsWith('#/ai')) route(); else location.hash = '#/ai';
    };
    if (prefs.sound || opts.test) { tone(a.kind); try { if (navigator.vibrate) navigator.vibrate(a.level === 'critical' ? [500, 200, 500, 200, 500] : [300, 150, 300]); } catch { /* none */ } }
    if (prefs.voice || opts.test) setTimeout(() => say(opts.test ? t('alTestText') : alertText(a, true)), 700);
    try { if (!opts.test && document.hidden && window.Notification && Notification.permission === 'granted') new Notification('EndoControl', { body: alertText(a), requireInteraction: a.level !== 'warn' }); } catch { /* none */ }
  }
  async function alertCheck() {
    if (!S.me || S.me.user.role === 'doctor' || !alPrefs().on) return;
    let d; try { d = await getData(Date.now() - 40 * 60e3, Date.now() + 60e3); } catch { return; }
    const { lo, hi } = targets(S.me.user);
    const a = window.Alerts.check(d.entries, Date.now(), { lo, hi });
    const mem = alMem();
    if (!window.Alerts.shouldFire(a, mem, Date.now())) return;
    mem.last = { kind: a.kind, at: Date.now() }; alMemSave(mem);
    showAlert(a);
  }
  let alTimer = null;
  function alertWatch() { if (alTimer) return; alertCheck(); alTimer = setInterval(alertCheck, 60e3); }
  function alertSettings() {
    if (!S.me || S.me.user.role === 'doctor') return;
    const p = alPrefs();
    const box = document.createElement('div'); box.className = 'card'; box.id = 'alcard';
    box.innerHTML = `<h2 class="hic">${icon('bell')}${esc(t('alTitle'))}</h2>
      <label class="check"><input type="checkbox" data-p="on" ${p.on ? 'checked' : ''}> ${esc(t('alOn'))}</label>
      <label class="check"><input type="checkbox" data-p="voice" ${p.voice ? 'checked' : ''}> ${esc(t('alVoice'))}</label>
      <label class="check"><input type="checkbox" data-p="sound" ${p.sound ? 'checked' : ''}> ${esc(t('alSound'))}</label>
      <div class="row" style="gap:10px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn sm" id="altest">${esc(t('alTest'))}</button></div>
      <p class="tiny muted" style="margin-bottom:0">${esc(t('alNote'))}</p>`;
    const head = $('#view .phead'); if (head) head.after(box); else $('#view').prepend(box);
    box.querySelectorAll('[data-p]').forEach(c => c.onchange = () => { const q = alPrefs(); q[c.dataset.p] = c.checked; alSave(q); });
    box.querySelector('#altest').onclick = () => {
      try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch { /* none */ }
      showAlert({ kind: 'fall', level: 'urgent', v: 92 }, { test: true });
    };
  }

  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2800); }
  async function copy(text) { try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch { toast(text); } }
  function modal(html, onMount) {
    $('#modal').innerHTML = `<div class="modal" id="mbg"><div class="card">${html}</div></div>`;
    $('#mbg').onclick = e => { if (e.target.id === 'mbg') closeModal(); };
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    onMount && onMount();
  }
  const closeModal = () => { $('#modal').innerHTML = ''; };

  // ------------------------------------------------------------ shell
  function nav() {
    const r = location.hash.split('/')[1] || '';
    let items = [];
    if (S.me && S.me.user.role === 'doctor') items = [['patients', '👥', 'navPatients'], ['settings', '⚙️', 'navSettings']];
    else if (S.me) items = [['home', '🏠', 'navHome'], ['diary', '📔', 'navDiary'], ['reports', '📊', 'navReports'], ['ai', '✨', 'navAi'], ['school', '🎓', 'navSchool'], ['share', '🩺', 'navDoctor'], ['settings', '⚙️', 'navSettings']];
    const html = items.map(([id, ic, k]) => `<a href="#/${id}" class="${r === id || (id === 'home' && r === 'connect') ? 'on' : ''}"><span>${icon(id)}</span>${esc(t(I.has('en', k + 'Short') ? k + 'Short' : k))}</a>`).join('');
    $('#mainnav').innerHTML = items.map(([id, , k]) => `<a href="#/${id}" class="${r === id ? 'on' : ''}">${esc(t(k))}</a>`).join('');
    $('#bottomnav').innerHTML = html;
    $('#bottomnav').style.display = items.length ? '' : 'none';
    const lb = $('#logoutBtn'); lb.hidden = !S.me; lb.textContent = t('logout');
  }
  function fillLangs() {
    $('#langSel').innerHTML = I.LANGS.map(l => `<option value="${l.code}">${esc(l.name)}</option>`).join('');
    $('#langSel').value = S.lang;
    $('#langSel').onchange = async e => {
      setLang(e.target.value);
      if (S.me) { try { await api('PUT', '/app/me', { lang: S.lang }); } catch { } }
      route();
    };
    $('#logoutBtn').onclick = async () => { await api('POST', '/app/logout').catch(() => { }); S.me = null; location.hash = '#/login'; };
  }

  async function loadMe() {
    try { S.me = await api('GET', '/app/me'); S.units = S.me.user.units; if (S.me.user.lang && S.me.user.lang !== S.lang && !I.saved()) setLang(S.me.user.lang); }
    catch { S.me = null; }
    return S.me;
  }

  // ------------------------------------------------------------ router
  async function route() {
    clearInterval(S.timer);
    HT.onDone = null;
    if (ROBOT) { ROBOT.destroy(); ROBOT = null; }
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const page = parts[0] || '';
    const view = $('#view');
    if (page === 's') { S.me = S.me || await loadMe(); nav(); return sharedView(parts[1]); }
    if (!S.me) await loadMe();
    nav();
    if (!S.me) { if (page === 'register') return register(); return login(); }
    const doc = S.me.user.role === 'doctor';
    const settingsPage = async a => { await settings(a); alertSettings(); };
    const pages = doc ? { patients, p: doctorPatient, settings } : { home, connect, diary, reports, ai, school, share, settings: settingsPage };
    const fn = pages[page] || (doc ? patients : home);
    if (!pages[page]) history.replaceState(null, '', doc ? '#/patients' : '#/home');
    view.innerHTML = `<div class="loading">${esc(t('loading'))}</div>`;
    try { await fn(parts.slice(1)); } catch (e) { console.error(e); view.innerHTML = `<div class="card err">${esc(errText(e))}</div>`; }
    nav();
  }

  // ------------------------------------------------------------ auth pages
  function pwStrength(p) { let s = 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (/\d/.test(p) && /\p{L}/u.test(p)) s++; if (/[^\p{L}\d]/u.test(p)) s++; return s; }

  function login() {
    $('#view').innerHTML = `<div class="auth">
      <img class="authart" src="${IMG('welcome')}" alt="">
      <div class="hero"><h1>${esc(t('welcome'))}</h1><div class="muted">${esc(t('tagline'))}</div></div>
      <form class="card" id="f">
        <div class="fld"><label for="em">${esc(t('email'))}</label><input id="em" type="email" autocomplete="username" required></div>
        <div class="fld"><label for="pw">${esc(t('password'))}</label><input id="pw" type="password" autocomplete="current-password" required></div>
        <div class="err" id="err"></div>
        <button class="btn block">${esc(t('signIn'))}</button>
        <p class="small muted" style="text-align:center;margin:14px 0 0">${esc(t('noAccount'))} <a href="#/register">${esc(t('createAccount'))}</a></p>
      </form>${window.EC_DEMO ? `<div class="card small"><p style="margin-top:0">${esc(t('demoBanner'))}</p><div class="grid g2"><button class="btn ghost" data-demo="demo">👨‍👩‍👧 ${esc(t('demoAsPatient'))}</button><button class="btn ghost" data-demo="doctor">🩺 ${esc(t('demoAsDoctor'))}</button></div></div>` : ''}</div>`;
    document.querySelectorAll('[data-demo]').forEach(b => b.onclick = async () => { await api('POST', '/app/login', { email: b.dataset.demo + '@endocontrol.app', password: 'demo1234' }); await loadMe(); location.hash = '#/'; route(); });
    $('#f').onsubmit = async e => {
      e.preventDefault(); $('#err').textContent = '';
      try { await api('POST', '/app/login', { email: $('#em').value, password: $('#pw').value }); await loadMe(); location.hash = '#/'; route(); }
      catch (er) { $('#err').textContent = errText(er); }
    };
  }

  function register() {
    let role = 'patient';
    const mmolDefault = ['ru', 'uk', 'kk', 'zh'].includes(S.lang) || /GB|AU|CA|NZ|IE|ZA|KZ|RU|UA|CN|HK|SE|NO|DK|FI|NL|CZ|SK/.test(navigator.language || '');
    const draw = () => {
      $('#view').innerHTML = `<div class="auth">
      <div class="hero"><img src="/icon.svg" alt=""><h1>${esc(t('createAccount'))}</h1><div class="muted">${esc(t('regIntro'))}</div></div>
      <form class="card" id="f" novalidate>
        <div class="roles"><button type="button" data-r="patient" class="${role === 'patient' ? 'on' : ''}"><span>👨‍👩‍👧</span>${esc(t('rolePatient'))}</button>
          <button type="button" data-r="doctor" class="${role === 'doctor' ? 'on' : ''}"><span>🩺</span>${esc(t('roleDoctor'))}</button></div>
        <div class="fld"><label for="nm">${esc(t(role === 'doctor' ? 'yourNameDoctor' : 'yourName'))}</label><input id="nm" autocomplete="name" required></div>
        ${role === 'patient' ? `<div class="fld"><label for="pn">${esc(t('patientName'))}</label><input id="pn" placeholder="${esc(t('patientNameHint'))}"></div>
        <div class="grid g2"><div class="fld"><label for="dt">${esc(t('diabetesType'))}</label><select id="dt"><option value="t1">${esc(t('t1'))}</option><option value="t2">${esc(t('t2'))}</option><option value="gestational">${esc(t('gest'))}</option><option value="other">${esc(t('otherType'))}</option></select></div>
        <div class="fld"><label for="un">${esc(t('units'))}</label><select id="un"><option value="mmol" ${mmolDefault ? 'selected' : ''}>mmol/L</option><option value="mg/dl" ${mmolDefault ? '' : 'selected'}>mg/dL</option></select></div></div>` : ''}
        <div class="fld"><label for="em">${esc(t('email'))}</label><input id="em" type="email" autocomplete="email" required></div>
        <div class="fld"><label for="pw">${esc(t('password'))}</label><input id="pw" type="password" autocomplete="new-password" required><div class="pwbar"><i id="pwb"></i></div><div class="tiny muted">${esc(t('pwRule'))}</div></div>
        <div class="fld"><label for="pw2">${esc(t('password2'))}</label><input id="pw2" type="password" autocomplete="new-password" required></div>
        <label class="check"><input type="checkbox" id="cs"> <span>${esc(t('consent'))}</span></label>
        <div class="err" id="err"></div>
        <button class="btn block">${esc(t('createAccount'))}</button>
        <p class="small muted" style="text-align:center;margin:14px 0 0">${esc(t('haveAccount'))} <a href="#/login">${esc(t('signIn'))}</a></p>
      </form></div>`;
      document.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { role = b.dataset.r; draw(); });
      $('#pw').oninput = () => { const s = pwStrength($('#pw').value); const b = $('#pwb'); b.style.width = s * 25 + '%'; b.style.background = ['var(--low)', 'var(--low)', 'var(--high)', 'var(--in)', 'var(--in)'][s]; };
      $('#f').onsubmit = async e => {
        e.preventDefault(); const err = $('#err'); err.textContent = '';
        const pw = $('#pw').value;
        if (pw !== $('#pw2').value) return err.textContent = t('pwMismatch');
        if (pw.length < 8 || !/\d/.test(pw) || !/\p{L}/u.test(pw)) return err.textContent = t('e_weak_password');
        if (!$('#cs').checked) return err.textContent = t('e_consent_required');
        const body = { role, name: $('#nm').value, email: $('#em').value, password: pw, consent: true, lang: S.lang, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        if (role === 'patient') Object.assign(body, { patient_name: $('#pn').value, diabetes_type: $('#dt').value, units: $('#un').value });
        else body.units = mmolDefault ? 'mmol' : 'mg/dl';
        try { await api('POST', '/app/register', body); await loadMe(); location.hash = role === 'doctor' ? '#/patients' : '#/connect'; route(); }
        catch (er) { err.textContent = errText(er); }
      };
    };
    draw();
  }

  // ------------------------------------------------------------ data helpers
  async function getData(fromMs, toMs, share) {
    const q = new URLSearchParams({ from: Math.round(fromMs), to: Math.round(toMs) });
    if (share) q.set('share', share);
    const d = await api('GET', '/app/data?' + q);
    d.treatments.forEach(x => { x.mills = x.mills || Date.parse(x.created_at); });
    return d;
  }
  const targets = p => ({ lo: (p && p.target_low) || 70, hi: (p && p.target_high) || 180 });
  const dayStart = (ms, offsetDays = 0) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offsetDays); return d.getTime(); };

  function metricsHtml(st, lo, hi) {
    if (!st.n) return `<div class="muted">${esc(t('noData'))}</div>`;
    const m = (l, v, sub, col) => `<div class="metric"><div class="l">${esc(l)}</div><div class="v" ${col ? `style="color:${col}"` : ''}>${v}</div><div class="t">${esc(sub)}</div></div>`;
    return `<div class="grid g4">
      ${m(t('tir'), st.tir.toFixed(0) + '%', t('goal') + ' >70%', st.tir >= 70 ? 'var(--in)' : 'var(--high)')}
      ${m(t('tbr'), st.tbr.toFixed(1) + '%', t('goal') + ' <4%', st.tbr < 4 ? 'var(--in)' : 'var(--low)')}
      ${m(t('mean'), G(st.mean), UL())}
      ${m('GMI', st.gmi.toFixed(1) + '%', 'CV ' + st.cv.toFixed(0) + '% · ' + t('goal') + ' ≤36%')}</div>`;
  }
  function trTitle(x) {
    if (x.carbs && x.insulin) return t('tMeal');
    if (x.carbs) return t('tCarbs');
    if (x.insulin) return /basal/i.test(x.eventType) ? t('tBasal') : t('tInsulin');
    if (x.glucose) return t('tBg');
    if (/exercise/i.test(x.eventType)) return t('tExercise');
    if (/sensor/i.test(x.eventType)) return t('tSensor');
    return x.eventType === 'Note' || x.eventType === '<none>' ? t('tNote') : x.eventType;
  }
  function trValue(x) {
    const p = [];
    if (x.mealType) p.push(t(x.mealType === 'snack' ? 'mSnack' : 'ex_' + x.mealType));
    if (x.carbs) p.push(`${+x.carbs} ${t('gCarbs')}`);
    if (x.insulin) p.push(`${+x.insulin} ${t('uIns')}`);
    if (x.glucose && x.bgAt == null) p.push(`${G(x.units === 'mmol' ? x.glucose * C.MMOL : x.glucose)} ${UL()}`);
    if (x.duration) p.push(`${x.duration} ${t('min')}`);
    if (x.insulin && Number.isFinite(+x.preBolus) && x.carbs) p.push(+x.preBolus > 0 ? t('bwBefore') : +x.preBolus < 0 ? t('bwAfter') : t('bwWith'));
    return p.join(' · ');
  }
  // "glucose 6.2 → 9.8 after 2 h", coloured by range; filled in automatically from the sensor.
  function trBg(x, lo, hi) {
    if (x.bgAt == null && x.bg2h == null) return '';
    const col = v => v < lo ? 'var(--low)' : v > hi ? 'var(--high)' : 'var(--in)';
    const v = mg => `<b style="color:${col(mg)}">${G(mg)}</b>`;
    const after = x.bg2h != null ? `${v(x.bg2h)} ${esc(t('bg2h'))}` : (Date.now() - x.mills < 2 * 3600e3 ? `<span class="muted">${esc(t('pending2h'))}</span>` : '—');
    return `<div class="bgpair">🩸 ${x.bgAt != null ? v(x.bgAt) : '—'} → ${after} <span class="muted">${esc(UL())}</span></div>`;
  }

  // Big current-glucose card, coloured by range
  function heroHtml(last, lo, hi, name, metaHtml, extra) {
    const v = last ? last[1] : null;
    const st = v == null ? 'none' : v < 54 ? 'vlow' : v < lo ? 'low' : v <= hi ? 'in' : v <= 250 ? 'high' : 'vhigh';
    const label = { none: '', vlow: t('veryLow'), low: t('low'), in: t('inRange'), high: t('high'), vhigh: t('veryHigh') }[st];
    return `<div class="hero-card st-${st}"><div class="now">
      <div class="valbox"><div class="val">${v != null ? G(v) : '—'}<span class="arrow">${last ? (C.ARROWS[last[2]] || '') : ''}</span></div><div class="unit">${UL()}${label ? `<span class="zone z-${st}"><i></i>${esc(label)}</span>` : ''}</div></div>
      <div class="grow"><div class="who">${esc(name)}</div><div class="meta">${metaHtml}</div></div>
      ${extra || ''}</div></div>`;
  }

  // ------------------------------------------------------------ home
  async function home() {
    const me = S.me = await api('GET', '/app/me');
    S.units = me.user.units;
    let range = Number(sessionStorage.getItem('range') || 24);
    // The 3D robot lives in one element that is moved into each redraw, so it is built once per visit.
    let rbox = null;
    const draw = async () => {
      const now = Date.now();
      const d = await getData(now - range * 3600e3, now + 60e3);
      const { lo, hi } = targets(me.user);
      const last = d.entries[d.entries.length - 1];
      const today = d.entries.filter(e => e[0] >= dayStart(now)).map(e => e[1]);
      const st = C.stats(today, lo, hi);
      const stale = !last || now - last[0] > 15 * 60e3;
      const noSource = !me.bridges.length && !me.last;
      $('#view').innerHTML = `
      ${noSource ? `<div class="cta"><h2>${esc(t('connectFirst'))}</h2><p>${esc(t('connectFirstText'))}</p><a class="btn" href="#/connect">${esc(t('connectSensor'))}</a></div>` : ''}
      ${heroHtml(last, lo, hi, me.user.patient_name || me.user.name, (last ? esc(ago(last[0])) : esc(t('noData'))) + (stale && last ? ` · ${esc(t('stale'))}` : ''), `<div class="seg" id="rng">${[3, 6, 12, 24].map(h => `<button data-h="${h}" class="${h === range ? 'on' : ''}">${h}${esc(t('hShort'))}</button>`).join('')}</div>`)}
      <div class="card chartcard indigo">
      ${C.line(d.entries, now - range * 3600e3, now + 5 * 60e3, { lo, hi, units: S.units, treatments: d.treatments, locale: locale(), label: t('glucose') })}
      <div class="legend"><i style="background:var(--ins)"></i>${esc(t('tInsulin'))}<i style="background:var(--carb)"></i>${esc(t('tCarbs'))}<i style="background:var(--in-soft);border:1px solid var(--in)"></i>${esc(t('targetRange'))} ${G(lo)}–${G(hi)}</div>
      </div>
      <div class="quick no-print">${[['meal', '🍽', 'tMealEntry'], ['insulin', '💉', 'tBolus'], ['bg', '🩸', 'tBg'], ['exercise', '🏃', 'tExercise'], ['note', '📝', 'tNote']].map(q => `<button data-q="${q[0]}"><span>${icon(q[0])}</span>${esc(t(q[2]))}</button>`).join('')}</div>
      <div class="card aihome no-print">
        <div class="row aihead"><div class="hrobot" id="hrobot" aria-hidden="true"></div><div class="grow"><h2>${esc(t('navAi'))}</h2><div class="small muted">${esc(t('aiSeen'))}</div></div>
          <button type="button" class="btn red sm" id="hsos">${esc(t('urSos'))}</button></div>
        ${insights(d.entries, lo, hi).slice(0, 3).map(x => `<div class="ins">${esc(x)}</div>`).join('')}
        <form id="hask" class="aiform"><input id="haskIn" maxlength="2000" autocomplete="off" placeholder="${esc(t('aiPlaceholder'))}" aria-label="${esc(t('aiAsk'))}"><button class="btn" aria-label="${esc(t('aiSend'))}">➤</button></form>
        <div class="chips">${t('aiChips').split('|').slice(0, 3).map(c => `<button type="button" class="chip" data-hq="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      </div>
      <div class="grid g2" style="margin-top:12px">
        <div class="card"><h2>${esc(t('today'))}</h2>${metricsHtml(st, lo, hi)}</div>
        <div class="card"><h2>${esc(t('dataSources'))}</h2>${sourcesHtml(me)}<a class="btn ghost sm" href="#/connect" style="margin-top:8px">${esc(t('connectSensor'))}</a></div>
      </div>
      <div class="discover no-print">
        <a class="dcard yellow" href="#/school"><img src="${IMG('home')}" alt="" loading="lazy"><b>${esc(t('navSchool'))}</b><span>${esc(t('schProgress', { n: schoolDone().length, total: SCH.lessons(S.lang).length }))}</span></a>
        <a class="dcard peach" href="#/reports"><img src="${IMG('l-targets')}" alt="" loading="lazy"><b>${esc(t('navReports'))}</b><span>${esc(t('timeInRanges'))}</span></a>
      </div>`;
      document.querySelectorAll('#rng button').forEach(b => b.onclick = () => { range = +b.dataset.h; sessionStorage.setItem('range', range); draw(); });
      document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => addEntry(b.dataset.q, draw));
      // Questions asked here open the analyst with the answer.
      const toAi = (q, force = false) => { if (!q || !q.trim()) return; S.pendingQuestion = { q: q.trim(), force }; location.hash = '#/ai'; };
      $('#hask').onsubmit = e => { e.preventDefault(); toAi($('#haskIn').value); };
      document.querySelectorAll('[data-hq]').forEach(b => b.onclick = () => toAi(b.dataset.hq));
      $('#hsos').onclick = () => toAi(t('urSos'), true);
      if (!rbox) { rbox = document.createElement('div'); rbox.className = 'robotbox homebot'; rbox.innerHTML = `<img src="${IMG('ai')}" alt="">`; }
      robotClickable(rbox);
      $('#hrobot').appendChild(rbox);
      if (!ROBOT) mountRobot(rbox);
    };
    await draw();
    // Refresh every minute, but not while a dialog is open or a question is being typed.
    S.timer = setInterval(() => { const typing = document.activeElement && document.activeElement.id === 'haskIn' && document.activeElement.value; if (!$('#modal').innerHTML && !typing) draw().catch(() => { }); }, 60e3);
  }

  function sourcesHtml(me) {
    const names = { librelinkup: 'LibreLinkUp', dexcom: 'Dexcom Share', nightscout: 'Nightscout' };
    let h = me.bridges.map(b => `<div class="status"><span class="dot ${b.status === 'ok' ? 'ok' : b.status === 'error' ? 'err' : 'wait'}"></span><div class="grow">
      <b>${esc(names[b.kind] || b.kind)}</b><div class="small muted">${b.status === 'ok' ? esc(t('bridgeOk', { time: b.last_data ? ago(b.last_data) : '—' })) : b.status === 'error' ? esc(bridgeErr(b.last_error)) : esc(t('bridgeWait'))}</div></div></div>`).join('');
    if (me.last && !me.bridges.some(b => b.kind === me.last.source)) h += `<div class="status"><span class="dot ok"></span><div class="grow"><b>${esc(me.last.device || t('uploaderApp'))}</b><div class="small muted">${esc(t('lastValue'))}: ${esc(ago(me.last.date))}</div></div></div>`;
    if (!h) h = `<div class="muted small">${esc(t('noSources'))}</div>`;
    return h + `<div class="tiny muted" style="margin-top:6px">${esc(t('storedCount', { n: (me.stored || 0).toLocaleString(locale()) }))}</div>`;
  }
  const bridgeErr = s => { const code = String(s || '').split(':')[0]; return I.has(S.lang, 'b_' + code) ? t('b_' + code) : (s || t('e_generic')); };

  // ---- number fields accept "6,5" as well as "6.5"
  const parseNum = v => { const x = parseFloat(String(v == null ? '' : v).trim().replace(',', '.')); return Number.isFinite(x) ? x : NaN; };
  const numField = (id, label, req) => `<div class="fld"><label for="${id}">${esc(label)}</label><input id="${id}" type="text" inputmode="decimal" autocomplete="off" pattern="[0-9]*[.,]?[0-9]*" ${req ? 'required' : ''}></div>`;

  // ---- time "wheel": day · hour · minute columns that snap, plus quick buttons
  const WH = 36; // item height, px
  function wheelHtml() {
    return `<div class="fld"><label>${esc(t('time'))}</label>
      <div class="wheel" id="wheel"><div class="wsel"></div><div class="wcol" data-c="d"></div><div class="wcol narrow" data-c="h"></div><div class="wsep">:</div><div class="wcol narrow" data-c="m"></div></div>
      <div class="wquick">${[0, 15, 30, 60].map(n => `<button type="button" data-ago="${n}">${esc(n ? t('timeAgo', { n }) : t('timeNow'))}</button>`).join('')}</div></div>`;
  }
  function wheelMount(onChange) {
    const root = $('#wheel'), now = Date.now();
    const days = Array.from({ length: 7 }, (_, k) => dayStart(now, -k));
    const label = (d, k) => k === 0 ? t('wheelToday') : k === 1 ? t('wheelYesterday') : fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' });
    const cols = { d: days.map(label), h: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), m: Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')) };
    const el = c => root.querySelector(`[data-c="${c}"]`);
    for (const c of ['d', 'h', 'm']) el(c).innerHTML = cols[c].map((x, i) => `<div class="witem" data-i="${i}">${esc(x)}</div>`).join('');
    const idx = c => Math.max(0, Math.min(cols[c].length - 1, Math.round(el(c).scrollTop / WH)));
    const value = () => days[idx('d')] + idx('h') * 3600e3 + idx('m') * 60e3;
    const mark = () => { for (const c of ['d', 'h', 'm']) { const i = idx(c); el(c).querySelectorAll('.witem').forEach((x, k) => x.classList.toggle('on', k === i)); } };
    let tmr;
    for (const c of ['d', 'h', 'm']) {
      el(c).addEventListener('scroll', () => { mark(); clearTimeout(tmr); tmr = setTimeout(() => onChange(value()), 120); }, { passive: true });
      el(c).addEventListener('click', e => { const it = e.target.closest('.witem'); if (it) el(c).scrollTo({ top: +it.dataset.i * WH, behavior: 'smooth' }); });
    }
    const set = ms => {
      const d = new Date(ms), di = Math.max(0, days.findIndex(x => x <= ms));
      el('d').scrollTop = di * WH; el('h').scrollTop = d.getHours() * WH; el('m').scrollTop = d.getMinutes() * WH;
      mark(); onChange(value());
    };
    root.parentElement.querySelectorAll('[data-ago]').forEach(b => b.onclick = () => set(Date.now() - +b.dataset.ago * 60e3));
    set(now);
    return { value };
  }

  function addEntry(kind, done) {
    const titles = { meal: 'tMealEntry', carbs: 'tCarbs', insulin: 'tBolus', bg: 'tBg', exercise: 'tExercise', note: 'tNote' };
    const mealByHour = h => h >= 5 && h < 11 ? 'breakfast' : h >= 11 && h < 16 ? 'lunch' : h >= 16 && h < 22 ? 'dinner' : 'snack';
    const seg = (name, opts, on) => `<div class="seg wide" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === on ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
    let body = '';
    if (kind === 'meal') {
      body = `${seg('meal', [['breakfast', t('ex_breakfast')], ['lunch', t('ex_lunch')], ['dinner', t('ex_dinner')], ['snack', t('mSnack')]], mealByHour(new Date().getHours()))}
        <div class="grid g2" style="gap:10px;margin-top:10px">
          <div class="fld"><label for="ec">${esc(t('carbsLabel'))}</label><div class="inunit"><input id="ec" type="text" inputmode="decimal" autocomplete="off">${seg('cu', [['g', t('gCarbs')], ['xe', t('unitXE')]], 'g')}</div><div class="tiny muted" id="ecx"></div></div>
          ${numField('ei', t('bolusLabel'))}
        </div>
        <div class="fld"><label>${esc(t('bolusWhen'))}</label>${seg('pre', [['15', t('bwBefore')], ['0', t('bwWith')], ['-15', t('bwAfter')]], '15')}</div>
        <div class="fld"><label for="eg">${esc(t('bgAtMeal'))}, ${esc(UL())}</label><input id="eg" type="text" inputmode="decimal" autocomplete="off"><div class="tiny muted" id="egs"></div></div>`;
    } else if (kind === 'insulin') {
      body = `${numField('ev', t('amount') + ', ' + t('uIns'), true)}
        <div class="fld"><label>${esc(t('insKind'))}</label>${seg('ik', [['meal', t('insMeal')], ['correction', t('insCorr')], ['basal', t('insBasal')]], 'correction')}</div>`;
    } else if (kind !== 'note') {
      const unit = { carbs: t('gCarbs'), bg: UL(), exercise: t('min') }[kind];
      body = numField('ev', `${t('amount')}, ${unit}`, true);
    }
    modal(`<h2>${esc(t(titles[kind]))}</h2>
      <form id="ef" novalidate>${body}
      ${wheelHtml()}
      <div class="fld"><label for="en">${esc(t('comment'))}</label><input id="en" maxlength="1000"></div>
      <div class="err" id="eerr"></div>
      <div class="row"><button class="btn grow">${esc(t('save'))}</button><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div></form>`, () => {
      const segVal = n => { const b = document.querySelector(`[data-seg="${n}"] .on`); return b && b.dataset.v; };
      document.querySelectorAll('[data-seg] button').forEach(b => b.onclick = () => { b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); refresh(); });
      // Carbs in bread units are shown in grams (1 XE = 12 g) as you type.
      const refresh = () => {
        const x = $('#ecx'); if (!x) return;
        const v = parseNum($('#ec').value);
        x.textContent = segVal('cu') === 'xe' && v > 0 ? `= ${Math.round(v * 12)} ${t('gCarbs')} · ${t('xeNote')}` : '';
      };
      if ($('#ec')) $('#ec').addEventListener('input', refresh);
      // The sensor value at the chosen time is filled in for a meal unless typed by hand.
      let bgTyped = false, sensorMg = null;
      if ($('#eg')) $('#eg').addEventListener('input', () => { bgTyped = true; });
      const onTime = async ms => {
        if (kind !== 'meal') return;
        if (!$('#ef') && !$('#eg')) return;
        const hour = new Date(ms).getHours(), m = mealByHour(hour);
        const segM = document.querySelector('[data-seg="meal"]');
        if (segM && !segM.dataset.touched) segM.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === m));
        try {
          const d = await getData(ms - 15 * 60e3, ms + 15 * 60e3);
          const near = d.entries.sort((a, b) => Math.abs(a[0] - ms) - Math.abs(b[0] - ms))[0];
          sensorMg = near ? near[1] : null;
        } catch { sensorMg = null; }
        const eg = $('#eg'), egs = $('#egs'); if (!eg) return;
        if (!bgTyped) eg.value = sensorMg ? G(sensorMg) : '';
        egs.textContent = sensorMg ? t('bgAuto', { v: `${G(sensorMg)} ${UL()}` }) : t('bgNoSensor');
      };
      const segM = document.querySelector('[data-seg="meal"]'); if (segM) segM.addEventListener('click', () => { segM.dataset.touched = '1'; });
      const wheel = wheelMount(onTime);
      $('#ef').onsubmit = async e => {
        e.preventDefault();
        const at = new Date(wheel.value()).toISOString();
        const err = m => { $('#eerr').textContent = m; };
        let payload = { kind, at, notes: $('#en').value };
        if (kind === 'meal') {
          let carbs = $('#ec').value.trim() ? parseNum($('#ec').value) : 0, ins = $('#ei').value.trim() ? parseNum($('#ei').value) : 0;
          if (Number.isNaN(carbs) || Number.isNaN(ins) || carbs < 0 || ins < 0) return err(t('eNum'));
          if (!carbs && !ins) return err(t('eMealEmpty'));
          if (segVal('cu') === 'xe') carbs = carbs * 12;
          const typedBg = bgTyped && $('#eg').value.trim() ? parseNum($('#eg').value) : NaN;
          payload = { ...payload, carbs, insulin: ins, mealType: segVal('meal'), preBolus: ins ? Number(segVal('pre')) : undefined, glucose: Number.isFinite(typedBg) ? toMg(typedBg) : undefined };
        } else if (kind !== 'note') {
          const v = parseNum($('#ev').value);
          if (Number.isNaN(v) || v < 0) return err(t('eNum'));
          payload.value = kind === 'bg' ? toMg(v) : v;
          if (kind === 'insulin') payload.insulinType = segVal('ik');
        }
        try {
          await api('POST', '/app/treatments', payload);
          closeModal(); toast(t('saved')); done && done();
        } catch (er) { err(errText(er)); }
      };
    });
  }

  // ------------------------------------------------------------ connect a sensor
  function uploaderBox(u) {
    return `<div class="fld"><label>${esc(t('nsUrl'))}</label><div class="copy"><code>${esc(u.base_url)}</code><button class="btn sm ghost" data-copy="${esc(u.base_url)}">${esc(t('copy'))}</button></div></div>
      <div class="fld"><label>${esc(t('apiSecret'))}</label><div class="copy"><code>${esc(u.api_secret)}</code><button class="btn sm ghost" data-copy="${esc(u.api_secret)}">${esc(t('copy'))}</button></div></div>
      <div class="fld"><label>${esc(t('xdripUrl'))}</label><div class="copy"><code>${esc(u.xdrip_url)}</code><button class="btn sm ghost" data-copy="${esc(u.xdrip_url)}">${esc(t('copy'))}</button></div></div>
      ${/^http:/.test(u.base_url) ? `<div class="tiny" style="color:var(--high)">${esc(t('httpsNote'))}</div>` : ''}`;
  }
  const METHODS = {
    llu: { title: 'LibreLinkUp', badge: 'easiest', form: 'librelinkup' },
    dexshare: { title: 'Dexcom Share', badge: 'easiest', form: 'dexcom' },
    juggluco: { title: 'Juggluco (Android)', uploader: true, steps: 'stepsJuggluco' },
    xdrip: { title: 'xDrip+ (Android)', uploader: true, steps: 'stepsXdrip' },
    iosapps: { title: 'Spike · Diabox · Tomato · Shuggah (iPhone)', uploader: true, steps: 'stepsIos' },
    loop: { title: 'Loop · Trio · iAPS · AndroidAPS', uploader: true, steps: 'stepsLoop' },
    nspull: { title: t('nsPullTitle'), form: 'nightscout' },
    csv: { title: t('csvTitle'), csv: true },
  };
  const BRANDS = [
    { id: 'libre', ic: 'sensor', name: 'FreeStyle Libre', models: 'Libre 1 · 2 · 2 Plus · 3 · 3 Plus', methods: ['llu', 'juggluco', 'xdrip', 'csv'] },
    { id: 'dexcom', ic: 'sensor', name: 'Dexcom', models: 'G6 · G7 · ONE · ONE+ · Stelo', methods: ['dexshare', 'xdrip', 'iosapps', 'csv'] },
    { id: 'medtronic', ic: 'pump', name: 'Medtronic', models: 'Guardian 3 · 4 · Simplera · 780G', methods: ['csv', 'nspull'] },
    { id: 'eversense', ic: 'sensor', name: 'Eversense', models: 'E3 · 365', methods: ['xdrip', 'csv'] },
    { id: 'other', ic: 'sensor', name: 'otherCgm', models: 'Sibionics · Aidex · Ottai · Syai · Linx · Glunovo · Yuwell · i3 · Medtrum', methods: ['juggluco', 'xdrip', 'iosapps', 'csv'] },
    { id: 'pump', ic: 'pump', name: 'aidSystems', models: 'Loop · Trio · iAPS · AndroidAPS · Omnipod 5 (CSV)', methods: ['loop', 'csv'] },
    { id: 'ns', ic: 'moon', name: 'Nightscout', models: 'nsModels', methods: ['nspull', 'xdrip'] },
    { id: 'meter', ic: 'bg', name: 'meterName', models: 'meterModels', methods: ['csv'] },
  ];
  async function connect(args) {
    const me = S.me = await api('GET', '/app/me');
    const brand = BRANDS.find(b => b.id === args[0]);
    const tn = s => I.has(S.lang, s) ? t(s) : s;
    if (!brand) {
      $('#view').innerHTML = `${pageHead('sensor', esc(t('connectSensor')), t('connectIntro'), 'sky')}
        <div class="brands">${BRANDS.map(b => `<a class="brand" href="#/connect/${b.id}" style="text-decoration:none"><div class="ic">${icon(b.ic)}</div><b>${esc(tn(b.name))}</b><div class="small muted">${esc(tn(b.models))}</div></a>`).join('')}</div>
        <div class="card" style="margin-top:14px"><h2>${esc(t('dataSources'))}</h2>${sourcesHtml(me)}</div>`;
      return;
    }
    const u = me.user.upload;
    $('#view').innerHTML = `<p><a href="#/connect">← ${esc(t('allSensors'))}</a></p>${pageHead(brand.ic, esc(tn(brand.name)), t('chooseMethod'), 'sky')}
      ${brand.methods.map((m, i) => { const M = METHODS[m]; return `<div class="method"><h2 style="margin:0 0 6px">${i + 1}. ${esc(M.title)}${M.badge ? `<span class="tag">${esc(t('easiest'))}</span>` : ''}</h2>
        ${M.form === 'librelinkup' ? `<ol class="steps">${t('stepsLlu').split('|').map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          <form data-bridge="librelinkup" class="grid g3"><div><label>${esc(t('lluEmail'))}</label><input name="email" type="email" required autocomplete="off"></div>
          <div><label>${esc(t('password'))}</label><input name="password" type="password" required autocomplete="off"></div>
          <div><label>${esc(t('region'))}</label><select name="region">${['EU', 'EU2', 'US', 'DE', 'FR', 'AP', 'AU', 'AE', 'CA', 'JP', 'LA', 'RU', 'CN'].map(r => `<option>${r}</option>`).join('')}</select></div>
          <div><button class="btn">${esc(t('connect'))}</button></div></form>` : ''}
        ${M.form === 'dexcom' ? `<ol class="steps">${t('stepsDex').split('|').map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          <form data-bridge="dexcom" class="grid g3"><div><label>${esc(t('dexUser'))}</label><input name="username" required autocomplete="off"></div>
          <div><label>${esc(t('password'))}</label><input name="password" type="password" required autocomplete="off"></div>
          <div><label>${esc(t('region'))}</label><select name="region"><option value="ous">${esc(t('regionOus'))}</option><option value="us">USA</option><option value="jp">日本 / Japan</option></select></div>
          <div><button class="btn">${esc(t('connect'))}</button></div></form>` : ''}
        ${M.form === 'nightscout' ? `<p class="small">${esc(t('nsPullText'))}</p>
          <form data-bridge="nightscout" class="grid g3"><div><label>URL</label><input name="url" type="url" placeholder="https://…" required></div>
          <div><label>${esc(t('nsToken'))}</label><input name="token" autocomplete="off"></div><div><label>${esc(t('apiSecret'))} (${esc(t('optional'))})</label><input name="secret" type="password" autocomplete="off"></div>
          <div><button class="btn">${esc(t('connect'))}</button></div></form>` : ''}
        ${M.uploader ? `<ol class="steps">${t(M.steps).split('|').map(s => `<li>${esc(s)}</li>`).join('')}</ol>${uploaderBox(u)}` : ''}
        ${M.csv ? `<p class="small">${esc(t('csvText'))}</p><input type="file" id="csvf" accept=".csv,.txt,.tsv,text/csv"><div class="small" id="csvres" style="margin-top:6px"></div>` : ''}
        <div class="err" data-err></div></div>`; }).join('')}
      <p class="tiny muted">${esc(t('privacyNote'))}</p>`;
    document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(b.dataset.copy));
    document.querySelectorAll('form[data-bridge]').forEach(f => f.onsubmit = async e => {
      e.preventDefault();
      const errEl = f.parentElement.querySelector('[data-err]'); errEl.textContent = ''; errEl.className = 'err';
      const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = t('checking');
      const config = Object.fromEntries(new FormData(f).entries());
      try {
        const r = await api('POST', '/app/bridges', { kind: f.dataset.bridge, config });
        if (r.ok) { errEl.className = 'ok small'; errEl.textContent = t('bridgeConnected', { n: r.count }); f.reset(); }
        else errEl.textContent = bridgeErr(r.code);
      } catch (er) { errEl.textContent = errText(er); }
      btn.disabled = false; btn.textContent = t('connect');
    });
    const cf = $('#csvf');
    if (cf) cf.onchange = async () => {
      const file = cf.files[0]; if (!file) return;
      const res = $('#csvres'); res.textContent = t('checking');
      try {
        const text = await file.text();
        const r = await api('POST', '/app/import?tz_offset=' + new Date().getTimezoneOffset(), text, true);
        res.className = 'small ok'; res.textContent = t('csvDone', { n: r.imported, units: r.detected.units });
      } catch (er) { res.className = 'small err'; res.textContent = errText(er); }
    };
  }

  // ------------------------------------------------------------ diary
  async function diary(args) {
    const me = S.me;
    let day = args[0] ? Number(args[0]) : dayStart(Date.now());
    const draw = async () => {
      const d = await getData(day, dayStart(day, 1));
      const { lo, hi } = targets(d.patient);
      const st = C.stats(d.entries.map(e => e[1]), lo, hi);
      const carbs = d.treatments.reduce((a, x) => a + (+x.carbs || 0), 0), ins = d.treatments.reduce((a, x) => a + (+x.insulin || 0), 0);
      $('#view').innerHTML = `${pageHead('calendar', esc(fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })), t('navDiary'), 'sky',
          `<div class="daynav"><button class="navbtn" id="prev" aria-label="←">${icon('left')}</button><button class="navbtn" id="next" aria-label="→" ${day >= dayStart(Date.now()) ? 'disabled' : ''}>${icon('right')}</button></div>`)}
        <div class="card chartcard indigo">${C.line(d.entries, day, dayStart(day, 1), { lo, hi, units: S.units, treatments: d.treatments, locale: locale() })}
        <div class="grid g4" style="margin-top:8px">
          <div class="metric"><div class="l">${esc(t('tir'))}</div><div class="v">${st.n ? st.tir.toFixed(0) + '%' : '—'}</div></div>
          <div class="metric"><div class="l">${esc(t('mean'))}</div><div class="v">${G(st.mean)}</div><div class="t">${UL()}</div></div>
          <div class="metric"><div class="l">${esc(t('tCarbs'))}</div><div class="v">${Math.round(carbs)}</div><div class="t">${esc(t('gCarbs'))}</div></div>
          <div class="metric"><div class="l">${esc(t('tInsulin'))}</div><div class="v">${+ins.toFixed(1)}</div><div class="t">${esc(t('uIns'))}</div></div></div></div>
        <div class="quick no-print">${[['meal', '🍽', 'tMealEntry'], ['insulin', '💉', 'tBolus'], ['bg', '🩸', 'tBg'], ['exercise', '🏃', 'tExercise'], ['note', '📝', 'tNote']].map(q => `<button data-q="${q[0]}"><span>${icon(q[0])}</span>${esc(t(q[2]))}</button>`).join('')}</div>
        <div class="card" style="margin-top:12px"><h2>${esc(t('entries'))}</h2>
        ${d.treatments.length ? `<table><tr><th>${esc(t('time'))}</th><th>${esc(t('entry'))}</th><th></th><th></th></tr>${[...d.treatments].reverse().map(x => `<tr><td>${fmtTime(x.mills)}</td><td><b>${esc(trTitle(x))}</b> ${esc(trValue(x))}${trBg(x, lo, hi)}${x.notes ? `<div class="small muted">${esc(x.notes)}</div>` : ''}</td><td class="small muted">${esc(x.enteredBy || '')}</td><td><button class="btn sm ghost" data-del="${esc(x._id)}" aria-label="${esc(t('delete'))}">✕</button></td></tr>`).join('')}</table>` : `<div class="muted">${esc(t('noEntries'))}</div>`}</div>`;
      $('#prev').onclick = () => { day = dayStart(day, -1); history.replaceState(null, '', '#/diary/' + day); draw(); };
      $('#next').onclick = () => { day = dayStart(day, 1); history.replaceState(null, '', '#/diary/' + day); draw(); };
      document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => addEntry(b.dataset.q, draw));
      document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await api('DELETE', '/app/treatments/' + b.dataset.del); toast(t('deleted')); draw(); });
    };
    await draw();
  }

  // ------------------------------------------------------------ reports (also used for doctor & shared views)
  async function reportHtml(share, days, patientTitle) {
    const to = dayStart(Date.now(), 1), from = dayStart(Date.now(), -(days - 1));
    const d = await getData(from, to, share);
    const p = d.patient; const { lo, hi } = targets(p);
    const units = S.units;
    const st = C.stats(d.entries.map(e => e[1]), lo, hi);
    const perDay = [];
    for (let k = 0; k < days; k++) {
      const a = dayStart(from, k), b = dayStart(from, k + 1);
      const es = d.entries.filter(e => e[0] >= a && e[0] < b), ts = d.treatments.filter(x => x.mills >= a && x.mills < b);
      perDay.push({ a, b, es, ts, st: C.stats(es.map(e => e[1]), lo, hi), label: fmtDate(a), short: fmtDate(a, { day: '2-digit' }) });
    }
    const expected = days * 288, cover = st.n ? Math.min(100, st.n / expected * 100 * (d.entries.length > 1 ? Math.max(1, 5 * 60e3 / medianGap(d.entries)) : 1)) : 0;
    return `<div class="print-only"><h1>${esc(t('reportTitle'))}</h1></div>
      <div class="card"><div class="row"><div class="grow"><h2 style="margin:0">${esc(patientTitle || p.patient_name || p.name)}</h2>
        <div class="small muted">${esc(fmtDate(from))} – ${esc(fmtDate(to - 1))} · ${days} ${esc(t('days'))} · ${esc(t('readings', { n: st.n || 0 }))} · ${esc(t('sensorActive'))} ${cover.toFixed(0)}%${p.diabetes_type ? ' · ' + esc(t(p.diabetes_type === 'gestational' ? 'gest' : p.diabetes_type === 'other' ? 'otherType' : p.diabetes_type)) : ''}</div></div></div>
      <div style="margin-top:12px">${metricsHtml(st, lo, hi)}</div></div>
      ${st.n ? `<div class="grid g2"><div class="card"><h2>${esc(t('timeInRanges'))}</h2>${C.tirBlock(st, t, units, lo, hi)}</div>
        <div class="card"><h2>${esc(t('patterns'))}</h2>${insights(d.entries, lo, hi).map(x => `<p class="small" style="margin:6px 0">• ${esc(x)}</p>`).join('')}</div></div>
      <div class="card indigo"><h2>AGP · ${days} ${esc(t('days'))}</h2>${C.agp(d.entries, { lo, hi, units, empty: t('noData') })}<div class="legend">${esc(t('agpLegend'))}</div></div>
      <div class="card indigo"><h2>${esc(t('tirByDay'))}</h2>${C.dailyBars(perDay)}</div>
      <div class="card indigo allowbreak"><h2>${esc(t('dailyCharts'))}</h2><div class="days">${[...perDay].reverse().map(x => `<div class="daycard"><div class="row small"><b>${esc(fmtDate(x.a, { weekday: 'short', day: '2-digit', month: '2-digit' }))}</b><span class="muted" style="margin-inline-start:auto">${esc(t('tir'))} ${x.st.n ? x.st.tir.toFixed(0) + '%' : '—'} · ${esc(t('mean'))} ${G(x.st.mean)}</span></div>
        ${C.line(x.es, x.a, x.b, { lo, hi, units, treatments: x.ts, locale: locale(), height: 170, thin: true })}
        ${x.ts.length ? `<div class="tiny muted">${x.ts.map(tr => `${fmtTime(tr.mills)} ${esc(trTitle(tr))} ${esc(trValue(tr))}`).join(' · ')}</div>` : ''}</div>`).join('')}</div></div>` : ''}
      <p class="tiny muted">${esc(t('reportFooter', { date: fmtDT(Date.now()) }))}</p>`;
  }
  function medianGap(es) { const g = []; for (let i = 1; i < Math.min(es.length, 500); i++) g.push(es[i][0] - es[i - 1][0]); g.sort((a, b) => a - b); return g[Math.floor(g.length / 2)] || 5 * 60e3; }
  function insights(entries, lo, hi) {
    const out = [];
    const block = (h1, h2) => C.stats(entries.filter(e => { const h = new Date(e[0]).getHours(); return h >= h1 && h < h2; }).map(e => e[1]), lo, hi);
    const night = block(0, 6), morning = block(6, 10), aft = block(12, 18), eve = block(18, 24);
    if (night.n && night.tbr > 4) out.push(t('insNightLow', { p: night.tbr.toFixed(0) }));
    if (night.n && morning.n && morning.mean - night.mean > 25) out.push(t('insDawn', { d: G(morning.mean - night.mean), u: UL() }));
    if (aft.n && aft.tar > 40) out.push(t('insAfternoon', { p: aft.tar.toFixed(0) }));
    if (eve.n && eve.tar > 40) out.push(t('insEvening', { p: eve.tar.toFixed(0) }));
    const all = C.stats(entries.map(e => e[1]), lo, hi);
    if (all.cv > 36) out.push(t('insCv', { p: all.cv.toFixed(0) }));
    if (!out.length) out.push(t('insGood'));
    return out;
  }
  function reportControls(cb, days) {
    return `<div class="row no-print" style="margin-bottom:12px"><div class="seg" id="per">${[7, 14, 30, 90].map(n => `<button data-n="${n}" class="${n === days ? 'on' : ''}">${n} ${esc(t('daysShort'))}</button>`).join('')}</div>
      <button class="btn" id="pdf" style="margin-inline-start:auto">📄 ${esc(t('downloadPdf'))}</button></div>`;
  }
  function wireReport(redraw) {
    document.querySelectorAll('#per button').forEach(b => b.onclick = () => redraw(+b.dataset.n));
    const p = $('#pdf'); if (p) p.onclick = () => { if (window.EC_DEMO) return toast(t('demoNoPdf')); toast(t('pdfHint')); setTimeout(() => window.print(), 400); };
  }
  async function reports() {
    let days = 14;
    const draw = async () => {
      $('#view').innerHTML = `<div class="no-print">${pageHead('reports', esc(t('navReports')), t('timeInRanges'), 'peach')}</div>${reportControls(null, days)}<div id="rep" class="loading">${esc(t('loading'))}</div>`;
      wireReport(n => { days = n; draw(); });
      $('#rep').outerHTML = `<div id="rep">${await reportHtml(null, days)}</div>`;
    };
    await draw();
  }

  // ------------------------------------------------------------ AI analyst
  // Offline answer to a general question: the best-matching Diabetes school lesson.
  function schoolAnswer(q) {
    // Rough stems (first 4 letters) so that "низком" matches "низкий", "carbs" matches "carbohydrates".
    const stem = w => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 4);
    const words = [...new Set(q.split(/\s+/).map(stem).filter(w => w.length >= 4))];
    const hits = text => { const h = text.toLowerCase(); return words.reduce((a, w) => a + (h.includes(w) ? 1 : 0), 0); };
    let best = null, bestScore = 0;
    for (const l of SCH.lessons(S.lang)) {
      const score = hits(SCH.text(l)) + 2 * hits(l.title + ' ' + l.summary);
      if (score > bestScore) { best = l; bestScore = score; }
    }
    if (!best) return { text: '' };
    // The two best-matching sections, each in full: cutting a list short could drop a safety threshold.
    const secs = best.sections.map((x, i) => ({ x, i, score: 2 * hits(x.h) + hits([...(x.p || []), ...(x.list || [])].join(' ')) }))
      .sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 2).sort((a, b) => a.i - b.i).map(o => o.x);
    const body = secs.map(sec => [(sec.p || []).join('\n\n'), (sec.list || []).map(x => '- ' + x).join('\n')].filter(Boolean).join('\n\n')).join('\n\n');
    return { text: `${body}\n\n${t('aiMore', { t: best.title })}`, lesson: best.id };
  }
  // Light markdown for answers: **bold**, "- " / "1. " lists, paragraphs. Escapes everything first.
  function aiMd(text) {
    return esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n{2,}/).map(par => {
      const lines = par.split('\n').filter(l => l.trim());
      if (lines.length && lines.every(l => /^\s*([-•*]|\d+[.)])\s/.test(l))) {
        const tag = /^\s*\d/.test(lines[0]) ? 'ol' : 'ul';
        return `<${tag}>${lines.map(l => `<li>${l.replace(/^\s*([-•*]|\d+[.)])\s/, '')}</li>`).join('')}</${tag}>`;
      }
      return `<p>${lines.join('<br>')}</p>`;
    }).join('');
  }
  // The analyst's 3D robot (three.js, loaded on demand). The picture stays if it cannot load.
  let ROBOT = null;
  async function mountRobot(boxEl) {
    if (!boxEl) return;
    try {
      const m = await import('/robot.js');
      if (!document.body.contains(boxEl) || ROBOT) return;
      const r = m.mount(boxEl);
      if (r) { ROBOT = r; boxEl.classList.add('live'); }
    } catch { /* no WebGL or no modules (offline demo): keep the picture */ }
  }
  // ---- the analyst's chat as one component, used on the AI tab and in the robot's dialog.
  // Data for 14 days and the AI status are cached for a minute so the dialog opens fast.
  async function aiData() {
    if (S.aiCtx && Date.now() - S.aiCtx.at < 60e3) return S.aiCtx;
    const to = Date.now() + 60e3, from = to - 14 * 864e5;
    const [d, status] = await Promise.all([getData(from, to), api('GET', '/app/ai').catch(() => ({ enabled: false }))]);
    S.aiCtx = { at: Date.now(), d, status, to };
    return S.aiCtx;
  }
  async function aiPanel(root, opts = {}) {
    const { d, status, to } = await aiData();
    const { lo, hi } = targets(S.me.user);
    // Without the AI: a curve analysis for questions about a meal or a moment, a school lesson
    // for general questions, and the pattern review for everything else.
    const ruleAnswer = q => {
      const ex = window.Explain.answer(q, { entries: d.entries, treatments: d.treatments, now: Date.now(), lo, hi, t, g: G, unit: UL(), time: fmtTime, dayStart });
      if (ex) return { text: ex };
      const review = /\b(7|14)\b|недел|дн[еяи]|week|days|разбер|review|тренд|pattern|апта|күн/i.test(q);
      if (!review) { const sa = schoolAnswer(q); if (sa.lesson) return sa; }
      const recent = /\b7\b/.test(q) ? d.entries.filter(e => e[0] >= to - 7 * 864e5) : d.entries;
      return { text: insights(recent, lo, hi).map(x => '- ' + x).join('\n') + '\n\n' + t('aiRuleNote') };
    };
    const chat = S.aiChat = S.aiChat || [];
    // Emergency help runs locally, instantly, with or without the AI.
    const urg = S.urgent = S.urgent || { state: (() => { try { const c = localStorage.getItem('ec_country'); return c ? { country: c } : {}; } catch { return {}; } })() };
    const latest = async () => {
      try { const x = await getData(Date.now() - 30 * 60e3, Date.now() + 60e3); const e = x.entries[x.entries.length - 1]; return e ? { t: e[0], v: e[1], dir: (C.ARROWS && C.ARROWS[e[2]]) || '' } : null; }
      catch { return null; }
    };
    const uctx = (reading, extra = {}) => ({ t, g: G, unit: UL(), mmol: S.units === 'mmol', reading, now: Date.now(), state: urg.state, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, lang: S.lang, ...extra });
    const keepState = st => { urg.state = st; try { if (st.country) localStorage.setItem('ec_country', st.country); } catch { /* not kept */ } };
    let busy = false, note = status.enabled ? t('aiPrivacy') : t('aiOff') + ' ' + t('aiNoKeyShort');
    let chips = opts.chips || t('aiChips').split('|');
    root.innerHTML = `${opts.head || ''}<div class="chat"></div><div class="chips"></div>
      <form class="aiform"><input maxlength="2000" autocomplete="off" placeholder="${esc(t('aiPlaceholder'))}" aria-label="${esc(t('aiAsk'))}">
        <button class="btn" aria-label="${esc(t('aiSend'))}">➤</button></form>
      <p class="tiny muted ainote" style="margin-bottom:0"></p>`;
    const q$ = sel => root.querySelector(sel);
    const draw = () => {
      if (!document.body.contains(root)) return;
      q$('.chat').innerHTML = chat.map(m => `<div class="msg ${m.role === 'user' ? 'u' : 'a'}${m.pending ? ' pending' : ''}${m.level ? ' urgent lv-' + esc(m.level) : ''}">${m.role === 'user' ? esc(m.text) : aiMd(m.text)}${m.lesson ? `<div><a href="#/school/${esc(m.lesson)}" class="small">🎓 ${esc(t('navSchool'))} →</a></div>` : ''}${m.actions && m.actions.length ? `<div class="uract">${m.actions.map(a => a.kind === 'call' ? `<a class="btn red sm" href="tel:${esc(a.tel)}">${esc(a.label)}</a>` : `<button type="button" class="btn sm" data-timer="1">${esc(a.label)}</button>`).join('')}</div>` : ''}</div>`).join('');
      root.querySelectorAll('[data-timer]').forEach(b => b.onclick = () => { startHypoTimer(15); toast(t('tmLeft', { m: '15:00' })); });
      root.querySelectorAll('.chat a[href^="#/"]').forEach(a => a.addEventListener('click', () => { if (opts.onLeave) opts.onLeave(); }));
      q$('.chips').innerHTML = (opts.keepChips || !chat.length) ? chips.map(c => `<button type="button" class="chip">${esc(c)}</button>`).join('') : '';
      root.querySelectorAll('.chips .chip').forEach(b => b.onclick = () => ask(b.textContent));
      q$('.aiform button').disabled = busy;
      q$('.ainote').textContent = note;
      const last = q$('.chat').lastElementChild; if (last) last.scrollIntoView({ block: 'nearest' });
    };
    async function recheck() {
      const r = window.Urgent.recheck(uctx(await latest()));
      keepState(r.state);
      chat.push({ role: 'assistant', text: r.text, actions: r.actions, level: r.level, local: true });
      if (ROBOT) ROBOT.setMode('idle');
      draw();
    }
    async function ask(q, force = false) {
      q = String(q || '').trim();
      if (!q || busy) return;
      const history = chat.filter(m => !m.pending && !m.local).map(m => ({ role: m.role, text: m.text }));
      chat.push({ role: 'user', text: q });
      const reply = { role: 'assistant', text: t('aiThinking'), pending: true };
      chat.push(reply); busy = true; draw();
      if (ROBOT) ROBOT.setMode('thinking');
      const u = window.Urgent.assess(q, uctx(await latest(), { force }));
      if (u) {
        keepState(u.state);
        Object.assign(reply, { text: u.text, actions: u.actions, level: u.level, local: true, pending: false });
        busy = false; if (ROBOT) ROBOT.setMode('quote'); draw();
        return;
      }
      try {
        const r = await api('POST', '/app/ai', { question: q, history, lang: S.lang, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
        if (r.mode === 'off') { Object.assign(reply, ruleAnswer(q)); reply.local = true; note = t('aiOff') + ' ' + t('aiNoKeyShort'); }
        else if (r.refusal || !r.text) { reply.text = t('aiRefusal'); reply.local = true; }
        else { reply.text = r.text; note = t('aiPrivacy'); }
      } catch (e) {
        // The offline demo has no AI endpoint: fall back to the rule-based review.
        if (e.code === 'not_found') { Object.assign(reply, ruleAnswer(q)); note = t('aiOff') + ' ' + t('aiNoKeyShort'); }
        else reply.text = errText(e);
        reply.local = true;
      }
      reply.pending = false; busy = false;
      if (ROBOT) ROBOT.setMode(reply.local && !reply.text ? 'idle' : 'quote');
      draw();
    }
    q$('.aiform').onsubmit = e => { e.preventDefault(); const inp = q$('.aiform input'); const v = inp.value; inp.value = ''; ask(v); };
    draw();
    return { ask, recheck, draw, setChips: list => { chips = list; draw(); }, focus: () => q$('.aiform input').focus() };
  }

  // ---- tapping the robot: a dialog to review glucose or ask anything
  function openRobotDialog() {
    if (ROBOT && ROBOT.poke) ROBOT.poke();
    const analyse = t('rdChipsAnalyze').split('|'), questions = t('aiChips').split('|');
    modal(`<div class="rdlg">
      <div class="row rdhead"><img src="${IMG('ai')}" alt=""><div class="grow"><h2 style="margin:0">${esc(t('rdTitle'))}</h2><div class="small muted">${esc(t('rdSub'))}</div></div><button class="iconbtn" data-close aria-label="${esc(t('rdClose'))}">✕</button></div>
      <div class="rdtabs"><button type="button" class="rdtab on" data-k="analyse"><span>${icon('reports')}</span><b>${esc(t('rdAnalyze'))}</b><small>${esc(t('rdAnalyzeSub'))}</small></button>
        <button type="button" class="rdtab" data-k="ask"><span>${icon('chat')}</span><b>${esc(t('rdAsk'))}</b><small>${esc(t('rdAskSub'))}</small></button></div>
      <div id="rdpanel"></div>
      <div class="row rdfoot"><button type="button" class="btn red sm" id="rdsos">${esc(t('urSos'))}</button><a class="btn ghost sm" href="#/ai" id="rdfull" style="margin-inline-start:auto">${esc(t('rdOpenFull'))} →</a></div></div>`, async () => {
      const panel = await aiPanel($('#rdpanel'), { chips: analyse, keepChips: true, onLeave: closeModal });
      document.querySelectorAll('.rdtab').forEach(b => b.onclick = () => {
        document.querySelectorAll('.rdtab').forEach(x => x.classList.toggle('on', x === b));
        if (b.dataset.k === 'analyse') panel.setChips(analyse); else { panel.setChips(questions); panel.focus(); }
      });
      $('#rdsos').onclick = () => panel.ask(t('urSos'), true);
      $('#rdfull').onclick = () => closeModal();
    });
    document.querySelector('#modal .modal .card')?.classList.add('rdcard');
  }
  // Makes a robot box clickable (and keyboard-reachable).
  function robotClickable(box) {
    if (!box || box.dataset.click) return;
    box.dataset.click = '1';
    box.setAttribute('role', 'button'); box.setAttribute('tabindex', '0'); box.removeAttribute('aria-hidden');
    box.setAttribute('aria-label', t('rdTitle')); box.title = t('rdTap');
    box.addEventListener('click', openRobotDialog);
    box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRobotDialog(); } });
  }

  async function ai() {
    const me = S.me;
    const { d } = await aiData();
    const { lo, hi } = targets(me.user);
    const st = C.stats(d.entries.map(e => e[1]), lo, hi);
    const found = insights(d.entries, lo, hi);
    $('#view').innerHTML = `<div class="banner violet"><div class="btxt"><h1>${esc(t('navAi'))}</h1><p>${esc(t('aiIntro'))}</p><p class="small rdhint">${esc(t('rdTap'))}</p></div>
        <div class="robotbox" id="robotbox"><img src="${IMG('ai')}" alt=""></div></div>
      <div class="card">${metricsHtml(st, lo, hi)}
        <h2 style="margin-top:16px">${esc(t('aiSeen'))}</h2>${found.map(x => `<div class="ins">${esc(x)}</div>`).join('')}</div>
      <div class="card" id="aichat"></div>`;
    const panel = await aiPanel($('#aichat'), { head: `<div class="row" style="gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px"><h2 style="margin:0">${esc(t('aiAsk'))}</h2><button type="button" class="btn red sm" id="sos" style="margin-inline-start:auto">${esc(t('urSos'))}</button></div>` });
    $('#sos').onclick = () => panel.ask(t('urSos'), true);
    // When the 15-minute timer ends on this page, check the sensor straight away.
    HT.onDone = () => { if (!location.hash.startsWith('#/ai')) return false; htSet(0); hypoTimerDraw(); panel.recheck(); return true; };
    robotClickable($('#robotbox'));
    mountRobot($('#robotbox'));
    if (S.pendingRecheck) { S.pendingRecheck = false; panel.recheck(); }
    if (S.pendingQuestion) { const pq = S.pendingQuestion; S.pendingQuestion = null; panel.ask(pq.q, pq.force); }
  }

  // ------------------------------------------------------------ diabetes school
  const SCH = window.SCHOOL;
  const schoolKey = () => 'ec_school_' + (S.me ? S.me.user.id : 'guest');
  function schoolDone() { try { return JSON.parse(localStorage.getItem(schoolKey()) || '[]'); } catch { return []; } }
  function markDone(id) {
    const d = schoolDone(); if (d.includes(id)) return;
    d.push(id); try { localStorage.setItem(schoolKey(), JSON.stringify(d)); } catch { /* private mode: progress is not kept */ }
  }
  function schoolLangNote() {
    return ['ru', 'en'].includes(S.lang) ? '' : `<p class="tiny muted">${esc(t('schLangNote'))}</p>`;
  }
  async function school(parts) {
    const lessons = SCH.lessons(S.lang);
    const done = schoolDone();
    const id = parts && parts[0];
    const lesson = id && lessons.find(l => l.id === id);
    if (!lesson) {
      const n = lessons.filter(l => done.includes(l.id)).length;
      $('#view').innerHTML = `${banner('yellow', 'home', esc(t('navSchool')), t('schIntro'), `<div class="bprog"><b>${esc(t('schProgress', { n, total: lessons.length }))}</b>
          <div class="progress"><div style="width:${(n / lessons.length * 100).toFixed(0)}%"></div></div></div>`)}${schoolLangNote()}
        <div class="lessons">${lessons.map((l, i) => `<a class="lesson tone${i % 5}" href="#/school/${l.id}">
          <img src="${IMG(l.img || 'l-' + l.id)}" alt="" loading="lazy"><div class="lbody"><div class="tiny lmeta">${l.icon} ${i + 1} · ${esc(t('schMin', { n: l.min }))}${done.includes(l.id) ? ` · <span class="okc">✓ ${esc(t('schDone'))}</span>` : ''}</div>
          <b>${esc(l.title)}</b><div class="small muted">${esc(l.summary)}</div></div></a>`).join('')}</div>`;
      return;
    }
    const i = lessons.indexOf(lesson), next = lessons[i + 1];
    const answers = {};
    $('#view').innerHTML = `<p><a href="#/school">← ${esc(t('schAllLessons'))}</a></p>
      ${banner('tone' + (i % 5), lesson.img || 'l-' + lesson.id, esc(lesson.title), `${lesson.summary} · ${t('schMin', { n: lesson.min })}`)}${schoolLangNote()}
      <div class="card lessonbody">${lesson.sections.map(sec => `<h2>${esc(sec.h)}</h2>${(sec.p || []).map(x => `<p>${esc(x)}</p>`).join('')}${sec.list ? `<ul>${sec.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`).join('')}</div>
      <div class="card"><h2>${esc(t('schQuiz'))}</h2>${lesson.quiz.map((q, qi) => `<div class="quiz" data-q="${qi}"><p><b>${esc(q.q)}</b></p>
        <div class="opts">${q.a.map((a, ai) => `<button type="button" class="opt" data-a="${ai}">${esc(a)}</button>`).join('')}</div><p class="small fb" hidden></p></div>`).join('')}
        <p class="okc" id="finished" ${done.includes(lesson.id) ? '' : 'hidden'}>✓ ${esc(t('schFinished'))}</p></div>
      <div class="row" style="gap:10px;flex-wrap:wrap"><a class="btn ghost" href="#/ai">✨ ${esc(t('schAskAi'))}</a>
        ${next ? `<a class="btn" href="#/school/${next.id}" style="margin-inline-start:auto">${esc(t('schNext'))} →</a>` : ''}</div>`;
    document.querySelectorAll('.quiz').forEach(box => {
      const q = lesson.quiz[+box.dataset.q];
      box.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const ok = +b.dataset.a === q.ok;
        box.querySelectorAll('.opt').forEach(x => x.classList.remove('right', 'wrong'));
        b.classList.add(ok ? 'right' : 'wrong');
        const fb = box.querySelector('.fb'); fb.hidden = false;
        fb.textContent = `${t(ok ? 'schRight' : 'schWrong')} ${q.why}`;
        answers[box.dataset.q] = ok;
        if (lesson.quiz.every((_, k) => answers[k])) { markDone(lesson.id); $('#finished').hidden = false; }
      });
    });
    scrollTo(0, 0);
  }

  // ------------------------------------------------------------ share with doctor / family
  async function share() {
    const [list, notes] = await Promise.all([api('GET', '/app/shares'), api('GET', '/app/notes')]);
    const link = tok => `${location.origin}/#/s/${tok}`;
    $('#view').innerHTML = `${pageHead('share', esc(t('navDoctor')), t('shareTitle'), 'violet')}
      <div class="card"><h2 class="hic">${icon('link')}${esc(t('shareTitle'))}</h2><p class="small muted">${esc(t('shareText'))}</p>
        ${list.map(s => `<div class="status"><div class="grow"><b>${esc(s.label || t('shareLink'))}</b><div class="copy"><code>${esc(link(s.token))}</code><button class="btn sm ghost" data-copy="${esc(link(s.token))}">${esc(t('copy'))}</button></div>
          <div class="tiny muted">${esc(t('created'))} ${esc(fmtDate(s.created_at))}${s.expires_at ? ' · ' + esc(t('validUntil')) + ' ' + esc(fmtDate(s.expires_at)) : ''} · Nightscout token: <code>${esc(s.token)}</code></div></div>
          <button class="btn sm red" data-rev="${esc(s.token)}">${esc(t('revoke'))}</button></div>`).join('') || `<div class="muted small">${esc(t('noShares'))}</div>`}
        <form id="nf" class="grid g3" style="margin-top:12px"><div><label>${esc(t('shareFor'))}</label><input name="label" placeholder="${esc(t('shareForHint'))}"></div>
          <div><label>${esc(t('validity'))}</label><select name="days"><option value="0">${esc(t('noExpiry'))}</option><option value="7">7 ${esc(t('days'))}</option><option value="30">30 ${esc(t('days'))}</option><option value="90">90 ${esc(t('days'))}</option></select></div>
          <div style="align-self:end"><button class="btn">${esc(t('createLink'))}</button></div></form></div>
      <div class="card"><h2 class="hic">${icon('chat')}${esc(t('messages'))}</h2>
        ${notes.map(n => `<div class="note ${n.author_role === 'doctor' ? 'doc' : ''}"><div class="meta">${n.kind === 'conclusion' ? '📋 ' + esc(t('conclusion')) + ' · ' : ''}${esc(n.author)} · ${esc(fmtDT(n.created_at))}</div>${esc(n.text)}</div>`).join('') || `<div class="muted small">${esc(t('noMessages'))}</div>`}
        <form id="mf"><textarea id="mt" placeholder="${esc(t('msgHint'))}"></textarea><button class="btn" style="margin-top:6px">${esc(t('send'))}</button></form></div>`;
    document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(b.dataset.copy));
    document.querySelectorAll('[data-rev]').forEach(b => b.onclick = async () => { await api('DELETE', '/app/shares/' + b.dataset.rev); toast(t('revoked')); share(); });
    $('#nf').onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const r = await api('POST', '/app/shares', { label: f.label, days: Number(f.days) }); copy(link(r.token)); share(); };
    $('#mf').onsubmit = async e => { e.preventDefault(); const text = $('#mt').value.trim(); if (!text) return; await api('POST', '/app/notes', { text }); toast(t('sent')); share(); };
  }

  // ------------------------------------------------------------ doctor
  async function patients() {
    const list = await api('GET', '/app/patients');
    $('#view').innerHTML = `${pageHead('patients', esc(t('navPatients')), '', 'violet')}
      <form class="card row" id="af"><div class="grow"><label for="tk">${esc(t('addPatient'))}</label><input id="tk" placeholder="${esc(t('addPatientHint'))}" required></div><button class="btn" style="align-self:end">${esc(t('add'))}</button><div class="err" id="aerr" style="flex-basis:100%"></div></form>
      ${list.map(p => {
        const flags = [];
        if (p.tbr != null && p.tbr > 4) flags.push(['red', `${t('tbr')} ${p.tbr.toFixed(0)}%`]);
        if (p.tir != null) flags.push([p.tir >= 70 ? 'ok' : p.tir >= 50 ? 'amb' : 'red', `${t('tir')} ${p.tir.toFixed(0)}%`]);
        if (p.messages) flags.push(['blue', t('messages') + ' ' + p.messages]);
        S.units = S.me.user.units;
        return `<a class="pitem" href="#/p/${esc(p.token)}"><div class="avatar">${esc((p.patient_name || p.name || '?')[0])}</div>
          <div class="grow"><b>${esc(p.patient_name || p.name)}</b>${p.patient_name ? ` <span class="muted small">(${esc(p.name)})</span>` : ''}<div>${flags.map(f => `<span class="flag ${f[0]}">${esc(f[1])}</span>`).join('')}</div></div>
          <div style="text-align:end"><b style="color:${p.last ? C.color(p.last.sgv, p.target_low, p.target_high) : 'var(--muted)'}">${p.last ? G(p.last.sgv) + ' ' + (C.ARROWS[p.last.direction] || '') : '—'}</b><div class="tiny muted">${p.last ? esc(ago(p.last.date)) : ''}</div></div></a>`;
      }).join('') || `<div class="card muted">${esc(t('noPatients'))}</div>`}`;
    $('#af').onsubmit = async e => { e.preventDefault(); try { await api('POST', '/app/patients', { token: $('#tk').value }); toast(t('saved')); patients(); } catch (er) { $('#aerr').textContent = errText(er); } };
  }

  async function doctorPatient(args) {
    const token = args[0]; let tab = args[1] || 'overview', days = 14;
    const info = await api('GET', '/app/share/' + encodeURIComponent(token));
    const name = info.patient.patient_name || info.patient.name;
    const draw = async () => {
      $('#view').innerHTML = `<p class="no-print"><a href="#/patients">← ${esc(t('navPatients'))}</a></p>
        <div class="seg no-print" id="tabs" style="margin-bottom:12px">${[['overview', 'overview'], ['report', 'navReports'], ['notes', 'messages']].map(([id, k]) => `<button data-t="${id}" class="${tab === id ? 'on' : ''}">${esc(t(k))}</button>`).join('')}</div><div id="tb" class="loading">${esc(t('loading'))}</div>`;
      document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
      if (tab === 'overview') $('#tb').outerHTML = `<div id="tb">${await overviewHtml(token, name)}</div>`;
      if (tab === 'report') {
        $('#tb').outerHTML = `<div id="tb">${reportControls(null, days)}<div id="rep">${await reportHtml(token, days, name)}</div></div>`;
        wireReport(n => { days = n; draw(); });
      }
      if (tab === 'notes') {
        const notes = await api('GET', '/app/notes?share=' + encodeURIComponent(token));
        $('#tb').outerHTML = `<div id="tb"><div class="card"><h2>${esc(name)}</h2>
          ${notes.map(n => `<div class="note ${n.author_role === 'doctor' ? 'doc' : ''}"><div class="meta">${n.kind === 'conclusion' ? '📋 ' + esc(t('conclusion')) + ' · ' : ''}${esc(n.author)} · ${esc(fmtDT(n.created_at))}</div>${esc(n.text)}</div>`).join('') || `<div class="muted small">${esc(t('noMessages'))}</div>`}
          <form id="mf"><textarea id="mt" style="min-height:120px" placeholder="${esc(t('msgHintDoctor'))}"></textarea>
          <div class="row" style="margin-top:6px"><button class="btn" data-k="conclusion">📋 ${esc(t('sendConclusion'))}</button><button class="btn ghost" data-k="message">${esc(t('send'))}</button></div></form></div></div>`;
        document.querySelectorAll('#mf button').forEach(b => b.onclick = async e => { e.preventDefault(); const text = $('#mt').value.trim(); if (!text) return; await api('POST', '/app/notes', { text, share: token, kind: b.dataset.k }); toast(t('sent')); draw(); });
      }
    };
    await draw();
  }

  async function overviewHtml(share, name) {
    const now = Date.now();
    const d = await getData(now - 24 * 3600e3, now + 60e3, share);
    const { lo, hi } = targets(d.patient);
    const last = d.entries[d.entries.length - 1];
    const d14 = await getData(now - 14 * 864e5, now + 60e3, share);
    const st = C.stats(d14.entries.map(e => e[1]), lo, hi);
    return `${heroHtml(last, lo, hi, name, last ? esc(ago(last[0])) : esc(t('noData')), '')}
      <div class="card chartcard">${C.line(d.entries, now - 24 * 3600e3, now + 5 * 60e3, { lo, hi, units: S.units, treatments: d.treatments, locale: locale() })}</div>
      <div class="card"><h2>14 ${esc(t('days'))}</h2>${metricsHtml(st, lo, hi)}<div style="margin-top:12px">${st.n ? C.tirBlock(st, t, S.units, lo, hi) : ''}</div></div>`;
  }

  // Public read-only page opened from a share link (no account needed)
  async function sharedView(token) {
    let info;
    try { info = await api('GET', '/app/share/' + encodeURIComponent(token)); }
    catch (e) { $('#view').innerHTML = `<div class="card err">${esc(errText(e))}</div>`; return; }
    S.units = (S.me && S.me.user.units) || info.patient.units;
    const name = info.patient.patient_name || info.patient.name;
    let tab = 'overview', days = 14;
    const draw = async () => {
      $('#view').innerHTML = `<div class="card no-print small">${esc(t('sharedBanner'))}${S.me && S.me.user.role === 'doctor' ? ` <button class="btn sm" id="addme">${esc(t('addToPatients'))}</button>` : ''}</div>
        <div class="seg no-print" id="tabs" style="margin-bottom:12px">${[['overview', 'overview'], ['report', 'navReports']].map(([id, k]) => `<button data-t="${id}" class="${tab === id ? 'on' : ''}">${esc(t(k))}</button>`).join('')}</div><div id="tb" class="loading">${esc(t('loading'))}</div>`;
      document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
      const am = $('#addme'); if (am) am.onclick = async () => { await api('POST', '/app/patients', { token }); location.hash = '#/p/' + token; };
      if (tab === 'overview') $('#tb').outerHTML = `<div id="tb">${await overviewHtml(token, name)}</div>`;
      else { $('#tb').outerHTML = `<div id="tb">${reportControls(null, days)}<div id="rep">${await reportHtml(token, days, name)}</div></div>`; wireReport(n => { days = n; draw(); }); }
    };
    await draw();
  }

  // ------------------------------------------------------------ settings
  async function settings() {
    const me = S.me = await api('GET', '/app/me');
    const u = me.user; const doc = u.role === 'doctor';
    const v = mg => S.units === 'mmol' ? (mg / C.MMOL).toFixed(1) : mg;
    $('#view').innerHTML = `${pageHead('settings', esc(t('navSettings')), '', 'yellow')}
      <form class="card" id="pf"><h2>${esc(t('profile'))}</h2>
        <div class="grid g2"><div class="fld"><label>${esc(t(doc ? 'yourNameDoctor' : 'yourName'))}</label><input name="name" value="${esc(u.name)}"></div>
        ${doc ? '' : `<div class="fld"><label>${esc(t('patientName'))}</label><input name="patient_name" value="${esc(u.patient_name || '')}"></div>`}
        <div class="fld"><label>${esc(t('units'))}</label><select name="units"><option value="mmol" ${u.units === 'mmol' ? 'selected' : ''}>mmol/L</option><option value="mg/dl" ${u.units === 'mg/dl' ? 'selected' : ''}>mg/dL</option></select></div>
        ${doc ? '' : `<div class="fld"><label>${esc(t('targetRange'))} (${UL()})</label><div class="row" style="flex-wrap:nowrap"><input name="lo" type="number" step="any" value="${v(u.target_low)}"><span>–</span><input name="hi" type="number" step="any" value="${v(u.target_high)}"></div></div>`}</div>
        <div class="tiny muted">${esc(t('email'))}: ${esc(u.email)}</div>
        <button class="btn" style="margin-top:10px">${esc(t('save'))}</button></form>
      ${doc ? '' : `<div class="card"><h2>📡 ${esc(t('uploadSettings'))}</h2><p class="small muted">${esc(t('uploadSettingsText'))}</p>${uploaderBox(u.upload)}
        <div class="row"><button class="btn sm red" id="rot">${esc(t('newSecret'))}</button>${window.EC_DEMO ? '' : `<a class="btn sm ghost" href="/app/export.csv">${esc(t('exportCsv'))}</a>`}</div></div>`}
      <form class="card" id="cp"><h2 class="hic">${icon('lock')}${esc(t('changePassword'))}</h2><div class="grid g2"><div class="fld"><label>${esc(t('currentPassword'))}</label><input type="password" name="current" autocomplete="current-password" required></div>
        <div class="fld"><label>${esc(t('newPassword'))}</label><input type="password" name="password" autocomplete="new-password" required></div></div><div class="err" id="cperr"></div><button class="btn">${esc(t('save'))}</button></form>
      <form class="card" id="del"><h2>${esc(t('deleteAccount'))}</h2><p class="small muted">${esc(t('deleteText'))}</p><div class="row"><input type="password" name="password" placeholder="${esc(t('password'))}" required style="max-width:260px"><button class="btn red">${esc(t('deleteAccount'))}</button></div><div class="err" id="delerr"></div></form>
      <p class="tiny muted">${esc(me.app.name)} ${esc(me.app.version)} · ${esc(t('compatNote'))}</p>`;
    document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(b.dataset.copy));
    $('#pf').onsubmit = async e => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      const conv = x => (S.units === 'mmol' ? Math.round(parseFloat(String(x).replace(',', '.')) * C.MMOL) : Math.round(+x));
      const body = { name: f.name, patient_name: f.patient_name, units: f.units, lang: S.lang };
      if (f.lo) { body.target_low = conv(f.lo); body.target_high = conv(f.hi); }
      await api('PUT', '/app/me', body); S.units = f.units; toast(t('saved')); settings();
    };
    const rot = $('#rot'); if (rot) rot.onclick = () => modal(`<h2>${esc(t('newSecret'))}</h2><p>${esc(t('newSecretWarn'))}</p><div class="row"><button class="btn red" id="ok">${esc(t('confirm'))}</button><button class="btn ghost" data-close>${esc(t('cancel'))}</button></div>`,
      () => { $('#ok').onclick = async () => { await api('POST', '/app/me/rotate-secret'); closeModal(); settings(); }; });
    $('#cp').onsubmit = async e => { e.preventDefault(); try { await api('POST', '/app/me/password', Object.fromEntries(new FormData(e.target))); toast(t('saved')); e.target.reset(); } catch (er) { $('#cperr').textContent = errText(er); } };
    $('#del').onsubmit = async e => { e.preventDefault(); try { await api('POST', '/app/me/delete', Object.fromEntries(new FormData(e.target))); S.me = null; location.hash = '#/login'; route(); } catch (er) { $('#delerr').textContent = errText(er); } };
  }

  // ------------------------------------------------------------ boot
  setLang(S.lang);
  fillLangs();
  window.addEventListener('hashchange', route);
  route();
  hypoTimerDraw();
  setTimeout(alertWatch, 3000);
})();
