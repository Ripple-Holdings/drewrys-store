/**
 * The guide pages: /ingredients and /help.
 *
 * WHY THESE EXIST: the site had a homepage, eight product pages and three
 * legal pages. Nothing on it answered a question - not "what does marula oil
 * do", not "how long does delivery take", not "can I return an opened jar".
 * Those are what people type into a search box or an assistant before they
 * buy, and an answer engine cites the page that answers them.
 *
 * EVERY FACT ON BOTH PAGES IS READ FROM LIVE DATA - the ingredient library,
 * the shipping settings and the BUSINESS block. Nothing is typed in here that
 * could drift out of step with the shop. Change a delivery price in /admin and
 * this page changes with it. That matters more than usual for a page whose
 * whole job is to be quoted back to a customer by a machine.
 *
 * They use legal.js's page() shell, so they are the same design as /terms and
 * /returns rather than a third look.
 */

import { page, BUSINESS } from './legal.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const money = (pence) => '&pound;' + (Math.round(Number(pence) || 0) / 100).toFixed(2);

/* ── /ingredients ────────────────────────────────────────────────────────── */

/**
 * One entry per ingredient in the library, with its bullets and write-up.
 * Ingredients with no write-up are listed but not given a section of their
 * own - a heading over an empty space reads as a broken page, and padding it
 * with invented copy is worse. Pistachio and Amber are the current case.
 */
export function ingredientsPage(library) {
  const all = (library || []).slice();
  const written = all.filter((i) => (i.text && i.text.trim())
    || (i.bullets && i.bullets.length));
  const bare = all.filter((i) => !written.includes(i));

  const intro = 'Every Drewrys product is built on botanical oils and butters '
    + 'rather than filler. This is what each one is, and what it actually does '
    + 'for your hair.';

  let body = '<p>We list our ingredients because we would want to read them. '
    + 'If you are sensitive to any of the below, the product is not for you '
    + 'and we would rather you knew before you bought it than after.</p>';

  /* A contents grid up top: a long page is easier to cite when the reader (or
     the crawler) can see its shape at a glance. The circular icon treatment is
     lifted from the product modal's ingredient chips so the two read as the
     same thing in two places. */
  body += '<div class="box"><p><strong>In this guide</strong></p><div class="ingrid">'
    + written.map((i) => `<a class="ingrid-i" href="#${esc(i.slug)}">`
      + (i.icon
        ? `<span class="ingrid-c"><img src="${esc(i.icon)}" alt="" width="30" height="30" loading="lazy"></span>`
        /* No icon yet (Amber, Pistachio). An empty disc reads as a failed
           image, so they get a monogram instead - same shape, same alignment,
           obviously a placeholder rather than a broken one. */
        : `<span class="ingrid-c ingrid-c--mono" aria-hidden="true">${esc(i.name.charAt(0))}</span>`)
      + `<span class="ingrid-n">${esc(i.name)}</span></a>`).join('')
    + '</div></div>';

  written.forEach((i) => {
    /* The icon sits INSIDE the h2 so it travels with the heading and cannot
       drift from it. It is decorative - the name is the accessible text, so
       the img carries an empty alt rather than repeating it. */
    body += `<h2 id="${esc(i.slug)}" class="ingh">`
      + (i.icon
        ? `<span class="ingh-c"><img src="${esc(i.icon)}" alt="" width="34" height="34" loading="lazy"></span>`
        : `<span class="ingh-c ingh-c--mono" aria-hidden="true">${esc(i.name.charAt(0))}</span>`)
      + `<span>${esc(i.name)}</span></h2>`;
    if (i.text && i.text.trim()) body += `<p>${esc(i.text.trim())}</p>`;
    if (i.bullets && i.bullets.length) {
      body += '<ul>' + i.bullets.map((b) => `<li>${esc(b)}</li>`).join('') + '</ul>';
    }
  });

  if (bare.length) {
    body += '<h2>Also in the range</h2><p>These appear in some formulations and '
      + 'their full write-ups are on the way: '
      + bare.map((i) => esc(i.name)).join(', ') + '.</p>';
  }

  body += '<h2>A note on what we do not use</h2>'
    + '<p>Our products are not tested on animals. If you are pregnant, have a '
    + 'scalp condition, or are treating your hair medically, check with a '
    + 'pharmacist or your GP before using a new product - that is true of any '
    + 'brand, not just ours.</p>'
    + `<p>Any question about a specific ingredient, email us at `
    + `<a href="mailto:${BUSINESS.email}">${BUSINESS.email}</a> and we will `
    + 'answer it properly.</p>';

  return page('Ingredients', intro, body, {
    slug: 'ingredients',
    updated: false,
    /* Scoped to this page rather than added to the shared shell, which the
       legal pages also use and which has no need of any of it. */
    style: `
.ingrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));
  gap:16px 10px;margin-top:14px}
.ingrid-i{display:flex;flex-direction:column;align-items:center;gap:7px;
  text-decoration:none;color:var(--muted)}
.ingrid-i:hover{color:var(--ink)}
.ingrid-c{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;
  background:rgba(25,28,33,.045);transition:background .15s}
.ingrid-i:hover .ingrid-c{background:rgba(199,154,107,.18)}
.ingrid-c img{width:30px;height:30px;display:block}
.ingrid-n{font-size:.74rem;text-align:center;line-height:1.2}
.ingrid-c--mono,.ingh-c--mono{font-family:"NeueMontreal","Geist",system-ui,sans-serif;
  font-weight:500;color:var(--peanut-deep)}
.ingrid-c--mono{font-size:1.15rem}
.ingh-c--mono{font-size:1.35rem}
h2.ingh{display:flex;align-items:center;gap:12px}
.ingh-c{width:52px;height:52px;flex:0 0 auto;border-radius:50%;display:grid;
  place-items:center;background:rgba(25,28,33,.045)}
.ingh-c img{width:34px;height:34px;display:block}
@media(max-width:520px){
  .ingrid{grid-template-columns:repeat(auto-fill,minmax(72px,1fr))}
  .ingh-c{width:44px;height:44px}
  .ingh-c img{width:28px;height:28px}
}`,
  });
}

