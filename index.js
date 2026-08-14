/**
 * Drewrys - storefront Worker.
 *
 *   /                    the site: shell.html from ASSETS with the live
 *                        catalogue injected before </head>
 *   /api/catalogue       same data as JSON
 *   /create-session      POST, starts a Teya hosted checkout
 *   /webhook             POST, Teya payment result
 *   /admin               PIN-gated portal: Catalogue · Stock · Orders
 *   everything else      static asset
 *
 * The page is public/shell.html on purpose - see the note in wrangler.toml.
 */

import {
  createSession, verifySignature, getCatalogue, getSettings, getStock,
  getIngredients, getSessionStatus, refundPayment, tokenDiagnostic, pathProbe, DEFAULT_SETTINGS,
} from './teya.js';
import { GATE, adminHtml } from './admin.js';
import { zones, methods } from './shipping.js';
import { COUNTRIES } from './countries.js';
import { CARRIERS, confirmationEmails, dispatchedEmail, readyEmail,
         collectedEmail, reviewRequestEmail, publicReviewInviteEmail } from './fulfilment.js';
import { REVIEW_DEFAULTS, livePlatforms, newToken, reviewId, queueReviewRequest, takeDue,
         getReviews, putReviews, publishedReviews, ratingSummary,
         reviewFormPage, reviewGonePage, reviewSharePage } from './reviews.js';
import { lookupPostcode } from './address.js';
import { checkoutHtml } from './checkout.js';
import { TERMS, RETURNS, PRIVACY } from './legal.js';
import { orderConfirmationPage } from './confirmation.js';
import { RETURN_REASONS, NO_RESTOCK_REASONS, reasonLabel, refundEmail,
         cancelledEmail } from './refunds.js';
import { subscribe, enquiry, contact, listLeads, unsubscribe } from './leads.js';
import { vatForOrder, vatReport, vatPeriods, vatSettings, sellingPrice } from './vat.js';
import { recordHit, mirrorOrder, rollupAndPrune, dashboardData } from './reports.js';
import { cleanPromo, normalisePromos, getPromoUses, incrementUses, evaluatePromos } from './promos.js';
import { BIZ, shellPage, notFoundPage, productPage } from './pages.js';
import { homeGraph, productGraph } from './schema.js';


const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gbp = (pence) => '£' + (Number(pence || 0) / 100).toFixed(2);
const json = (d, status = 200) => new Response(JSON.stringify(d), {
  status, headers: { 'Content-Type': 'application/json' },
});
const html = (markup, status = 200) => new Response(markup, {
  status, headers: { 'Content-Type': 'text/html;charset=utf-8' },
});

/* ── canonical origin, redirects and headers ─────────────────────────────── */

/**
 * The one true origin. Everything else 301s here.
 *
 * Before this existed, four hostnames each returned a 200 with identical
 * content: http and https, www and apex. That splits ranking signals across
 * four URLs, and — far worse — /checkout was reachable over plaintext http,
 * so a customer's name, email, phone and postal address were submitted in
 * clear text. The privacy policy states the site is served over HTTPS, so
 * this was also a claim we were not honouring.
 */
const CANONICAL_HOST = 'drewrys.store';

/**
 * Cloudflare terminates TLS at the edge, so url.protocol is not reliable on
 * its own. cf-visitor carries the scheme the *client* actually used.
 */
function clientScheme(request, url) {
  try {
    const v = request.headers.get('cf-visitor');
    if (v) {
      const s = JSON.parse(v).scheme;
      if (s) return s;
    }
  } catch { /* fall through to the URL */ }
  return url.protocol.replace(':', '');
}

/** 301 to https://drewrys.store<path> when the request came in any other way. */
function canonicalRedirect(request, url) {
  const host = url.hostname.toLowerCase();
  const insecure = clientScheme(request, url) === 'http';
  const wrongHost = host === 'www.' + CANONICAL_HOST;
  if (!insecure && !wrongHost) return null;
  if (host !== CANONICAL_HOST && !wrongHost) return null;  // preview/dev hosts pass through
  const target = new URL(url.toString());
  target.protocol = 'https:';
  target.hostname = CANONICAL_HOST;
  return Response.redirect(target.toString(), 301);
}

/**
 * Security headers, applied to every response on the way out.
 *
 * No CSP here on purpose: the site inlines all of its CSS and JS, so any
 * useful policy would need 'unsafe-inline' and would buy nothing. Adding one
 * properly means externalising those assets first.
 *
 * HSTS is safe to send now that canonicalRedirect() guarantees https.
 */
function harden(res, { cache } = {}) {
  // 204/205/304 must carry a null body — the asset handler returns 304 on a
  // conditional request, and passing a body for one of those statuses throws.
  const nullBody = res.status === 101 || res.status === 204
                || res.status === 205 || res.status === 304;
  const h = new Headers(res.headers);
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), interest-cohort=()');
  if (cache && !h.has('Cache-Control')) h.set('Cache-Control', cache);
  return new Response(nullBody ? null : res.body,
    { status: res.status, statusText: res.statusText, headers: h });
}

/**
 * Cache policy by path.
 *
 * Everything under /img and the font CSS was being served
 * `max-age=0, must-revalidate`, the Cloudflare Pages default, which nobody
 * had overridden. That meant ~34 conditional requests on every repeat visit
 * before anything could paint. These files are content-addressed by name and
 * change only when replaced, so a long max-age with revalidation is correct.
 *
 * HTML stays short: the catalogue and stock are injected per request.
 */
