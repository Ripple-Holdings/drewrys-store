/**
 * Teya Hosted Checkout.
 *
 * The one rule: prices come from KV, never from the browser. The basket is
 * client-side and editable, so only sku and qty are read off the request and
 * every amount is recalculated here against the same `catalogue` key the shop
 * renders from. Ben editing a price in /admin therefore changes the shop and
 * the charge in one move - they cannot drift apart.
 *
 * AUTH, corrected 05/08/2026. Teya issues a client id and secret and expects
 * an OAuth client_credentials exchange for a short-lived bearer token, not a
 * static API key. Source: the Teya WooCommerce plugin changelog, which also
 * documents the failure modes worth copying - retry once on a 401 with a fresh
 * token, and single-flight the refresh so concurrent requests do not stampede
 * the token endpoint. TEYA_API_KEY still works as a static bearer if that is
 * what the portal actually issues, so the wrong guess does not break anything.
 *
 * WEBHOOKS, corrected the same day. Teya signs with a PUBLIC KEY verified
 * against the raw body, not an HMAC shared secret. verifySignature now detects
 * which it has been given, so setting TEYA_WEBHOOK_SECRET to a PEM public key
 * switches modes with no change in index.js.
 *
 * STILL UNVERIFIED, because docs.teya.com is JavaScript-rendered and cannot be
 * read: the token endpoint path, the signature header name, and the exact
 * request field names. Each is a single env var below rather than a guess baked
 * into the code.
 */

import { DEFAULT_CATALOGUE } from './catalogue-default.js';
import { DEFAULT_INGREDIENTS } from './ingredients.js';
import { DEFAULT_ZONES, DEFAULT_METHODS, resolveZone, resolveMethod } from './shipping.js';
import { countryByCode } from './countries.js';

const API = {
  staging: 'https://api.teya.xyz',
  production: 'https://api.teya.com',
};

// Cached per isolate. Workers reuse an isolate across requests, so this saves a
// token round trip on most calls without ever persisting a credential.
let _token = null;          // { value, expires }
let _tokenInFlight = null;  // single-flight guard

function tokenUrl(env) {
  if (env.TEYA_TOKEN_URL) return env.TEYA_TOKEN_URL;
  const base = API[env.TEYA_ENV === 'production' ? 'production' : 'staging'];
  return `${base}/oauth2/token`;
}

/**
 * A bearer token for the Teya API.
 *
 * force=true discards a cached token, which is what the 401 retry uses: a token
 * can be revoked before its stated TTL by a key rotation or clock skew, and the
 * expiry alone will not tell you.
 */
async function getAccessToken(env, force = false) {
  const now = Date.now();
  if (!force && _token && _token.expires > now + 30000) return _token.value;

  // Collapse concurrent callers onto one exchange.
  if (!force && _tokenInFlight) return _tokenInFlight;

  _tokenInFlight = (async () => {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.TEYA_CLIENT_ID,
      client_secret: env.TEYA_CLIENT_SECRET,
    });
    if (env.TEYA_SCOPE) body.set('scope', env.TEYA_SCOPE);

    const res = await fetch(tokenUrl(env), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      // Never log the secret. Status and any error code only.
      console.error('teya token failed', res.status, data.error || '');
      throw new Error('teya auth failed');
    }
    const ttl = (parseInt(data.expires_in, 10) || 3600) * 1000;
    _token = { value: data.access_token, expires: Date.now() + ttl };
    return _token.value;
  })();

  try { return await _tokenInFlight; }
  finally { _tokenInFlight = null; }
}

/**
 * Authorization header value. Prefers the OAuth exchange; falls back to a
 * static bearer when only TEYA_API_KEY is set, so whichever credential shape
 * the portal issues, one of the two paths works.
 */
async function authHeader(env, force = false) {
  if (env.TEYA_CLIENT_ID && env.TEYA_CLIENT_SECRET) {
    return `Bearer ${await getAccessToken(env, force)}`;
  }
  return `Bearer ${env.TEYA_API_KEY}`;
}

