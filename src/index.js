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
  getIngredients, DEFAULT_SETTINGS,
} from './teya.js';
import { GATE, adminHtml } from './admin.js';
import { zones, methods } from './shipping.js';
import { COUNTRIES } from './countries.js';
import { lookupPostcode } from './address.js';
import { checkoutHtml } from './checkout.js';
import { TERMS, RETURNS, PRIVACY } from './legal.js';


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
    zones: zones(settings),
    methods: methods(settings),
    free_over: settings.free_over || {},
    collect_address: settings.collect_address || env.SHOP_COLLECT_ADDR || '',
    ingredients: await getIngredients(env),
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
    promos: settings.promos || {},
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
    <tr><td>${order.fulfilment === 'collect' ? 'Collection'
      : ('Delivery' + (order.method ? ' &mdash; ' + esc(order.method.name) : ''))}</td><td align="right">${order.shipping ? gbp(order.shipping) : 'Free'}</td></tr>
    <tr><td style="padding-top:8px;font-weight:700">Total</td><td align="right" style="padding-top:8px;font-weight:700">${gbp(order.total)}</td></tr>
  </table>`;
}

async function sendOrderEmails(env, order) {
  const collect = order.fulfilment === 'collect';
  const addr = order.collect_address || env.SHOP_COLLECT_ADDR || '';
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
  // A pending checkout expires in 90 days; a PAID one is an accounting record
  // and has to outlive that. Six years plus the current year, per the privacy
  // policy and IoM record-keeping requirements.
  await env.DREWRYS_KV.put(`order:${reference}`, JSON.stringify(order),
    paid ? { expirationTtl: 60 * 60 * 24 * 365 * 7 } : undefined);

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
      };
      await env.DREWRYS_KV.put('settings', JSON.stringify(clean));
    }

    return json({ ok: true, images: savedImages });
  }

  const cat = await getCatalogue(env);
  return html(adminHtml({
    catalogue: cat,
    settings: await getSettings(env),
    stock: await stockMap(env, cat.products),
    orders: await recentOrders(env),
    ingredients: await getIngredients(env),
  }));
}

/* ── router ──────────────────────────────────────────────────────────────── */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/' || path === '/index.html') return renderSite(request, env);
      if (path === '/checkout') return renderCheckout(env);
      if (path === '/api/address') return lookupPostcode(request, env, url);
      if (path === '/api/catalogue') {
        const cat = await getCatalogue(env);
        return json({ ...cat, stock: await stockMap(env, cat.products) });
      }
      if (path === '/create-session' && request.method === 'POST') return createSession(request, env);
      if (path === '/webhook' && request.method === 'POST') return handleWebhook(request, env, ctx);
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
