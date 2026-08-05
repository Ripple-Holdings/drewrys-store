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

/**
 * Candidate token endpoints, tried in order until one answers with a token.
 *
 * Both hosts returned a bare 403 with no OAuth error body for /oauth2/token,
 * which is what a gateway does for a path it does not know rather than what an
 * OAuth server does for bad credentials - so the path, not the credential, is
 * the thing in doubt. TEYA_TOKEN_URL short-circuits all of this the moment Teya
 * tell us the real one.
 */
function tokenCandidates(env) {
  if (env.TEYA_TOKEN_URL) return [env.TEYA_TOKEN_URL];
  const prod = env.TEYA_ENV === 'production';
  const api = API[prod ? 'production' : 'staging'];
  const host = prod ? 'teya.com' : 'teya.xyz';
  return [
    // Confirmed from Teya's own API URLs table 05/08/2026. OAuth lives on a
    // SEPARATE host from the payments API, which is why every path under
    // api.teya.com returned a bare 403 - the gateway there has no token
    // endpoint to refuse properly.
    `https://id.${host}/oauth/v2/oauth-token`,
    `${api}/oauth2/token`,
    `${api}/oauth/token`,
    `${api}/v2/oauth/token`,
  ];
}

// Remembered once found, so the probing happens at most once per isolate. Keyed
// by environment: a cached staging URL must not survive a switch to production
// inside a warm isolate.
const _tokenUrlFound = {};

function envKey(env) {
  return env.TEYA_ENV === 'production' ? 'production' : 'staging';
}

