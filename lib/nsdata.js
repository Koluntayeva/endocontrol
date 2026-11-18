'use strict';
// Storage and query helpers that follow the Nightscout v1 REST API data model,
// so existing uploaders (xDrip+, Juggluco, Loop, Trio, Spike, Diabox, …) work unchanged.

const DIRECTIONS = ['NONE', 'DoubleUp', 'SingleUp', 'FortyFiveUp', 'Flat', 'FortyFiveDown', 'SingleDown', 'DoubleDown', 'NOT COMPUTABLE', 'RATE OUT OF RANGE'];

function toMillis(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v < 1e11 ? v * 1000 : v; // seconds -> ms
  if (/^\d+$/.test(String(v))) return toMillis(Number(v));
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}
const num = v => (v === '' || v == null || !Number.isFinite(Number(v))) ? null : Number(v);

// ---- entries -------------------------------------------------------------
function normalizeEntry(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const type = typeof doc.type === 'string' ? doc.type : 'sgv';
  const date = toMillis(doc.date) ?? toMillis(doc.dateString) ?? toMillis(doc.sysTime) ?? toMillis(doc.mills) ?? Date.now();
  if (date > Date.now() + 24 * 3600e3 || date < Date.UTC(2000, 0, 1)) return null; // reject absurd timestamps
  let direction = doc.direction;
  if (typeof doc.trend === 'number' && !direction) direction = DIRECTIONS[doc.trend];
  const e = {
    type, date,
    sgv: num(doc.sgv), mbg: num(doc.mbg),
    direction: typeof direction === 'string' ? direction.slice(0, 32) : null,
    device: typeof doc.device === 'string' ? doc.device.slice(0, 120) : null,
    noise: num(doc.noise), filtered: num(doc.filtered), unfiltered: num(doc.unfiltered), rssi: num(doc.rssi),
    utc_offset: num(doc.utcOffset),
  };
  if (type === 'sgv' && (e.sgv == null || e.sgv < 1 || e.sgv > 1000)) return null;
  if (type === 'mbg' && (e.mbg == null || e.mbg < 1 || e.mbg > 1000)) return null;
  return e;
}

