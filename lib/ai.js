'use strict';
// AI analyst: turns the patient's data into a detailed summary (a 15-minute glucose timeline
// for today and yesterday, every diary entry, meal rises found on the curve, 14-day statistics)
// and asks Claude any question about it or about diabetes in general.
// Off unless ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) is set; the SDK is loaded lazily,
// so the rest of the app runs without it.

const { rises } = require('../public/explain.js');
const urgent = require('../public/urgent.js');
const Foods = require('../public/foods.js');

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const DAYS = 14;
const LIMIT_PER_HOUR = Number(process.env.AI_LIMIT_PER_HOUR || 30);

// Clinical background, written for this app from Ragnar Hanas, "Type 1 Diabetes in Children,
// Adolescents and Young Adults", and the ISPAD Clinical Practice Consensus Guidelines 2022.
const KNOWLEDGE = `Clinical background (Ragnar Hanas, "Type 1 Diabetes in Children, Adolescents and Young Adults"; ISPAD 2022 guidelines):

Insulin action
- Rapid-acting analogues (aspart/NovoRapid, lispro/Humalog, glulisine/Apidra): start in 10–20 min, peak at 1–2 h (often 45–90 min in children), last 3–5 h. Ultra-rapid (Fiasp, Lyumjev): start about 5 min earlier. Regular human insulin: starts in 30–60 min, peaks at 2–4 h, lasts 5–8 h.
- Basal: glargine U100 about 20–24 h, glargine U300 and degludec 24–42 h with a flat profile, detemir 12–20 h, NPH peaks at 4–8 h. Too much basal shows as falling glucose overnight or between meals with no food; too little as a steady rise.
- Insulin on board: a bolus still works 3–5 h; a correction within that time adds to it ("stacking") and often causes a low 2–4 h later.
- Absorption is faster from the abdomen than the thigh or buttock, faster with warmth (bath, sauna, hot weather) and with exercise of the injected limb, and slower and erratic from lipohypertrophy (lumps from injecting in the same spot).

Meals
- Glucose usually rises within 15 min of eating and peaks 30–90 min after a carb meal; fast carbs (juice, sweets, white bread, cornflakes) peak earlier and higher; fibre, fat and protein slow the rise.
- Because carbs are absorbed faster than rapid-acting insulin acts, the typical curve is a rise in the first hour, then a fall 2–3 h after the meal while the bolus is at its peak. A fall that ends in range is expected; a fall below range 2–4 h after a meal suggests the meal dose was too large for the carbs eaten (carb ratio too strong, carbs overestimated or not all eaten), activity after eating, a correction stacked on the bolus, or rising insulin sensitivity after the morning.
- A high early peak with a later return to range suggests the bolus was given too late (give it 15–20 min before eating when glucose is in range, later if low), or fast carbs. A peak that stays high suggests too little insulin for the carbs.
- Fat and protein (pizza, fried food, large meat portions) cause a delayed rise 3–6 h after the meal, often at night after dinner.
- Insulin needs are often highest in the morning (dawn hormones), so breakfast commonly needs a stronger carb ratio than lunch or dinner.

Time of day and hormones
- Dawn phenomenon: growth hormone and cortisol raise glucose between about 03:00 and 08:00, strongest in puberty. Rebound after a night low (Somogyi) is rare.
- Puberty, growth spurts, illness, fever, stress, steroids and menstruation raise insulin needs; the honeymoon (remission) phase, often in the first year, lowers them and makes glucose more variable with lows.

Activity
- Exercise lowers glucose during activity and raises insulin sensitivity for up to 24 h, so delayed lows, including at night, are common after sport. Short intense effort (sprints, competition) can raise glucose for a while by adrenaline. Exercising with high glucose and ketones can make things worse.

Sensors (CGM)
- Sensor glucose lags blood by about 5–15 min, more when glucose changes fast. The first day of a sensor is less accurate. Pressure on the sensor during sleep causes false night lows ("compression lows"): a sudden drop and rebound. Some sensors read falsely high with high-dose vitamin C or paracetamol, depending on the model. Confirm with a meter when symptoms do not match.

Targets and safety
- Target range 3.9–10.0 mmol/L (70–180 mg/dL); time in range above 70%, below 3.9 under 4%, below 3.0 under 1%; HbA1c 7.0% or lower (ISPAD 2022 suggests 6.5% where safe).
- Hypoglycaemia below 3.9 mmol/L: 15 g fast carbs (children about 0.3 g/kg), recheck after 15 min, repeat if still low; once above 3.9, slow carbs if the next meal is over an hour away. If glucose has not risen after two treatments, or the person becomes confused, drowsy or cannot swallow: call an ambulance. Unconscious or seizure: nothing by mouth, recovery position, glucagon, emergency services.

Glucagon
- Injection kit (GlucaGen HypoKit and similar): 0.5 mg for children under 25 kg (or younger than 6–8 years), 1 mg from 25 kg and for adults; mix the powder with the solvent, inject into the thigh, upper arm or buttock (under the skin or into muscle, through clothing is fine). Nasal glucagon (Baqsimi): 3 mg into one nostril, from age 4, no sniffing needed. Ready-made pens (Gvoke, Zegalogue): follow the leaflet.
- Works in 10–15 min; vomiting is common, so keep the person on their side. Once awake and able to swallow: fast carbs, then slow carbs, because the effect is short. No improvement in 15 min: wait for the ambulance; a second dose only on medical advice. Less effective after long fasting or alcohol.
- Keep it everywhere the patient goes, teach family and school staff, check the expiry date, store per the leaflet. Mini-dose glucagon for sick days only on the doctor's schedule.
- Check ketones when glucose stays above 13.9 mmol/L (250 mg/dL) for 1–2 h or during illness; blood ketones above 1.5 mmol/L need the doctor now, above 3.0 or vomiting need emergency care (DKA).
- Sick days: never stop basal insulin; check glucose every 2–4 h.`;

