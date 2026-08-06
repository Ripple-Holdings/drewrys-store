/**
 * Drewrys - reporting.
 *
 * Two jobs:
 *   1. count visits, in the Worker rather than with a browser script, so an
 *      ad blocker cannot hide them and no third party is involved
 *   2. mirror every paid order into D1, so sales history is complete instead
 *      of being whatever survives in KV's last-50 list
 *
 * WHY THERE ARE FIVE ROLLUP TABLES
 * A visitor is counted once per DAY, not once per page. Summing a per-path
 * table to get "visitors" counts the same person once for every page they
 * opened - home, shop, cart, checkout, back is one visitor, not five. So each
 * dimension that needs a visitor number gets its own table with its own
 * COUNT(DISTINCT visitor):
 *
 *   hit            raw, 7 days. The only table with timestamps.
 *   day_total      whole-day totals. Feeds the daily chart and the KPIs.
 *   hour_total     per hour of day. Feeds the "Time of day" view.
 *   path_total     per path. Feeds the checkout funnel.
 *   country_total  per country. Feeds the country card.
 *
 * The last three exist because `hit` prunes at 7 days. Anything not rolled up
 * before then is gone permanently - visit data cannot be reconstructed after
 * the fact the way an order can.
 *
 * D1 free tier is 5GB, 100k rows written a day and 5M read, and it returns
 * hard errors past those. Every write here is best effort and wrapped, and
 * recordHit is called through ctx.waitUntil, so a page can never fail because
 * of analytics.
 */

const DAY = 86400000;
const HIT_DAYS = 7;          // raw hits
const ROLL_DAYS = 396;       // 13 months of rolled-up figures

/* ── helpers ─────────────────────────────────────────────────────────────── */

export const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const shift = (day, n) => dayKey(new Date(day + 'T00:00:00Z').getTime() + n * DAY);
const todayKey = () => dayKey(Date.now());

/** Paths that are not the website: admin, APIs, media, assets. */
function countable(path) {
  if (!path || path[0] !== '/') return false;
  if (/^\/(admin|api|media|webhook|create-session|review)\b/.test(path)) return false;
  if (/\.(png|jpe?g|svg|webp|ico|css|js|woff2?|ttf|map|txt|xml)$/i.test(path)) return false;
  return true;
}

const BOT = /bot|crawl|spider|slurp|bing|yandex|baidu|duckduck|facebookexternal|headless|lighthouse|curl|wget|python-requests|monitor|uptime|pingdom|semrush|ahrefs|preview/i;

/**
 * A visitor is a hash of IP + user agent + a salt that rotates daily, cut to
 * 8 bytes. The same person all day is one visitor; the same person tomorrow is
 * a different one, so nothing is linkable across days and nothing identifying
 * is stored.
 */