function insertEntries(db, userId, docs, source) {
  const stmt = db.prepare(`INSERT INTO entries (user_id,type,date,sgv,mbg,direction,device,noise,filtered,unfiltered,rssi,utc_offset,source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id,type,date) DO UPDATE SET sgv=excluded.sgv, mbg=excluded.mbg, direction=excluded.direction, device=excluded.device,
      noise=excluded.noise, filtered=excluded.filtered, unfiltered=excluded.unfiltered, rssi=excluded.rssi`);
  const saved = [];
  db.exec('BEGIN');
  try {
    for (const d of docs) {
      const e = normalizeEntry(d);
      if (!e) continue;
      stmt.run(userId, e.type, e.date, e.sgv, e.mbg, e.direction, e.device, e.noise, e.filtered, e.unfiltered, e.rssi, e.utc_offset, source || 'api');
      saved.push(e);
    }
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
  return saved;
}

function formatEntry(r) {
  const o = { _id: String(r.id), type: r.type, date: r.date, dateString: new Date(r.date).toISOString(), sysTime: new Date(r.date).toISOString() };
  for (const k of ['sgv', 'mbg', 'direction', 'device', 'noise', 'filtered', 'unfiltered', 'rssi']) if (r[k] != null) o[k] = r[k];
  if (r.utc_offset != null) o.utcOffset = r.utc_offset;
  return o;
}

// Parses Nightscout-style find[field][$op]=value query parameters.
function parseFind(params) {
  const out = [];
  for (const [k, v] of params) {
    const m = /^find\[([a-zA-Z_]+)\](?:\[\$(gte|gt|lte|lt|eq|ne)\])?$/.exec(k);
    if (m) out.push({ field: m[1], op: m[2] || 'eq', value: v });
  }
  return out;
}
const OPS = { gte: '>=', gt: '>', lte: '<=', lt: '<', eq: '=', ne: '!=' };

function queryEntries(db, userId, params, forcedType) {
  const where = ['user_id = ?'], args = [userId];
  const type = forcedType || params.get('type');
  for (const f of parseFind(params)) {
    if (f.field === 'type') { if (f.op === 'eq') { where.push('type = ?'); args.push(f.value); } continue; }
    if (f.field === 'date' || f.field === 'dateString' || f.field === 'sysTime') {
      const ms = toMillis(f.value); if (ms == null) continue;
      where.push(`date ${OPS[f.op]} ?`); args.push(ms); continue;
    }
    if (f.field === 'sgv' && num(f.value) != null) { where.push(`sgv ${OPS[f.op]} ?`); args.push(num(f.value)); }
  }
  if (type) { where.push('type = ?'); args.push(type); }
  const count = Math.min(Math.max(parseInt(params.get('count') || '10', 10) || 10, 1), 100000);
  args.push(count);
  return db.prepare(`SELECT * FROM entries WHERE ${where.join(' AND ')} ORDER BY date DESC LIMIT ?`).all(...args).map(formatEntry);
}

function entriesRange(db, userId, from, to) {
  return db.prepare('SELECT date, sgv, direction FROM entries WHERE user_id=? AND type=\'sgv\' AND date>=? AND date<? ORDER BY date').all(userId, from, to);
}

// ---- treatments ------------------------------------------------------------
const TREATMENT_CORE = new Set(['_id', 'eventType', 'created_at', 'carbs', 'insulin', 'glucose', 'notes', 'enteredBy', 'date', 'mills', 'timestamp', 'secret', 'token']);
function insertTreatments(db, userId, docs) {
  const stmt = db.prepare(`INSERT INTO treatments (user_id,created_at,event_type,carbs,insulin,glucose,notes,entered_by,extra)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id,created_at,event_type) DO UPDATE SET carbs=excluded.carbs, insulin=excluded.insulin, glucose=excluded.glucose,
      notes=excluded.notes, entered_by=excluded.entered_by, extra=excluded.extra RETURNING id`);
  const saved = [];
  db.exec('BEGIN');
  try {
    for (const d of docs) {
      if (!d || typeof d !== 'object') continue;
      const created = toMillis(d.created_at) ?? toMillis(d.timestamp) ?? toMillis(d.date) ?? toMillis(d.mills) ?? Date.now();
      const eventType = typeof d.eventType === 'string' && d.eventType ? d.eventType.slice(0, 60) : '<none>';
      const extra = {};
      for (const [k, v] of Object.entries(d)) if (!TREATMENT_CORE.has(k)) extra[k] = v;
      const row = stmt.get(userId, created, eventType, num(d.carbs), num(d.insulin), num(d.glucose),
        typeof d.notes === 'string' ? d.notes.slice(0, 2000) : null, typeof d.enteredBy === 'string' ? d.enteredBy.slice(0, 120) : null,
        Object.keys(extra).length ? JSON.stringify(extra).slice(0, 20000) : null);
      saved.push(formatTreatment({ id: row.id, created_at: created, event_type: eventType, carbs: num(d.carbs), insulin: num(d.insulin), glucose: num(d.glucose), notes: d.notes, entered_by: d.enteredBy, extra: JSON.stringify(extra) }));
    }
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
  return saved;
}
function formatTreatment(r) {
  let extra = {};
  try { extra = r.extra ? JSON.parse(r.extra) : {}; } catch { }
  const o = { ...extra, _id: String(r.id), eventType: r.event_type, created_at: new Date(r.created_at).toISOString(), mills: r.created_at };
  if (r.carbs != null) o.carbs = r.carbs;
  if (r.insulin != null) o.insulin = r.insulin;
  if (r.glucose != null) o.glucose = r.glucose;
  if (r.notes) o.notes = r.notes;
  if (r.entered_by) o.enteredBy = r.entered_by;
  return o;
}
function queryTreatments(db, userId, params) {
  const where = ['user_id = ?'], args = [userId];
  for (const f of parseFind(params)) {
    if (f.field === 'created_at' || f.field === 'date' || f.field === 'mills') {
      const ms = toMillis(f.value); if (ms == null) continue;
      where.push(`created_at ${OPS[f.op]} ?`); args.push(ms);
    } else if (f.field === 'eventType' && f.op === 'eq') { where.push('event_type = ?'); args.push(f.value); }
  }
  const count = Math.min(Math.max(parseInt(params.get('count') || '100', 10) || 100, 1), 100000);
  args.push(count);
  return db.prepare(`SELECT * FROM treatments WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).all(...args).map(formatTreatment);
}

// ---- devicestatus ------------------------------------------------------------
function insertDeviceStatus(db, userId, docs) {
  const stmt = db.prepare('INSERT INTO devicestatus (user_id, created_at, data) VALUES (?,?,?)');
  const out = [];
  for (const d of docs) {
    if (!d || typeof d !== 'object') continue;
    const created = toMillis(d.created_at) ?? Date.now();
    const clean = { ...d }; delete clean.secret; delete clean.token;
    const r = stmt.run(userId, created, JSON.stringify(clean).slice(0, 100000));
    out.push({ ...clean, _id: String(r.lastInsertRowid), created_at: new Date(created).toISOString() });
  }
  // keep 30 days of device status
  db.prepare('DELETE FROM devicestatus WHERE user_id=? AND created_at < ?').run(userId, Date.now() - 30 * 864e5);
  return out;
}
function queryDeviceStatus(db, userId, params) {
  const count = Math.min(Math.max(parseInt(params.get('count') || '10', 10) || 10, 1), 10000);
  return db.prepare('SELECT * FROM devicestatus WHERE user_id=? ORDER BY created_at DESC LIMIT ?').all(userId, count)
    .map(r => ({ ...JSON.parse(r.data), _id: String(r.id), created_at: new Date(r.created_at).toISOString() }));
}

// Text format used by some legacy clients (tab separated).
function entriesAsText(list) {
  return list.map(e => [JSON.stringify(e.dateString), e.date, e.sgv ?? e.mbg ?? '', JSON.stringify(e.direction || ''), JSON.stringify(e.device || '')].join('\t')).join('\n');
}

module.exports = { DIRECTIONS, toMillis, insertEntries, queryEntries, entriesRange, insertTreatments, queryTreatments, formatTreatment, insertDeviceStatus, queryDeviceStatus, entriesAsText };