/* ── /help ───────────────────────────────────────────────────────────────── */

/**
 * Delivery, collection, returns and payment, in the customer's words.
 * The delivery table is generated from the SAME zones and methods the checkout
 * prices from, so it cannot promise a rate the basket does not charge - which
 * is exactly the fault the site audit found on the Terms page.
 */
export function helpPage(settings) {
  const s = settings || {};
  const zones = (s.zones || []).filter((z) => z.active !== false);
  const methods = (s.shipping_methods || []).filter((m) => m.active !== false);
  const freeOver = s.free_over || {};
  const collect = s.collect_address || '';

  const intro = 'Delivery, collection, returns and payment - answered plainly. '
    + 'If what you need is not here, email us and a person will reply.';

  let body = '<h2>How long does delivery take, and what does it cost?</h2>';

  const rows = [];
  zones.forEach((z) => {
    const mine = methods.filter((m) => m.zone === z.id);
    mine.forEach((m) => {
      rows.push(`<li><strong>${esc(z.name)}</strong> &mdash; ${esc(m.name)}`
        + (m.note ? `, ${esc(m.note)}` : '')
        + `: ${Number(m.price) > 0 ? money(m.price) : 'free'}</li>`);
    });
    const thr = Number(freeOver[z.id]) || 0;
    if (thr > 0) {
      rows.push(`<li><strong>${esc(z.name)}</strong> &mdash; free delivery on `
        + `orders over ${money(thr)}</li>`);
    }
  });

  body += rows.length
    ? '<ul>' + rows.join('') + '</ul>'
    : '<p>Delivery options are shown in the basket before you pay.</p>';

  body += '<p>Orders are packed and sent from the Isle of Man. Every rate above '
    + 'is confirmed in your basket before you pay, so nothing changes at the '
    + 'last step.</p>';

  body += '<h2>Can I collect instead?</h2>';
  if (collect) {
    body += '<p>Yes, and it is free. Choose <strong>Collection</strong> at '
      + 'checkout and pick your order up from:</p>'
      + '<div class="box"><p>' + collect.split(',').map((x) => esc(x.trim())).join('<br>')
      + '</p></div>'
      + '<p>We will email you when it is ready. Bring your order number.</p>';
  } else {
    body += '<p>Yes. Choose <strong>Collection</strong> at checkout and we will '
      + 'email you when your order is ready to pick up.</p>';
  }

  /* Never let this read as a broken sentence. With no zones configured the
     "outside those" clause has no antecedent, which is how it rendered the
     first time I looked at it. */
  body += '<h2>Where do you deliver to?</h2>';
  body += zones.length
    ? '<p>We deliver to ' + zones.map((z) => esc(z.name)).join(', ')
      + '. We do not deliver outside those at present.</p>'
    : '<p>Delivery destinations are listed in the basket at checkout.</p>';
  body += '<p>If you are elsewhere and want something, email us and we will '
    + 'tell you honestly whether we can help.</p>';

  body += '<h2>Can I return something?</h2>'
    + '<p>Unopened and still sealed, yes - within 14 days, and we will refund '
    + 'you. Return postage is yours unless the item is faulty.</p>'
    + '<p><strong>Opened haircare cannot be returned.</strong> That is not us '
    + 'being awkward: consumer law makes an exception for sealed goods that are '
    + 'not suitable for return once unsealed, for hygiene reasons, and haircare '
    + 'is squarely in it. If an item arrives faulty or damaged, that rule does '
    + 'not apply and we will sort it - tell us within 30 days.</p>'
    + '<p>The full detail is on our <a href="/returns">returns page</a>.</p>';

  body += '<h2>Is it safe to pay on this site?</h2>'
    + '<p>Yes, and we never see your card. Payment is taken on a page hosted by '
    + 'Teya, our payment provider, so your card details go straight to them and '
    + 'never touch our servers. We are told only whether the payment worked.</p>';

  body += '<h2>Do you sell wholesale?</h2>'
    + '<p>Yes - salons, barbershops and retailers, on the Island and across the '
    + 'UK. Use the wholesale form on the '
    + '<a href="/#wholesale">homepage</a> and tell us a bit about your shop.</p>';

  body += '<h2>Still stuck?</h2>'
    + `<p>Email <a href="mailto:${BUSINESS.email}">${BUSINESS.email}</a>`
    + (BUSINESS.phone ? ` or call <a href="tel:${esc(telE164(BUSINESS.phone))}">`
      + `${esc(BUSINESS.phone)}</a>` : '')
    + '. We are a small team and we answer our own email.</p>';

  return page('Help &amp; delivery', intro, body, { slug: 'help', updated: false });
}

/** Manx mobiles sit inside the UK numbering plan, so +44 and drop the zero. */
function telE164(national) {
  const d = String(national || '').replace(/[^0-9]/g, '');
  if (!d) return '';
  return d.startsWith('0') ? '+44' + d.slice(1) : '+' + d;
}
