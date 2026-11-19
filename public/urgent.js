'use strict';
/* Emergency help for low and very high glucose, shared by the browser (works with no AI and no
   network) and the server (the numbers directory goes into the AI's instructions).
   Glucose values are mg/dL. Texts come from i18n keys "ur*". */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Urgent = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // Emergency numbers. `amb` is the ambulance, `all` the general emergency number.
  const COUNTRIES = {
    kz: { name: { ru: 'Казахстан', en: 'Kazakhstan', kk: 'Қазақстан' }, amb: '103', all: '112' },
    ru: { name: { ru: 'Россия', en: 'Russia', kk: 'Ресей' }, amb: '103', all: '112' },
    kg: { name: { ru: 'Кыргызстан', en: 'Kyrgyzstan', kk: 'Қырғызстан' }, amb: '103', all: '112' },
    uz: { name: { ru: 'Узбекистан', en: 'Uzbekistan', kk: 'Өзбекстан' }, amb: '103', all: null },
    by: { name: { ru: 'Беларусь', en: 'Belarus', kk: 'Беларусь' }, amb: '103', all: '112' },
    ua: { name: { ru: 'Украина', en: 'Ukraine', kk: 'Украина' }, amb: '103', all: '112' },
    am: { name: { ru: 'Армения', en: 'Armenia', kk: 'Армения' }, amb: '103', all: '112' },
    az: { name: { ru: 'Азербайджан', en: 'Azerbaijan', kk: 'Әзірбайжан' }, amb: '103', all: '112' },
    ge: { name: { ru: 'Грузия', en: 'Georgia', kk: 'Грузия' }, amb: '112', all: null },
    tr: { name: { ru: 'Турция', en: 'Turkey', kk: 'Түркия' }, amb: '112', all: null },
    eu: { name: { ru: 'Европа', en: 'Europe', kk: 'Еуропа' }, amb: '112', all: null },
    gb: { name: { ru: 'Великобритания', en: 'United Kingdom', kk: 'Ұлыбритания' }, amb: '999', all: '112' },
    us: { name: { ru: 'США и Канада', en: 'USA and Canada', kk: 'АҚШ және Канада' }, amb: '911', all: null },
    ae: { name: { ru: 'ОАЭ', en: 'UAE', kk: 'БАӘ' }, amb: '998', all: '999' },
    cn: { name: { ru: 'Китай', en: 'China', kk: 'Қытай' }, amb: '120', all: null },
  };
  // City and country names (lower case, Cyrillic and Latin) → country.
  const PLACES = {
    kz: 'казахстан қазақстан kazakhstan алматы almaty астана astana нур-султан шымкент shymkent караганд қарағанды karaganda актобе ақтөбе aktobe тараз taraz павлодар pavlodar усть-каменогорск өскемен oskemen семей semey атырау atyrau костанай қостанай kostanay кызылорд қызылорда kyzylorda уральск орал oral петропавловск aktau актау ақтау темиртау туркестан түркістан кокшетау көкшетау талдыкорган талдықорған экибастуз жезказган жезқазған',
    ru: 'россия russia москв moscow санкт-петербург петербург спб питер новосибирск екатеринбург казань kazan нижний новгород челябинск самар омск ростов уфа красноярск перм воронеж волгоград краснодар астрахан оренбург саратов тюмен барнаул иркутск владивосток хабаровск',
    kg: 'кыргызстан киргизия kyrgyzstan бишкек bishkek ош osh',
    uz: 'узбекистан uzbekistan ташкент tashkent самарканд бухар',
    by: 'беларус belarus минск minsk гомель брест витебск гродно могилев',
    ua: 'украин ukraine киев київ kyiv kiev харьков одесс днепр львов',
    am: 'армени armenia ереван yerevan', az: 'азербайджан azerbaijan баку baku', ge: 'грузи georgia тбилиси tbilisi батуми',
    tr: 'турци turkey türkiye стамбул istanbul анкар анталь',
    gb: 'англи великобритан united kingdom london лондон', us: 'сша usa америк new york нью-йорк canada канад торонто',
    ae: 'оаэ uae дубай dubai абу-даби', cn: 'китай china пекин beijing шанхай shanghai урумчи',
    eu: 'германи germany берлин франци france париж итали italy испани spain польш poland прага чехи европ europe',
  };
  const ZONES = { kz: /^Asia\/(Almaty|Atyrau|Aqtobe|Aqtau|Oral|Qyzylorda|Qostanay)$/, ru: /^(Europe\/(Moscow|Samara|Volgograd|Kaliningrad|Saratov|Ulyanovsk|Astrakhan|Kirov)|Asia\/(Yekaterinburg|Omsk|Novosibirsk|Barnaul|Krasnoyarsk|Irkutsk|Yakutsk|Vladivostok|Magadan|Kamchatka|Tomsk|Novokuznetsk|Chita|Sakhalin))$/, kg: /^Asia\/Bishkek$/, uz: /^Asia\/(Tashkent|Samarkand)$/, by: /^Europe\/Minsk$/, ua: /^Europe\/(Kyiv|Kiev)$/ };

  function countryFromText(text) {
    const s = ' ' + String(text || '').toLowerCase() + ' ';
    for (const [code, words] of Object.entries(PLACES)) for (const w of words.split(' ')) if (w.length > 2 && s.includes(w)) return code;
    return null;
  }
  function countryFromZone(tz) { for (const [code, rx] of Object.entries(ZONES)) if (rx.test(tz || '')) return code; return null; }
  function numbers(code) { const c = COUNTRIES[code]; return c ? [c.amb, c.all].filter(Boolean) : ['103', '112']; }

  const RX = {
    critical: /без сознани|потерял[аи]? сознани|не отвеча|не реагир|судорог|не может глотать|не глотает|обморок|отключил|не просыпа|unconscious|not responding|seizure|fit\b|can'?t swallow|fainted|passed out|есінен|ес-түссіз|талма|тырыс/i,
    panic: /паник|страшн|боюсь|испуг|помогите|срочно|ужас|не знаю что делать|что делать\?*!|!!|panic|scared|afraid|help|urgent|qorq|қорқ|көмектес|шұғыл/i,
    stuck: /не поднима|не раст|не повыша|всё ещё низк|все еще низк|по-прежнему низк|не помога|снова упал|опять упал|долго не|уже час|полчаса|still low|not rising|won'?t (go )?up|doesn'?t (go )?up|not going up|көтерілмей/i,
    low: /низк|упал|падает|гипо|hypo|\blow\b|dropp|falling|төмен|түсіп/i,
    high: /высок|кетон|ацетон|рвот|тошн|high|ketone|vomit|nause|жоғары|құс/i,
    ketones: /кетон|ацетон|ketone|рвот|vomit|құс/i,
    now: /сейчас|now|қазір/i,
    gave: /дал[аи]? (сок|сахар|углевод|глюкоз)|съел|выпил|ate|drank|gave (juice|sugar|carbs)|ішті|жеді/i,
  };

  // A glucose value written in the question, in mg/dL. "2,1" / "2.1" in mmol units, "38" in mg/dL.
  function parseValue(q, mmolUnits) {
    const m = String(q).match(/(\d{1,3}(?:[.,]\d)?)\s*(ммоль|mmol|мг|mg)?/gi);
    if (!m) return null;
    for (const raw of m) {
      const x = raw.match(/(\d{1,3}(?:[.,]\d)?)\s*(ммоль|mmol|мг|mg)?/i);
      const n = parseFloat(x[1].replace(',', '.')), unit = (x[2] || '').toLowerCase();
      if (unit.startsWith('мг') || unit.startsWith('mg')) { if (n >= 15 && n <= 600) return n; continue; }
      if (unit.startsWith('ммоль') || unit.startsWith('mmol') || mmolUnits) { if (n >= 0.5 && n <= 35) return Math.round(n * 18.0182); continue; }
      if (n >= 15 && n <= 600) return n;
    }
    return null;
  }

  // Decide whether the message is an emergency and build the reply.
  // ctx: { t(key, vars), g(mg) -> string, unit, mmol, reading: {v, t, dir} | null, now, state, tz, lang }
  // state (kept by the caller between messages): { cycles, country, askedCity, startedAt }
  // Returns null, or { text, actions: [{kind, label, tel}], level, state }.
  function assess(q, ctx) {
    const { t, g } = ctx;
    const st = Object.assign({ cycles: 0, country: null, askedCity: false, startedAt: 0 }, ctx.state || {});
    const fromText = countryFromText(q);
    if (fromText) st.country = fromText;
    const cityReply = fromText && st.askedCity && !RX.low.test(q) && !RX.critical.test(q);

    const fresh = ctx.reading && ctx.now - ctx.reading.t < 20 * 60e3 ? ctx.reading : null;
    let v = parseValue(q, ctx.mmol);
    const usedSensor = v == null && fresh && (ctx.force || RX.now.test(q) || RX.low.test(q) || RX.stuck.test(q) || RX.critical.test(q) || cityReply);
    if (usedSensor) v = fresh.v;

    const critical = RX.critical.test(q);
    // A follow-up within an episode that is still open (the last 3 hours).
    const followUp = st.startedAt && ctx.now - st.startedAt < 3 * 3600e3;
    if (followUp && v != null && v >= 70 && !critical) {
      st.cycles = 0; st.startedAt = 0;
      return { text: t('urRecovered', { v: g(v), u: ctx.unit }), actions: [], level: 'ok', state: st };
    }
    const stuck = RX.stuck.test(q) || (followUp && v != null && v < 70);
    const lowWords = RX.low.test(q);
    // The SOS button (ctx.force) always opens the low-glucose steps; a normal sensor value is then ignored.
    if (ctx.force && v != null && v >= 70) v = null;
    const isLow = v != null ? v < 70 : (stuck || (lowWords && (critical || RX.panic.test(q) || ctx.force)));
    const isDka = RX.ketones.test(q) && (v == null || v > 180) && !isLow;
    const highVal = v != null && v > 250 && RX.high.test(q);
    if (!critical && !isLow && !isDka && !highVal && !cityReply) return null;

    const code = st.country || countryFromZone(ctx.tz);
    const nums = numbers(code);
    const place = st.country ? COUNTRIES[st.country].name[ctx.lang] || COUNTRIES[st.country].name.en : null;
    const call = nums.map(n => ({ kind: 'call', tel: n, label: t('urCall', { n }) }));
    const out = [], actions = [];
    const askCity = () => { if (!st.country) { out.push(t('urAskCity', { nums: nums.join(t('urOr')) })); st.askedCity = true; } else out.push(t('urNumbers', { place, nums: nums.join(t('urOr')) })); };

    if (cityReply && !critical && !isLow && !isDka) {
      out.push(t('urNumbers', { place, nums: nums.join(t('urOr')) }));
      out.push(t('urCityKept'));
      return { text: out.join('\n\n'), actions: call, level: 'info', state: st };
    }
    if (RX.panic.test(q) || critical) out.push(t('urCalm'));

    if (critical) {
      out.push(t('urCritical', { nums: nums.join(t('urOr')) }));
      askCity();
      return { text: out.join('\n\n'), actions: call, level: 'critical', state: st };
    }

    if (isDka || highVal) {
      if (v != null) out.push(t('urHighValue', { v: g(v), u: ctx.unit }));
      out.push(t('urDka', { nums: nums.join(t('urOr')) }));
      askCity();
      return { text: out.join('\n\n'), actions: call, level: 'high', state: st };
    }

    // Low glucose
    if (stuck) st.cycles = Math.max(st.cycles + 1, 1);
    if (!st.startedAt) st.startedAt = ctx.now;
    const longTime = ctx.now - st.startedAt > 40 * 60e3;
    const escalate = stuck && (st.cycles >= 2 || longTime || /час|hour|сағат|долго|30|40|минут/i.test(q));
    if (v != null) {
      out.push(t(v < 54 ? 'urVeryLow' : 'urLow', { v: g(v), u: ctx.unit }) + (usedSensor ? ' ' + t('urFromSensor', { ago: Math.max(1, Math.round((ctx.now - fresh.t) / 60e3)), dir: fresh.dir || '' }) : ''));
    } else if (!followUp) {
      out.push(t('urNoValue'));
    }
    if (escalate) {
      out.push(t('urEscalate', { nums: nums.join(t('urOr')) }));
      askCity();
      out.push(t('urWhileWaiting'));
      return { text: out.join('\n\n'), actions: [...call, { kind: 'timer', label: t('urTimerBtn') }], level: 'critical', state: st };
    }
    out.push(t(stuck ? 'urRepeat' : 'urSteps'));
    out.push(t('urWhenCall', { nums: nums.join(t('urOr')) }));
    if (!st.country && !st.askedCity) { out.push(t('urAskCity', { nums: nums.join(t('urOr')) })); st.askedCity = true; }
    actions.push({ kind: 'timer', label: t('urTimerBtn') }, ...call);
    return { text: out.join('\n\n'), actions, level: v != null && v < 54 ? 'severe' : 'low', state: st };
  }

  // After the 15-minute wait: what the sensor shows now.
  function recheck(ctx) {
    const { t, g } = ctx;
    const st = Object.assign({ cycles: 0 }, ctx.state || {});
    const nums = numbers(st.country || countryFromZone(ctx.tz));
    const r = ctx.reading && ctx.now - ctx.reading.t < 15 * 60e3 ? ctx.reading : null;
    if (!r) return { text: t('urRecheckAsk'), actions: [], state: st };
    if (r.v >= 70) {
      st.cycles = 0; st.startedAt = 0;
      return { text: t('urRecovered', { v: g(r.v), u: ctx.unit }), actions: [], state: st, level: 'ok' };
    }
    st.cycles += 1;
    const text = st.cycles >= 2
      ? [t('urStillLow', { v: g(r.v), u: ctx.unit }), t('urEscalate', { nums: nums.join(t('urOr')) }), t('urWhileWaiting')].join('\n\n')
      : [t('urStillLow', { v: g(r.v), u: ctx.unit }), t('urRepeat'), t('urWhenCall', { nums: nums.join(t('urOr')) })].join('\n\n');
    return { text, actions: [{ kind: 'timer', label: t('urTimerBtn') }, ...nums.map(n => ({ kind: 'call', tel: n, label: t('urCall', { n }) }))], state: st, level: st.cycles >= 2 ? 'critical' : 'low' };
  }

  // A plain list for the AI's instructions.
  function directory() {
    return Object.values(COUNTRIES).map(c => `${c.name.en}: ambulance ${c.amb}${c.all ? `, emergency ${c.all}` : ''}`).join('; ');
  }

  return { assess, recheck, parseValue, countryFromText, countryFromZone, numbers, directory, COUNTRIES };
});