function cacheFor(path) {
  if (/^\/(img|media)\//.test(path)) return 'public, max-age=31536000, stale-while-revalidate=86400';
  if (/\.(css|woff2?|png|jpe?g|svg|webp|avif|ico)$/i.test(path)) {
    return 'public, max-age=31536000, stale-while-revalidate=86400';
  }
  return null;
}

/* ── storefront ──────────────────────────────────────────────────────────── */

async function stockMap(env, products) {
  const out = {};
  for (const p of products) out[p.slug] = await getStock(env, p.slug);
  return out;
}

async function renderSite(request, env) {
  const res = await env.ASSETS.fetch(new URL('/shell.html', request.url));
  if (!res.ok) return new Response('shell.html missing from public/', { status: 500 });

  const cat = await getCatalogue(env);
  const settings = await getSettings(env);
  const live = cat.products.filter((p) => p.active !== false)
    // Show what will be charged. priceBasket computes the same figure, so a
    // product entered exclusive of VAT cannot display its net price.
    .map((p) => ({ ...p, price_pence: sellingPrice(p, settings) }));
  const allReviews = await getReviews(env);

  const payload = {
    products: live,
    stock: await stockMap(env, live),
    zones: zones(settings),
    methods: methods(settings),
    free_over: settings.free_over || {},
    collect_address: settings.collect_address || env.SHOP_COLLECT_ADDR || '',
    paired_pct: pairedPct(settings),
    ingredients: await getIngredients(env),
    reviews: publishedReviews(allReviews),
    ratings: ratingSummary(allReviews),
    // Same credential test as teya.js: OAuth pair, or the legacy static key.
    payments_live: !!(((env.TEYA_CLIENT_ID && env.TEYA_CLIENT_SECRET) || env.TEYA_API_KEY)
                      && env.TEYA_STORE_ID),
    // Footer links. Empty means the link is hidden rather than pointing at "#",
    // which is what sent every one of them back to the top of the page.
    // A hand-picked review for the contact panel. Blank means the panel falls
    // back to a real published review, and shows nothing if there are none.
    featured_review: {
      quote: settings.feature_quote || '',
      name: settings.feature_name || '',
      sub: settings.feature_sub || '',
    },
    links: {
      instagram: settings.instagram_url || '',
      facebook: settings.facebook_url || '',
      contact: settings.contact_email || env.SHOP_CONTACT_EMAIL || env.SHOP_ORDER_EMAIL || '',
    },
    address_lookup: !!env.ADDRESS_API_KEY,
  };

  const inject = `<script>window.__DREWRYS__=${
    JSON.stringify(payload).replace(/</g, '\\u003c')
  };</script>`;

  /* Structured data. Generated from the same objects the page renders, so
     price and availability cannot drift from the shop. */
  const graph = homeGraph({
    biz: BIZ, settings, products: live, stock: payload.stock,
    ratings: payload.ratings, freeOver: payload.free_over,
  });
  const ld = `<script type="application/ld+json">${graph}</script>`;

  /* The head that shipped said "Drewrys, premium haircare, with purpose." in
     both the title and the description — byte-identical, 40 characters, and
     naming no product category, no market and no location. Nobody searches
     for an abstract noun. */
  const title = 'Drewrys — barber-made hair clay, paste &amp; sea salt spray, made in the UK';
  const desc = 'Premium men’s haircare built by a barber with 15 years on the floor. '
    + 'Matte clay, paste, fibre, sea salt spray and shampoo, made in the UK with organic '
    + 'botanical oils. Free UK delivery over £40.';

  /* Straight to each product's page, same destination as the card's "Learn
     more". One product, one address, however you get there. */
  const productLinks = '<li class="fl-lh">THE RANGE</li>'
    + live.map((p) => `<li><a href="/shop/${esc(p.slug)}">${esc(p.name)}</a></li>`).join('');

  /* The grid, rendered server-side.
     The client rebuilds #grid from window.__DREWRYS__ the moment it boots, so
     this markup is short-lived in a real browser. It is not short-lived for a
     crawler that does not run scripts: before this, the raw HTML shipped
     `<div class="grid" id="grid"></div>` and the only £ figures anywhere in
     the document were three £0.00 cart placeholders. Anything that could not
     execute JavaScript saw a shop with no products and no prices.
     Classes mirror the client template so there is no visual flash. */
  const gridHtml = live.map((p, i) => {
    const n = payload.stock[p.slug];
    const out = n !== null && n !== undefined && n <= 0;
    return `<article class="card${out ? ' is-sold' : ''}" id="p-${esc(p.slug)}" data-idx="${i}">`
      + `<div class="shot">${out ? '<span class="tag tag--out">Sold out</span>'
          : (p.badge ? `<span class="tag">${esc(p.badge)}</span>` : '')}`
      + `<img class="pshot" src="${esc(p.image || '')}" alt="${esc(p.name)}" `
      + `width="600" height="600" loading="lazy" decoding="async"></div>`
      + `<div class="meta"><h3 class="pname">${esc(p.name)}</h3>`
      + `<p class="pvol">${esc(p.size || '')}</p>`
      + `<p class="pdesc">${esc(p.tagline || '')}</p>`
      + `<div class="prow"><span class="price">${gbp(p.price_pence)}</span>`
      + `<div class="pbtns"><a class="learn" href="/shop/${esc(p.slug)}">Learn more</a>`
      + `${out ? '<button class="add add--out" disabled>Sold out</button>'
               : '<button class="add">Add</button>'}</div></div></div></article>`;
  }).join('');

  let body = await res.text();
  body = body
    .replace('<title>Drewrys, premium haircare, with purpose.</title>', `<title>${title}</title>`)
    .replace('<meta name="description" content="Drewrys, premium haircare, with purpose.">',
             `<meta name="description" content="${desc}">`)
    .replace('<meta property="og:title" content="Drewrys">',
             '<meta property="og:title" content="Drewrys — barber-made haircare, made in the UK">')
    .replace('<div class="grid" id="grid"></div>', `<div class="grid" id="grid">${gridHtml}</div>`)
    .replace('<ul id="flProducts"></ul>', `<ul id="flProducts">${productLinks}</ul>`);

  return html(body.includes('</head>')
    ? body.replace('</head>', inject + ld + '</head>')
    : inject + ld + body);
}

async function renderCheckout(env) {
  const cat = await getCatalogue(env);
  const settings = await getSettings(env);
  const live = cat.products.filter((p) => p.active !== false)
    // Show what will be charged. priceBasket computes the same figure, so a
    // product entered exclusive of VAT cannot display its net price.
    .map((p) => ({ ...p, price_pence: sellingPrice(p, settings) }));
  return html(checkoutHtml({
    products: live,
    stock: await stockMap(env, live),
    zones: zones(settings),
    methods: methods(settings),
    countries: (() => {
      const live = new Set(zones(settings).map((z) => z.id));
      return COUNTRIES.filter((c) => c.zone && live.has(c.zone));
    })(),
    // The hint under the dropdown has to name the zones that are actually on.
    delivers_to: zones(settings).map((z) => z.name),
    free_over: settings.free_over || {},
    collect_address: settings.collect_address || env.SHOP_COLLECT_ADDR || '',
    address_lookup: !!env.ADDRESS_API_KEY,
  }));
}

/* ── content pages ───────────────────────────────────────────────────────── */

/**
 * Everything these pages need, gathered once.
 *
 * The homepage keeps its catalogue in a JS object and builds the grid on the
 * client, so a crawler that does not execute scripts sees a shop with no
 * products and no prices. These pages are the fix: real HTML, real URLs, one
 * product per page, which is also the only shape eligible for product rich
 * results.
 */
async function shopContext(env) {
  const cat = await getCatalogue(env);
  const settings = await getSettings(env);
  const products = cat.products.filter((p) => p.active !== false)
    .map((p) => ({ ...p, price_pence: sellingPrice(p, settings) }));
  const allReviews = await getReviews(env);
  return {
    settings,
    products,
    stock: await stockMap(env, products),
    ingredients: await getIngredients(env),
    reviews: publishedReviews(allReviews),
    ratings: ratingSummary(allReviews),
    freeOver: settings.free_over || {},
  };
}

async function renderProduct(env, slug) {
  const c = await shopContext(env);
  const product = c.products.find((p) => p.slug === slug);
  if (!product) return notFound();

  // "Pairs well with", the same three the upsell offers, minus this one and
  // anything sold out — a cross-sell to something unbuyable is a dead end.
  const related = c.products
    .filter((p) => p.slug !== slug && (c.stock[p.slug] ?? 1) > 0)
    .slice(0, 3);

  return html(productPage({
    product,
    stock: c.stock[product.slug],
    ingredients: c.ingredients,
    related,
    jsonld: productGraph({ biz: BIZ, settings: c.settings, product,
                           stock: c.stock[product.slug], ratings: c.ratings,
                           reviews: c.reviews, freeOver: c.freeOver }),
  }));
}


/* ── crawler plumbing: robots, sitemap, 404 ──────────────────────────────── */

/**
 * robots.txt.
 *
 * Cloudflare was serving a managed file that blocked the AI *training*
 * crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot and friends) while
 * leaving every *retrieval* agent — OAI-SearchBot, ChatGPT-User,
 * Claude-SearchBot, PerplexityBot, Googlebot — allowed. That posture is
 * deliberate and worth keeping: it refuses free training data while still
 * permitting citation, which is what Content-Signal `use=reference` states.
 *
 * The one thing it lacked was a Sitemap: line. Serving our own file keeps the
 * policy and adds the pointer.
 */
function robotsTxt() {
  const body = `# Drewrys — https://drewrys.store
#
# Search and AI *retrieval* are welcome: OAI-SearchBot, ChatGPT-User,
# Claude-SearchBot, Claude-User, PerplexityBot and Googlebot are all allowed
# by the wildcard below and are what put the shop in front of people.
#
# The agents named individually below collect training data rather than
# answer a live query, which is a different bargain. Content-Signal states
# the same thing in one line.

User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
Allow: /
Disallow: /admin
Disallow: /order
Disallow: /checkout
Disallow: /review/

User-agent: Amazonbot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: meta-externalagent
Disallow: /

Sitemap: https://${CANONICAL_HOST}/sitemap.xml
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain;charset=utf-8',
               'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * sitemap.xml, generated from the live catalogue so a product added in
 * /admin appears here without anyone remembering to update a static file.
 * Sold-out products stay listed — they are still the right landing page for
 * the query, and the page says so honestly.
 */
async function sitemapXml(env) {
  const cat = await getCatalogue(env);
  const live = cat.products.filter((p) => p.active !== false);
  const today = new Date().toISOString().slice(0, 10);
  const base = `https://${CANONICAL_HOST}`;

  const urls = [
    { loc: '/', priority: '1.0', freq: 'daily' },
    ...live.map((p) => ({ loc: `/shop/${p.slug}`, priority: '0.8', freq: 'weekly' })),
    { loc: '/terms', priority: '0.3', freq: 'yearly' },
    { loc: '/returns', priority: '0.3', freq: 'yearly' },
    { loc: '/privacy', priority: '0.3', freq: 'yearly' },
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${base}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml;charset=utf-8',
               'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * A 404 that is worth landing on. The previous one returned a correct status
 * with a zero-byte body, so the visitor got a blank white screen and no way
 * back.
 */
function notFound() {
  return html(notFoundPage(), 404);
}

/* ── orders ──────────────────────────────────────────────────────────────── */

async function pushRecent(env, reference) {
  const raw = await env.DREWRYS_KV.get('orders:recent');
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  list = [reference, ...list.filter((r) => r !== reference)].slice(0, 50);
  await env.DREWRYS_KV.put('orders:recent', JSON.stringify(list));
}

/** Put a refunded order's units back on the shelf. The mirror of
 *  decrementStock: products with no stock key are unlimited and left alone. */
async function restoreStock(env, order) {
  for (const item of order.items || []) {
    const cur = await getStock(env, item.sku);
    if (cur === null) continue;
    await env.DREWRYS_KV.put(`stock:${item.sku}`, String(cur + (item.quantity || 0)));
  }
}

async function decrementStock(env, order) {
  for (const item of order.items || []) {
    const cur = await getStock(env, item.sku);
    if (cur === null) continue;                       // unlimited, leave alone
    const next = Math.max(0, cur - (item.quantity || 0));
    await env.DREWRYS_KV.put(`stock:${item.sku}`, String(next));
  }
}

/** A readable text version of an HTML email, for the multipart alternative. */
function toPlainText(markup) {
  return String(markup || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&pound;/g, '\u00a3')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l, i, a) => l || (a[i - 1] || '').length)
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function sendEmail(env, { to, subject, html: bodyHtml, replyTo: replyOverride }) {
  if (!env.SENDGRID_API_KEY || !to) return false;
  const from = env.SHOP_FROM_EMAIL || 'orders@drewrys.store';
  const replyTo = replyOverride || env.SHOP_CONTACT_EMAIL || env.SHOP_ORDER_EMAIL || '';
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: env.SHOP_NAME || 'Drewrys' },
      // Replies to a noreply address are a customer-service own goal, and a
      // missing Reply-To is itself a spam signal.
      reply_to: replyTo ? { email: replyTo, name: env.SHOP_NAME || 'Drewrys' } : undefined,
      subject,
      // A plain-text alternative must come FIRST in this array. HTML with no
      // text part is one of the commonest reasons a properly authenticated
      // domain still lands in junk.
      content: [
        { type: 'text/plain', value: toPlainText(bodyHtml) },
        { type: 'text/html', value: bodyHtml },
      ],
    }),
  });
  if (!r.ok) console.error('sendgrid', r.status, await r.text().catch(() => ''));
  return r.ok;
}

