'use strict';
/* Plate builder: put foods on a plate, set grams, get kcal/protein/fat/carbs and bread units, see the whole dish,
   and save it to the diary as a meal. Approximate values; never a dose suggestion. */
(function () {
const FOODS = window.PLATE_FOODS;
// the family's own dishes, kept in this browser
try { for (const d of JSON.parse(localStorage.getItem('plate_own') || '[]')) FOODS.push({ ...d, own: true }); } catch { /* none */ }
// Photos of the foods (top-down, 4×4 per sheet) are used when the files are there; otherwise the emoji.
const SHEETS = Array.from({ length: 9 }, (_, i) => `/img/plate/foods-${i + 1}.webp?v=1`);
const sheetOk = SHEETS.map(() => false);
SHEETS.forEach((src, i) => { const im = new Image(); im.onload = () => { sheetOk[i] = true; render(); drawGrid(); }; im.src = src; });
const hasPhoto = f => !!f.cell && sheetOk[f.cell[0]];
const BY = Object.fromEntries(FOODS.map(f => [f.id, f]));
const SECS = [['side','Гарниры','#e7a33e'],['main','Основное','#e2557b'],['veg','Овощи и салаты','#3fb27f'],['sweet','Фрукты и десерты','#f0458f'],['sauce','Соусы','#8b5cf6'],['drink','Напитки','#3b82f6']];
const SEC_NAME = Object.fromEntries(SECS.map(s => [s[0], s[1]]));
// where each section lives on the plate (normalised 0..1); fats and drinks go beside it
const AREA = { veg: { cx: .26, cy: .58, r: .18 }, sweet: { cx: .38, cy: .2, r: .09 }, main: { cx: .7, cy: .3, r: .15 }, side: { cx: .7, cy: .7, r: .15 } };

const $ = s => document.querySelector(s);
const fmt = (x, d = 0) => (Math.round(x * 10 ** d) / 10 ** d).toString().replace('.', ',');
let tab = 'side', items = [], undoStack = [];
const snap = () => undoStack.push(JSON.stringify(items));

// ---------- product grid
function drawTabs() {
  $('#tabs').innerHTML = SECS.map(([k, n, col]) => `<button class="tab ${k === tab ? 'on' : ''}" data-k="${k}"><i style="background:${col}"></i>${n}</button>`).join('');
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => { tab = b.dataset.k; drawTabs(); drawGrid(); });
}
function drawGrid() {
  const q = ($('#psearch') && $('#psearch').value.trim().toLowerCase().replace(/ё/g, 'е')) || '';
  $('#grid').innerHTML = FOODS.filter(f => q ? f.name.toLowerCase().replace(/ё/g, 'е').includes(q) : f.sec === tab).map(f => `<div class="prod ${items.some(i => i.id === f.id) ? 'used' : ''}" data-id="${f.id}" role="button" tabindex="0">${hasPhoto(f) ? `<span class="ph" style="${photoCss(f)}"></span>` : `<span class="em">${f.em}</span>`}<b>${f.name}</b><small>${fmt(f.c, 1)} г угл. / 100 г</small></div>`).join('');
  document.querySelectorAll('.prod').forEach(el => {
    el.addEventListener('pointerdown', e => startDrag(e, BY[el.dataset.id]));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(BY[el.dataset.id], null, null); } });
  });
}

// ---------- drag and drop (mouse and touch); a click without moving opens the grams sheet
let drag = null;
function startDrag(e, food) {
  e.preventDefault();
  drag = { food, x0: e.clientX, y0: e.clientY, moved: false };
  const h = $('#held'); h.textContent = food.em;
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp, { once: true });
}
function targetAt(x, y) {
  const box = $('#platebox').getBoundingClientRect();
  for (const id of ['oil', 'glass']) { const r = $('#' + id).getBoundingClientRect(); if (x > r.left && x < r.right && y > r.top && y < r.bottom) return { side: id }; }
  const nx = (x - box.left) / box.width, ny = (y - box.top) / box.height;
  if (Math.hypot(nx - .5, ny - .5) < .47) return { plate: true, nx, ny };
  return null;
}
function onMove(e) {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) { drag.moved = true; $('#held').style.display = 'block'; }
  if (!drag.moved) return;
  const h = $('#held'); h.style.left = e.clientX + 'px'; h.style.top = e.clientY + 'px';
  const t = targetAt(e.clientX, e.clientY);
  $('#platebox').classList.toggle('hover', !!(t && t.plate));
  document.querySelectorAll('.sector').forEach(s => s.classList.toggle('target', s.dataset.sec === drag.food.sec));
  ['oil', 'glass'].forEach(id => $('#' + id).classList.toggle('hover', !!(t && t.side === id)));
}
function onUp(e) {
  window.removeEventListener('pointermove', onMove);
  $('#held').style.display = 'none'; $('#platebox').classList.remove('hover'); ['oil', 'glass'].forEach(id => $('#' + id).classList.remove('hover'));
  const d = drag; drag = null; if (!d) return;
  if (!d.moved) return openSheet(d.food, null, null);
  const t = targetAt(e.clientX, e.clientY);
  if (!t) return toast('Положите продукт на тарелку');
  openSheet(d.food, t.plate ? { nx: t.nx, ny: t.ny } : null, null);
}