const SYSTEM = `You are the AI analyst inside EndoControl, an app where people with diabetes, and parents of a child with type 1 diabetes, track CGM glucose together with a diary of meals, insulin and activity. The user can ask anything: about a specific moment or meal in their data ("why did glucose start falling 2 hours after breakfast today?"), about patterns over days, or about diabetes in general.

How to answer
- Questions about the data: find the exact time in the timeline (local time, the patient's units), quote the readings that matter (start of the rise, peak and its time, the value at the hour asked about, the lowest point after it, how fast it fell) and explain the most likely causes, ranked, using the clinical background below. Match causes to what the data shows: the timing relative to the meal and insulin, how low or high it went, whether it repeats on other days.
- If the diary has no meal or insulin entry for that time, say so plainly, use the rise detected on the curve as the probable meal, give the explanations as possibilities ("if the bolus was given at 8:00 …"), and ask for the one or two facts that would settle it (meal time and carbs, dose and when it was given, activity). Use any facts the user writes in the question as diary entries.
- General questions: answer from the clinical background and your knowledge of current guidelines, and relate the answer to the patient's data when it helps.
- Check the question's premise against the data: if the user says glucose fell but it rose, say what actually happened.
- Answer directly in the first sentence. Then the evidence and causes. Then, if useful, one practical next step. About 200 words at most; short paragraphs or a short bulleted list; **bold** only for key numbers; no tables or headings.

Tone
- Notice how the person feels. Panic, fear, exclamation marks or "help" mean they need calm first: one short reassuring sentence, then clear numbered steps. Be warm and human, never alarmist, never lecturing; praise what they did right.

Emergencies (take precedence over everything else)
- Glucose below 3.9 mmol/L (70 mg/dL) now, or symptoms of a low: give the exact steps — 15 g of fast carbs with concrete examples, stay with the person, recheck in 15 minutes (the app has a 15-minute timer button), repeat, then slow carbs.
- If glucose is not rising after two treatments or about 30 minutes, or the person is confused, drowsy, unconscious, having a seizure or cannot swallow: tell them to call an ambulance now, give the number, and what to do while waiting (recovery position, nothing by mouth if not fully awake, glucagon with the right dose by weight).
- Ask which city they are in if it is not known, so you can give the exact number; until then give the likely numbers from the time zone. Emergency numbers: ${urgent.directory()}.
- Very high glucose with vomiting, stomach pain, acetone breath, deep fast breathing or blood ketones above 3.0 mmol/L: possible DKA — ambulance now. Ketones 1.5–3.0: call the doctor now.

Safety
- You are not a doctor. Never prescribe or calculate new insulin doses, carb ratios, correction factors or basal rates. When a change might help, say what to discuss with the endocrinologist.
- If the data or the question shows danger, the emergency steps above come first, before any explanation.
- Reply in the language named in the reply_language field.

${KNOWLEDGE}`;