async function sendOrderEmails(env, order) {
  const settings = await getSettings(env);
  const addr = settings.collect_address || env.SHOP_COLLECT_ADDR || '';
  const { customer, owner } = confirmationEmails(order, {
    origin: env.SITE_ORIGIN, collectAddress: addr,
    settings, contactEmail: env.SHOP_CONTACT_EMAIL || env.SHOP_ORDER_EMAIL,
  });
  await sendEmail(env, { to: order.customer?.email,
    subject: `Drewrys order ${order.reference}`, html: customer });
  await sendEmail(env, { to: env.SHOP_ORDER_EMAIL,
    subject: `New order ${order.reference} - ${gbp(order.total)}`, html: owner });
}

/* \u2500\u2500 discount codes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/** The pairs-well upsell percentage, live from settings. 0 disables the offer. */
function pairedPct(settings) {
  const p = normalisePromos(settings).find((x) => x.code === 'PAIRED10');
  return p && p.active && p.type === 'percent' ? p.amount : 0;
}

/**
 * Validate entered codes for the checkout page. The subtotal is computed
 * server-side from the catalogue, so min-spend checks cannot be gamed, and
 * the full code list never reaches the browser. This answer is advisory for
 * display - priceBasket runs the same rules again at payment time and that
 * result is the one that charges.
 */
async function checkPromos(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'bad json' }, 400);

  const cat = await getCatalogue(env);
  const bySlug = Object.fromEntries(cat.products.map((p) => [p.slug, p]));
  let subtotal = 0;
  for (const line of Array.isArray(body.lines) ? body.lines : []) {
    const p = bySlug[line.sku];
    if (!p || p.active === false) continue;
    subtotal += (p.price_pence || 0) * Math.max(1, Math.min(99, parseInt(line.qty, 10) || 0));
  }

  const settings = await getSettings(env);
  const codes = (Array.isArray(body.codes) ? body.codes : []).slice(0, 5);
  const result = evaluatePromos(
    normalisePromos(settings), await getPromoUses(env), codes, subtotal);
  return json(result);
}

/**
 * Pull our order reference out of whatever shape Teya sends.
 *
 * Teya has no documented reference field, so createSession sends our reference
 * only on the return URLs and the Idempotency-Key, and maps session id to
 * reference in KV. The webhook therefore usually arrives carrying a SESSION ID
 * and nothing else, which is why matching on `event.reference` alone silently
 * did nothing: no reference meant an early 200 and no email, no order, no log.
 */
async function resolveReference(env, event) {
  const d = event.data || {};
  const direct = event.reference || d.reference ||
                 event.merchant_reference || d.merchant_reference ||
                 (event.metadata && event.metadata.reference) ||
                 (d.metadata && d.metadata.reference) || '';
  if (direct) return { reference: direct, via: 'reference field' };

  const sessionId = event.session_id || d.session_id ||
                    event.checkout_session_id || d.checkout_session_id ||
                    event.id || d.id || '';
  if (sessionId) {
    const mapped = await env.DREWRYS_KV.get(`session:${sessionId}`);
    if (mapped) return { reference: mapped, via: `session:${sessionId}` };
    return { reference: '', via: `session ${sessionId} not in KV` };
  }
  return { reference: '', via: 'no reference and no session id' };
}

/** Mark an order paid or failed, and fire everything that follows. Used by
 *  both the webhook and the manual reconcile so the two cannot drift. */
async function settleOrder(env, ctx, reference, paid, txn) {
  const stored = await env.DREWRYS_KV.get(`order:${reference}`);
  if (!stored) return { ok: false, reason: 'order not found' };
  const order = JSON.parse(stored);
  if (order.status === 'paid') return { ok: true, reason: 'already paid' };

  order.status = paid ? 'paid' : 'failed';
  order.settled = new Date().toISOString();
  if (txn) order.transaction_id = txn;
  await env.DREWRYS_KV.put(`order:${reference}`, JSON.stringify(order),
    paid ? { expirationTtl: 60 * 60 * 24 * 365 * 7 } : undefined);

  if (paid) {
    await pushRecent(env, reference);
    ctx.waitUntil(decrementStock(env, order));
    ctx.waitUntil(sendOrderEmails(env, order));
    ctx.waitUntil(mirrorOrder(env, order));
    ctx.waitUntil(incrementUses(env, order.promos || (order.promo ? order.promo.split(' ') : [])));
  }
  return { ok: true, status: order.status };
}