// ---------- grams sheet
let sheet = null;
function openSheet(food, at, idx) {
  const cur = idx != null ? items[idx] : null;
  sheet = { food, at, idx };
  $('#sEm').textContent = food.em; $('#sName').textContent = food.name;
  $('#sPer').textContent = `На 100 г: ${fmt(food.k)} ккал · Б ${fmt(food.p, 1)} · Ж ${fmt(food.f, 1)} · У ${fmt(food.c, 1)}`;
  $('#grams').value = cur ? cur.g : food.por[0][0];
  $('#sChips').innerHTML = food.por.map(([g, l]) => `<button data-g="${g}">${l} · ${g} г</button>`).join('') + `<button data-g="100">100 г</button>`;
  document.querySelectorAll('#sChips button').forEach(b => b.onclick = () => { $('#grams').value = b.dataset.g; prev(); });
  $('#sDel').style.display = cur ? '' : 'none'; $('#sOk').textContent = cur ? 'Сохранить' : 'На тарелку';
  prev(); $('#veil').classList.add('on'); setTimeout(() => $('#grams').select(), 50);
}
const gramsVal = () => { const v = parseFloat(String($('#grams').value).replace(',', '.')); return isFinite(v) && v > 0 ? Math.min(v, 2000) : 0; };
function prev() {
  const f = sheet.food, g = gramsVal();
  $('#sPrev').innerHTML = [['ккал', f.k], ['Б', f.p], ['Ж', f.f], ['У', f.c]].map(([l, v]) => `<div><span>${l}</span><b>${fmt(v * g / 100, l === 'ккал' ? 0 : 1)}</b></div>`).join('');
}
$('#grams').oninput = prev;
$('#minus').onclick = () => { $('#grams').value = Math.max(5, gramsVal() - (gramsVal() > 50 ? 10 : 5)); prev(); };
$('#plus').onclick = () => { $('#grams').value = gramsVal() + (gramsVal() >= 50 ? 10 : 5); prev(); };
const closeSheet = () => { $('#veil').classList.remove('on'); sheet = null; };
$('#veil').onclick = e => { if (e.target.id === 'veil') closeSheet(); };
$('#grams').onkeydown = e => { if (e.key === 'Enter') $('#sOk').click(); };
$('#sOk').onclick = () => {
  const g = gramsVal(); if (!g) return toast('Укажите граммы');
  snap();
  const { food, at, idx } = sheet;
  if (idx != null) { items[idx].g = g; toast(`${food.name}: ${fmt(g)} г`); }
  else { items.push({ id: food.id, g, pos: place(food, at) }); toast(`${food.name} на тарелке`); }
  closeSheet(); render();
};
$('#sDel').onclick = () => { const { idx, food } = sheet; snap(); flyAway(idx); items.splice(idx, 1); closeSheet(); render(); toast(`${food.name} убран`); };

// a spot inside the product's own part of the plate, near where it was dropped, away from other piles
function place(food, at) {
  if (food.sec === 'sauce' || food.sec === 'drink') return null;
  const a = AREA[food.sec];
  let x = at ? at.nx : a.cx, y = at ? at.ny : a.cy;
  const d = Math.hypot(x - a.cx, y - a.cy); if (d > a.r) { x = a.cx + (x - a.cx) / d * a.r; y = a.cy + (y - a.cy) / d * a.r; }
  for (let k = 0; k < 24; k++) {
    const near = items.filter(i => i.pos).find(i => Math.hypot(i.pos.x - x, i.pos.y - y) < .11);
    if (!near) break;
    const ang = k * 2.4, rr = a.r * (.35 + (k % 6) / 8);
    x = a.cx + Math.cos(ang) * rr; y = a.cy + Math.sin(ang) * rr;
  }
  return { x, y };
}

