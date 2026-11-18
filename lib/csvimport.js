'use strict';
// Imports glucose history from CSV exports of any sensor or meter:
// LibreView (FreeStyle Libre), Dexcom Clarity, Medtronic CareLink, Eversense, Glooko, Tidepool, xDrip+, generic tables.
// Column names are matched by keywords in several languages; units (mg/dL or mmol/L) are detected automatically.

function splitLine(line, d) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const GLUCOSE_KEYS = [/historic glucose|historische glukose|glucosa histórica|glucose historique|исторические данные глюкозы/i,
  /sensor glucose|glucose du capteur|sensorglukose/i, /glucose value|glucosewert|valor de glucosa/i, /^sgv$/i,
  /glucose|glukose|glucosa|glicose|glicemia|glycémie|глюкоз|сахар|血糖|グルコース|혈당|glikoz|गुलूकोज़|glukosa/i, /\bbg\b|blood sugar/i];
const TIME_KEYS = [/device timestamp|gerätezeitstempel|marca de tiempo del dispositivo|horodatage de l'appareil|метка времени устройства/i,
  /timestamp|zeitstempel|marca de tiempo|horodatage|метка времени|datetime|date ?time|дата и время|日時|일시/i];
const DATE_KEYS = [/^date$|^datum$|^fecha$|^data$|^дата$|^日付$/i];
const CLOCK_KEYS = [/^time$|^zeit$|^hora$|^heure$|^время$|^時刻$/i];
const TYPE_KEYS = [/record type|aufzeichnungstyp|tipo de registro|type d'enregistrement|тип записи|event type/i];

function findCol(header, patterns) {
  for (const p of patterns) { const i = header.findIndex(h => p.test(h)); if (i >= 0) return i; }
  return -1;
}

function parseDateTime(s, order, offsetMin) {
  s = String(s || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) return Date.parse(s);
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(s);
  let y, mo, d, h, mi, se, ap;
  if (m) { [, y, mo, d, h, mi, se, ap] = m; }
  else {
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(s);
    if (!m) return null;
    let a, b; [, a, b, y, h, mi, se, ap] = m;
    if (order === 'MDY') { mo = a; d = b; } else { d = a; mo = b; }
    if (y.length === 2) y = '20' + y;
  }
  h = +h % (ap ? 12 : 24); if (ap && ap.toUpperCase() === 'PM') h += 12;
  const local = Date.UTC(+y, +mo - 1, +d, h, +mi, +(se || 0));
  return local + (Number(offsetMin) || 0) * 60e3; // browser getTimezoneOffset(): UTC = local + offset
}

function parseCsv(text, tzOffsetMin) {
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const detected = {};
  if (lines.length < 2) return { entries: [], detected: { error: 'empty file' } };
  const sample = lines.slice(0, 20).join('\n');
  const delim = [',', ';', '\t'].map(d => [d, (sample.match(new RegExp(d === '\t' ? '\t' : '\\' + d, 'g')) || []).length]).sort((a, b) => b[1] - a[1])[0][0];
  detected.delimiter = delim === '\t' ? 'tab' : delim;

  // header = first of the first 30 lines that has a glucose column and a time or date column
  let hi = -1, header;
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const h = splitLine(lines[i], delim);
    if (findCol(h, GLUCOSE_KEYS) >= 0 && (findCol(h, TIME_KEYS) >= 0 || findCol(h, DATE_KEYS) >= 0)) { hi = i; header = h; break; }
  }
  if (hi < 0) return { entries: [], detected: { ...detected, error: 'no glucose/time columns found' } };

  // pick the glucose column with the most numeric values among matching candidates
  const rows = lines.slice(hi + 1).map(l => splitLine(l, delim));
  const candidates = [];
  header.forEach((h, i) => { if (GLUCOSE_KEYS.some(p => p.test(h)) && !/scan|strip|insulin|carb|meal|target|ziel|objetivo/i.test(h)) candidates.push(i); });
  const numeric = v => { const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };
  let gi = candidates[0], best = -1;
  for (const c of candidates) { const n = rows.reduce((a, r) => a + (numeric(r[c]) != null ? 1 : 0), 0); if (n > best) { best = n; gi = c; } }
  const ti = findCol(header, TIME_KEYS), di = findCol(header, DATE_KEYS), ci = findCol(header, CLOCK_KEYS), typ = findCol(header, TYPE_KEYS);
  detected.glucoseColumn = header[gi]; detected.timeColumn = ti >= 0 ? header[ti] : `${header[di]} + ${header[ci]}`;

  // units
  const vals = rows.map(r => numeric(r[gi])).filter(v => v != null);
  let mmol = /mmol/i.test(header[gi]) ? true : /mg/i.test(header[gi]) ? false : null;
  if (mmol == null) { const sorted = [...vals].sort((a, b) => a - b); mmol = sorted[Math.floor(sorted.length / 2)] < 35; }
  detected.units = mmol ? 'mmol/L' : 'mg/dL';

  // day/month order
  const stamps = rows.map(r => ti >= 0 ? r[ti] : `${r[di]} ${r[ci]}`);
  let order = /AM|PM/i.test(stamps.slice(0, 50).join(' ')) ? 'MDY' : 'DMY';
  for (const s of stamps.slice(0, 2000)) {
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/.exec(String(s).trim());
    if (m) { if (+m[1] > 12) { order = 'DMY'; break; } if (+m[2] > 12) { order = 'MDY'; break; } }
  }
  detected.dateOrder = order;

  const entries = [];
  for (let k = 0; k < rows.length; k++) {
    const r = rows[k];
    if (typ >= 0 && /^(1|scan|calibration|insulin|carbs|alert|event)/i.test(r[typ] || '') && !/^egv$/i.test(r[typ] || '')) {
      if (!/^0$|^egv$|sensor/i.test(r[typ] || '')) continue;
    }
    let v = numeric(r[gi]);
    if (v == null) { if (/^low$/i.test(r[gi] || '')) v = mmol ? 2.2 : 40; else if (/^high$/i.test(r[gi] || '')) v = mmol ? 22.2 : 400; else continue; }
    const date = parseDateTime(stamps[k], order, tzOffsetMin);
    if (!date) continue;
    const sgv = Math.round(mmol ? v * 18.0182 : v);
    if (sgv < 20 || sgv > 600) continue;
    entries.push({ type: 'sgv', date, sgv, device: 'CSV import' });
  }
  detected.rows = entries.length;
  return { entries, detected };
}

module.exports = { parseCsv, parseDateTime };