function tokenUrl(env) {
  return _tokenUrlFound[envKey(env)] || tokenCandidates(env)[0];
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
    // OAuth allows the client credentials either in the form body or as HTTP
    // Basic, and servers differ on which they accept. Try the body first, then
    // Basic on a 401 or 403, rather than making the choice a guess.
    // Documented 05/08/2026: the grant must request checkout/sessions/create or
    // the token mints fine and every API call returns 403 "token has no scopes
    // defined". Defaulted so no environment variable is needed; TEYA_SCOPE
    // overrides it if more scopes are ever required.
    const form = new URLSearchParams({ grant_type: 'client_credentials' });
    form.set('scope', env.TEYA_SCOPE || 'checkout/sessions/create');

    const attempt = async (url, useBasic) => {
      const body = new URLSearchParams(form);
      const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      if (useBasic) {
        headers.Authorization = 'Basic ' +
          btoa(`${env.TEYA_CLIENT_ID}:${env.TEYA_CLIENT_SECRET}`);
      } else {
        body.set('client_id', env.TEYA_CLIENT_ID);
        body.set('client_secret', env.TEYA_CLIENT_SECRET);
      }
      const r = await fetch(url, { method: 'POST', headers, body: body.toString() });
      return { r, data: await r.json().catch(() => ({})) };
    };

    const cached = _tokenUrlFound[envKey(env)];
    const urls = cached ? [cached] : tokenCandidates(env);
    let res = null; let data = {}; let winner = null;

    for (const url of urls) {
      ({ r: res, data } = await attempt(url, false));
      if (!data.access_token && (res.status === 401 || res.status === 403)) {
        ({ r: res, data } = await attempt(url, true));
      }
      if (data.access_token) { winner = url; break; }
      // A bare 403 or 404 with no OAuth error body means wrong path, so move on.
      // Anything else is the server talking to us and is worth reporting.
      console.error('teya token', res.status, url,
                    data.error || '', String(data.error_description || '').slice(0, 160));
      if (data.error) break;   // a real OAuth rejection: stop, the path is right
    }

    if (!winner) {
      throw new Error('teya auth failed');
    }
    if (_tokenUrlFound[envKey(env)] !== winner) {
      _tokenUrlFound[envKey(env)] = winner;
      console.log('teya token endpoint resolved:', winner, 'env', envKey(env));
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

  // Field names taken from Teya's own worked example, 05/08/2026. The line item
  // keys are `description` and `unit_price`, NOT the name/unit_amount I had
  // guessed, and `type` is required. There is no documented reference field, so
  // our own reference travels on the return URLs and via the Idempotency-Key,
  // and the session id is mapped back to it in KV once Teya answers.
  // Teya validates that the line items sum EXACTLY to amount.value
  // (LINE_ITEMS_TOTAL_MISMATCH), so delivery and any discount have to appear as
  // lines of their own. Products alone summed to the subtotal, which is wrong
  // the moment a promo code or a delivery charge is involved.
  const lineItems = basket.items.map(({ name, quantity, unit_amount }) => ({
    description: name,
    quantity,
    unit_price: unit_amount,
  }));
  if (basket.shipping > 0) {
    lineItems.push({
      description: (basket.method && basket.method.name) || 'Delivery',
      quantity: 1,
      unit_price: basket.shipping,
    });
  }
  if (basket.discount > 0) {
    lineItems.push({
      description: `Discount${basket.promo ? ' ' + basket.promo : ''}`,
      quantity: 1,
      unit_price: -basket.discount,
    });
  }

  const lineSum = lineItems.reduce((n, l) => n + (l.unit_price * l.quantity), 0);

  const body = {
    store_id: env.TEYA_STORE_ID,
    amount: { value: basket.total, currency: 'GBP' },
    type: 'SALE',
    success_url: `${origin}/?paid=1&ref=${reference}`,
    cancel_url: `${origin}/?cancelled=1&ref=${reference}`,
  };

  // Last line of defence: if the arithmetic does not reconcile for any reason,
  // send no line items rather than a total Teya will reject. The charge is the
  // thing that matters; the itemisation is presentation.
  if (lineSum === basket.total) {
    body.line_items = lineItems;
  } else {
    console.error('line items do not sum to total, sending none:', lineSum, 'vs', basket.total);
  }

  // getAccessToken THROWS when the token exchange fails, and an uncaught throw
  // here escapes the Worker and Cloudflare answers with an HTML error page - so
  // the browser gets "Unexpected token '<'" instead of a usable message. Catch
  // it and answer in JSON like every other failure on this path.
  let res;
  try {
    res = await teyaFetch(env, '/v2/checkout/sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': reference },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error('teya request threw', String(e && e.message || e));
    return json({ error: 'payment setup failed' }, 502);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('teya session failed', res.status, JSON.stringify(data));
    return json({ error: 'payment setup failed' }, 502);
  }

  // Documented response: session_id, session_token, session_url, session_status.
  // The older keys are kept as a fallback in case the field is ever renamed.
  const url = data.session_url || data.checkout_url || data.url || data.redirect_url;
  if (!url) {
    console.error('no session url from teya', JSON.stringify(data).slice(0, 400));
    return json({ error: 'payment setup failed' }, 502);
  }

  // The webhook and any later status check identify the payment by session id,
  // so store the mapping both ways. Without it a callback carrying only a
  // session id has no way back to our order.
  const sessionId = data.session_id || '';
  if (sessionId) {
    try {
      await env.DREWRYS_KV.put(`session:${sessionId}`, reference,
                               { expirationTtl: 60 * 60 * 24 * 90 });
      const parked = await env.DREWRYS_KV.get(`order:${reference}`);
      if (parked) {
        const o = JSON.parse(parked);
        o.session_id = sessionId;
        await env.DREWRYS_KV.put(`order:${reference}`, JSON.stringify(o),
                                 { expirationTtl: 60 * 60 * 24 * 90 });
      }
    } catch (e) {
      // Not fatal: the return URL still carries the reference.
      console.error('session mapping failed', String(e && e.message || e));
    }
  }

  return json({ url, reference, session_id: sessionId, total: basket.total });
}

/**
 * Status of a checkout session, for reconciling an order whose webhook never
 * arrived. Treats a payment as paid only when the status says success AND a
 * transaction id is present - the Teya plugin shipped a fix for exactly this,
 * having marked declined sessions paid on status alone.
 */
export async function getSessionStatus(env, sessionId) {
  if (!paymentsConfigured(env) || !sessionId) return null;
  let res;
  try {
    res = await teyaFetch(env, `/v2/checkout/sessions/${encodeURIComponent(sessionId)}`,
                          { method: 'GET' });
  } catch (e) {
    console.error('teya status threw', String(e && e.message || e));
    return null;
  }
  if (!res.ok) {
    console.error('teya session status failed', res.status);
    return null;
  }
  const data = await res.json().catch(() => ({}));
  // Documented fields are payment_status and session_status; payment_status is
  // the one that says whether money moved.
  const status = String(data.payment_status || data.session_status || data.status || '').toUpperCase();
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