// ---------- protein-fat units: 1 БЖЕ = 100 kcal from protein and fat; they raise glucose slowly, for hours
const bjeOf = t => (t.p * 4 + t.f * 9) / 100;
// how long after the meal glucose may keep rising (the usual school rule: 1 → 3 h, 2 → 4 h, 3 → 5 h, 4+ → 6–8 h)
const tailHours = b => (b < 1 ? null : b < 2 ? [3, 3] : b < 3 ? [4, 4] : b < 4 ? [5, 5] : [6, 8]);
const hoursText = h => (h[0] === h[1] ? `${h[0]} ч` : `${h[0]}–${h[1]} ч`);

// ---------- render
function totals(list = items) {
  return list.reduce((t, i) => { const f = BY[i.id], k = i.g / 100; t.k += f.k * k; t.p += f.p * k; t.f += f.f * k; t.c += f.c * k; return t; }, { k: 0, p: 0, f: 0, c: 0 });
}
let shownK = 0;
function countUp(el, to, d = 0, ms = 450) {
  const from = parseFloat(String(el.dataset.v || 0)); el.dataset.v = to; const t0 = performance.now();
  const step = t => { const p = Math.min(1, (t - t0) / ms), e = 1 - (1 - p) ** 3; el.textContent = fmt(from + (to - from) * e, d); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function render() {
  // piles
  const sideCounts = { sauce: [], drink: [] };
  $('#piles').innerHTML = items.map((i, idx) => {
    const f = BY[i.id];
    if (!i.pos) { sideCounts[f.sec].push(f.em); return ''; }
    const size = Math.max(26, Math.min(60, 22 + Math.sqrt(i.g) * 2.6));
    const pic = hasPhoto(f) ? `<span class="ph" style="width:${size * 1.5}px;height:${size * 1.5}px;${photoCss(f)}"></span>` : `<span class="em" style="font-size:${size}px">${f.em}</span>`;
    return `<div class="pile" data-i="${idx}" style="left:${i.pos.x * 100}%;top:${i.pos.y * 100}%;z-index:${Math.round(i.pos.y * 100)}">${pic}<span class="g">${fmt(i.g)} г</span></div>`;
  }).join('');
  document.querySelectorAll('.pile').forEach(p => p.onclick = () => { const i = +p.dataset.i; openSheet(BY[items[i].id], null, i); });
  $('#oil').innerHTML = `<div><span class="em">${sideCounts.sauce.join('') || '🥫'}</span>${sideCounts.sauce.length ? '' : 'соус'}</div>`;
  $('#glass').innerHTML = `<div><span class="em">${sideCounts.drink.join('') || '🥛'}</span>${sideCounts.drink.length ? '' : 'напиток'}</div>`;
  $('#oil').onclick = () => { const i = items.findIndex(x => BY[x.id].sec === 'sauce'); if (i >= 0) openSheet(BY[items[i].id], null, i); };
  $('#glass').onclick = () => { const i = items.findIndex(x => BY[x.id].sec === 'drink'); if (i >= 0) openSheet(BY[items[i].id], null, i); };
  // totals
  const t = totals();
  countUp($('#kcal'), Math.round(t.k)); countUp($('#pp'), t.p, 1); countUp($('#ff'), t.f, 1); countUp($('#cc'), t.c, 1);
  $('#cc2').textContent = `${fmt(t.c, 1)} г`; $('#xe').textContent = `${fmt(t.c / 12, 1)} ХЕ`;
  const b = bjeOf(t), th = tailHours(b);
  $('#bje').textContent = `${fmt(b, 1)} БЖЕ`; $('#bjeh').textContent = th ? `Сахар может подниматься ещё до ${hoursText(th)} после еды` : '';
  const kp = t.p * 4, kf = t.f * 9, kc = t.c * 4, ks = kp + kf + kc || 1;
  $('#bp').style.flex = kp; $('#bf').style.flex = kf; $('#bc').style.flex = kc;
  $('#lp').textContent = Math.round(kp / ks * 100); $('#lf').textContent = Math.round(kf / ks * 100); $('#lc').textContent = Math.round(kc / ks * 100);
  $('#list').innerHTML = items.length ? items.map((i, idx) => { const f = BY[i.id]; return `<div class="li"><span class="em">${f.em}</span><span class="grow">${f.name}<br><small style="color:var(--muted)">${fmt(i.g)} г · ${fmt(f.c * i.g / 100, 1)} г угл.</small></span><button data-e="${idx}" aria-label="изменить">✎</button></div>`; }).join('') : '<div class="empty">Тарелка пустая. Выберите гарнир, основное блюдо, салат — что угодно.</div>';
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => openSheet(BY[items[+b.dataset.e].id], null, +b.dataset.e));
  // steps
  const has = s => items.some(i => BY[i.id].sec === s);
  const st = [['side', 'Гарнир'], ['main', 'Основное'], ['veg', 'Овощи'], ['drink', 'Напиток']];
  const cur = st.findIndex(([k]) => !has(k));
  $('#steps').innerHTML = st.map(([k, n], i) => `<div class="step ${has(k) ? 'done' : ''} ${i === cur ? 'cur' : ''}"><i>${has(k) ? '✓' : i + 1}</i><b>${n}</b></div>`).join('');
  $('#done').disabled = !items.length;
  drawGrid();
}
// one cell of a 4×4 photo sheet, zoomed to its middle so only food shows
const photoCss = f => { const z = 500, cs = z / 4; return `background-image:url(${SHEETS[f.cell[0]]});background-size:${z}% ${z}%;background-position:${((f.cell[1] + .5) * cs - 50) / (z - 100) * 100}% ${((f.cell[2] + .5) * cs - 50) / (z - 100) * 100}%`; };
function flyAway(idx) {
  const el = document.querySelector(`.pile[data-i="${idx}"]`); if (!el) return;
  const clone = el.cloneNode(true); clone.classList.add('fly'); $('#piles').appendChild(clone);
  requestAnimationFrame(() => { clone.style.left = '-20%'; clone.style.top = '20%'; }); setTimeout(() => clone.remove(), 500);
}

// ---------- toast
let tt; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 1600); }

