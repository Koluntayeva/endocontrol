'use strict';
// AI analyst: turns the last 14 days of glucose and diary data into a compact summary
// and asks Claude about it. Off unless ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) is set;
// the SDK is loaded lazily, so the rest of the app runs without it.

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const DAYS = 14;
const LIMIT_PER_HOUR = Number(process.env.AI_LIMIT_PER_HOUR || 30);

const SYSTEM = `You are the AI analyst inside EndoControl, an app where people with diabetes, or parents of a child with type 1 diabetes, track glucose from a CGM together with a diary of food, insulin and activity. Answer the question using the data summary in the user's message.

- Base every statement on the data and cite concrete numbers, days and times. If the data cannot answer the question, say what is missing.
- Look for patterns: time of day, meals, insulin timing, activity, night lows, variability, changes from day to day.
- Keep it short and plain: about 150 words at most, in short paragraphs or a bulleted list, with no tables or headings. Use **bold** only for the key numbers.
- You are not a doctor. Never prescribe or calculate new insulin doses, carb ratios, correction factors or basal rates. When a change might help, say to discuss it with the endocrinologist and suggest concrete questions to ask.
- If the data shows danger signs (glucose below 3.0 mmol/L or 54 mg/dL, repeated lows, glucose above 13.9 mmol/L or 250 mg/dL for many hours) or the question mentions ketones, vomiting, confusion or loss of consciousness, say first and plainly to follow the emergency plan and contact a doctor or emergency services.
- Reply in the language named in the reply_language field.`;

// The voice assistant: general diabetes knowledge, answers meant to be read aloud.
const ASSISTANT = `You are the voice assistant inside EndoControl, an app for people with diabetes and for parents of children with type 1 diabetes. You are an expert diabetes educator: you know type 1, type 2 and gestational diabetes, insulin and its types, pumps and pens, CGM sensors, carb counting and bread units, hypo- and hyperglycaemia, ketones and DKA, exercise, sick days, nutrition, school and travel, technology and emotional wellbeing, following ISPAD and ADA guidance.

- Your answer will be read aloud. Write plain sentences only: no markdown, lists, symbols, emoji or tables. Keep it under about 90 words unless asked for detail.
- Answer the question directly first, then give the one or two most useful facts. Use the patient's units.
- A summary of the patient's recent data is attached. Use it only when the question is about this patient.
- You are not a doctor. Never prescribe or calculate insulin doses, ratios or basal rates; say to agree changes with the endocrinologist.
- For danger signs (glucose below 3.0 mmol/L or 54 mg/dL, unconsciousness, seizures, vomiting, ketones above 1.5 mmol/L, deep fast breathing), first say to give fast carbs or glucagon as appropriate and to call emergency services (103 or 112 in Kazakhstan and Russia).
- If the question is not about diabetes or health, answer briefly and kindly steer back to diabetes.
- Reply in the language named in the reply_language field.`;

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
  let f;
  try { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
  catch { f = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
  return ms => {
    const p = Object.fromEntries(f.formatToParts(ms).map(x => [x.type, x.value]));
    return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, hm: `${p.hour}:${p.minute}` };
  };
}

const KIND = { 'Carb Correction': 'carbs', 'Meal Bolus': 'meal', 'Snack Bolus': 'snack', 'Correction Bolus': 'bolus', 'Basal Insulin': 'basal', 'Temp Basal': 'temp basal', 'BG Check': 'fingerstick', Exercise: 'activity', Note: 'note' };

