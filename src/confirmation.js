/**
 * The order confirmation page.
 *
 * Teya's hosted checkout ends on THEIR "Payment approved" screen with a
 * "Back to store" button. That button goes wherever success_url points, so the
 * job here is to make the place it lands a proper confirmation page rather
 * than the homepage with the bag panel hanging open.
 *
 * Rendered on the server from the order in KV, so it shows the real lines,
 * the real total and the right next step for collection or delivery. Nothing
 * depends on the browser having any state left.
 */

import { vatForOrder } from './vat.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gbp = (p) => '£' + (Number(p || 0) / 100).toFixed(2);

function shell(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} \u00b7 Drewrys</title>
<link rel="icon" type="image/png" href="/img/favicon.png">
<meta name="robots" content="noindex,nofollow">
<!-- Trimmed font file: only NeueMontreal and Geist, the two faces this page
     uses. The full fonts.css inlines four families as base64 and is 261KB. -->
<link rel="preload" as="style" href="/fonts-order.css">
<link rel="stylesheet" href="/fonts-order.css">
<link rel="preload" as="image" href="/img/halftone-order.jpg" media="(min-width:761px)">
<style>
:root{--cotton:#F3EDE1;--cotton-2:#ECE3D3;--ink:#191C21;--peanut:#C79A6B;
  --peanut-deep:#9A6C3E;--slate:#2B3037;--line:rgba(25,28,33,.14);
  --muted:rgba(25,28,33,.62)}
*{margin:0;padding:0;box-sizing:border-box}

/* The site's first-load screen, so arriving here feels like arriving home. */
/* A lighter copy of the halftone for this page only, so the homepage hero
   keeps its original file. 371KB down to 72KB; it is a soft texture scaled
   with cover, so the smaller source is indistinguishable. */
body{background:#f2f1e8 url(/img/halftone-order.jpg) center/cover no-repeat fixed;
  color:var(--ink);
  font-family:"Geist",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  line-height:1.6;-webkit-font-smoothing:antialiased;min-height:100dvh}
@media(max-width:760px){body{background-image:url(/img/halftone-order-portrait.jpg)}}

main{max-width:660px;margin:0 auto;padding:clamp(38px,7vh,74px) 22px 90px;
  display:flex;flex-direction:column;align-items:center;text-align:center}

.mark{width:clamp(120px,17vw,168px);height:auto;
  filter:drop-shadow(0 14px 30px rgba(0,0,0,.20));margin-bottom:clamp(26px,4vh,42px)}

/* headings in the title face, body copy in the body face */
h1,h2{font-family:"NeueMontreal","Geist",system-ui,sans-serif;font-weight:500;
  letter-spacing:-.018em;line-height:1.06}
h1{font-size:clamp(1.85rem,5.2vw,2.75rem)}
h1 em{font-style:normal;color:var(--peanut-deep)}
h2{font-size:clamp(1.12rem,2.4vw,1.35rem);margin-bottom:16px}

.lede{margin-top:15px;font-size:1.02rem;color:var(--muted);max-width:46ch}
.ref{display:inline-block;margin-top:22px;background:var(--slate);color:var(--cotton);
  border-radius:99px;padding:9px 20px;font-size:.88rem;letter-spacing:.05em}

.card{width:100%;background:rgba(255,255,255,.9);-webkit-backdrop-filter:blur(8px);
  backdrop-filter:blur(8px);border:1px solid var(--line);border-radius:20px;
  padding:clamp(20px,3.5vw,28px);margin-top:clamp(26px,4vh,38px);text-align:left}

.line{display:flex;gap:15px;align-items:center;padding:13px 0;
  border-bottom:1px solid var(--line)}
.line:last-of-type{border-bottom:0}
.line img{width:62px;height:62px;object-fit:contain;padding:6px;border-radius:12px;
  flex:0 0 auto;background:var(--cotton-2)}
.line .n{font-weight:600;font-size:.98rem}
.line .v{font-size:.79rem;color:var(--peanut-deep);margin-top:1px}
.line .sp{flex:1}
.line .p{font-weight:600;white-space:nowrap}

.tot{display:flex;justify-content:space-between;padding:7px 0;font-size:.95rem;
  color:var(--muted)}
.tot.grand{border-top:1px solid var(--line);margin-top:11px;padding-top:15px;
  font-size:1.16rem;color:var(--ink);font-weight:700}

.next{background:var(--slate);color:var(--cotton);border-color:transparent}
.next h2{color:var(--cotton)}
.next p{margin-top:9px;color:rgba(243,237,225,.8)}
.next p:first-of-type{margin-top:0}

.btn{display:inline-block;margin-top:clamp(28px,4vh,40px);background:var(--peanut);
  color:var(--ink);text-decoration:none;
  font-family:"NeueMontreal","Geist",sans-serif;font-weight:600;
  padding:15px 32px;border-radius:99px;font-size:.98rem}
.small{margin-top:20px;font-size:.86rem;color:var(--muted)}
.foot{margin-top:44px;display:flex;gap:18px;font-size:.85rem;color:var(--muted)}
.foot a{color:var(--muted)}
</style></head><body>
<main>
  <a href="/"><img class="mark" src="/img/logo-d.png" alt="Drewrys" width="168" height="168" fetchpriority="high"></a>
  ${body}
  <div class="foot">
    <a href="/terms">Terms</a><a href="/returns">Returns</a><a href="/privacy">Privacy</a>
  </div>