// ---------- undo
function undo() { if (!undoStack.length) return toast('Нечего отменять'); items = JSON.parse(undoStack.pop()); render(); toast('Отменено'); }
$('#undo').onclick = undo;
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  if (e.key === 'Escape') { closeSheet(); $('#result').classList.remove('on'); }
});

// ---------- result (instead of a receipt): lines printed one by one, totals count up
$('#done').onclick = () => {
  const t = totals();
  $('#rDate').textContent = new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  $('#rLines').innerHTML = items.map(i => { const f = BY[i.id], k = i.g / 100; return `<div class="rl"><span>${f.em}</span><span>${f.name}</span><span>${fmt(i.g)}</span><span>${fmt(f.p * k, 1)}</span><span>${fmt(f.f * k, 1)}</span><span><b>${fmt(f.c * k, 1)}</b></span></div>`; }).join('');
  ['#rK', '#rP', '#rF', '#rC', '#rXe', '#rBje'].forEach(s => { $(s).dataset.v = 0; $(s).textContent = '0'; });
  const bj = bjeOf(t), th = tailHours(bj);
  $('#rTail').innerHTML = th
    ? `<b>⏳ Возможен «хвост»: сахар может расти до ${hoursText(th)} после еды</b>Белки и жиры (${fmt(bj, 1)} БЖЕ) всасываются медленно: сахар может начать расти через 2–3 часа после еды и держаться повышенным до ${hoursText(th)}, когда короткий инсулин уже не действует. Проверьте сахар через 3 часа и ещё раз позже. Как компенсировать БЖЕ (например, продлённым болюсом), решает эндокринолог.<br><button type="button" id="tailBtn">⏱ Напомнить проверить сахар через 3 ч</button>`
    : `<b>БЖЕ меньше 1</b>Белков и жиров немного — заметного позднего подъёма обычно не бывает.`;
  const tb = $('#tailBtn'); if (tb) tb.onclick = () => {
    // the app's own timer (the same one as on the timer screen): a "check glucose" reminder in 3 hours
    try { localStorage.setItem('ec_hypo_timer', JSON.stringify({ end: Date.now() + 180 * 60e3, kind: 'check', min: 180 })); } catch { /* not kept */ }
    tb.disabled = true; tb.textContent = '✓ Напоминание через 3 ч поставлено'; toast('Напомню проверить сахар через 3 часа');
  };
  $('#result').classList.add('on'); drawSave();
  const lines = [...document.querySelectorAll('#rLines .rl')];
  lines.forEach((l, i) => setTimeout(() => l.classList.add('on'), 1300 + i * 110));
  setTimeout(() => {
    countUp($('#rK'), Math.round(t.k), 0, 700); countUp($('#rP'), t.p, 1, 700); countUp($('#rF'), t.f, 1, 700); countUp($('#rC'), t.c, 1, 700); countUp($('#rXe'), t.c / 12, 1, 700); countUp($('#rBje'), bjeOf(t), 1, 700);
  }, 1300 + lines.length * 110);
  const kp = t.p * 4, kf = t.f * 9, kc = t.c * 4, ks = kp + kf + kc || 1;
  $('#rbp').style.flex = kp; $('#rbf').style.flex = kf; $('#rbc').style.flex = kc;
  $('#rlp').textContent = `Белки ${Math.round(kp / ks * 100)}%`; $('#rlf').textContent = `Жиры ${Math.round(kf / ks * 100)}%`; $('#rlc').textContent = `Углеводы ${Math.round(kc / ks * 100)}%`;
  // what the plate is made of, by weight — no "right" or "wrong", the Harvard plate only for comparison
  const w = s => items.filter(i => s.includes(BY[i.id].sec)).reduce((a, i) => a + i.g, 0);
  const onPlate = w(['veg', 'side', 'main', 'sweet']) || 1;
  const share = s => Math.round(w([s]) / onPlate * 100);
  const chk = [['side', 'Гарнир'], ['main', 'Основное'], ['veg', 'Овощи и салаты'], ['sweet', 'Фрукты и десерт']].filter(([k]) => w([k]) > 0).map(([k, n]) => [true, `${n} — ${share(k)}% тарелки`]);
  chk.push([true, 'Для сравнения, гарвардская тарелка: ½ овощи, ¼ гарнир, ¼ белок']);
  $('#rCheck').innerHTML = chk.map(([, txt], i) => `<li><span class="ok" style="color:${i === chk.length - 1 ? 'var(--muted)' : 'var(--g3)'}">•</span><span>${txt}</span></li>`).join('');
  drawDish();
};
// The finished dish: the whole plate is covered with food, each item taking a wedge by its weight;
// sauces in small dishes on the rim, the drink in a glass beside the plate.
const TONE = { own: '#d9c3a0', mash: '#f3e3b5', pasta: '#f1d48a', rice: '#f6f2e6', buckwheat: '#8a5a33', potato: '#ecd18a', fries: '#f0b84a', potfried: '#d99a3c', plov: '#d9973f', bulgur: '#d8b26c', bread: '#f2dcae', lavash: '#efdcb4',
  cutlet: '#7a4428', drumstick: '#b8692c', breast: '#efd8bd', fishfried: '#d9a25a', sausage: '#e59a8a', goulash: '#8a3d22', omelet: '#f6d66b', pelmeni: '#f3e8d2', manty: '#f1e6cf', pizza: '#e9a24a', burger: '#b8743a',
  salad: '#7fbf5a', olivier: '#efe2b0', vinegret: '#b8355a', cabbage: '#cfe6a8', stewveg: '#d9813a', corn: '#f2c94c', peas: '#7cb342', broccoli: '#3f8f3a', apple: '#f4dcae', banana: '#f6e29a', grapes: '#9bc25a',
  cake: '#f1dcc8', icecream: '#fbf3df', cookies: '#d9a25a', choco: '#6b3b23' };