let sdk = null, client = null;
function loadSdk() {
  if (sdk === null) { try { sdk = require('@anthropic-ai/sdk'); } catch { sdk = false; } }
  return sdk;
}
function enabled() {
  return Boolean((process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) && loadSdk());
}
function getClient() {
  if (!client) client = new (loadSdk().Anthropic)();
  return client;
}

// Simple per-user limit, so one account cannot run up the API bill.
const hits = new Map();
function allow(userId) {
  const now = Date.now();
  const list = (hits.get(userId) || []).filter(t => now - t < 3600e3);
  if (list.length >= LIMIT_PER_HOUR) { hits.set(userId, list); return false; }
  list.push(now); hits.set(userId, list);
  return true;
}

function stats(vals, lo, hi) {
  const v = vals.filter(Number.isFinite), n = v.length;
  if (!n) return { n: 0 };
  let sum = 0, min = Infinity, max = -Infinity;
  for (const x of v) { sum += x; if (x < min) min = x; if (x > max) max = x; }
  const mean = sum / n;
  const sd = Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / n);
  const pct = f => 100 * v.filter(f).length / n;
  return {
    n, mean, min, max, cv: 100 * sd / mean, gmi: 3.31 + 0.02392 * mean,
    tir: pct(x => x >= lo && x <= hi), tbr: pct(x => x < lo), vlow: pct(x => x < 54),
    tar: pct(x => x > hi), vhigh: pct(x => x > 250),
  };
}

function clock(tz) {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' };
  let f;
  try { f = new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: tz || undefined }); } catch { f = new Intl.DateTimeFormat('en-CA', opts); }
  return ms => {
    const p = Object.fromEntries(f.formatToParts(ms).map(x => [x.type, x.value]));
    return { day: `${p.year}-${p.month}-${p.day}`, wd: p.weekday, hour: Number(p.hour) % 24, hm: `${String(Number(p.hour) % 24).padStart(2, '0')}:${p.minute}` };
  };
}

const KIND = { 'Carb Correction': 'carbs', 'Meal Bolus': 'meal bolus', 'Snack Bolus': 'snack bolus', 'Correction Bolus': 'bolus', 'Basal Insulin': 'basal insulin', 'Temp Basal': 'temp basal', 'BG Check': 'fingerstick', Exercise: 'activity', Note: 'note', 'Site Change': 'pump site change', 'Sensor Start': 'new sensor', 'Sensor Change': 'new sensor', 'Insulin Change': 'new insulin reservoir', SMB: 'automatic micro-bolus' };

