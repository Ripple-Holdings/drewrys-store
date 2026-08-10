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
  getIngredients, getSessionStatus, DEFAULT_SETTINGS,
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
import { recordHit, mirrorOrder, rollupAndPrune, dashboardData } from './reports.js';
import { cleanPromo, normalisePromos, getPromoUses, incrementUses, evaluatePromos } from './promos.js';


const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gbp = (pence) => '£' + (Number(pence || 0) / 100).toFixed(2);
const json = (d, status = 200) => new Response(JSON.stringify(d), {
  status, headers: { 'Content-Type': 'application/json' },
});
const html = (markup, status = 200) => new Response(markup, {
  status, headers: { 'Content-Type': 'text/html;charset=utf-8' },
});

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
  const live = cat.products.filter((p) => p.active !== false);
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
    payments_live: !!(env.TEYA_API_KEY && env.TEYA_STORE_ID),
    address_lookup: !!env.ADDRESS_API_KEY,
  };

  const inject = `<script>window.__DREWRYS__=${
    JSON.stringify(payload).replace(/</g, '\\u003c')
  };</script>`;

  const body = await res.text();
  return html(body.includes('</head>')
    ? body.replace('</head>', inject + '</head>')
    : inject + body);
}

async function renderCheckout(env) {
  const cat = await getCatalogue(env);
  const settings = await getSettings(env);
  const live = cat.products.filter((p) => p.active !== false);
  return html(checkoutHtml({
    products: live,
    stock: await stockMap(env, live),
    zones: zones(settings),
    methods: methods(settings),
    countries: COUNTRIES.filter((c) => c.zone),
    free_over: settings.free_over || {},
    collect_address: settings.collect_address || env.SHOP_COLLECT_ADDR || '',
    address_lookup: !!env.ADDRESS_API_KEY,
  }));
}

/* ── orders ──────────────────────────────────────────────────────────────── */

async function pushRecent(env, reference) {
  const raw = await env.DREWRYS_KV.get('orders:recent');
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  list = [reference, ...list.filter((r) => r !== reference)].slice(0, 50);
  await env.DREWRYS_KV.put('orders:recent', JSON.stringify(list));
}

async function decrementStock(env, order) {
  for (const item of order.items || []) {
    const cur = await getStock(env, item.sku);
    if (cur === null) continue;                       // unlimited, leave alone
    const next = Math.max(0, cur - (item.quantity || 0));
    await env.DREWRYS_KV.put(`stock:${item.sku}`, String(next));
  }
}

async function sendEmail(env, { to, subject, html: bodyHtml }) {
  if (!env.SENDGRID_API_KEY || !to) return false;
  const from = env.SHOP_FROM_EMAIL || 'orders@drewrys.store';
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: env.SHOP_NAME || 'Drewrys' },
      subject,
      content: [{ type: 'text/html', value: bodyHtml }],
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
    contactEmail: env.SHOP_CONTACT_EMAIL || env.SHOP_ORDER_EMAIL,
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

async function handleWebhook(request, env, ctx) {
  const raw = await request.text();
  const sig = request.headers.get('teya-signature') || request.headers.get('x-teya-signature');
  if (!(await verifySignature(raw, sig, env.TEYA_WEBHOOK_SECRET))) {
    console.error('webhook REJECTED: signature check failed. header present:', Boolean(sig));
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
          contactEmail: env.SHOP_CONTACT_EMAIL || env.SHOP_ORDER_EMAIL,
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
        contactEmail: env.SHOP_CONTACT_EMAIL || env.SHOP_ORDER_EMAIL,
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

async function fulfilOrder(env, body) {
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
      contactEmail: env.SHOP_CONTACT_EMAIL || env.SHOP_ORDER_EMAIL };
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

async function handleAdmin(request, env, url) {
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
    if (body.order) return fulfilOrder(env, body.order);
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
    if (request.method === 'GET') ctx.waitUntil(recordHit(request, env, path));
    try {
      if (path === '/' || path === '/index.html') return renderSite(request, env);
      if (path === '/checkout') return renderCheckout(env);
      if (path.startsWith('/review/share/')) return handleShare(env, path.slice(14));
      if (path.startsWith('/review/')) return handleReview(request, env, path.slice(8));
      if (path === '/api/address') return lookupPostcode(request, env, url);
      if (path === '/api/promo' && request.method === 'POST') return checkPromos(request, env);
      if (path === '/api/catalogue') {
        const cat = await getCatalogue(env);
        return json({ ...cat, stock: await stockMap(env, cat.products) });
      }
      if (path === '/create-session' && request.method === 'POST') return createSession(request, env);
      if (path === '/webhook' && request.method === 'POST') return handleWebhook(request, env, ctx);
      if (path === '/admin/reconcile') return handleReconcile(request, env, url, ctx);
      if (path === '/terms') return html(TERMS);
      if (path === '/returns') return html(RETURNS);
      if (path === '/privacy') return html(PRIVACY);
      if (path === '/admin') return handleAdmin(request, env, url);
      if (path.startsWith('/media/')) return serveImage(env, decodeURIComponent(path.slice(7).split('?')[0]));
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('Not found', { status: 404 });
    } catch (e) {
      console.error(e);
      return new Response('Server error: ' + e.message, { status: 500 });
    }
  },
};
