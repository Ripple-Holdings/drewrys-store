/**
 * Teya Hosted Checkout.
 *
 * The one rule: prices come from KV, never from the browser. The basket is
 * client-side and editable, so only sku and qty are read off the request and
 * every amount is recalculated here against the same `catalogue` key the shop
 * renders from. Ben editing a price in /admin therefore changes the shop and
 * the charge in one move - they cannot drift apart.
 *
 * UNVERIFIED until staging credentials exist: the exact request field names,
 * whether Authorization is Bearer or Basic, and the webhook signature header.
 * All three are isolated below so they are one-line changes.
 */

import { DEFAULT_CATALOGUE } from './catalogue-default.js';
import { DEFAULT_INGREDIENTS } from './ingredients.js';
import { DEFAULT_ZONES, DEFAULT_METHODS, resolveZone, resolveMethod } from './shipping.js';
import { countryByCode } from './countries.js';

const API = {
  staging: 'https://api.teya.xyz',
  production: 'https://api.teya.com',
};

export const DEFAULT_SETTINGS = {
  zones: DEFAULT_ZONES,
  shipping_methods: DEFAULT_METHODS,
  free_over: {},                    // zone id -> pence, absent or 0 = no threshold
  collect_address: '',
  promos: { DREWRYS10: 10, PAIRED10: 10 },
};

/**
 * Older saves stored `image_key` ('clay') rather than a resolved `image`
 * path. Derive the path on read so an existing KV catalogue keeps working
 * and the next save writes it in the current shape. Without this a save
 * would blank every image rather than migrate it.
 */
function normalise(cat) {
  const products = (cat && Array.isArray(cat.products) ? cat.products : []).map((p) => ({
    ...p,
    image: p.image || (p.image_key ? `/img/product-${p.image_key}.png` : ''),
  }));
  return { ...cat, products };
}

export async function getCatalogue(env) {
  const raw = await env.DREWRYS_KV.get('catalogue');
  if (!raw) return normalise(DEFAULT_CATALOGUE);      // first run, before any save
  try { return normalise(JSON.parse(raw)); } catch { return normalise(DEFAULT_CATALOGUE); }
}

/** The ingredient library: icons and write-ups, shared across products. */
export async function getIngredients(env) {
  const raw = await env.DREWRYS_KV.get('ingredients');
  if (!raw) return DEFAULT_INGREDIENTS;
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length ? list : DEFAULT_INGREDIENTS;
  } catch { return DEFAULT_INGREDIENTS; }
}

export async function getSettings(env) {
  const raw = await env.DREWRYS_KV.get('settings');
  if (!raw) return DEFAULT_SETTINGS;
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; } catch { return DEFAULT_SETTINGS; }
}