function drawDish() {
  const plate = items.filter(i => !['sauce', 'drink'].includes(BY[i.id].sec));
  const order = ['veg', 'side', 'main', 'sweet'];
  plate.sort((a, b) => order.indexOf(BY[a.id].sec) - order.indexOf(BY[b.id].sec));
  const total = plate.reduce((a, i) => a + i.g, 0) || 1;
  const CX = 210, CY = 200, R = 150;
  let ang = -Math.PI / 2, defs = '', wedges = '', labels = '';
  plate.forEach((i, n) => {
    const f = BY[i.id], a0 = ang, a1 = ang + i.g / total * Math.PI * 2; ang = a1;
    const id = 'pt' + n, large = a1 - a0 > Math.PI ? 1 : 0;
    const P = a => [CX + Math.cos(a) * R, CY + Math.sin(a) * R];
    const [x0, y0] = P(a0), [x1, y1] = P(a1);
    const path = plate.length === 1 ? `M${CX - R},${CY}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0` : `M${CX},${CY}L${x0},${y0}A${R},${R} 0 ${large},1 ${x1},${y1}Z`;
    if (hasPhoto(f)) {
      const [sh, c, r] = f.cell, S = 4 * (R * 2.3 / .8); // the sheet scaled so one portion covers the whole plate
      defs += `<pattern id="${id}" patternUnits="userSpaceOnUse" width="420" height="400"><image href="${SHEETS[sh]}" width="${S}" height="${S}" x="${CX - (c + .5) * S / 4}" y="${CY - (r + .5) * S / 4}" preserveAspectRatio="none"/></pattern>`;
    } else {
      // a dense heap of the food: base colour plus many small pieces, slightly rotated
      let t = ''; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) t += `<text x="${x * 15 + (y % 2) * 7 + 1}" y="${y * 15 + 13}" font-size="15" transform="rotate(${(x * 37 + y * 53) % 40 - 20} ${x * 15 + 8} ${y * 15 + 8})">${f.em}</text>`;
      defs += `<pattern id="${id}" patternUnits="userSpaceOnUse" width="45" height="45" patternTransform="rotate(${n * 23})"><rect width="45" height="45" fill="${TONE[f.own ? 'own' : f.id] || '#e9e2d6'}"/>${t}</pattern>`;
    }
    wedges += `<path d="${path}" fill="url(#${id})" stroke="rgba(255,255,255,.35)" stroke-width="1.2" style="filter:url(#heap)"/>`;
    const am = (a0 + a1) / 2, lr = plate.length === 1 ? 0 : R * .62;
    if (a1 - a0 > .35) labels += `<g transform="translate(${CX + Math.cos(am) * lr},${CY + Math.sin(am) * lr})"><rect x="-34" y="-11" width="68" height="22" rx="11" fill="rgba(255,255,255,.88)"/><text text-anchor="middle" y="4" font-size="11" font-weight="700" fill="#1d1d2c">${fmt(i.g)} г</text></g>`;
  });
  const sauces = items.filter(i => BY[i.id].sec === 'sauce'), drinks = items.filter(i => BY[i.id].sec === 'drink');
  const small = (f, x, y, r) => hasPhoto(f)
    ? (() => { const cs = r * 2.5; return `<defs><pattern id="s${f.id}" patternUnits="userSpaceOnUse" width="${2 * r}" height="${2 * r}" x="${x - r}" y="${y - r}"><image href="${SHEETS[f.cell[0]]}" width="${cs * 4}" height="${cs * 4}" x="${r - (f.cell[1] + .5) * cs}" y="${r - (f.cell[2] + .5) * cs}"/></pattern></defs><circle cx="${x}" cy="${y}" r="${r + 4}" fill="#fff" style="filter:url(#heap)"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#s${f.id})"/>`; })()
    : `<circle cx="${x}" cy="${y}" r="${r}" fill="${f.sec === 'drink' ? '#dcecff' : '#fff'}" stroke="#e6e3ef" stroke-width="3"/><text x="${x}" y="${y + r * .32}" text-anchor="middle" font-size="${r}">${f.em}</text>`;
  const sauceSvg = sauces.map((i, n) => small(BY[i.id], CX - R * .78 + n * 34, CY + R * .98, 20)).join('');
  const drinkSvg = drinks.map((i, n) => small(BY[i.id], 375, 70 + n * 70, 30)).join('');
  $('#dish').innerHTML = `<svg viewBox="0 0 420 400"><defs>${defs}
      <filter id="heap"><feGaussianBlur in="SourceAlpha" stdDeviation="2"/><feOffset dy="1.5"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="drim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a3d"/><stop offset=".38" stop-color="#f0458f"/><stop offset=".7" stop-color="#8b5cf6"/><stop offset="1" stop-color="#3b82f6"/></linearGradient>
      <radialGradient id="shade" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="rgba(255,255,255,.18)"/><stop offset=".6" stop-color="rgba(255,255,255,0)"/><stop offset="1" stop-color="rgba(40,20,10,.22)"/></radialGradient>
      <radialGradient id="dsh" cx=".5" cy=".55" r=".55"><stop offset=".8" stop-color="rgba(40,30,90,.22)"/><stop offset="1" stop-color="rgba(40,30,90,0)"/></radialGradient></defs>
    <ellipse cx="${CX}" cy="${CY + 14}" rx="${R + 36}" ry="${R + 30}" fill="url(#dsh)"/>
    <circle cx="${CX}" cy="${CY}" r="${R + 22}" fill="url(#drim)"/><circle cx="${CX}" cy="${CY}" r="${R + 15}" fill="#fff"/>
    <circle cx="${CX}" cy="${CY}" r="${R + 2}" fill="#f4f2f6"/>
    ${plate.length ? wedges : `<text x="${CX}" y="${CY}" text-anchor="middle" font-size="14" fill="#7a7a8c">на тарелке пусто</text>`}
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#shade)" pointer-events="none"/>
    ${labels}${sauceSvg}${drinkSvg}</svg><div class="dcloche" id="dcl"></div>`;
  $('#dname').textContent = plate.map(i => BY[i.id].name.toLowerCase()).join(', ').replace(/^./, c => c.toUpperCase()) + (drinks.length ? ' · ' + drinks.map(i => BY[i.id].name.toLowerCase()).join(', ') : '');
  setTimeout(() => { const c = $('#dcl'); if (c) c.classList.add('up'); }, 450);
}
$('#back').onclick = () => $('#result').classList.remove('on');
$('#again').onclick = () => { snap(); items = []; $('#result').classList.remove('on'); render(); toast('Новая тарелка'); };