async function visitorHash(request, env, day) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  const ua = request.headers.get('user-agent') || '';
  const salt = env.ANALYTICS_SALT || 'drewrys';
  const data = new TextEncoder().encode(`${ip}|${ua}|${salt}|${day}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf).slice(0, 8)]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ── schema ──────────────────────────────────────────────────────────────── */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS hit (
     ts INTEGER NOT NULL, day TEXT NOT NULL, hour INTEGER NOT NULL,
     path TEXT NOT NULL, country TEXT, visitor TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS hit_day ON hit(day)`,

  `CREATE TABLE IF NOT EXISTS day_total (
     day TEXT PRIMARY KEY, views INTEGER NOT NULL, visitors INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS hour_total (
     day TEXT NOT NULL, hour INTEGER NOT NULL,
     views INTEGER NOT NULL, visitors INTEGER NOT NULL,
     PRIMARY KEY (day, hour))`,
  `CREATE TABLE IF NOT EXISTS path_total (
     day TEXT NOT NULL, path TEXT NOT NULL,
     views INTEGER NOT NULL, visitors INTEGER NOT NULL,
     PRIMARY KEY (day, path))`,
  `CREATE TABLE IF NOT EXISTS country_total (
     day TEXT NOT NULL, country TEXT NOT NULL,
     views INTEGER NOT NULL, visitors INTEGER NOT NULL,
     PRIMARY KEY (day, country))`,

  `CREATE TABLE IF NOT EXISTS ord (
     reference TEXT PRIMARY KEY, ts INTEGER NOT NULL, day TEXT NOT NULL,
     hour INTEGER NOT NULL, total INTEGER NOT NULL, subtotal INTEGER NOT NULL,
     delivery INTEGER NOT NULL, discount INTEGER NOT NULL, promo TEXT,
     fulfilment TEXT, country TEXT)`,
  `CREATE INDEX IF NOT EXISTS ord_day ON ord(day)`,

  `CREATE TABLE IF NOT EXISTS ord_item (
     reference TEXT NOT NULL, sku TEXT NOT NULL, name TEXT,
     qty INTEGER NOT NULL, line INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS ord_item_ref ON ord_item(reference)`,

  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`,
];

// Keyed on the binding rather than held in one module-level boolean, so a
// second database (a test harness, or a staging binding) still gets its schema
// built instead of inheriting the first one's "already done".
const built = new WeakSet();

export async function ensureSchema(env) {
  if (!env.DB) return false;
  if (built.has(env.DB)) return true;
  for (const sql of SCHEMA) await env.DB.prepare(sql).run();
  built.add(env.DB);
  return true;
}

/** First day anything was recorded. Drives the "tracking started" copy. */
async function firstDay(env) {
  const row = await env.DB.prepare(
    `SELECT v FROM meta WHERE k = 'first_day'`).first();
  return row ? row.v : null;
}

async function noteFirstDay(env, day) {
  await env.DB.prepare(
    `INSERT INTO meta (k, v) VALUES ('first_day', ?)
     ON CONFLICT(k) DO NOTHING`).bind(day).run();
}

/* ── collection ──────────────────────────────────────────────────────────── */

/**
 * Record one page view. Never throws - a failure here must not cost a sale.
 */
export async function recordHit(request, env, path) {
  if (!env.DB) return;
  if (!countable(path)) return;
  const ua = request.headers.get('user-agent') || '';
  if (!ua || BOT.test(ua)) return;

  try {
    await ensureSchema(env);
    const now = Date.now();
    const day = dayKey(now);
    const visitor = await visitorHash(request, env, day);
    const country = request.headers.get('cf-ipcountry') || 'XX';
    await env.DB.prepare(
      `INSERT INTO hit (ts, day, hour, path, country, visitor)
       VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(now, day, new Date(now).getUTCHours(), path.slice(0, 120), country, visitor)
      .run();
    await noteFirstDay(env, day);
  } catch (e) {
    console.warn('recordHit failed', e.message);
  }
}

/**
 * Mirror a paid order. KV keeps the order itself; this is the reporting copy,
 * and it is what makes revenue history survive KV's 50-order recent list.
 */
export async function mirrorOrder(env, order) {
  if (!env.DB || !order || !order.reference) return;
  try {
    await ensureSchema(env);
    const ts = Date.parse(order.settled || order.created || '') || Date.now();
    const day = dayKey(ts);
    const items = order.items || [];
    const subtotal = items.reduce((s, i) => s + (i.line ?? (i.unit_price || 0) * (i.quantity || 0)), 0);

    await env.DB.prepare(
      `INSERT INTO ord (reference, ts, day, hour, total, subtotal, delivery,
                        discount, promo, fulfilment, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(reference) DO UPDATE SET
         total = excluded.total, subtotal = excluded.subtotal,
         delivery = excluded.delivery, discount = excluded.discount`)
      .bind(
        order.reference, ts, day, new Date(ts).getUTCHours(),
        Math.round(order.total || 0), Math.round(subtotal),
        Math.round(order.delivery || 0), Math.round(order.discount || 0),
        order.promo || null, order.fulfilment || 'delivery',
        order.customer?.country || null,
      ).run();

    await env.DB.prepare(`DELETE FROM ord_item WHERE reference = ?`)
      .bind(order.reference).run();
    for (const i of items) {
      await env.DB.prepare(
        `INSERT INTO ord_item (reference, sku, name, qty, line)
         VALUES (?, ?, ?, ?, ?)`)
        .bind(order.reference, i.sku || '', i.name || '',
              Math.max(0, i.quantity || 0),
              Math.round(i.line ?? (i.unit_price || 0) * (i.quantity || 0)))
        .run();
    }
    await noteFirstDay(env, day);
  } catch (e) {
    console.warn('mirrorOrder failed', e.message);
  }
}