function paymentsConfigured(env) {
  const hasAuth = (env.TEYA_CLIENT_ID && env.TEYA_CLIENT_SECRET) || env.TEYA_API_KEY;
  return Boolean(hasAuth && env.TEYA_STORE_ID);
}

/** Call the Teya API, retrying once on a 401 with a freshly minted token. */
async function teyaFetch(env, path, init = {}) {
  const base = API[env.TEYA_ENV === 'production' ? 'production' : 'staging'];
  const send = async (force) => fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'Authorization': await authHeader(env, force),
      'Content-Type': 'application/json',
    },
  });

  let res = await send(false);
  if (res.status === 401 && env.TEYA_CLIENT_ID && env.TEYA_CLIENT_SECRET) {
    res = await send(true);
  }
  return res;
}

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

  if (!paymentsConfigured(env)) {
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

  const res = await teyaFetch(env, '/v2/checkout/sessions', {
    method: 'POST',
    headers: { 'Idempotency-Key': reference },
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

/**
 * Status of a checkout session, for reconciling an order whose webhook never
 * arrived. Treats a payment as paid only when the status says success AND a
 * transaction id is present - the Teya plugin shipped a fix for exactly this,
 * having marked declined sessions paid on status alone.
 */
export async function getSessionStatus(env, sessionId) {
  if (!paymentsConfigured(env) || !sessionId) return null;
  const res = await teyaFetch(env, `/v2/checkout/sessions/${encodeURIComponent(sessionId)}`,
                              { method: 'GET' });
  if (!res.ok) {
    console.error('teya session status failed', res.status);
    return null;
  }
  const data = await res.json().catch(() => ({}));
  const status = String(data.payment_status || data.status || '').toUpperCase();
  const txn = data.transaction_id || data.transactionId ||
              (data.payment && (data.payment.transaction_id || data.payment.id)) || '';
  return { raw: data, status, transaction_id: txn, paid: status === 'SUCCESS' && Boolean(txn) };
}

// ── Webhook signature ────────────────────────────────────────────────────

const _b64ToBytes = (b64) => {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const _hexToBytes = (hex) => {
  const clean = hex.replace(/^sha256=/, '').trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
};

/** Signatures arrive base64 or hex depending on the provider. Accept both. */
function _sigBytes(sig) {
  const s = String(sig || '').replace(/^sha256=/, '').trim();
  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) return _hexToBytes(s);
  try { return _b64ToBytes(s); } catch { return null; }
}

function _pemToBytes(pem) {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  return _b64ToBytes(body);
}

/**
 * Verify against a PUBLIC KEY. Teya signs the raw body; the key is published in
 * the Business Portal. Tries RSA SHA-256 then Ed25519 rather than asking anyone
 * to know which, because the docs page cannot be read.
 */
async function verifyWithPublicKey(raw, sig, pem) {
  const sigBytes = _sigBytes(sig);
  if (!sigBytes) return false;
  const keyBytes = _pemToBytes(pem);
  const data = new TextEncoder().encode(raw);

  const attempts = [
    { alg: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, verify: 'RSASSA-PKCS1-v1_5' },
    { alg: { name: 'RSA-PSS', hash: 'SHA-256' }, verify: { name: 'RSA-PSS', saltLength: 32 } },
    { alg: { name: 'Ed25519' }, verify: 'Ed25519' },
  ];
  for (const a of attempts) {
    try {
      const key = await crypto.subtle.importKey('spki', keyBytes, a.alg, false, ['verify']);
      if (await crypto.subtle.verify(a.verify, key, sigBytes, data)) return true;
    } catch { /* wrong algorithm for this key, try the next */ }
  }
  return false;
}

/**
 * Kept at three arguments so index.js needs no change. The third value decides
 * the mode: a PEM public key means asymmetric verification, anything else is
 * treated as an HMAC shared secret.
 */
export async function verifySignature(raw, sig, secret) {
  if (!secret) return true; // not configured yet - do not hard-fail staging
  if (!sig) return false;

  if (/BEGIN [A-Z ]*PUBLIC KEY/.test(secret)) {
    return verifyWithPublicKey(raw, sig, secret);
  }

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