$('#psearch').oninput = () => drawGrid();
// ---------- own dish: name, zone, grams and its КБЖУ (per 100 g or per portion)
const ZONES = [['side', 'Гарнир'], ['main', 'Основное'], ['veg', 'Овощи'], ['sweet', 'Десерт'], ['sauce', 'Соус'], ['drink', 'Напиток']];
let ownZone = 'main', ownPer = '100';
function openOwn() {
  $('#oZone').innerHTML = ZONES.map(([k, n]) => `<button data-v="${k}" class="${k === ownZone ? 'on' : ''}">${n}</button>`).join('');
  document.querySelectorAll('#oZone button').forEach(b => b.onclick = () => { ownZone = b.dataset.v; document.querySelectorAll('#oZone button').forEach(x => x.classList.toggle('on', x === b)); });
  document.querySelectorAll('#oPer button').forEach(b => b.onclick = () => { ownPer = b.dataset.v; document.querySelectorAll('#oPer button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#oErr').textContent = ''; $('#ownVeil').classList.add('on'); setTimeout(() => $('#oName').focus(), 50);
}
const num = v => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) && x >= 0 ? x : null; };
$('#ownBtn').onclick = openOwn;
$('#oCancel').onclick = () => $('#ownVeil').classList.remove('on');
$('#ownVeil').onclick = e => { if (e.target.id === 'ownVeil') $('#ownVeil').classList.remove('on'); };
$('#oOk').onclick = () => {
  const name = $('#oName').value.trim(), g = num($('#oG').value), k = num($('#oK').value), p = num($('#oP').value) ?? 0, f = num($('#oF').value) ?? 0, c = num($('#oC').value);
  if (!name) return ($('#oErr').textContent = 'Впишите название');
  if (!g || g > 3000) return ($('#oErr').textContent = 'Укажите граммы порции');
  if (c == null) return ($('#oErr').textContent = 'Укажите углеводы — без них не посчитать ХЕ');
  const per = ownPer === '100' ? 1 : 100 / g; // everything is kept per 100 g
  const kcal = k != null ? k * per : (p * 4 + f * 9 + c * 4) * per;
  const d = { id: 'own' + Date.now(), name, em: '🍽️', sec: ownZone, k: kcal, p: p * per, f: f * per, c: c * per, por: [[g, 'порция']], cell: null };
  FOODS.push({ ...d, own: true }); BY[d.id] = FOODS[FOODS.length - 1];
  try { const all = JSON.parse(localStorage.getItem('plate_own') || '[]'); all.push(d); localStorage.setItem('plate_own', JSON.stringify(all.slice(-30))); } catch { /* not kept */ }
  snap(); items.push({ id: d.id, g, pos: place(d, null) });
  $('#ownVeil').classList.remove('on'); ['#oName', '#oK', '#oP', '#oF', '#oC'].forEach(s => $(s).value = '');
  tab = ownZone; drawTabs(); render(); toast(`${name} на тарелке`);
};

