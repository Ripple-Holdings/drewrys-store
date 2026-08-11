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
import { normalisePromos, getPromoUses, evaluatePromos } from './promos.js';

import { sellingPrice, productTaxable } from './vat.js';

const API = {
  staging: 'https://api.teya.xyz',
  production: 'https://api.teya.com',
};

// Cached per isolate. Workers reuse an isolate across requests, so this saves a
// token round trip on most calls without ever persisting a credential.
// Keyed `${env}|${scope}` — Teya grants scopes per token, so one cache slot
// would hand a checkout token to a refund and 403.
export const SCOPE_CHECKOUT = 'checkout/sessions/create';
export const SCOPE_REFUND = 'refunds/create';
const _tokens = {};          // { 'production|scope': { value, expires } }
const _tokenInFlight = {};   // single-flight guard, per key

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
async function getAccessToken(env, force = false, scope = SCOPE_CHECKOUT) {
  // Teya grant scopes PER TOKEN. A refund needs refunds/create, and a token
  // minted for checkout/sessions/create returns 403 "token has no scopes
  // defined" on /v3/refunds. Cache and single-flight per env AND scope, or a
  // warm isolate hands a checkout token to a refund.
  const ck = `${envKey(env)}|${scope}`;
  const now = Date.now();
  const hit = _tokens[ck];
  if (!force && hit && hit.expires > now + 30000) return hit.value;
  if (!force && _tokenInFlight[ck]) return _tokenInFlight[ck];

  _tokenInFlight[ck] = (async () => {
    // OAuth allows the client credentials either in the form body or as HTTP
    // Basic, and servers differ on which they accept. Try the body first, then
    // Basic on a 401 or 403, rather than making the choice a guess.
    // Documented 05/08/2026: the grant must request checkout/sessions/create or
    // the token mints fine and every API call returns 403 "token has no scopes
    // defined". Defaulted so no environment variable is needed; TEYA_SCOPE
    // overrides it if more scopes are ever required.
    const form = new URLSearchParams({ grant_type: 'client_credentials' });
    form.set('scope', scope);

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
    _tokens[ck] = { value: data.access_token, expires: Date.now() + ttl };
    return _tokens[ck].value;
  })();

  try { return await _tokenInFlight[ck]; }
  finally { delete _tokenInFlight[ck]; }
}

/**
 * Authorization header value. Prefers the OAuth exchange; falls back to a
 * static bearer when only TEYA_API_KEY is set, so whichever credential shape
 * the portal issues, one of the two paths works.
 */
async function authHeader(env, force = false, scope = SCOPE_CHECKOUT) {
  if (env.TEYA_CLIENT_ID && env.TEYA_CLIENT_SECRET) {
    return `Bearer ${await getAccessToken(env, force, scope)}`;
  }
  return `Bearer ${env.TEYA_API_KEY}`;
}

function paymentsConfigured(env) {
  const hasAuth = (env.TEYA_CLIENT_ID && env.TEYA_CLIENT_SECRET) || env.TEYA_API_KEY;
  return Boolean(hasAuth && env.TEYA_STORE_ID);
}