/* ── rollup ──────────────────────────────────────────────────────────────── */

const ROLLUPS = [
  ['day_total', null],
  ['hour_total', 'hour'],
  ['path_total', 'path'],
  ['country_total', 'country'],
];

/**
 * Recompute the rollups for one day from `hit`. Idempotent, so re-running it
 * for a day already rolled up is safe and is how a partial day gets corrected.
 */
export async function rollupDay(env, day) {
  for (const [table, col] of ROLLUPS) {
    await env.DB.prepare(`DELETE FROM ${table} WHERE day = ?`).bind(day).run();
    const sql = col
      ? `INSERT INTO ${table} (day, ${col}, views, visitors)
         SELECT day, ${col}, COUNT(*), COUNT(DISTINCT visitor)
         FROM hit WHERE day = ? GROUP BY day, ${col}`
      : `INSERT INTO ${table} (day, views, visitors)
         SELECT day, COUNT(*), COUNT(DISTINCT visitor)
         FROM hit WHERE day = ? GROUP BY day`;
    await env.DB.prepare(sql).bind(day).run();
  }
}

/**
 * Nightly. Rolls up every day still present in `hit` (at most seven, so this
 * stays cheap and self-heals a night the cron missed), then prunes.
 */
export async function rollupAndPrune(env) {
  if (!env.DB) return { skipped: 'no D1 binding' };
  await ensureSchema(env);

  const { results } = await env.DB.prepare(
    `SELECT DISTINCT day FROM hit ORDER BY day`).all();
  const days = (results || []).map((r) => r.day);
  for (const day of days) await rollupDay(env, day);

  // Inclusive of today, so -(N - 1) keeps exactly N days. Using -N kept N + 1.
  const hitCut = shift(todayKey(), -(HIT_DAYS - 1));
  const rollCut = shift(todayKey(), -(ROLL_DAYS - 1));
  await env.DB.prepare(`DELETE FROM hit WHERE day < ?`).bind(hitCut).run();
  for (const [table] of ROLLUPS) {
    await env.DB.prepare(`DELETE FROM ${table} WHERE day < ?`).bind(rollCut).run();
  }
  return { rolled: days.length, hitCut, rollCut };
}

/* ── queries ─────────────────────────────────────────────────────────────── */

/**
 * Rollups are authoritative for every day EXCEPT today, which is still being
 * written to and is computed live from `hit`. That keeps the dashboard current
 * without writing on every read.
 */
async function visitSeries(env, table, col, from, to) {
  const today = todayKey();
  const rows = [];
  const rolledTo = to >= today ? shift(today, -1) : to;

  if (from <= rolledTo) {
    const sql = col
      ? `SELECT day, ${col} AS k, views, visitors FROM ${table}
         WHERE day >= ? AND day <= ? ORDER BY day`
      : `SELECT day, '' AS k, views, visitors FROM ${table}
         WHERE day >= ? AND day <= ? ORDER BY day`;
    const r = await env.DB.prepare(sql).bind(from, rolledTo).all();
    rows.push(...(r.results || []));
  }

  if (to >= today && from <= today) {
    const sql = col
      ? `SELECT day, ${col} AS k, COUNT(*) AS views,
                COUNT(DISTINCT visitor) AS visitors
         FROM hit WHERE day = ? GROUP BY ${col}`
      : `SELECT day, '' AS k, COUNT(*) AS views,
                COUNT(DISTINCT visitor) AS visitors
         FROM hit WHERE day = ?`;
    const r = await env.DB.prepare(sql).bind(today).all();
    rows.push(...(r.results || []).filter((x) => x.views > 0));
  }
  return rows;
}

const RANGES = {
  today: { days: 1, label: 'today' },
  '7d': { days: 7, label: 'last 7 days' },
  '30d': { days: 30, label: 'last 30 days' },
  '12m': { days: 365, label: 'last 12 months' },
};