// ---------- intro
const open = () => { document.body.classList.add('open'); toast('Выберите гарнир — любой'); };
$('#cloche').onclick = open; $('#openBtn').onclick = open;

drawTabs(); render();

// ---------- save to the diary as a meal (carbs, the foods with their КБЖУ, optional bolus)
const MEALS = [['breakfast', 'Завтрак'], ['lunch', 'Обед'], ['dinner', 'Ужин'], ['snack', 'Перекус']];
const byClock = h => (h >= 5 && h < 12 ? 'breakfast' : h >= 12 && h < 16 ? 'lunch' : h >= 16 && h < 22 ? 'dinner' : 'snack');
const askedMeal = new URLSearchParams(location.search).get('meal');
let meal = MEALS.some(m => m[0] === askedMeal) ? askedMeal : byClock(new Date().getHours());
const pickOne = (box, cb) => box.querySelectorAll('button').forEach(b => b.onclick = () => { box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); cb && cb(b.dataset.v); });
function drawSave() {
  $('#sMeal').innerHTML = MEALS.map(([k, n]) => `<button data-v="${k}" class="${k === meal ? 'on' : ''}">${n}</button>`).join('');
  pickOne($('#sMeal'), v => { meal = v; }); pickOne($('#sWhen'));
  const segs = document.querySelectorAll('#sPre .pseg'), pickSeg = el => segs.forEach(x => x.classList.toggle('on', x === el));
  segs.forEach(el => { el.onclick = () => pickSeg(el); });
  document.querySelectorAll('#sPre input').forEach(i => { i.onfocus = () => { pickSeg(i.closest('.pseg')); i.select(); }; i.onclick = e => e.stopPropagation(); });
  $('#sErr').textContent = ''; $('#sSave').disabled = false; $('#sSave').textContent = 'Записать в дневник';
}
const r1 = x => Math.round(x * 10) / 10;
$('#sSave').onclick = async () => {
  const t = totals();
  const insRaw = $('#sIns').value.trim(), ins = insRaw ? parseFloat(insRaw.replace(',', '.')) : 0;
  if (insRaw && !(ins >= 0 && ins < 100)) return ($('#sErr').textContent = 'Проверьте дозу');
  if (!(t.c > 0) && !ins) return ($('#sErr').textContent = 'На тарелке нет углеводов — записывать нечего');
  const seg = $('#sPre .pseg.on'), pd = seg ? seg.dataset.p : 'before', inp = seg && seg.querySelector('input');
  const mins = inp ? Math.max(0, Math.min(180, Math.round(parseFloat(String(inp.value).replace(',', '.')) || 0))) : 0;
  const pre = pd === 'with' ? 0 : pd === 'before' ? mins : -mins, ago = Number(($('#sWhen .on') || {}).dataset?.v || 0);
  const body = {
    kind: 'meal', mealType: meal, carbs: r1(t.c), insulin: ins || 0, preBolus: ins ? pre : undefined,
    foods: items.map(i => { const f = BY[i.id], k = i.g / 100; return { id: String(f.own ? 'own' : 'plate-' + f.id).slice(0, 40), name: f.name, g: r1(i.g), c: r1(f.c * k), k: Math.round(f.k * k), p: r1(f.p * k), f: r1(f.f * k) }; }),
    at: new Date(Date.now() - ago * 60e3).toISOString(),
    notes: `Тарелка: ${Math.round(t.k)} ккал, Б ${fmt(t.p, 1)} · Ж ${fmt(t.f, 1)} · У ${fmt(t.c, 1)} г (${fmt(t.c / 12, 1)} ХЕ, ${fmt(bjeOf(t), 1)} БЖЕ)`,
  };
  $('#sSave').disabled = true; $('#sSave').textContent = 'Записываю…';
  try {
    const r = await fetch('/app/treatments', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-EC': '1' }, body: JSON.stringify(body) });
    if (r.status === 401) throw new Error('Войдите в приложение, чтобы записывать в дневник');
    if (!r.ok) throw new Error('Не получилось записать. Попробуйте ещё раз');
    $('#sSave').textContent = 'Записано ✓'; toast('Записано в дневник');
    setTimeout(() => { location.href = '/#/diary'; }, 900);
  } catch (e) { $('#sErr').textContent = e.message; $('#sSave').disabled = false; $('#sSave').textContent = 'Записать в дневник'; }
};

})();
