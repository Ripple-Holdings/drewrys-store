/**
 * Drewrys - discount codes.
 *
 * A code is an object, not a bare percentage:
 *   { code, type ('percent'|'fixed'), amount (percent, or pence for fixed),
 *     active, limit (0 = unlimited), expires ('' or YYYY-MM-DD, inclusive),
 *     stackable, min_spend (pence, 0 = none) }
 *
 * Older saves stored promos as a flat map { CODE: pct }. normalisePromos
 * migrates that shape on read, same pattern as the catalogue's image_key -
 * the migration lives in the READ path so an old save keeps working and the
 * next admin save writes the current shape.
 *
 * Usage counts live in ONE KV key, promo_uses = { CODE: n }, incremented in
 * the webhook when an order is PAID. Applying a code at checkout does not
 * count - an abandoned basket must not burn a use.
 *
 * STACKING RULE, deterministic and order-sensitive: codes are evaluated in
 * the order the customer entered them. The first valid code is accepted; each
 * later code is accepted only if it AND everything already accepted are
 * stackable. A non-stackable code therefore only ever applies alone.
 *
 * MATHS: each percent code is computed on the product subtotal (they do not
 * compound), fixed codes take their face value, and the combined discount is
 * capped at the subtotal so a total can never go negative.
 */

const CODE_RE = /^[A-Z0-9_-]{2,30}$/;

export function cleanPromo(p) {
  const code = String(p.code || '').toUpperCase().trim();
  if (!CODE_RE.test(code)) return null;
  const type = p.type === 'fixed' ? 'fixed' : 'percent';
  let amount = Math.max(0, parseInt(p.amount, 10) || 0);
  if (type === 'percent') amount = Math.min(100, amount);
  return {
    code,
    type,
    amount,
    active: p.active !== false,
    limit: Math.max(0, parseInt(p.limit, 10) || 0),
    expires: /^\d{4}-\d{2}-\d{2}$/.test(String(p.expires || '')) ? p.expires : '',
    stackable: p.stackable === true,
    min_spend: Math.max(0, parseInt(p.min_spend, 10) || 0),
  };
}

/** Settings promos in the current shape, whatever shape was saved. */
export function normalisePromos(settings) {
  const raw = (settings || {}).promos;
  if (Array.isArray(raw)) return raw.map(cleanPromo).filter(Boolean);
  if (raw && typeof raw === 'object') {
    // legacy flat map { CODE: pct }
    return Object.entries(raw)
      .map(([code, pct]) => cleanPromo({ code, type: 'percent', amount: pct }))
      .filter(Boolean);
  }
  return [];
}

export async function getPromoUses(env) {
  try {
    const raw = await env.DREWRYS_KV.get('promo_uses');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** Called from the webhook on a PAID order only. Best effort, never throws. */
export async function incrementUses(env, codes) {
  if (!codes || !codes.length) return;
  try {
    const uses = await getPromoUses(env);
    for (const c of codes) uses[c] = (uses[c] || 0) + 1;
    await env.DREWRYS_KV.put('promo_uses', JSON.stringify(uses));
  } catch (e) { console.warn('promo uses not counted', e.message); }
}

/**
 * Evaluate a list of entered codes against the live promo set.
 * Pure - takes uses and now so it can be tested without KV or a clock.
 * Returns { applied: [{code, type, amount, discount, label}],
 *           rejected: [{code, reason}], discount }.
 */
export function evaluatePromos(promos, uses, codes, subtotal, now = Date.now()) {
  const byCode = Object.fromEntries(promos.map((p) => [p.code, p]));
  const today = new Date(now).toISOString().slice(0, 10);
  const applied = [];
  const rejected = [];
  const seen = new Set();

  for (const rawCode of codes || []) {
    const code = String(rawCode || '').toUpperCase().trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);

    const p = byCode[code];
    if (!p) { rejected.push({ code, reason: 'That code is not recognised' }); continue; }
    if (!p.active) { rejected.push({ code, reason: 'That code is no longer active' }); continue; }
    if (p.expires && today > p.expires) {
      rejected.push({ code, reason: 'That code has expired' }); continue;
    }
    if (p.limit > 0 && (uses[code] || 0) >= p.limit) {
      rejected.push({ code, reason: 'That code has reached its usage limit' }); continue;
    }
    if (p.min_spend > 0 && subtotal < p.min_spend) {
      rejected.push({
        code,
        reason: `That code needs a minimum spend of £${(p.min_spend / 100).toFixed(2)}`,
      });
      continue;
    }
    if (applied.length && !(p.stackable && applied.every((a) => a.stackable))) {
      rejected.push({
        code,
        reason: `That code cannot be combined with ${applied.map((a) => a.code).join(', ')}`,
      });
      continue;
    }

    const discount = p.type === 'fixed'
      ? Math.min(p.amount, subtotal)
      : Math.round((subtotal * p.amount) / 100);
    applied.push({
      code,
      type: p.type,
      amount: p.amount,
      stackable: p.stackable,
      discount,
      label: p.type === 'fixed'
        ? `£${(p.amount / 100).toFixed(2)} off`
        : `${p.amount}% off`,
    });
  }

  const discount = Math.min(subtotal, applied.reduce((n, a) => n + a.discount, 0));
  // strip the internal stackable flag from what goes back to the browser
  return {
    applied: applied.map(({ stackable, ...a }) => a),
    rejected,
    discount,
  };
}