/** Fill every day in a window so a chart has no gaps. */
function spine(from, to) {
  const out = [];
  let d = from;
  let guard = 0;
  while (d <= to && guard++ < 400) { out.push(d); d = shift(d, 1); }
  return out;
}

function isoWeek(day) {
  const d = new Date(day + 'T00:00:00Z');
  const n = (d.getUTCDay() + 6) % 7;          // Monday = 0
  d.setUTCDate(d.getUTCDate() - n);
  return dayKey(d.getTime());
}

async function orderRows(env, from, to) {
  const r = await env.DB.prepare(
    `SELECT reference, ts, day, hour, total, subtotal, delivery, discount,
            promo, fulfilment
     FROM ord WHERE day >= ? AND day <= ? ORDER BY ts`).bind(from, to).all();
  return r.results || [];
}

function sum(rows, f) { return rows.reduce((s, r) => s + (f(r) || 0), 0); }

/**
 * Everything the dashboard needs for one range, plus the same figures for the
 * period immediately before it so the change badges have something to compare
 * against. `has_previous` is false when that earlier window starts before
 * tracking began, and the UI hides the badges rather than showing -100%.
 */
export async function dashboardData(env, rangeId, salesView, visitorsView) {
  if (!env.DB) return { enabled: false };
  await ensureSchema(env);

  const range = RANGES[rangeId] || RANGES['30d'];
  const to = todayKey();
  const from = shift(to, -(range.days - 1));
  const prevTo = shift(from, -1);
  const prevFrom = shift(prevTo, -(range.days - 1));

  const started = await firstDay(env);
  const daysTracked = started
    ? Math.round((Date.parse(to) - Date.parse(started)) / DAY) + 1 : 0;
  const hasPrevious = !!started && prevFrom >= started;

  /* orders */
  const cur = await orderRows(env, from, to);
  const prev = hasPrevious ? await orderRows(env, prevFrom, prevTo) : [];

  const revenue = sum(cur, (r) => r.total);
  const prevRevenue = sum(prev, (r) => r.total);

  /* sales series */
  let salesKeys = [];
  let salesOf = () => '';
  if (salesView === 'hour') {
    salesKeys = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    salesOf = (r) => String(r.hour).padStart(2, '0');
  } else if (salesView === 'week') {
    salesKeys = [...new Set(spine(from, to).map(isoWeek))];
    salesOf = (r) => isoWeek(r.day);
  } else {
    salesKeys = spine(from, to);
    salesOf = (r) => r.day;
  }
  const bucket = (rows, keys, of) => {
    const m = Object.fromEntries(keys.map((k) => [k, { revenue: 0, orders: 0 }]));
    for (const r of rows) { const k = of(r); if (m[k]) { m[k].revenue += r.total; m[k].orders += 1; } }
    return keys.map((k) => ({ key: k, ...m[k] }));
  };
  const salesNow = bucket(cur, salesKeys, salesOf);
  // Deliberately EMPTY when there is no earlier period. Bucketing an empty
  // list would return a full spine of zeros, and the chart would draw a flat
  // dashed line along the axis that reads as real data sitting at nil.
  const prevKeys = salesView === 'hour' ? salesKeys
    : salesView === 'week' ? [...new Set(spine(prevFrom, prevTo).map(isoWeek))]
      : spine(prevFrom, prevTo);
  const salesPrev = hasPrevious
    ? bucket(prev, prevKeys, salesOf).map((x) => x.revenue) : [];

  /* visitors */
  const dayRows = await visitSeries(env, 'day_total', null, from, to);
  const dayMap = Object.fromEntries(dayRows.map((r) => [r.day, r]));
  const dailySpine = spine(from, to);
  let visitors = [];
  if (visitorsView === 'hour') {
    const hr = await visitSeries(env, 'hour_total', 'hour', from, to);
    const m = {};
    for (const r of hr) {
      const k = String(r.k).padStart(2, '0');
      m[k] = m[k] || { views: 0, visitors: 0 };
      m[k].views += r.views; m[k].visitors += r.visitors;
    }
    visitors = Array.from({ length: 24 }, (_, i) => {
      const k = String(i).padStart(2, '0');
      return { key: k, label: k + ':00', views: m[k]?.views || 0, visitors: m[k]?.visitors || 0 };
    });
  } else if (visitorsView === 'dow') {
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const m = names.map(() => ({ views: 0, visitors: 0 }));
    for (const d of dailySpine) {
      const r = dayMap[d]; if (!r) continue;
      const i = (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7;
      m[i].views += r.views; m[i].visitors += r.visitors;
    }
    visitors = names.map((n, i) => ({ key: n, label: n, ...m[i] }));
  } else {
    visitors = dailySpine.map((d) => ({
      key: d, label: d,
      views: dayMap[d]?.views || 0, visitors: dayMap[d]?.visitors || 0,
    }));
  }

  const visitorsTotal = dailySpine.reduce((s, d) => s + (dayMap[d]?.visitors || 0), 0);
  const todayRow = dayMap[to];

  /* countries */
  const cRows = await visitSeries(env, 'country_total', 'country', from, to);
  const cMap = {};
  for (const r of cRows) {
    cMap[r.k] = (cMap[r.k] || 0) + r.visitors;
  }
  const countries = Object.entries(cMap)
    .map(([code, n]) => ({ code, visitors: n }))
    .sort((a, b) => b.visitors - a.visitors).slice(0, 6);

  /* funnel - visits, reached checkout, paid */
  const pRows = await visitSeries(env, 'path_total', 'path', from, to);
  let checkoutVisitors = 0;
  for (const r of pRows) if (r.k === '/checkout') checkoutVisitors += r.visitors;

  /* fulfilment split */
  const collect = cur.filter((r) => r.fulfilment === 'collect').length;

  /* best sellers */
  const bs = await env.DB.prepare(
    `SELECT i.sku, MAX(i.name) AS name, SUM(i.qty) AS units, SUM(i.line) AS revenue
     FROM ord_item i JOIN ord o ON o.reference = i.reference
     WHERE o.day >= ? AND o.day <= ?
     GROUP BY i.sku ORDER BY units DESC LIMIT 6`).bind(from, to).all();
  let bsPrev = {};
  if (hasPrevious) {
    const p = await env.DB.prepare(
      `SELECT i.sku, SUM(i.qty) AS units FROM ord_item i
       JOIN ord o ON o.reference = i.reference
       WHERE o.day >= ? AND o.day <= ? GROUP BY i.sku`).bind(prevFrom, prevTo).all();
    bsPrev = Object.fromEntries((p.results || []).map((r) => [r.sku, r.units]));
  }

  /* discount codes */
  const codes = await env.DB.prepare(
    `SELECT promo AS code, COUNT(*) AS uses, SUM(discount) AS saved
     FROM ord WHERE day >= ? AND day <= ? AND promo IS NOT NULL AND promo != ''
     GROUP BY promo ORDER BY uses DESC LIMIT 6`).bind(from, to).all();

  const pct = (now, before) =>
    (!hasPrevious || !before) ? null : Math.round(((now - before) / before) * 1000) / 10;

  return {
    enabled: true,
    range: rangeId,
    range_label: range.label,
    from, to,
    tracking_started: started,
    days_tracked: daysTracked,
    has_previous: hasPrevious,
    kpis: {
      revenue,
      orders: cur.length,
      aov: cur.length ? Math.round(revenue / cur.length) : 0,
      visitors_today: todayRow ? todayRow.visitors : 0,
      revenue_change: pct(revenue, prevRevenue),
      orders_change: pct(cur.length, prev.length),
      aov_change: pct(cur.length ? revenue / cur.length : 0,
        prev.length ? prevRevenue / prev.length : 0),
    },
    sales: { view: salesView, points: salesNow, previous: salesPrev },
    visitors: { view: visitorsView, points: visitors, total: visitorsTotal },
    countries,
    funnel: {
      visits: visitorsTotal,
      checkout: checkoutVisitors,
      paid: cur.length,
    },
    fulfilment: { collect, delivery: cur.length - collect },
    best_sellers: (bs.results || []).map((r) => ({
      ...r,
      trend: hasPrevious && bsPrev[r.sku]
        ? Math.round(((r.units - bsPrev[r.sku]) / bsPrev[r.sku]) * 1000) / 10 : null,
    })),
    codes: codes.results || [],
  };
}