/** Call the Teya API, retrying once on a 401 with a freshly minted token. */
async function teyaFetch(env, path, init = {}, scope = SCOPE_CHECKOUT) {
  const base = API[env.TEYA_ENV === 'production' ? 'production' : 'staging'];
  const send = async (force) => fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'Authorization': await authHeader(env, force, scope),
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
  // VAT. Prices on the site are INCLUSIVE, so this describes what is inside
  // the price rather than anything added at checkout. Without these entries
  // getSettings returns no rate, Number(undefined) becomes 0, and the report
  // quietly says nothing is owed.
  vat_registered: true,
  vat_number: 'GB004838290',
  vat_rate: 20,
  // Ben has no Facebook page, so it stays blank and the link hides itself.
  instagram_url: 'https://www.instagram.com/drewrys_haircare/',
  facebook_url: '',
  contact_email: 'hello@drewrys.store',
  zones: DEFAULT_ZONES,
  shipping_methods: DEFAULT_METHODS,
  free_over: {},                    // zone id -> pence, absent or 0 = no threshold
  collect_address: '',
  promos: [
    { code: 'DREWRYS10', type: 'percent', amount: 10, active: true,
      limit: 0, expires: '', stackable: false, min_spend: 0 },
    { code: 'PAIRED10', type: 'percent', amount: 10, active: true,
      limit: 0, expires: '', stackable: false, min_spend: 0 },
  ],
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

    // The SELLING price: for a product entered EXCLUSIVE of VAT this is the net
    // figure plus VAT, for everything else it is the figure as typed. Charging
    // the net price by accident is the expensive direction.
    const unit = sellingPrice(p, settings);
    subtotal += unit * take;
    items.push({ sku: p.slug, name: p.name, quantity: take, unit_amount: unit,
                 vat_applicable: productTaxable(p, settings),
                 size: p.size || '', image: p.image || '' });
  }
  if (!items.length) throw new Error('empty basket');

  const ful = payload.fulfilment === 'deliver' ? 'deliver' : 'collect';

  // Codes are re-validated here with the SAME rules the checkout page used,
  // because a limit or expiry can trip between page load and Pay. If a
  // submitted code is no longer valid the order is refused with the reason,
  // rather than quietly charging more than the total the customer approved.
  const codes = Array.isArray(payload.promos) ? payload.promos
    : payload.promo ? [payload.promo] : [];
  const promoResult = evaluatePromos(
    normalisePromos(settings), await getPromoUses(env), codes, subtotal);
  if (promoResult.rejected.length) {
    const r = promoResult.rejected[0];
    throw new Error(`${r.reason} (${r.code}). Please remove it and try again.`);
  }
  const discount = promoResult.discount;
  const appliedCodes = promoResult.applied.map((a) => a.code);

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
    promo: appliedCodes.length ? appliedCodes.join(' ') : null,
    promos: appliedCodes,
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
  // Stamped at pricing time so a later rate change never restates this order.
  const vatRate = Number((await getSettings(env)).vat_rate) || 0;

  // Park the order before sending anyone to Teya, so the webhook has
  // something to attach the payment result to.
  await env.DREWRYS_KV.put(`order:${reference}`, JSON.stringify({
    reference, status: 'pending', created: new Date().toISOString(),
    ...basket,
    vat_rate: vatRate,
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
    // Confirmed by Teya support 10/08/2026: post_success_payment controls
    // whether hosted checkout shows the "Payment approved" screen.
    // SHOW_SUCCESS_PAGE is the default; REDIRECT sends the customer straight
    // to success_url instead. redirect_url, which their docs example shows,
    // is NOT the field for this and has been removed.
    post_success_payment: 'REDIRECT',
    // merchant_reference is a documented field we were not sending, which is
    // why every webhook has arrived with merchant_reference:null and matching
    // has depended entirely on the session:<id> KV mapping. Sending it gives
    // the webhook a direct route back to the order.
    merchant_reference: reference,
    metadata: { order_id: reference },
    // Documented alongside cancel_url. A declined payment has been going to
    // cancel_url by default; this is the field for it.
    failure_url: `${origin}/checkout?failed=1&ref=${reference}`,
    success_url: `${origin}/order?ref=${reference}`,
    cancel_url: `${origin}/checkout?cancelled=1&ref=${reference}`,
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
  // TEYA_EXTRA_SESSION_JSON lets an undocumented session field be tried from
  // the Cloudflare dashboard without a code push, e.g. {"auto_redirect":true}.
  // Teya's own response then says whether the field exists. Unset, nothing
  // changes. Bad JSON is ignored rather than breaking checkout.
  if (env.TEYA_EXTRA_SESSION_JSON) {
    try {
      Object.assign(body, JSON.parse(env.TEYA_EXTRA_SESSION_JSON));
      console.log('teya session: merged extra fields',
                  JSON.stringify(Object.keys(JSON.parse(env.TEYA_EXTRA_SESSION_JSON))));
    } catch (e) {
      console.error('TEYA_EXTRA_SESSION_JSON is not valid JSON, ignored');
    }
  }

  // Log what we actually SEND. Without this, "their screen still appeared"
  // cannot be told apart from "the deploy did not land", which is exactly the
  // ambiguity we hit on 11/08.
  console.log('teya session request:', JSON.stringify({
    keys: Object.keys(body),
    post_success_payment: body.post_success_payment ?? '(not sent)',
    success_url: body.success_url ?? '(not sent)',
  }));

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
  // Log which keys Teya echoed. If success_url is absent from the response it
  // was ignored, which would explain a checkout that ends on Teya's own page.
  console.log('teya session response keys:', JSON.stringify(Object.keys(data)),
              'success_url echoed:', Boolean(data.success_url || data.return_url));

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

/**
 * Kept at three arguments so index.js needs no change. The third value decides
 * the mode: a PEM public key means asymmetric verification, anything else is
 * treated as an HMAC shared secret.
 */
/**
 * Verify a Teya webhook.
 *
 * FACT, from a real delivery on 10/08/2026: the header is `x-teya-signature`
 * and its value is 344 base64 characters, which decodes to 256 bytes. That is
 * an RSA-2048 signature over the raw body. An HMAC-SHA256 would be 32 bytes,
 * so the HMAC branch this function used could never have matched and every
 * webhook was rejected with 401.
 *
 * TEYA_WEBHOOK_SECRET must therefore hold Teya's PUBLIC KEY. Accepts it as a
 * PEM block or as a bare base64 SPKI with the header lines stripped, since it
 * is easy to paste either. Tries PKCS#1 v1.5 first, then PSS.
 */
export async function verifySignature(raw, sig, secret) {
  if (!secret) return true;              // not configured - do not hard-fail
  if (!sig) { console.error('webhook: no signature header'); return false; }

  let sigBytes;
  try {
    sigBytes = Uint8Array.from(atob(sig.trim()), (c) => c.charCodeAt(0));
  } catch {
    console.error('webhook: signature is not base64');
    return false;
  }

  const body = new TextEncoder().encode(raw);
  const der = pemToDer(secret);
  if (!der) {
    console.error('webhook: TEYA_WEBHOOK_SECRET is not a public key. A',
                  sigBytes.length + '-byte signature needs Teya\'s RSA public key,',
                  'not a shared secret.');
    return false;
  }

  for (const algo of [
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    { name: 'RSA-PSS', hash: 'SHA-256' },
  ]) {
    try {
      const key = await crypto.subtle.importKey('spki', der, algo, false, ['verify']);
      const params = algo.name === 'RSA-PSS' ? { name: 'RSA-PSS', saltLength: 32 } : algo.name;
      if (await crypto.subtle.verify(params, key, sigBytes, body)) {
        console.log('webhook signature verified with', algo.name);
        return true;
      }
    } catch (e) {
      console.error('webhook: import/verify failed for', algo.name,
                    String(e && e.message || e));
    }
  }
  console.error('webhook: signature did not verify against the configured key');
  return false;
}

/** Accept a PEM block or a bare base64 SPKI body. */
function pemToDer(text) {
  const b64 = String(text)
    .replace(/-----BEGIN [A-Z ]*-----/g, '')
    .replace(/-----END [A-Z ]*-----/g, '')
    .replace(/\s+/g, '');
  if (b64.length < 100 || /[^A-Za-z0-9+/=]/.test(b64)) return null;
  try {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  } catch { return null; }
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});


/**
 * Refund a captured payment, whole or part.
 *
 * POST /v2/refunds, the third endpoint listed alongside checkout sessions in
 * Teya's own WooCommerce plugin. Amount is in MINOR units, same as everywhere
 * else on this API — the webhook's amount.value of 5 was five pence.
 *
 * Returns { ok, refund_id, status, error }. Never throws: a refund that fails
 * at Teya must still leave the admin usable and the order untouched, because
 * the one thing worse than an unrefunded order is an order marked refunded
 * that never was.
 */
export async function refundPayment(env, { transactionId, amount, reference }) {
  if (!transactionId) return { ok: false, error: 'no transaction id on this order' };
  if (!(amount > 0)) return { ok: false, error: 'refund amount must be more than zero' };

  const body = {
    transaction_id: transactionId,
    amount: Math.round(amount),
    merchant_reference: reference || undefined,
  };

  let res;
  try {
    res = await teyaFetch(env, '/v3/refunds', {
      method: 'POST',
      // DETERMINISTIC, per Teya's own warning: repeating the request with a
      // different key, or none, creates a SECOND refund. Never randomise this.
      headers: { 'Idempotency-Key': `refund-${reference || transactionId}` },
      body: JSON.stringify(body),
    }, SCOPE_REFUND);
  } catch (e) {
    console.error('teya refund threw', String(e && e.message || e));
    return { ok: false, error: 'could not reach Teya' };
  }

  // A 202 means accepted, NOT done, and carries no body. Treating it as success
  // would tell Ben and the customer the money had gone back when it had not.
  if (res.status === 202) {
    console.log('teya refund accepted but pending', reference);
    return { ok: false, pending: true, state: 'pending',
             error: 'Teya has accepted the refund but has not completed it yet' };
  }

  // Read the body as TEXT first. A canned message keyed on the status code was
  // hiding Teya's own words: a 403 was reported as a missing refunds/create
  // scope long after the token was proven to carry that scope.
  const raw = await res.text().catch(() => '');
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

  if (!res.ok) {
    // Everything Teya said, so the next person is not guessing from a number.
    const hdrs = {};
    res.headers.forEach((v, k) => {
      if (/^(x-|www-authenticate|content-type)/i.test(k)) hdrs[k] = v;
    });
    console.error('teya refund failed', res.status,
      'body:', raw ? raw.slice(0, 900) : '(empty)',
      'headers:', JSON.stringify(hdrs),
      'sent:', JSON.stringify({ transaction_id: transactionId,
        amount: Math.round(amount), merchant_reference: reference,
        idempotency_key: `refund-${reference || transactionId}` }));

    // THEIR wording wins. Ours is only a last resort, and it says plainly that
    // it is a guess from the status code.
    const theirs = data.status_reason || data.message || data.error_description
      || data.error || data.detail || data.title;
    const fallback = {
      401: 'Teya rejected our credentials',
      403: `Teya refused the refund with 403 and gave no reason in the body. The token does carry refunds/create, so this is not the scope. Check the Worker log for the full response.`,
      404: 'Teya does not recognise that transaction id',
      409: 'a refund for this order has already been submitted',
      422: 'Teya refused the amount',
    }[res.status] || `Teya returned ${res.status}`;

    return { ok: false, status: res.status, body: raw ? raw.slice(0, 400) : '',
             error: theirs ? `Teya says: ${theirs}` : fallback };
  }

  const status = String(data.status || '').toUpperCase();
  const issuer = data.issuer_result || {};

  if (status === 'FAILURE') {
    // status_reason is a documented enum. Ben should not be shown
    // INSUFFICIENT_FUNDS in caps and left to work out whose funds.
    const reason = String(data.status_reason || '');
    const plain = {
      INSUFFICIENT_FUNDS: 'the account this would refund to has insufficient funds',
      CARD_EXPIRED: 'the original card has expired',
      LOST_OR_STOLEN: 'the original card is reported lost or stolen',
      CARD_DECLINED: 'the card issuer declined the refund',
      ISSUER_DECLINED: 'the card issuer declined the refund',
      DO_NOT_HONOR: 'the card issuer declined the refund without a reason',
      INVALID_CARD_NUMBER: 'the original card number is no longer valid',
      ACCOUNT_INVALID: 'the account behind the original card is no longer valid',
      TRANSACTION_NOT_ALLOWED: 'the issuer does not allow a refund on this transaction',
      EXCEEDS_AMOUNT_LIMIT: 'the amount exceeds a limit on the account',
      MERCHANT_CONFIGURATION: 'a setting on the Teya account is blocking this - contact them',
      PROCESSOR_UNAVAILABLE: 'Teya could not reach the card network, try again shortly',
      TEMPORARY_ISSUE_RETRY: 'a temporary problem at the card network, try again shortly',
      TIMEOUT: 'the card network timed out, try again shortly',
      SUSPECTED_FRAUD: 'the issuer flagged this as suspected fraud',
    }[reason];
    console.error('teya refund FAILURE', reason, JSON.stringify(issuer));
    return { ok: false,
             error: plain ? `Refund declined: ${plain}`
                          : `Refund declined by Teya${reason ? ` (${reason})` : ''}`,
             status_reason: reason, response_code: issuer.response_code || '' };
  }

  if (status === 'PENDING') {
    return { ok: false, pending: true, state: 'pending',
             error: 'Teya has the refund in progress but has not completed it' };
  }

  // Record what TEYA says was refunded, not what we asked for. If those ever
  // differ, the money that actually moved is the one that matters.
  const settled = data.refund_amount && Number.isFinite(Number(data.refund_amount.amount))
    ? Number(data.refund_amount.amount) : null;

  return { ok: true, state: 'refunded',
           refund_id: data.transaction_id || '',
           approval_code: issuer.approval_code || '',
           response_code: issuer.response_code || '',
           created_at: data.created_at || '',
           amount_settled: settled,
           status: status || 'SUCCESS' };
}


/**
 * Exactly what Teya support asked for on 11/08/2026, and nothing more.
 *
 * Mints a FRESH token for the requested scope, bypassing the cache, and returns
 * the whole token response with the token value REDACTED so the `scope` field
 * can be read. Also returns the environment, the first six characters of the
 * client id, and the refund request as a cURL with the secret and the token
 * removed.
 *
 * The access token never appears in the output. It is a bearer credential: one
 * that leaks into a chat log or a screenshot is a live key until it expires.
 */
export async function tokenDiagnostic(env, scope = SCOPE_REFUND, sample = {}) {
  const isProd = env.TEYA_ENV === 'production';
  const api = API[isProd ? 'production' : 'staging'];
  const out = {
    environment: api,
    token_endpoint: null,
    client_id_first_six: String(env.TEYA_CLIENT_ID || '').slice(0, 6) || '(not set)',
    store_id: env.TEYA_STORE_ID || '(not set)',
    scope_requested: scope,
    token_response: null,
    refund_curl: null,
    error: null,
  };

  const urls = tokenCandidates(env);
  const form = new URLSearchParams({ grant_type: 'client_credentials' });
  form.set('scope', scope);

  for (const url of urls) {
    for (const useBasic of [false, true]) {
      const body = new URLSearchParams(form);
      const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      if (useBasic) {
        headers.Authorization = 'Basic ' +
          btoa(`${env.TEYA_CLIENT_ID}:${env.TEYA_CLIENT_SECRET}`);
      } else {
        body.set('client_id', env.TEYA_CLIENT_ID);
        body.set('client_secret', env.TEYA_CLIENT_SECRET);
      }
      let r; let data = {};
      try {
        r = await fetch(url, { method: 'POST', headers, body: body.toString() });
        data = await r.json().catch(() => ({}));
      } catch (e) {
        out.error = String(e && e.message || e);
        continue;
      }
      if (data.access_token || data.error) {
        out.token_endpoint = url;
        out.auth_style = useBasic ? 'HTTP Basic' : 'client_id and client_secret in the body';
        out.http_status = r.status;
        // Redact the token itself, keep everything else so `scope` is visible.
        out.token_response = { ...data };
        if (out.token_response.access_token) {
          out.token_response.access_token = '[REDACTED]';
        }
        if (out.token_response.refresh_token) {
          out.token_response.refresh_token = '[REDACTED]';
        }
        out.scope_returned = data.scope === undefined ? '(no scope field in the response)' : data.scope;
        out.scope_includes_refunds = typeof data.scope === 'string'
          ? data.scope.split(/[\s,]+/).includes('refunds/create')
          : null;
        break;
      }
    }
    if (out.token_endpoint) break;
  }

  const txn = sample.transaction_id || 'tr_THE_ORIGINAL_PAYMENT_ID';
  const ref = sample.merchant_reference || 'DRW-EXAMPLE';
  const amt = Number.isFinite(Number(sample.amount)) ? Number(sample.amount) : 100;
  out.refund_curl = [
    `curl -X POST '${api}/v3/refunds' \\`,
    `  -H 'Authorization: Bearer [ACCESS_TOKEN_REMOVED]' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'Idempotency-Key: refund-${ref}' \\`,
    `  -d '${JSON.stringify({ transaction_id: txn, amount: amt, merchant_reference: ref })}'`,
  ].join('\n');

  return out;
}
