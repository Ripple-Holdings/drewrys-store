/**
 * Drewrys — storefront Worker.
 *
 *   /                    the site: shell.html from ASSETS with the live
 *                        catalogue injected before </head>
 *   /api/catalogue       same data as JSON
 *   /create-session      POST, starts a Teya hosted checkout
 *   /webhook             POST, Teya payment result
 *   /admin               PIN-gated portal: Catalogue · Stock · Orders
 *   everything else      static asset
 *
 * The page is public/shell.html on purpose — see the note in wrangler.toml.
 */

import {
  createSession, verifySignature, getCatalogue, getSettings, getStock,
  DEFAULT_SETTINGS,
} from './teya.js';
import { GATE, adminHtml } from './admin.js';

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

  const payload = {
    products: live,
    stock: await stockMap(env, live),
    shipping: settings.shipping,
    free_over: settings.free_over,
    payments_live: !!(env.TEYA_API_KEY && env.TEYA_STORE_ID),
  };

  const inject = `<script>window.__DREWRYS__=${
    JSON.stringify(payload).replace(/</g, '\\u003c')
  };</script>`;

  const body = await res.text();
  return html(body.includes('</head>')
    ? body.replace('</head>', inject + '</head>')
    : inject + body);
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

function orderRows(order) {
  return (order.items || []).map((i) =>
    `<tr><td style="padding:6px 0">${esc(i.name)} &times; ${i.quantity}</td>
     <td align="right">${gbp(i.unit_amount * i.quantity)}</td></tr>`).join('');
}

function orderTable(order) {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">
    ${orderRows(order)}
    <tr><td style="padding-top:10px">Subtotal</td><td align="right" style="padding-top:10px">${gbp(order.subtotal)}</td></tr>
    ${order.discount ? `<tr><td>Discount${order.promo ? ' (' + esc(order.promo) + ')' : ''}</td><td align="right">&minus;${gbp(order.discount)}</td></tr>` : ''}
    <tr><td>${order.fulfilment === 'collect' ? 'Collection' : 'Delivery'}</td><td align="right">${order.shipping ? gbp(order.shipping) : 'Free'}</td></tr>
    <tr><td style="padding-top:8px;font-weight:700">Total</td><td align="right" style="padding-top:8px;font-weight:700">${gbp(order.total)}</td></tr>
  </table>`;
}

async function sendOrderEmails(env, order) {
  const collect = order.fulfilment === 'collect';
  const addr = env.SHOP_COLLECT_ADDR || '';
  const cust = `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#191C21">
    <h2 style="font-weight:600">Thanks${order.customer?.name ? ', ' + esc(order.customer.name.split(' ')[0]) : ''}.</h2>
    <p>We've got your order. Reference <b>${esc(order.reference)}</b>.</p>
    ${orderTable(order)}
    <p style="margin-top:18px">${collect
      ? 'Ready to collect from the shop' + (addr ? ' &mdash; ' + esc(addr) : '') + '. We\'ll be in touch when it\'s ready.'
      : 'We\'ll drop you a line when it\'s on its way.'}</p>
    <p style="color:#6b6b6b;font-size:12px;margin-top:24px">Drewrys</p></div>`;

  const owner = `<div style="font-family:system-ui,sans-serif;max-width:520px">
    <h2>New order ${esc(order.reference)}</h2>
    ${orderTable(order)}
    <p style="margin-top:14px"><b>${collect ? 'COLLECTION' : 'DELIVERY'}</b><br>
    ${esc(order.customer?.name || '')}<br>${esc(order.customer?.email || '')}<br>
    ${esc(order.customer?.phone || '')}<br>${esc(order.customer?.address || '')} ${esc(order.customer?.postcode || '')}</p></div>`;

  await sendEmail(env, { to: order.customer?.email, subject: `Drewrys order ${order.reference}`, html: cust });
  await sendEmail(env, { to: env.SHOP_ORDER_EMAIL, subject: `New order ${order.reference} — ${gbp(order.total)}`, html: owner });
}

async function handleWebhook(request, env, ctx) {
  const raw = await request.text();
  const sig = request.headers.get('teya-signature') || request.headers.get('x-teya-signature');
  if (!(await verifySignature(raw, sig, env.TEYA_WEBHOOK_SECRET))) {
    return new Response('bad signature', { status: 401 });
  }

  let event = {};
  try { event = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

  const reference = event.reference || event.data?.reference || '';
  const status = String(event.status || event.data?.status || event.type || '').toLowerCase();
  const paid = /succeed|success|paid|complete|captur/.test(status);
  if (!reference) return new Response('ok', { status: 200 });

  const stored = await env.DREWRYS_KV.get(`order:${reference}`);
  if (!stored) { console.warn('webhook for unknown order', reference); return new Response('ok', { status: 200 }); }

  const order = JSON.parse(stored);
  if (order.status === 'paid') return new Response('ok', { status: 200 }); // idempotent

  order.status = paid ? 'paid' : 'failed';
  order.settled = new Date().toISOString();
  await env.DREWRYS_KV.put(`order:${reference}`, JSON.stringify(order));

  if (paid) {
    await pushRecent(env, reference);
    ctx.waitUntil(decrementStock(env, order));
    ctx.waitUntil(sendOrderEmails(env, order));
  }
  return new Response('ok', { status: 200 });
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

/** Uploaded product photos are stored in KV and served from /media/<slug>. */
async function saveImage(env, slug, dataUrl) {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
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
    },
  });
}

async function handleAdmin(request, env, url) {
  const key = url.searchParams.get('key') || request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    if (request.method === 'POST') return json({ error: 'Unauthorized' }, 401);
    return html(GATE, 401);
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'bad json' }, 400);

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

    if (body.stock && typeof body.stock === 'object') {
      for (const [slug, v] of Object.entries(body.stock)) {
        if (v === null || v === '') await env.DREWRYS_KV.delete(`stock:${slug}`);
        else await env.DREWRYS_KV.put(`stock:${slug}`, String(Math.max(0, parseInt(v, 10) || 0)));
      }
    }

    if (body.settings) {
      await env.DREWRYS_KV.put('settings', JSON.stringify({ ...DEFAULT_SETTINGS, ...body.settings }));
    }

    return json({ ok: true, images: savedImages });
  }

  const cat = await getCatalogue(env);
  return html(adminHtml({
    catalogue: cat,
    settings: await getSettings(env),
    stock: await stockMap(env, cat.products),
    orders: await recentOrders(env),
  }));
}

/* ── router ──────────────────────────────────────────────────────────────── */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/' || path === '/index.html') return renderSite(request, env);
      if (path === '/api/catalogue') {
        const cat = await getCatalogue(env);
        return json({ ...cat, stock: await stockMap(env, cat.products) });
      }
      if (path === '/create-session' && request.method === 'POST') return createSession(request, env);
      if (path === '/webhook' && request.method === 'POST') return handleWebhook(request, env, ctx);
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