/**
 * Ask Teya directly what happened to an order, and settle it from the answer.
 * Recovers anything whose webhook never arrived, and doubles as a way to test
 * the whole email and admin path without depending on the webhook at all.
 *   GET /admin/reconcile?ref=DRW-XXXX&key=<ADMIN_KEY>
 */
async function handleReconcile(request, env, url, ctx) {
  const key = url.searchParams.get('key') || request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return json({ error: 'unauthorised' }, 401);

  const ref = (url.searchParams.get('ref') || '').trim();
  if (!ref) return json({ error: 'pass ?ref=DRW-XXXX' }, 400);

  const stored = await env.DREWRYS_KV.get(`order:${ref}`);
  if (!stored) return json({ error: 'no such order', reference: ref }, 404);
  const order = JSON.parse(stored);

  if (!order.session_id) {
    return json({ reference: ref, status: order.status,
                  error: 'order has no session_id, so Teya cannot be asked' }, 409);
  }

  const res = await getSessionStatus(env, order.session_id);
  if (!res) return json({ reference: ref, error: 'could not reach Teya' }, 502);

  const out = await settleOrder(env, ctx, ref, res.paid, res.transaction_id);
  return json({ reference: ref, session_id: order.session_id,
                teya_status: res.status, transaction_id: res.transaction_id,
                paid: res.paid, result: out });
}

/**
 * Record every hit on a webhook path, whatever it is, so "is Teya even calling
 * us?" stops being a guess. Last 10 kept in KV, readable at
 * /admin/webhook-log?key=<ADMIN_KEY> - no log tail needed.
 */
async function logHook(env, entry) {
  try {
    const raw = await env.DREWRYS_KV.get('webhook:log');
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({ at: new Date().toISOString(), ...entry });
    await env.DREWRYS_KV.put('webhook:log', JSON.stringify(list.slice(0, 10)),
                             { expirationTtl: 60 * 60 * 24 * 30 });
  } catch (e) { console.error('logHook failed', String(e && e.message || e)); }
}

/**
 * One place that answers "what is actually going on with payments".
 *
 * Lists every parked order INCLUDING pending ones. The admin's Orders tab is
 * built from orders:recent, which is only written when an order is PAID, so a
 * checkout that never completed was invisible and its reference unobtainable.
 * That is why there was no DRW- number to reconcile with.
 */
/**
 * GET /admin/vat?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Built from the orders in KV rather than the D1 mirror, because the mirror
 * does not carry the delivery zone and the zone is what decides whether a sale
 * is standard-rated or a zero-rated export.
 */
/**
 * GET /admin/teya-token?scope=refunds/create&key=<ADMIN_KEY>
 *
 * Produces the four things Teya support asked for and nothing else. The access
 * token is redacted before it leaves the Worker, so the output is safe to paste
 * into a support chat.
 */
/**
 * GET /admin/order?ref=DRW-XXXX&key=<ADMIN_KEY>
 *
 * Read only. Shows the fields a refund depends on, so "is the stored
 * transaction id the right shape" can be answered without attempting another
 * refund against a live card.
 */