</main>
</body></html>`;
}

/**
 * GET /order?ref=DRW-XXXX
 *
 * Shows nothing until the webhook has marked the order paid, so a guessed
 * reference reveals no more than a "still processing" line. Payment is
 * confirmed by Teya server to server, never by the browser arriving here.
 */
export async function orderConfirmationPage(env, ref, settings = {}) {
  if (!ref) {
    return shell('Order', `<h1>Order <em>not found</em></h1>
      <p class="lede">We could not find that order reference. If you have just
      paid, check your email for the confirmation.</p>
      <a class="btn" href="/#shop">Back to the shop</a>`);
  }

  const raw = await env.DREWRYS_KV.get(`order:${ref}`);
  if (!raw) {
    return shell('Order', `<h1>Order <em>not found</em></h1>
      <p class="lede">We could not find order ${esc(ref)}. If you have just paid,
      your confirmation email is the record of it, and nothing is wrong with
      your payment.</p>
      <a class="btn" href="/#shop">Back to the shop</a>`);
  }

  let o = {};
  try { o = JSON.parse(raw); } catch { o = {}; }

  // KV is EVENTUALLY consistent and caches a read at the edge for 60 seconds.
  // createSession writes the pending order and reads it straight back, caching
  // the PENDING copy at that colo; the webhook then writes `paid` from Teya's
  // colo in Dublin. On 10/08 that left this page showing "being confirmed" for
  // 48 seconds after the payment had already settled.
  //
  // D1 is strongly consistent and the webhook mirrors every paid order into it,
  // so ask D1 whether the money moved and use KV only for the detail. This
  // matters more now post_success_payment=REDIRECT lands the customer here
  // within a second of paying, usually ahead of the webhook.
  const kvSaid = o.status;
  if (o.status !== 'paid' && env.DB) {
    try {
      const row = await env.DB.prepare('SELECT reference FROM ord WHERE reference = ?')
        .bind(ref).first();
      if (row) o.status = 'paid';
    } catch (e) {
      console.error('order page: D1 check failed', String(e && e.message || e));
    }
  }
  // Both sources, on every render, so this never has to be argued from memory.
  console.log('order page', ref, '| KV said', kvSaid, '| D1 said',
              o.status === 'paid' ? 'paid' : (env.DB ? 'no row' : 'not bound'),
              '| showing', o.status === 'paid' ? 'CONFIRMED' : 'pending');

  if (o.status !== 'paid') {
    // With REDIRECT the customer arrives within a second of paying, so poll
    // quickly rather than leaving them on this for six seconds at a time.
    return shell('Order received', `
      <meta http-equiv="refresh" content="2">
      <h1>Thank you, <em>we have your order.</em></h1>
      <p class="lede">Payment is still being confirmed by our payment provider.
      This normally takes a few seconds. Your confirmation email will arrive as
      soon as it clears, and nothing further is needed from you.</p>
      <span class="ref">Order ${esc(ref)}</span>
      <p class="small">This page updates itself.</p>
      <a class="btn" href="/#shop">Continue shopping</a>`);
  }

  const items = (o.items || []).map((i) => `
    <div class="line">
      ${i.image ? `<img src="${esc(i.image)}" alt="" width="62" height="62" decoding="async">` : '<img alt="" width="62" height="62">'}
      <div>
        <div class="n">${esc(i.name || '')}</div>
        ${i.size ? `<div class="v">${esc(i.size)}</div>` : ''}
      </div>
      <span class="sp"></span>
      <span class="p">${i.quantity > 1 ? `${i.quantity} &times; ` : ''}${gbp((i.unit_amount || 0) * (i.quantity || 1))}</span>
    </div>`).join('');

  const collect = o.fulfilment === 'collect';
  const where = o.collect_address || '';
  const next = collect
    ? `<h2>Collecting from us</h2>
       <p>We will email you the moment your order is ready. Please wait for that
       email before coming down.</p>
       ${where ? `<p>${esc(where)}</p>` : ''}`
    : `<h2>Delivery</h2>
       <p>We will email you with tracking as soon as your order is dispatched.</p>
       ${o.customer && o.customer.line1 ? `<p>Going to ${esc([o.customer.line1,
         o.customer.city, o.customer.postcode].filter(Boolean).join(', '))}</p>` : ''}`;

  return shell('Order confirmed', `
    <h1>Thank you, <em>your order is confirmed.</em></h1>
    <p class="lede">We have taken your payment. We will email you with a receipt.</p>
    <span class="ref">Order ${esc(o.reference || ref)}</span>

    <div class="card">
      <h2>Your order</h2>
      ${items}
      <div class="tot"><span>Subtotal</span><span>${gbp(o.subtotal)}</span></div>
      ${o.discount > 0 ? `<div class="tot"><span>Discount</span><span>&minus;${gbp(o.discount)}</span></div>` : ''}
      <div class="tot"><span>${collect ? 'Collection' : 'Delivery'}</span><span>${
        o.shipping > 0 ? gbp(o.shipping) : 'Free'}</span></div>
      <div class="tot grand"><span>Total paid</span><span>${gbp(o.total)}</span></div>
      ${(() => { const v = vatForOrder(o, settings); return v.applicable
        ? `<div class="tot" style="padding-top:8px">${v.zeroRated
            ? '<span>Zero-rated export, no VAT</span><span></span>'
            : `<span>Includes VAT at ${v.rate}%</span><span>${gbp(v.vat)}</span>`}</div>`
        : ''; })()}
    </div>

    <div class="card next">${next}</div>

    <a class="btn" href="/#shop">Continue shopping</a>`);
}
