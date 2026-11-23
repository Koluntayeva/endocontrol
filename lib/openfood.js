'use strict';
// Packaged foods from Open Food Facts (https://openfoodfacts.org), an open database of products
// with their nutrition labels. Data: Open Database License (ODbL); the app shows the source next
// to every result. Only the search words leave the server — nothing about the user.
// Results are kept in memory for a day so the same search is not repeated.

const BASE = process.env.OFF_URL || 'https://world.openfoodfacts.org';
const SEARCH = process.env.OFF_SEARCH_URL || 'https://search.openfoodfacts.org';
const UA = 'EndoControl/1.0 (diabetes diary; open source)';
const cache = new Map();
const DAY = 864e5;

const unent = x => String(x).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(+v) ? +v : null);

// One product → { code, name, brand, c (carbs per 100 g), p, f, serving (g) } or null when the label has no carbs.
function toFood(p, lang) {
  const n = p.nutriments || {};
  const c = num(n.carbohydrates_100g);
  if (c == null || c < 0 || c > 100) return null;
  const name = String(p[`product_name_${lang}`] || p.product_name_ru || p.product_name || p.generic_name || '').trim();
  if (!name) return null;
  const serving = num(p.serving_quantity);
  return {
    code: String(p.code || ''), name: unent(name).slice(0, 80), brand: unent(String(Array.isArray(p.brands) ? p.brands[0] || '' : p.brands || '').split(',')[0].trim()).slice(0, 40),
    c: Math.round(c * 10) / 10, p: num(n.proteins_100g), f: num(n.fat_100g), serving: serving && serving > 0 && serving < 2000 ? serving : null,
  };
}

async function search(q, lang = 'ru', fetchImpl = fetch) {
  const query = String(q || '').trim().slice(0, 60);
  if (query.length < 2) return [];
  const key = lang + '|' + query.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY) return hit.items;
  const fields = 'code,product_name,product_name_ru,product_name_kk,product_name_en,generic_name,brands,nutriments,serving_quantity';
  // the search service first, the classic search as a fallback (it is often busy)
  const urls = [`${SEARCH}/search?q=${encodeURIComponent(query)}&page_size=24&langs=${encodeURIComponent(lang)}&fields=${fields}`,
    `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&lc=${encodeURIComponent(lang)}&fields=${fields}`];
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    let products = null, lastErr = null;
    for (const url of urls) {
      try {
        const r = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctrl.signal });
        if (!r.ok) throw new Error('off_' + r.status);
        const j = await r.json(); products = j.hits || j.products || []; break;
      } catch (e) { lastErr = e; }
    }
    if (!products) throw lastErr || new Error('off_unavailable');
    const seen = new Set(), items = [];
    for (const p of products) {
      const f = toFood(p, lang); if (!f) continue;
      const k = (f.name + '|' + f.brand).toLowerCase(); if (seen.has(k)) continue;
      seen.add(k); items.push(f); if (items.length >= 12) break;
    }
    cache.set(key, { at: Date.now(), items });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return items;
  } finally { clearTimeout(timer); }
}

module.exports = { search, toFood };