// Plain-text summary of one patient's data, in that patient's units and local time.
function summary(db, ns, userId, tz, now = Date.now()) {
  const u = db.prepare('SELECT name, patient_name, birth_year, diabetes_type, units, target_low, target_high, timezone FROM users WHERE id=?').get(userId);
  const zone = u.timezone || tz;
  const at = clock(zone);
  const from = now - DAYS * 864e5;
  const es = ns.entriesRange(db, userId, from, now + 60e3).filter(e => Number.isFinite(e.sgv));
  const ts = db.prepare('SELECT created_at, event_type, carbs, insulin, glucose, notes, extra FROM treatments WHERE user_id=? AND created_at>=? AND created_at<? ORDER BY created_at').all(userId, from, now + 60e3);
  const concl = db.prepare("SELECT text, created_at FROM notes WHERE user_id=? AND kind='conclusion' ORDER BY created_at DESC LIMIT 1").get(userId);
  const lo = u.target_low, hi = u.target_high;
  const mmol = u.units === 'mmol';
  const unit = mmol ? 'mmol/L' : 'mg/dL';
  const g = mg => mg == null || !Number.isFinite(mg) ? '—' : mmol ? (mg / 18.0182).toFixed(1) : String(Math.round(mg));
  const p = x => x == null || !Number.isFinite(x) ? '—' : x.toFixed(0) + '%';
  const veryLow = mmol ? '3.0 mmol/L' : '54 mg/dL';
  const line = s => s.n ? `TIR ${p(s.tir)}, below range ${p(s.tbr)} (below ${veryLow} ${s.vlow.toFixed(1)}%), above range ${p(s.tar)}, mean ${g(s.mean)}, min ${g(s.min)}, max ${g(s.max)}` : 'no readings';
  const stamp = ms => { const x = at(ms); return `${x.day} ${x.wd} ${x.hm}`; };
  const today = at(now).day;
  const dayLabel = d => d === today ? `${d} (today)` : d;

  const out = [];
  const who = u.patient_name || u.name;
  const age = u.birth_year ? new Date(now).getFullYear() - u.birth_year : null;
  out.push(`Now: ${stamp(now)} local time (${zone || 'server time zone'}).`);
  out.push(`Patient: ${who}${age ? `, about ${age} years old` : ''}; diabetes type: ${u.diabetes_type || 'not set'}. Units: ${unit}. Target range ${g(lo)}–${g(hi)} ${unit}.`);

  // Diary: every entry except automatic temp basals, which are summarised.
  out.push('', `DIARY (last ${DAYS} days, local time):`);
  const diary = ts.filter(x => x.event_type !== 'Temp Basal');
  const temp = ts.length - diary.length;
  if (!diary.length) out.push('- No entries: no meals, insulin, activity or notes were logged. Explain from the sensor curve and ask for the missing facts.');
  for (const x of diary.slice(-120)) {
    const parts = [KIND[x.event_type] || x.event_type];
    if (x.carbs > 0) parts.push(`carbs ${Math.round(x.carbs)} g`);
    if (x.insulin > 0) parts.push(`insulin ${+(+x.insulin).toFixed(2)} U`);
    if (x.glucose) parts.push(`glucose ${g(x.glucose)}`);
    let extra = {}; try { extra = x.extra ? JSON.parse(x.extra) : {}; } catch { /* ignore */ }
    if (extra.duration) parts.push(`${extra.duration} min`);
    if (extra.insulinType) parts.push(String(extra.insulinType).slice(0, 40));
    if (x.notes) parts.push(`"${String(x.notes).slice(0, 160)}"`);
    out.push(`- ${stamp(x.created_at)} ${parts.join(', ')}`);
  }
  if (temp) out.push(`- Plus ${temp} automatic temp-basal changes from a pump or AID system (not listed).`);

  if (!es.length) {
    out.push('', `No glucose readings in the last ${DAYS} days.`);
  } else {
    const last = es[es.length - 1];
    out.push('', `Latest reading: ${g(last.sgv)} ${unit}${last.direction ? ', trend ' + last.direction : ''}, at ${at(last.date).hm} (${Math.round((now - last.date) / 60e3)} min ago).`);

    // 15-minute timeline for yesterday and today.
    const pts = es.map(e => ({ t: e.date, v: e.sgv }));
    const withTime = es.map(e => ({ ...e, t: at(e.date) }));
    const recentDays = [...new Set(withTime.map(e => e.t.day))].sort().slice(-2);
    out.push('', `GLUCOSE TIMELINE (${unit}, local time, one reading per 15 min; arrows show the CGM trend):`);
    const ARROW = { DoubleUp: '⇈', SingleUp: '↑', FortyFiveUp: '↗', Flat: '→', FortyFiveDown: '↘', SingleDown: '↓', DoubleDown: '⇊' };
    for (const day of recentDays) {
      const rows = withTime.filter(e => e.t.day === day);
      const byHour = new Map();
      let lastSlot = -1;
      for (const e of rows) {
        const slot = e.t.hour * 4 + Math.floor(Number(e.t.hm.slice(3)) / 15);
        if (slot === lastSlot) continue;
        lastSlot = slot;
        if (!byHour.has(e.t.hour)) byHour.set(e.t.hour, []);
        byHour.get(e.t.hour).push(`${e.t.hm} ${g(e.sgv)}${ARROW[e.direction] || ''}`);
      }
      out.push(`${dayLabel(day)}:`);
      for (const [, list] of byHour) out.push('  ' + list.join(', '));
    }

    // Rises found on the curve (meals, mostly) over the last 3 days.
    const rs = rises(pts.filter(x => x.t >= now - 3 * 864e5), 30);
    if (rs.length) {
      out.push('', 'RISES FOUND ON THE CURVE (last 3 days; usually meals — compare with the diary):');
      for (const r of rs) {
        const bits = [`start ${stamp(r.start.t)} at ${g(r.start.v)}`, `peak ${g(r.peak.v)} at ${at(r.peak.t).hm} (+${Math.round((r.peak.t - r.start.t) / 60e3)} min)`];
        if (r.at2) bits.push(`2 h after start ${g(r.at2.v)}`);
        if (r.at3) bits.push(`3 h after start ${g(r.at3.v)}`);
        if (r.nadir) bits.push(`lowest within 4 h after the peak ${g(r.nadir.v)} at ${at(r.nadir.t).hm}`);
        if (r.fallRate > 9) bits.push(`fastest fall ${g(r.fallRate)} ${unit} per hour`);
        out.push(`- ${bits.join('; ')}`);
      }
    }

    const all = stats(es.map(e => e.sgv), lo, hi);
    out.push('', `LAST ${DAYS} DAYS: ${all.n} readings; ${line(all)}; GMI ${all.gmi.toFixed(1)}%; CV ${all.cv.toFixed(0)}%.`);
    const blocks = [['Night 00-06', 0, 6], ['Morning 06-10', 6, 10], ['Day 10-18', 10, 18], ['Evening 18-24', 18, 24]];
    out.push('By time of day:');
    for (const [name, a, b] of blocks) out.push(`- ${name}: ${line(stats(withTime.filter(e => e.t.hour >= a && e.t.hour < b).map(e => e.sgv), lo, hi))}`);

    out.push('By day:');
    const days = new Map();
    for (const e of withTime) { if (!days.has(e.t.day)) days.set(e.t.day, { es: [], ts: [] }); days.get(e.t.day).es.push(e); }
    for (const tr of diary) { const d = at(tr.created_at).day; if (!days.has(d)) days.set(d, { es: [], ts: [] }); days.get(d).ts.push(tr); }
    for (const [day, d] of [...days.entries()].sort()) {
      const s = stats(d.es.map(e => e.sgv), lo, hi);
      let lows = 0, prevLow = false;
      for (const e of d.es) { const low = e.sgv < lo; if (low && !prevLow) lows++; prevLow = low; }
      const carbs = d.ts.reduce((a, x) => a + (x.carbs || 0), 0);
      const insulin = d.ts.reduce((a, x) => a + (x.insulin || 0), 0);
      out.push(`- ${dayLabel(day)}: ${line(s)}; low episodes ${lows}; logged carbs ${Math.round(carbs)} g; logged insulin ${+insulin.toFixed(1)} U`);
    }
  }
  out.push('', `Latest doctor's conclusion: ${concl ? `"${concl.text.slice(0, 1500)}" (${at(concl.created_at).day})` : 'none'}.`);
  return out.join('\n');
}