// Plain-text summary of one patient's last DAYS days, in that patient's units.
function summary(db, ns, userId, tz, now = Date.now()) {
  const u = db.prepare('SELECT name, patient_name, birth_year, diabetes_type, units, target_low, target_high, timezone FROM users WHERE id=?').get(userId);
  const zone = u.timezone || tz;
  const at = clock(zone);
  const from = now - DAYS * 864e5;
  const es = ns.entriesRange(db, userId, from, now + 60e3).filter(e => Number.isFinite(e.sgv));
  const ts = db.prepare('SELECT created_at, event_type, carbs, insulin, glucose, notes FROM treatments WHERE user_id=? AND created_at>=? AND created_at<? ORDER BY created_at').all(userId, from, now + 60e3);
  const concl = db.prepare("SELECT text, created_at FROM notes WHERE user_id=? AND kind='conclusion' ORDER BY created_at DESC LIMIT 1").get(userId);
  const lo = u.target_low, hi = u.target_high;
  const mmol = u.units === 'mmol';
  const unit = mmol ? 'mmol/L' : 'mg/dL';
  const g = mg => mg == null || !Number.isFinite(mg) ? '—' : mmol ? (mg / 18.0182).toFixed(1) : String(Math.round(mg));
  const p = x => x == null || !Number.isFinite(x) ? '—' : x.toFixed(0) + '%';
  const veryLow = mmol ? '3.0 mmol/L' : '54 mg/dL';
  const line = s => s.n ? `TIR ${p(s.tir)}, below range ${p(s.tbr)} (below ${veryLow} ${s.vlow.toFixed(1)}%), above range ${p(s.tar)}, mean ${g(s.mean)}, min ${g(s.min)}, max ${g(s.max)}` : 'no readings';

  const out = [];
  const who = u.patient_name || u.name;
  const age = u.birth_year ? new Date(now).getFullYear() - u.birth_year : null;
  out.push(`Patient: ${who}${age ? `, about ${age} years old` : ''}; diabetes type: ${u.diabetes_type || 'not set'}.`);
  out.push(`Units: ${unit}. Target range ${g(lo)}–${g(hi)} ${unit}. Time zone: ${zone || 'server local'}.`);
  if (!es.length) {
    out.push(`No glucose readings in the last ${DAYS} days.`);
  } else {
    const last = es[es.length - 1];
    out.push(`Latest reading: ${g(last.sgv)} ${unit}${last.direction ? ', trend ' + last.direction : ''}, ${Math.round((now - last.date) / 60e3)} min ago.`);
    const all = stats(es.map(e => e.sgv), lo, hi);
    out.push(`Last ${DAYS} days: ${all.n} readings; ${line(all)}; GMI ${all.gmi.toFixed(1)}%; CV ${all.cv.toFixed(0)}%.`);
    const blocks = [['Night 00-06', 0, 6], ['Morning 06-10', 6, 10], ['Day 10-18', 10, 18], ['Evening 18-24', 18, 24]];
    const withTime = es.map(e => ({ ...e, t: at(e.date) }));
    out.push('By time of day:');
    for (const [name, a, b] of blocks) out.push(`- ${name}: ${line(stats(withTime.filter(e => e.t.hour >= a && e.t.hour < b).map(e => e.sgv), lo, hi))}`);

    // Peak within 3 h after each carb entry, grouped by meal time.
    const meals = { breakfast: [], lunch: [], dinner: [] };
    for (const tr of ts) {
      if (!(tr.carbs > 0)) continue;
      const h = at(tr.created_at).hour;
      const before = es.filter(e => e.date <= tr.created_at && e.date > tr.created_at - 20 * 60e3).pop();
      const after = es.filter(e => e.date > tr.created_at && e.date <= tr.created_at + 3 * 3600e3);
      if (!after.length) continue;
      const peak = Math.max(...after.map(e => e.sgv));
      (h < 11 ? meals.breakfast : h < 16 ? meals.lunch : meals.dinner).push({ peak, rise: before ? peak - before.sgv : null });
    }
    const mealLines = Object.entries(meals).filter(([, v]) => v.length).map(([k, v]) => {
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      const rises = v.map(x => x.rise).filter(x => x != null);
      return `${k}: ${v.length} meals, average peak ${g(avg(v.map(x => x.peak)))}${rises.length ? `, average rise ${g(avg(rises))}` : ''}`;
    });
    if (mealLines.length) out.push(`Within 3 h after meals: ${mealLines.join('; ')}.`);

    out.push('By day:');
    const days = new Map();
    for (const e of withTime) { if (!days.has(e.t.day)) days.set(e.t.day, { es: [], ts: [] }); days.get(e.t.day).es.push(e); }
    for (const tr of ts) { const d = at(tr.created_at).day; if (!days.has(d)) days.set(d, { es: [], ts: [] }); days.get(d).ts.push(tr); }
    for (const [day, d] of [...days.entries()].sort()) {
      const s = stats(d.es.map(e => e.sgv), lo, hi);
      let lows = 0, prevLow = false;
      for (const e of d.es) { const low = e.sgv < lo; if (low && !prevLow) lows++; prevLow = low; }
      const carbs = d.ts.reduce((a, x) => a + (x.carbs || 0), 0);
      const insulin = d.ts.reduce((a, x) => a + (x.insulin || 0), 0);
      const events = d.ts.filter(x => !(x.carbs > 0) && !(x.insulin > 0) || x.notes).map(x => {
        const what = KIND[x.event_type] || x.event_type;
        return `${at(x.created_at).hm} ${what}${x.glucose ? ' ' + g(x.glucose) : ''}${x.notes ? ` ("${String(x.notes).slice(0, 120)}")` : ''}`;
      });
      out.push(`- ${day}: ${line(s)}; low episodes ${lows}; carbs ${Math.round(carbs)} g; insulin ${+insulin.toFixed(1)} U${events.length ? '; ' + events.slice(0, 8).join('; ') : ''}`);
    }
  }
  out.push(`Latest doctor's conclusion: ${concl ? `"${concl.text.slice(0, 1500)}" (${at(concl.created_at).day})` : 'none'}.`);
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

async function ask(db, ns, userId, { question, history, lang, tz, assistant }) {
  const data = summary(db, ns, userId, tz);
  const messages = [...cleanHistory(history), {
    role: 'user',
    content: `reply_language: ${lang || 'en'}\n\nDATA (last ${DAYS} days):\n${data}\n\nQUESTION:\n${question}`,
  }];
  const res = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // The spoken assistant favours a quick reply; the analyst digs into the data.
    output_config: { effort: assistant ? 'low' : 'medium' },
    system: assistant ? ASSISTANT : SYSTEM,
    messages,
  });
  if (res.stop_reason === 'refusal') return { refusal: true, text: '' };
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  return { text, truncated: res.stop_reason === 'max_tokens' };
}

// Maps SDK errors to the app's error codes.
function errorCode(e) {
  const A = loadSdk() && loadSdk().Anthropic;
  if (A && e instanceof A.RateLimitError) return [429, 'ai_busy'];
  if (A && (e instanceof A.AuthenticationError || e instanceof A.PermissionDeniedError)) return [503, 'ai_auth'];
  return [502, 'ai_failed'];
}

module.exports = { enabled, allow, ask, summary, errorCode, MODEL, DAYS };