export async function getStock(env, slug) {
  const v = await env.DREWRYS_KV.get(`stock:${slug}`);
  if (v === null || v === '') return null;   // null = unlimited
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/** Recompute the whole basket server-side. Throws on an unusable request. */
export async function priceBasket(env, payload) {
  const cat = await getCatalogue(env);
  const settings = await getSettings(env);
  const bySlug = Object.fromEntries(cat.products.map((p) => [p.slug, p]));

  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const items = [];
  let subtotal = 0;

  for (const line of lines) {
    const p = bySlug[String(line.sku)];
    if (!p || p.active === false) continue;
    const qty = Math.max(1, Math.min(99, parseInt(line.qty, 10) || 0));
    if (!qty) continue;

    const stock = await getStock(env, p.slug);
    if (stock !== null && stock <= 0) continue;               // sold out
    const take = stock === null ? qty : Math.min(qty, stock); // never oversell

    subtotal += p.price_pence * take;
    items.push({ sku: p.slug, name: p.name, quantity: take, unit_amount: p.price_pence,
                 size: p.size || '', image: p.image || '' });
  }
  if (!items.length) throw new Error('empty basket');

  const ful = payload.fulfilment === 'deliver' ? 'deliver' : 'collect';

  const code = String(payload.promo || '').toUpperCase();
  const pct = settings.promos[code] || 0;
  const discount = Math.round((subtotal * pct) / 100);

  let shipping = 0;
  let zone = 'collect';
  let country = null;
  let method = null;

  if (ful === 'deliver') {
    // `country` is the ISO code now; `region` is the old zone id, kept so an
    // older cached page cannot fail silently mid-order.
    const z = resolveZone(settings, payload.country || payload.region, payload.postcode);
    if (z.error) throw new Error(z.error);
    zone = z.zone;
    country = z.country;

    const m = resolveMethod(settings, zone, payload.method);
    if (m.error) throw new Error(m.error);
    method = m.method;
    shipping = Math.max(0, parseInt(method.price, 10) || 0);

    // A threshold of 0 or absent means the zone has no free-delivery offer.
    const threshold = (settings.free_over || {})[zone];
    if (threshold && subtotal - discount >= threshold) shipping = 0;
  }

  return {
    items, subtotal, shipping, discount,
    promo: pct ? code : null,
    fulfilment: ful,
    zone,
    country: country ? (countryByCode[country] || {}).name || country : null,
    method: method ? { id: method.id, name: method.name, zone: method.zone } : null,
    total: subtotal - discount + shipping,
  };
}

const clean = (v, n) => String(v || '').trim().slice(0, n);

/**
 * Delivery needs somewhere to send it; collection still needs a way to say
 * "it's ready". Both need an email, because that is where the confirmation
 * and the cancellation rights go.
 */
export function readCustomer(payload, fulfilment) {
  const value = {
    name: clean(payload.name, 120),
    email: clean(payload.email, 160),
    phone: clean(payload.phone, 40),
    line1: clean(payload.line1, 160),
    line2: clean(payload.line2, 160),
    city: clean(payload.city, 80),
    postcode: clean(payload.postcode, 12).toUpperCase(),
    country: (countryByCode[String(payload.country || '').toUpperCase()] || {}).name
             || clean(payload.country, 60),
  };
  value.address = [value.line1, value.line2, value.city, value.postcode, value.country]
    .filter(Boolean).join(', ');

  if (!value.name) return { error: 'Please give us a name for the order.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.email)) {
    return { error: 'Please give us a valid email address.' };
  }
  if (fulfilment === 'deliver') {
    if (!value.line1) return { error: 'Please give us a delivery address.' };
    if (!value.city) return { error: 'Please give us a town or city.' };
    if (!value.postcode) return { error: 'Please give us a postcode.' };
  }
  return { value };
}

export function newReference() {
  return 'DRW-' + Date.now().toString(36).toUpperCase() +
         '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export async function createSession(request, env) {
  const origin = env.SITE_ORIGIN || new URL(request.url).origin;

  let payload;
  try { payload = await request.json(); }
  catch { return json({ error: 'bad json' }, 400); }

  let basket;
  try { basket = await priceBasket(env, payload); }
  catch (e) { return json({ error: String(e.message || e) }, 400); }

  // Without these an order cannot be fulfilled or acknowledged, so they are
  // checked here as well as in the browser.
  const customer = readCustomer(payload, basket.fulfilment);
  if (customer.error) return json({ error: customer.error }, 400);

  if (!env.TEYA_API_KEY || !env.TEYA_STORE_ID) {
    return json({ error: 'payments not configured' }, 503);
  }

  const reference = newReference();

  // Park the order before sending anyone to Teya, so the webhook has
  // something to attach the payment result to.
  await env.DREWRYS_KV.put(`order:${reference}`, JSON.stringify({
    reference, status: 'pending', created: new Date().toISOString(),
    ...basket,
    customer: customer.value,
  }), { expirationTtl: 60 * 60 * 24 * 90 });

  const body = {
    store_id: env.TEYA_STORE_ID,
    amount: { value: basket.total, currency: 'GBP' },
    reference,
    line_items: basket.items.map(({ name, quantity, unit_amount }) => ({ name, quantity, unit_amount })),
    success_url: `${origin}/?paid=1&ref=${reference}`,
    cancel_url: `${origin}/?cancelled=1&ref=${reference}`,
  };

  const base = API[env.TEYA_ENV === 'production' ? 'production' : 'staging'];
  const res = await fetch(`${base}/v2/checkout/sessions`, {
    method: 'POST',
    headers: {
      // CHECK against the credential Ben generates - may be Basic.
      'Authorization': `Bearer ${env.TEYA_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': reference,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('teya session failed', res.status, JSON.stringify(data));
    return json({ error: 'payment setup failed' }, 502);
  }

  const url = data.checkout_url || data.url || data.redirect_url;
  if (!url) {
    console.error('no redirect url from teya', JSON.stringify(data));
    return json({ error: 'payment setup failed' }, 502);
  }

  return json({ url, reference, total: basket.total });
}

export async function verifySignature(raw, sig, secret) {
  if (!secret) return true; // not configured yet - do not hard-fail staging
  if (!sig) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const given = sig.replace(/^sha256=/, '').trim().toLowerCase();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});