async function handleOrderPeek(request, env, url) {
  const key = url.searchParams.get('key') || request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return json({ error: 'unauthorised' }, 401);

  const ref = String(url.searchParams.get('ref') || '').trim().slice(0, 40);
  if (!ref) return json({ error: 'pass ref=DRW-XXXX' }, 400);
  const raw = await env.DREWRYS_KV.get(`order:${ref}`);
  if (!raw) return json({ error: 'no order with that reference' }, 404);

  let o = {};
  try { o = JSON.parse(raw); } catch { return json({ error: 'order is not valid json' }, 500); }

  const txn = o.transaction_id || '';
  return new Response(JSON.stringify({
    reference: o.reference,
    status: o.status,
    created: o.created,
    settled: o.settled || null,
    total_pence: o.total,
    session_id: o.session_id || null,
    transaction_id: txn || '(none stored)',
    // The shape is the point: Teya's payment ids start tr_. A session id or a
    // payment link id here would explain a refusal that is nothing to do with
    // the credential.
    transaction_id_looks_like: !txn ? 'nothing stored'
      : (/^tr_/.test(txn) ? 'a Teya payment id (tr_...)'
        : (txn === o.session_id ? 'the SESSION id, not a payment id'
          : 'something else, ' + txn.length + ' chars')),
    refund_state: o.refund_state || null,
    refund: o.refund || null,
    vat_rate: o.vat_rate === undefined ? '(not stamped, predates VAT)' : o.vat_rate,
  }, null, 2), {
    headers: { 'Content-Type': 'application/json;charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function handleTokenDiag(request, env, url) {
  const key = url.searchParams.get('key') || request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return json({ error: 'unauthorised' }, 401);

  const scope = url.searchParams.get('scope') || 'refunds/create';
  const out = await tokenDiagnostic(env, scope, {
    transaction_id: url.searchParams.get('txn') || '',
    merchant_reference: url.searchParams.get('ref') || '',
    amount: url.searchParams.get('amount') || '',
  });
  return new Response(JSON.stringify(out, null, 2), {
    headers: { 'Content-Type': 'application/json;charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function handleVatReport(request, env, url) {
  const key = url.searchParams.get('key') || request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return json({ error: 'unauthorised' }, 401);

  const from = String(url.searchParams.get('from') || '').slice(0, 10);
  const to = String(url.searchParams.get('to') || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return json({ error: 'pass from and to as YYYY-MM-DD' }, 400);
  }

  const orders = [];
  try {
    let cursor;
    do {
      const page = await env.DREWRYS_KV.list({ prefix: 'order:', cursor, limit: 200 });
      for (const k of page.keys) {
        const raw = await env.DREWRYS_KV.get(k.name);
        if (!raw) continue;
        try { orders.push(JSON.parse(raw)); } catch { /* skip */ }
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
  } catch (e) {
    return json({ error: 'could not read orders: ' + String(e && e.message || e) }, 500);
  }

  return json(vatReport(orders, await getSettings(env), from, to));
}

async function handleDiag(request, env, url) {
  const key = url.searchParams.get('key') || request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return json({ error: 'unauthorised' }, 401);

  const orders = [];
  try {
    let cursor;
    do {
      const page = await env.DREWRYS_KV.list({ prefix: 'order:', cursor, limit: 200 });
      for (const k of page.keys) {
        const raw = await env.DREWRYS_KV.get(k.name);
        if (!raw) continue;
        let o = {}; try { o = JSON.parse(raw); } catch { continue; }
        orders.push({
          reference: o.reference, status: o.status, created: o.created,
          settled: o.settled || null, total: o.total,
          email: (o.customer && o.customer.email) || '',
          session_id: o.session_id || null,
        });
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
  } catch (e) {
    return json({ error: 'could not list orders: ' + String(e && e.message || e) }, 500);
  }
  orders.sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')));

  const hookRaw = await env.DREWRYS_KV.get('webhook:log');

  // Presence only. Never echo a secret's value.
  const cfg = {};
  for (const k of ['ADMIN_KEY','TEYA_CLIENT_ID','TEYA_CLIENT_SECRET','TEYA_API_KEY',
                   'TEYA_STORE_ID','TEYA_WEBHOOK_SECRET','SENDGRID_API_KEY',
                   'SHOP_FROM_EMAIL','SHOP_ORDER_EMAIL','SITE_ORIGIN','TEYA_ENV']) {
    cfg[k] = env[k] ? 'set' : 'MISSING';
  }

  return json({
    configured: cfg,
    counts: {
      total: orders.length,
      pending: orders.filter((o) => o.status === 'pending').length,
      paid: orders.filter((o) => o.status === 'paid').length,
      failed: orders.filter((o) => o.status === 'failed').length,
    },
    orders: orders.slice(0, 40),
    webhook_hits: hookRaw ? JSON.parse(hookRaw) : [],
    hint: orders.length === 0
      ? 'No orders parked at all. /create-session is failing before it parks anything, so the checkout never reached Teya.'
      : (orders.some((o) => o.status === 'pending')
          ? 'Pending orders exist, so checkout works and the payment result never came back. Reconcile one with /admin/reconcile?ref=<reference>&key=<ADMIN_KEY>'
          : 'No pending orders.'),
  });
}

async function handleWebhookLog(request, env, url) {
  const key = url.searchParams.get('key') || request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return json({ error: 'unauthorised' }, 401);
  const raw = await env.DREWRYS_KV.get('webhook:log');
  return json({ hits: raw ? JSON.parse(raw) : [],
                note: 'empty means nothing has ever hit a webhook path on this Worker' });
}

async function handleWebhook(request, env, ctx) {
  // A verification ping is often a GET, and a GET here used to fall through to
  // the asset handler and 404, which would make Teya reject the URL at save
  // time with nothing logged anywhere.
  if (request.method !== 'POST') {
    await logHook(env, { method: request.method, path: new URL(request.url).pathname,
                         note: 'non-POST, answered 200' });
    return new Response('ok', { status: 200 });
  }

  const raw = await request.text();
  await logHook(env, {
    method: 'POST',
    path: new URL(request.url).pathname,
    headers: Object.fromEntries([...request.headers].filter(([k]) =>
      /teya|signature|content-type|user-agent/i.test(k))),
    body: raw.slice(0, 900),
  });
  const sig = request.headers.get('teya-signature') || request.headers.get('x-teya-signature');
  if (!(await verifySignature(raw, sig, env.TEYA_WEBHOOK_SECRET))) {
    console.error('webhook REJECTED: signature check failed. header present:', Boolean(sig));
    await logHook(env, { result: 'REJECTED, signature check failed',
                         signatureHeaderPresent: Boolean(sig),
                         secretConfigured: Boolean(env.TEYA_WEBHOOK_SECRET) });
    return new Response('bad signature', { status: 401 });
  }

  let event = {};
  try { event = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

  // Always log the shape. Every webhook problem so far has been a field-name
  // guess, and without this the tail shows nothing at all.
  console.log('webhook in:', JSON.stringify({
    topKeys: Object.keys(event),
    dataKeys: Object.keys(event.data || {}),
    type: event.type || event.event || '',
    status: event.status || (event.data && event.data.status) || '',
    payment_status: event.payment_status || (event.data && event.data.payment_status) || '',
  }));

  const { reference, via } = await resolveReference(env, event);
  if (!reference) {
    console.error('webhook UNMATCHED:', via, '- raw:', raw.slice(0, 600));
    await logHook(env, { result: 'UNMATCHED', why: via });
    return new Response('ok', { status: 200 });
  }
  console.log('webhook matched order', reference, 'via', via);

  const d = event.data || {};
  const status = String(event.payment_status || d.payment_status ||
                        event.status || d.status || event.type || '').toUpperCase();
  const txn = event.transaction_id || d.transaction_id || d.transactionId ||
              (d.payment && (d.payment.transaction_id || d.payment.id)) || '';
  const looksGood = /SUCCE|PAID|COMPLET|CAPTUR/.test(status);
  if (looksGood && !txn) {
    console.warn('webhook says success but carries no transaction id, not marking paid:', reference);
  }
  const out = await settleOrder(env, ctx, reference, looksGood && Boolean(txn), txn);
  if (!out.ok) console.warn('webhook for unknown order', reference);
  await logHook(env, { result: 'MATCHED', reference, via, status, transaction_id: txn,
                       settled: out });
  return new Response('ok', { status: 200 });
}

/* ── reviews ─────────────────────────────────────────────────────────────── */

/**
 * One token, one review. The token is deleted on submission so a forwarded
 * link cannot be used twice, and an unknown token says so rather than
 * silently rendering an empty form.
 */
async function handleReview(request, env, token) {
  const clean = String(token || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);
  if (!clean) return html(reviewGonePage('That link is not valid'), 404);

  const ref = await env.DREWRYS_KV.get(`review:token:${clean}`);
  if (!ref) return html(reviewGonePage('That link has already been used'), 410);

  const raw = await env.DREWRYS_KV.get(`order:${ref}`);
  if (!raw) return html(reviewGonePage('We cannot find that order'), 404);
  const order = JSON.parse(raw);

  if (request.method !== 'POST') return html(reviewFormPage(order, clean));

  const body = await request.json().catch(() => null);
  const rating = Math.max(1, Math.min(5, parseInt(body?.rating, 10) || 0));
  if (!rating) return json({ error: 'Please choose a rating' }, 400);

  const settings = await getSettings(env);
  const review = {
    id: reviewId(),
    reference: ref,
    rating,
    name: String(body.name || order.customer?.name || '').trim().slice(0, 60),
    text: String(body.text || '').trim().slice(0, 1200),
    products: (order.items || []).map((i) => i.sku),
    email: order.customer?.email || '',
    created: new Date().toISOString(),
    status: settings.review_auto_publish ? 'published' : 'pending',
    invited: false,
  };

  const list = await getReviews(env);
  await putReviews(env, [review, ...list]);
  await env.DREWRYS_KV.delete(`review:token:${clean}`);

  // The public invite. `review_ask_from` decides who sees it; see the warning
  // at the top of reviews.js before raising it above 1.
  // review_ask_from of 0 switches the public invite off entirely
  const from = Number(settings.review_ask_from ?? REVIEW_DEFAULTS.review_ask_from);
  const platforms = livePlatforms(settings);
  const invite = platforms.length && from > 0 && rating >= from;

  if (invite) {
    review.invited = true;
    await putReviews(env, [review, ...list]);
    await env.DREWRYS_KV.put(`review:share:${review.id}`, review.id,
      { expirationTtl: 60 * 60 * 24 * 90 });
    if (review.email) {
      await sendEmail(env, {
        to: review.email,
        subject: 'Thank you from Drewrys',
        html: publicReviewInviteEmail(review, {
          origin: env.SITE_ORIGIN,
          settings, contactEmail: env.SHOP_CONTACT_EMAIL || env.SHOP_ORDER_EMAIL,
          platforms,
          shareUrl: `${String(env.SITE_ORIGIN || '').replace(/\/$/, '')}/review/share/${review.id}`,
        }),
      });
    }
  }

  return json({ ok: true, share: invite ? `/review/share/${review.id}` : null });
}

/** Publish, hide, delete, or send the public invite by hand. */
async function moderateReview(env, body) {
  const id = String(body.id || '');
  const action = String(body.action || '');
  const list = await getReviews(env);
  const i = list.findIndex((r) => r.id === id);
  if (i < 0) return json({ error: 'review not found' }, 404);
  const review = list[i];

  if (action === 'publish') review.status = 'published';
  else if (action === 'hide') review.status = 'hidden';
  else if (action === 'pending') review.status = 'pending';
  else if (action === 'delete') list.splice(i, 1);
  else if (action === 'invite') {
    const settings = await getSettings(env);
    const platforms = livePlatforms(settings);
    if (!platforms.length) return json({ error: 'no review link is set' }, 400);
    if (!review.email) return json({ error: 'no email on that review' }, 400);
    await env.DREWRYS_KV.put(`review:share:${review.id}`, review.id,
      { expirationTtl: 60 * 60 * 24 * 90 });
    const ok = await sendEmail(env, {
      to: review.email,
      subject: 'Thank you from Drewrys',
      html: publicReviewInviteEmail(review, {
        origin: env.SITE_ORIGIN,
        settings, contactEmail: env.SHOP_CONTACT_EMAIL || env.SHOP_ORDER_EMAIL,
        platforms,
        shareUrl: `${String(env.SITE_ORIGIN || '').replace(/\/$/, '')}/review/share/${review.id}`,
      }),
    });
    if (ok) review.invited = new Date().toISOString();
    await putReviews(env, list);
    return json({ ok: true, review, emailed: ok });
  } else return json({ error: 'unknown action' }, 400);

  await putReviews(env, list);
  return json({ ok: true, review: action === 'delete' ? null : review });
}

/** Their own words, a copy button, then Google and Facebook. */
async function handleShare(env, id) {
  const clean = String(id || '').replace(/[^a-z0-9]/gi, '').slice(0, 32);
  const list = await getReviews(env);
  const review = list.find((r) => r.id === clean);
  if (!review) return html(reviewGonePage('That link has expired'), 404);
  const platforms = livePlatforms(await getSettings(env));
  if (!platforms.length) return html(reviewGonePage('Nothing to share just yet'), 404);
  return html(reviewSharePage(review, platforms));
}

/** Daily: send any review request that has come due. */
async function sendDueReviewRequests(env) {
  const due = await takeDue(env);
  let sent = 0;
  for (const item of due) {
    const raw = await env.DREWRYS_KV.get(`order:${item.reference}`);
    if (!raw) continue;
    const order = JSON.parse(raw);
    if (order.review_requested) continue;

    const token = newToken();
    await env.DREWRYS_KV.put(`review:token:${token}`, item.reference,
      { expirationTtl: 60 * 60 * 24 * 60 });

    const ok = await sendEmail(env, {
      to: item.email,
      subject: `How did we do?`,
      html: reviewRequestEmail(order, {
        origin: env.SITE_ORIGIN,
        settings: await getSettings(env),
        contactEmail: env.SHOP_CONTACT_EMAIL || env.SHOP_ORDER_EMAIL,
        token,
      }),
    });
    if (ok) {
      order.review_requested = new Date().toISOString();
      await env.DREWRYS_KV.put(`order:${item.reference}`, JSON.stringify(order),
        { expirationTtl: 60 * 60 * 24 * 365 * 7 });
      sent += 1;
    }
  }
  return { due: due.length, sent };
}

/* ── admin ───────────────────────────────────────────────────────────────── */

async function recentOrders(env) {
  const raw = await env.DREWRYS_KV.get('orders:recent');
  let refs = [];
  try { refs = raw ? JSON.parse(raw) : []; } catch { refs = []; }
  const out = [];
  for (const r of refs.slice(0, 25)) {
    const o = await env.DREWRYS_KV.get(`order:${r}`);
    if (o) { try { out.push(JSON.parse(o)); } catch {} }
  }
  return out;
}

/**
 * Mark an order sent (or collected), and tell the customer once.
 *
 * `resend` exists so a merchant can re-send deliberately; marking an order
 * twice never re-sends by accident. `undo` clears the status AND the sent
 * flag, so correcting a mistake and re-marking does email properly.
 */
/**
 * Move an order along, and tell the customer at the right moment.
 *
 *   collection:  paid -> ready (emails "come and get it") -> collected (silent)
 *   delivery:    paid -> dispatched (emails "it's on its way")
 *
 * Emailing on "collected" would have told someone it was ready to collect
 * after they had already walked out with it, which is why collection has two
 * steps rather than one.
 *
 * Each email sends ONCE, tracked per stage in order.notified, so re-marking
 * never re-sends. Resend is explicit. Undo steps back one stage and clears
 * that stage's flag so a corrected mistake does email properly.
 */
const STAGE_EMAIL = { ready: 'ready', collected: 'collected', dispatched: 'dispatched' };

async function fulfilOrder(env, body, ctx) {
  const ref = String(body.reference || '').slice(0, 40);
  if (!ref) return json({ error: 'no reference' }, 400);

  const raw = await env.DREWRYS_KV.get(`order:${ref}`);
  if (!raw) return json({ error: 'order not found' }, 404);

  const order = JSON.parse(raw);
  const collect = order.fulfilment === 'collect';
  const action = String(body.action || '');
  order.notified = order.notified || {};

  if (action === 'undo') {
    const back = { collected: 'ready', ready: 'paid', dispatched: 'paid' };
    const to = back[order.status];
    if (!to) return json({ error: 'nothing to undo' }, 400);
    if (STAGE_EMAIL[order.status]) delete order.notified[order.status];
    if (to === 'paid') delete order.fulfilled;
    order.status = to;
  } else if (action === 'ready' && collect) {
    order.status = 'ready';
    order.ready_at = new Date().toISOString();
  } else if (action === 'collected' && collect) {
    order.status = 'collected';
    order.fulfilled = new Date().toISOString();
  } else if (action === 'dispatch' && !collect) {
    order.carrier = String(body.carrier || '').slice(0, 30);
    order.tracking = String(body.tracking || '').trim().slice(0, 60);
    order.status = 'dispatched';
    order.fulfilled = new Date().toISOString();
  } else if (action === 'refund' || action === 'cancel') {
    // Same money movement, two different situations, so two different emails.
    //   cancel  the order has NOT gone out yet. It is stopped and refunded.
    //   refund  it has already been collected or dispatched, and is coming back.
    const cancelling = action === 'cancel';
    const gone = order.status === 'collected' || order.status === 'dispatched';

    if (order.status === 'pending' || order.status === 'failed') {
      return json({ error: 'that order was never paid' }, 400);
    }
    if (cancelling && gone) {
      return json({ error: 'that order has already gone out, refund it instead' }, 400);
    }
    if (!cancelling && !gone) {
      return json({ error: 'that order has not gone out yet, cancel it instead' }, 400);
    }
    if (!order.transaction_id) {
      return json({ error: 'no transaction id on this order, so Teya cannot be asked' }, 409);
    }
    if (order.status === 'refunded' || order.status === 'cancelled') {
      return json({ error: 'the money has already been returned on this order' }, 409);
    }
    if (order.refund_state === 'pending') {
      return json({ error: 'a refund is already in progress with Teya for this order' }, 409);
    }

    const reason = String(body.reason || '');
    if (!RETURN_REASONS.some((r) => r.id === reason)) {
      return json({ error: cancelling ? 'pick a reason for the cancellation'
                                      : 'pick a reason for the return' }, 400);
    }
    // A cancelled order never left the shop, so its stock always goes back and
    // there is nothing to ask. Only a return can come back unsellable.
    const restock = cancelling ? true : body.restock === true;
    const noRestockReason = restock ? '' : String(body.no_restock_reason || '');
    if (!restock && !NO_RESTOCK_REASONS.some((r) => r.id === noRestockReason)) {
      return json({ error: 'say why it cannot go back on the shelf' }, 400);
    }

    // FULL only, and the amount comes from the ORDER, never the browser.
    const amount = order.total || 0;
    const res = await refundPayment(env, {
      transactionId: order.transaction_id, amount, reference: ref,
    });

    // A 202 or PENDING is NOT done. Park it and tell the truth.
    if (res.pending) {
      order.refund_state = 'pending';
      order.refund_attempted = new Date().toISOString();
      await env.DREWRYS_KV.put(`order:${ref}`, JSON.stringify(order),
        { expirationTtl: 60 * 60 * 24 * 365 * 7 });
      return json({ error: res.error, pending: true, order }, 202);
    }
    if (!res.ok) return json({ error: res.error || 'the refund was declined' }, 502);

    order.refund = {
      at: new Date().toISOString(), amount, kind: cancelling ? 'cancel' : 'refund',
      reason, reason_label: reasonLabel(RETURN_REASONS, reason),
      note: String(body.note || '').slice(0, 300),
      restocked: restock,
      no_restock_reason: noRestockReason,
      no_restock_label: restock ? '' : reasonLabel(NO_RESTOCK_REASONS, noRestockReason),
      refund_id: res.refund_id, approval_code: res.approval_code,
      response_code: res.response_code || '',
      teya_created_at: res.created_at || '',
      amount_settled: res.amount_settled === null || res.amount_settled === undefined
        ? amount : res.amount_settled,
    };
    order.refund_state = 'refunded';
    order.status = cancelling ? 'cancelled' : 'refunded';

    if (restock) ctx.waitUntil(restoreStock(env, order));

    if (order.customer?.email) {
      const build = cancelling ? cancelledEmail : refundEmail;
      ctx.waitUntil(sendEmail(env, {
        to: order.customer.email,
        subject: cancelling ? `Your Drewrys order ${ref} has been cancelled`
                            : `Your Drewrys refund for order ${ref}`,
        html: build(order, {
          origin: env.SITE_ORIGIN, amount,
          settings: await getSettings(env),
          contactEmail: env.SHOP_CONTACT_EMAIL || env.SHOP_ORDER_EMAIL,
        }),
      }));
    }
  } else if (action !== 'resend') {
    return json({ error: 'that action does not apply to this order' }, 400);
  }

  await env.DREWRYS_KV.put(`order:${ref}`, JSON.stringify(order),
    { expirationTtl: 60 * 60 * 24 * 365 * 7 });

  if (order.status === 'collected' || order.status === 'dispatched') {
    await queueReviewRequest(env, order, await getSettings(env));
  }

  const stage = STAGE_EMAIL[order.status];
  const wants = stage && (action === 'resend' || !order.notified[stage]);
  if (wants && order.customer?.email) {
    const settings = await getSettings(env);
    const addr = settings.collect_address || env.SHOP_COLLECT_ADDR || '';
    const opts = { origin: env.SITE_ORIGIN, collectAddress: addr,
      settings, contactEmail: env.SHOP_CONTACT_EMAIL || env.SHOP_ORDER_EMAIL };
    const byStage = {
      ready: { subject: `Your Drewrys order ${ref} is ready to collect`,
               html: () => readyEmail(order, opts) },
      collected: { subject: `Your Drewrys order ${ref} - collected`,
                   html: () => collectedEmail(order, opts) },
      dispatched: { subject: `Your Drewrys order ${ref} is on its way`,
                    html: () => dispatchedEmail(order, opts) },
    }[order.status];
    const ok = await sendEmail(env, {
      to: order.customer.email, subject: byStage.subject, html: byStage.html(),
    });
    if (ok) {
      order.notified[stage] = new Date().toISOString();
      await env.DREWRYS_KV.put(`order:${ref}`, JSON.stringify(order),
        { expirationTtl: 60 * 60 * 24 * 365 * 7 });
    }
    return json({ ok: true, order, emailed: ok });
  }

  return json({ ok: true, order, emailed: false });
}

/** Uploaded product photos are stored in KV and served from /media/<slug>. */
async function saveImage(env, slug, dataUrl) {
  const m = /^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) return null;
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  if (bytes.length > 2_000_000) return null;
  await env.DREWRYS_KV.put(`img:${slug}`, m[2], { metadata: { type: m[1] } });
  return `/media/${slug}?v=${Date.now().toString(36)}`;
}

async function serveImage(env, slug) {
  const { value, metadata } = await env.DREWRYS_KV.getWithMetadata(`img:${slug}`);
  if (!value) return new Response('not found', { status: 404 });
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      'Content-Type': (metadata && metadata.type) || 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Uploaded SVGs are same-origin. Loaded via <img> a browser will not run
      // script inside one, but if anything ever fetches these directly this
      // stops an uploaded file behaving like a page.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function handleAdmin(request, env, url, ctx) {
  const key = url.searchParams.get('key') || request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    if (request.method === 'POST') return json({ error: 'Unauthorized' }, 401);
    return html(GATE, 401);
  }

  // Dashboard figures. Same auth as the rest of the admin, so there is only
  // ever one way in.
  const report = url.searchParams.get('report');
  if (report) {
    return json(await dashboardData(
      env, report,
      url.searchParams.get('sales') || 'day',
      url.searchParams.get('visitors') || 'daily',
    ));
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'bad json' }, 400);

    // order actions are immediate, not part of the save-draft flow
    if (body.order) return fulfilOrder(env, body.order, ctx);
    if (body.review) return moderateReview(env, body.review);

    // Photos first, so the catalogue can be written with their final URLs.
    const savedImages = {};
    if (body.images && typeof body.images === 'object') {
      for (const [slug, dataUrl] of Object.entries(body.images)) {
        const url2 = await saveImage(env, slug, dataUrl);
        if (url2) savedImages[slug] = url2;
      }
    }

    if (body.catalogue && Array.isArray(body.catalogue.products)) {
      const clean = {
        currency: 'GBP',
        updated: new Date().toISOString(),
        products: body.catalogue.products.map((p) => ({
          slug: String(p.slug).slice(0, 60),
          name: String(p.name || '').slice(0, 120),
          size: String(p.size || '').slice(0, 40),
          tagline: String(p.tagline || '').slice(0, 200),
          badge: String(p.badge || '').slice(0, 40),
          image: savedImages[p.slug] || String(p.image || '')
                 || (p.image_key ? `/img/product-${p.image_key}.png` : ''),
          description: String(p.description || '').slice(0, 2000),
          price_pence: Math.max(0, parseInt(p.price_pence, 10) || 0),
          vat_applicable: p.vat_applicable !== false,
          price_mode: p.price_mode === 'exc' ? 'exc' : 'inc',
          ingredients: Array.isArray(p.ingredients) ? p.ingredients : [],
          howto: Array.isArray(p.howto) ? p.howto : [],
          active: p.active !== false,
        })),
      };
      await env.DREWRYS_KV.put('catalogue', JSON.stringify(clean));
    }

    if (Array.isArray(body.ingredients)) {
      const lib = [];
      for (const g of body.ingredients) {
        const slug = String(g.slug || '').slice(0, 60);
        if (!slug) continue;
        let icon = String(g.icon || '');
        if (g.icon_upload) {
          const saved = await saveImage(env, `ing-${slug}`, g.icon_upload);
          if (saved) icon = saved;
        }
        lib.push({
          name: String(g.name || '').slice(0, 60),
          slug, icon,
          bullets: (Array.isArray(g.bullets) ? g.bullets : [])
            .map((b) => String(b).slice(0, 120)).filter(Boolean).slice(0, 6),
          text: String(g.text || '').slice(0, 1200),
        });
      }
      await env.DREWRYS_KV.put('ingredients', JSON.stringify(lib));
      savedImages.__ingredients = lib;
    }

    if (body.stock && typeof body.stock === 'object') {
      for (const [slug, v] of Object.entries(body.stock)) {
        if (v === null || v === '') await env.DREWRYS_KV.delete(`stock:${slug}`);
        else await env.DREWRYS_KV.put(`stock:${slug}`, String(Math.max(0, parseInt(v, 10) || 0)));
      }
    }

    if (body.settings) {
      const st = body.settings;
      const clean = {
        ...DEFAULT_SETTINGS,
        ...st,
        collect_address: String(st.collect_address || '').slice(0, 300),
        zones: (Array.isArray(st.zones) ? st.zones : DEFAULT_SETTINGS.zones)
          .map((z) => ({
            id: String(z.id || '').slice(0, 20),
            name: String(z.name || '').slice(0, 60),
            placeholder: String(z.placeholder || '').slice(0, 30),
            active: z.active !== false,
          })).filter((z) => z.id && z.name),
        shipping_methods: (Array.isArray(st.shipping_methods)
          ? st.shipping_methods : DEFAULT_SETTINGS.shipping_methods)
          .map((m) => ({
            id: String(m.id || '').slice(0, 40),
            zone: String(m.zone || '').slice(0, 20),
            name: String(m.name || '').slice(0, 60),
            note: String(m.note || '').slice(0, 90),
            price: Math.max(0, parseInt(m.price, 10) || 0),
            active: m.active !== false,
          })).filter((m) => m.id && m.zone && m.name),
        free_over: Object.fromEntries(Object.entries(st.free_over || {})
          .map(([k, v]) => [k, Math.max(0, parseInt(v, 10) || 0)])),
        review_delay_collect: Math.max(0, parseInt(st.review_delay_collect, 10) || 0),
        review_delay_deliver: Math.max(0, parseInt(st.review_delay_deliver, 10) || 0),
        review_ask_from: Math.max(0, Math.min(5, parseInt(st.review_ask_from, 10) || 0)),
        review_google_url: String(st.review_google_url || '').slice(0, 400),
        review_facebook_url: String(st.review_facebook_url || '').slice(0, 400),
        // Footer links. Anything left empty hides its link rather than
        // rendering a dead "#" that jumps to the top of the page.
        instagram_url: String(st.instagram_url || '').slice(0, 400),
        facebook_url: String(st.facebook_url || '').slice(0, 400),
        contact_email: String(st.contact_email || '').slice(0, 200),
        feature_quote: String(st.feature_quote || '').slice(0, 400),
        feature_name: String(st.feature_name || '').slice(0, 80),
        feature_sub: String(st.feature_sub || '').slice(0, 80),
        vat_registered: st.vat_registered === true,
        vat_number: String(st.vat_number || '').slice(0, 30),
        vat_rate: (st.vat_rate === undefined || st.vat_rate === null || st.vat_rate === '')
          ? DEFAULT_SETTINGS.vat_rate
          : Math.max(0, Math.min(30, Number(st.vat_rate) || 0)),
        review_auto_publish: st.review_auto_publish === true,
        promos: (Array.isArray(st.promos) ? st.promos : normalisePromos({ promos: st.promos }))
          .map(cleanPromo).filter(Boolean).slice(0, 100),
      };
      await env.DREWRYS_KV.put('settings', JSON.stringify(clean));
    }

    return json({ ok: true, images: savedImages });
  }

  const cat = await getCatalogue(env);
  const adminSettings = await getSettings(env);
  adminSettings.promos = normalisePromos(adminSettings);
  return html(adminHtml({
    catalogue: cat,
    settings: adminSettings,
    stock: await stockMap(env, cat.products),
    orders: await recentOrders(env),
    ingredients: await getIngredients(env),
    carriers: CARRIERS,
    return_reasons: RETURN_REASONS,
    no_restock_reasons: NO_RESTOCK_REASONS,
    leads: await listLeads(env),
    vat_periods: vatPeriods(),
    vat: vatSettings(adminSettings),
    reviews: await getReviews(env),
    platforms: livePlatforms(adminSettings),
    promo_uses: await getPromoUses(env),
  }));
}

/* ── router ──────────────────────────────────────────────────────────────── */

export default {
  /**
   * Cron. Sends review requests that have come due. Runs daily; the queue
   * carries its own due timestamps so the exact hour does not matter.
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const r = await sendDueReviewRequests(env);
        console.log('review requests', JSON.stringify(r));
        const rep = await rollupAndPrune(env);
        console.log('reporting rollup', JSON.stringify(rep));
      } catch (e) { console.error('cron failed', e); }
    })());
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Consolidate on https://drewrys.store before anything else runs, so the
    // rest of the Worker only ever sees one origin.
    const redirect = canonicalRedirect(request, url);
    if (redirect) return redirect;

    if (request.method === 'GET') ctx.waitUntil(recordHit(request, env, path));
    try {
      const res = await route(request, env, ctx, url, path);
      return harden(res, { cache: cacheFor(path) });
    } catch (e) {
      console.error(e);
      return harden(new Response('Server error: ' + e.message, { status: 500 }));
    }
  },
};

/**
 * Routing proper.
 *
 * A module-level function rather than a method on the default export: the
 * runtime may invoke `fetch` detached from the object, in which case `this`
 * is undefined and `this.route(...)` throws on every request. Every return
 * here passes back through harden() in fetch().
 */
async function route(request, env, ctx, url, path) {
      if (path === '/' || path === '/index.html') return renderSite(request, env);
      if (path === '/checkout') return renderCheckout(env);

      // Crawler plumbing.
      if (path === '/robots.txt') return robotsTxt();
      if (path === '/sitemap.xml') return sitemapXml(env);

      // A real page per product, for search engines only.
      if (path.startsWith('/shop/')) {
        return renderProduct(env, decodeURIComponent(path.slice(6)).replace(/\/+$/, ''));
      }

      if (path.startsWith('/review/share/')) return handleShare(env, path.slice(14));
      if (path.startsWith('/review/')) return handleReview(request, env, path.slice(8));
      if (path === '/api/address') return lookupPostcode(request, env, url);
      if (path === '/api/promo' && request.method === 'POST') return checkPromos(request, env);
      if (path === '/api/catalogue') {
        // The PUBLIC view, identical to what the homepage injects: hidden
        // products stay hidden, and prices are the SELLING price so a product
        // entered exclusive of VAT cannot show its net figure. The raw
        // catalogue is admin-only. Before this filter the endpoint leaked
        // drafts and net prices to anyone who knew the URL.
        const cat = await getCatalogue(env);
        const settings = await getSettings(env);
        const live = cat.products.filter((p) => p.active !== false)
          .map((p) => ({ ...p, price_pence: sellingPrice(p, settings) }));
        return json({ ...cat, products: live, stock: await stockMap(env, live) });
      }
      if (path === '/create-session' && request.method === 'POST') return createSession(request, env);
      if (path === '/api/subscribe' && request.method === 'POST') return subscribe(request, env);
      if (path === '/api/enquiry' && request.method === 'POST') {
        return enquiry(request, env, ctx, sendEmail);
      }
      if (path === '/api/contact' && request.method === 'POST') {
        return contact(request, env, ctx, sendEmail);
      }
      if (path === '/unsubscribe') return unsubscribe(request, env, url);
      // Accept every path Teya might have been pointed at. A mismatch used to
      // 404 into the asset handler and leave no trace at all.
      if (/^\/(webhook|teya-webhook|webhooks\/teya|teya\/webhook)$/.test(path)) {
        return handleWebhook(request, env, ctx);
      }
      if (path === '/admin/order') return handleOrderPeek(request, env, url);
      if (path === '/admin/teya-token') return handleTokenDiag(request, env, url);
      if (path === '/admin/teya-paths') {
        const k = url.searchParams.get('key') || request.headers.get('x-admin-key') || '';
        if (!env.ADMIN_KEY || k !== env.ADMIN_KEY) return json({ error: 'unauthorised' }, 401);
        return new Response(JSON.stringify(await pathProbe(env), null, 2),
          { headers: { 'Content-Type': 'application/json;charset=utf-8',
                       'Cache-Control': 'no-store' } });
      }
      if (path === '/admin/vat') return handleVatReport(request, env, url);
      if (path === '/admin/diag') return handleDiag(request, env, url);
      if (path === '/admin/webhook-log') return handleWebhookLog(request, env, url);
      if (path === '/admin/reconcile') return handleReconcile(request, env, url, ctx);
      if (path === '/order') {
        // A page that refreshes itself while waiting for the webhook must never
        // be served from cache, or the customer sits on a stale "still being
        // confirmed" forever however many times it reloads.
        return new Response(
          await orderConfirmationPage(env, (url.searchParams.get('ref') || '').trim(),
                                    await getSettings(env)),
          { headers: { 'Content-Type': 'text/html;charset=utf-8',
                       'Cache-Control': 'no-store, must-revalidate' } });
      }
      if (path === '/terms') return html(TERMS);
      if (path === '/returns') return html(RETURNS);
      if (path === '/privacy') return html(PRIVACY);
      if (path === '/admin') return handleAdmin(request, env, url, ctx);
      if (path.startsWith('/media/')) return serveImage(env, decodeURIComponent(path.slice(7).split('?')[0]));

      // Trailing slashes used to dead-end: /terms/ was a hard 404 rather than
      // a redirect, so any inbound link written with one was lost.
      if (path.length > 1 && path.endsWith('/')) {
        const t = new URL(url.toString());
        t.pathname = path.replace(/\/+$/, '');
        return Response.redirect(t.toString(), 301);
      }

      if (env.ASSETS) {
        const asset = await env.ASSETS.fetch(request);
        if (asset.status !== 404) return asset;
      }
      return notFound();
}