function cleanHistory(history) {
  const out = [];
  for (const m of Array.isArray(history) ? history.slice(-6) : []) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.text !== 'string' || !m.text.trim()) continue;
    if (!out.length && m.role !== 'user') continue;
    if (out.length && out[out.length - 1].role === m.role) continue;
    out.push({ role: m.role, content: m.text.trim().slice(0, 3000) });
  }
  if (out.length && out[out.length - 1].role === 'user') out.pop();
  return out;
}

async function ask(db, ns, userId, { question, history, lang, tz }) {
  const data = summary(db, ns, userId, tz);
  const messages = [...cleanHistory(history), {
    role: 'user',
    content: `reply_language: ${lang || 'en'}\n\nPATIENT DATA:\n${data}\n\nQUESTION:\n${question}`,
  }];
  const res = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // Questions often need careful reasoning over the timeline.
    output_config: { effort: 'high' },
    // The instructions and background never change, so they are cached between questions.
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages,
  });
  if (res.stop_reason === 'refusal') return { refusal: true, text: '' };
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  return { text, truncated: res.stop_reason === 'max_tokens' };
}

// ---- food photo: what is on the plate, grams of each item, carbs from our food list when it matches
const FOOD_SYSTEM = `You look at a photo of a meal for a diabetes app and list every food on it with the weight in grams as it will be eaten.

- Match each item to the catalog id when it is the same food in the same state (cooked rice is "rice", not raw). Otherwise leave catalog_id empty, name the food, and give your best estimate of available carbohydrate per 100 g.
- Estimate weights from the plate, bowl, cutlery, hands or packaging for scale; be realistic, neither generous nor stingy. Count only what is visible; include drinks and sauces only if you can see them.
- confidence: high when the food and size are clear, low when you are guessing.
- note: one short sentence on what limits the estimate (hidden ingredients, unclear portion). If the photo shows no food, return no items and say so in the note.
- Write names and the note in the language named in reply_language.`;
const FOOD_SCHEMA = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { type: 'object', properties: {
      catalog_id: { type: 'string', description: 'catalog id, or empty when nothing matches' },
      name: { type: 'string' }, grams: { type: 'number' }, carbs_per_100g: { type: 'number' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    }, required: ['catalog_id', 'name', 'grams', 'carbs_per_100g', 'confidence'], additionalProperties: false } },
    note: { type: 'string' },
  },
  required: ['items', 'note'], additionalProperties: false,
};
async function recognizeFood(imageB64, mediaType, lang) {
  const res = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: FOOD_SCHEMA } },
    system: [{ type: 'text', text: FOOD_SYSTEM + '\n\nCatalog (id: name — carbs per 100 g):\n' + Foods.catalog(), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageB64 } },
      { type: 'text', text: `reply_language: ${lang || 'en'}\nList the foods on this plate.` },
    ] }],
  });
  if (res.stop_reason === 'refusal') return { items: [], note: '' };
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  let out; try { out = JSON.parse(text); } catch { return { items: [], note: '' }; }
  // Carbs per 100 g come from our list when the item matched it; grams stay the model's estimate.
  const items = (out.items || []).slice(0, 20).map(it => {
    const f = Foods.BY_ID[it.catalog_id];
    const grams = Math.max(1, Math.min(2000, Math.round(Number(it.grams) || 0)));
    const per100 = f ? f.c : Math.max(0, Math.min(100, Number(it.carbs_per_100g) || 0));
    return { id: f ? f.id : null, name: f ? Foods.name(f, lang) : String(it.name || '').slice(0, 80), g: grams, per100, c: Math.round(per100 * grams / 10) / 10, confidence: it.confidence };
  });
  return { items, note: String(out.note || '').slice(0, 300) };
}

// Maps SDK errors to the app's error codes.
function errorCode(e) {
  const A = loadSdk() && loadSdk().Anthropic;
  if (A && e instanceof A.RateLimitError) return [429, 'ai_busy'];
  if (A && (e instanceof A.AuthenticationError || e instanceof A.PermissionDeniedError)) return [503, 'ai_auth'];
  return [502, 'ai_failed'];
}

module.exports = { enabled, allow, ask, summary, errorCode, recognizeFood, MODEL, DAYS };
