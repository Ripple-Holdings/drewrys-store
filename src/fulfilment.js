/**
 * Fulfilment, and every email that reaches a customer.
 *
 * Email HTML is not web HTML. Outlook renders through Word, Gmail strips
 * <style> blocks, and nothing supports flex or grid reliably. So: tables,
 * inline styles, explicit widths. It looks dated because it has to be.
 *
 * Images need ABSOLUTE urls, since a mail client has no origin to resolve
 * /img against, so every builder takes the site origin.
 *
 * No em dashes anywhere, per Mark.
 */

export const CARRIERS = [
  { id: 'iompost', name: 'Isle of Man Post', url: '' },
  { id: 'royalmail', name: 'Royal Mail', url: 'https://www.royalmail.com/track-your-item#/tracking-results/{n}' },
  { id: 'parcelforce', name: 'Parcelforce', url: 'https://www.parcelforce.com/track-trace?trackNumber={n}' },
  { id: 'dpd', name: 'DPD', url: 'https://track.dpd.co.uk/search?reference={n}' },
  { id: 'evri', name: 'Evri', url: 'https://www.evri.com/track/parcel/{n}' },
  { id: 'dhl', name: 'DHL', url: 'https://www.dhl.com/gb-en/home/tracking.html?tracking-id={n}' },
  { id: 'ups', name: 'UPS', url: 'https://www.ups.com/track?tracknum={n}' },
  { id: 'other', name: 'Other', url: '' },
];

export const carrierById = Object.fromEntries(CARRIERS.map((c) => [c.id, c]));

export function trackingUrl(carrierId, number) {
  const c = carrierById[carrierId];
  const n = String(number || '').trim();
  if (!c || !c.url || !n) return '';
  return c.url.replace('{n}', encodeURIComponent(n));
}

export function carrierName(carrierId) {
  return (carrierById[carrierId] || {}).name || '';
}

/* ── shared pieces ───────────────────────────────────────────────────────── */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const gbp = (p) => '&pound;' + (Number(p || 0) / 100).toFixed(2);

import { vatForOrder } from './vat.js';

const INK = '#191C21';
const COTTON = '#F3EDE1';
const PEANUT = '#9A6C3E';
const MUTED = '#7a746b';
const LINE = '#e2dccf';
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function niceDate(iso) {
  const d = new Date(iso || Date.now());
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const abs = (origin, path) => {
  const p = String(path || '');
  if (!p) return '';
  return /^https?:/i.test(p) ? p : String(origin || '').replace(/\/$/, '') + p;
};

/** Black band, mark in white. Blocked images still leave a black band. */
function masthead(origin) {
  return `<tr><td align="center" bgcolor="${INK}" style="background-color:${INK};padding:28px 20px">
    <img src="${abs(origin, '/img/logo-d-white.png')}" width="56" height="56" alt="Drewrys"
      style="display:block;border:0;outline:none;width:56px;height:56px">
  </td></tr>`;
}

function footNote(email) {
  return `<tr><td style="padding:2px 28px 20px;font-family:${SANS};font-size:12.5px;
    line-height:1.6;color:${MUTED}">For any customer service enquiries please get in touch at
    <a href="mailto:${esc(email)}" style="color:${PEANUT};text-decoration:underline">${esc(email)}</a>.
  </td></tr>`;
}

const ZONE_LABEL = { iom: 'Isle of Man', uk: 'UK', eu: 'Europe', collect: 'Collection' };

/** How this order is going out, in a few words. */
export function fulfilmentLabel(order) {
  if (!order || order.fulfilment === 'collect') return 'Collection';
  const zone = ZONE_LABEL[order.zone] || order.country || 'Delivery';
  const method = (order.method || {}).name || '';
  return method ? `${zone} ${method}` : zone;
}

function heading(text, pill) {
  const tag = pill ? `<span style="display:inline-block;background-color:${INK};color:${COTTON};
      border-radius:999px;padding:5px 13px;font-size:11.5px;font-weight:700;letter-spacing:.07em;
      text-transform:uppercase;margin-left:10px;vertical-align:middle">${esc(pill)}</span>` : '';
  return `<tr><td style="padding:30px 28px 2px;font-family:${SANS};font-size:13px;
    font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${INK}">
    <span style="vertical-align:middle">${esc(text)}</span>${tag}</td></tr>`;
}

function factRow(aLabel, aValue, bLabel, bValue) {
  const cell = (l, v) => `<td width="50%" valign="top" style="font-family:${SANS};padding-right:14px">
      <div style="font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
        color:${MUTED};padding-bottom:5px">${esc(l)}</div>
      <div style="font-size:14.5px;color:${INK};line-height:1.55">${v}</div></td>`;
  return `<tr><td style="padding:20px 28px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${cell(aLabel, aValue)}${bLabel ? cell(bLabel, bValue) : '<td width="50%"></td>'}
    </tr></table></td></tr>`;
}

/** One product: shot on the left, name, size and quantity on the right. */
function itemBlock(origin, item) {
  const img = abs(origin, item.image);
  return `<tr><td style="padding:22px 28px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="136" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="124"><tr>
          <td align="center" bgcolor="#f4f1ea" style="background-color:#f4f1ea;border-radius:12px;padding:12px">
            ${img ? `<img src="${img}" width="100" alt="${esc(item.name)}"
              style="display:block;border:0;outline:none;width:100px;max-width:100px;height:auto">`
                  : '&nbsp;'}
          </td></tr></table>
      </td>
      <td valign="top" style="font-family:${SANS}">
        <div style="font-size:16.5px;font-weight:700;color:${INK};padding-bottom:4px">${esc(item.name)}</div>
        ${item.size ? `<div style="font-size:12px;letter-spacing:.07em;text-transform:uppercase;
          color:${PEANUT};font-weight:700;padding-bottom:9px">${esc(item.size)}</div>` : ''}
        <div style="font-size:13.5px;color:${MUTED}">Quantity ${item.quantity}</div>
        <div style="font-size:15px;color:${INK};font-weight:700;padding-top:4px">${gbp(item.unit_amount * item.quantity)}</div>
      </td>
    </tr></table></td></tr>`;
}

function totalsBlock(order, settings) {
  const line = (l, v, bold) => `<tr>
    <td style="font-family:${SANS};font-size:${bold ? '16px' : '14px'};
      color:${bold ? INK : MUTED};font-weight:${bold ? 700 : 400};padding:${bold ? '11px 0 0' : '6px 0 0'}">${l}</td>
    <td align="right" style="font-family:${SANS};font-size:${bold ? '16px' : '14px'};
      color:${bold ? INK : MUTED};font-weight:${bold ? 700 : 400};padding:${bold ? '11px 0 0' : '6px 0 0'}">${v}</td>
  </tr>`;
  const collect = order.fulfilment === 'collect';
  return `<tr><td style="padding:28px 28px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td colspan="2" style="border-top:1px solid ${LINE};font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td colspan="2" style="font-family:${SANS};font-size:13px;font-weight:700;
        letter-spacing:.1em;text-transform:uppercase;color:${INK};padding:18px 0 4px">Summary</td></tr>
      ${line('Subtotal', gbp(order.subtotal))}
      ${order.discount ? line('Discount' + (order.promo ? ' (' + esc(order.promo) + ')' : ''),
        '&minus;' + gbp(order.discount)) : ''}
      ${line(collect ? 'Collection'
        : 'Delivery' + (order.method ? ', ' + esc(order.method.name) : ''),
        order.shipping ? gbp(order.shipping) : 'Free')}
      ${line('Total', gbp(order.total), true)}
      ${(() => {
        const v = vatForOrder(order, settings || {});
        if (!v.applicable) return '';
        return v.zeroRated
          ? line('Zero-rated export, no VAT', '')
          : line(`Includes VAT at ${v.rate}%`, gbp(v.vat));
      })()}
    </table></td></tr>`;
}

/** A filled panel, used wherever an address needs to stand out. */
function panel(label, lines) {
  return `<tr><td style="padding:20px 28px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td bgcolor="${COTTON}" style="background-color:${COTTON};border-radius:12px;padding:16px 18px;
        font-family:${SANS};font-size:15px;line-height:1.6;color:${INK}">
        <div style="font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
          color:${PEANUT};padding-bottom:5px">${esc(label)}</div>
        ${lines.map(esc).join('<br>')}
      </td></tr></table></td></tr>`;
}

function addressBlock(order, collectAddress) {
  const c = order.customer || {};
  const collect = order.fulfilment === 'collect';
  const lines = collect
    ? String(collectAddress || '').split(/\s*,\s*/).filter(Boolean)
    : [c.line1, c.line2, c.city, c.postcode, c.country].filter(Boolean);
  return factRow(
    'Your details', [c.name, c.email].filter(Boolean).map(esc).join('<br>'),
    collect ? 'Collect from' : 'Delivery address',
    lines.length ? lines.map(esc).join('<br>') : '-',
  );
}

function shell(rows) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background-color:#EFEAE1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background-color:#EFEAE1"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
    style="width:600px;max-width:600px;background-color:#ffffff;border-radius:14px;overflow:hidden">
    ${rows}
  </table>
</td></tr></table></body></html>`;
}

/* ── the emails ──────────────────────────────────────────────────────────── */

/** Order confirmation. Its only job is to confirm what was bought. */
export function confirmationEmails(order, opts = {}) {
  const origin = opts.origin || 'https://drewrys.store';
  const contact = opts.contactEmail || 'hello@drewrys.store';
  const collect = order.fulfilment === 'collect';
  const c = order.customer || {};

  const collectLines = String(opts.collectAddress || '').split(/\s*,\s*/).filter(Boolean);

  const customer = shell(`
    ${masthead(origin)}
    ${heading(collect ? 'Order confirmation' : 'Order confirmation')}
    <tr><td style="padding:12px 28px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK}">
      Thanks${c.name ? ', ' + esc(String(c.name).split(' ')[0]) : ''}. We have your order and we are packing it now.
    </td></tr>
    ${collect ? `<tr><td style="padding:16px 28px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="${INK}" style="background-color:${INK};border-radius:12px;padding:18px 20px;
          font-family:${SANS};color:${COTTON}">
          <div style="font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
            color:${PEANUT};padding-bottom:6px">Collection order</div>
          <div style="font-size:16px;font-weight:700;line-height:1.45;padding-bottom:6px">
            We will email you as soon as it is ready to collect.</div>
          <div style="font-size:13.5px;line-height:1.55;color:#b8b1a6">
            Please wait for that email before coming down.</div>
        </td></tr></table></td></tr>` : ''}
    ${factRow('Order number', esc(order.reference),
              'Order date', esc(niceDate(order.settled || order.created)))}
    ${collect && collectLines.length ? panel('Collecting from', collectLines) : ''}
    ${(order.items || []).map((i) => itemBlock(origin, i)).join('')}
    ${totalsBlock(order, opts.settings)}
    ${collect
      ? factRow('Your details', [c.name, c.email].filter(Boolean).map(esc).join('<br>'), '', '')
      : addressBlock(order, opts.collectAddress)}
    <tr><td style="padding:26px 28px 20px;font-family:${SANS};font-size:13.5px;line-height:1.6;color:${MUTED}">
      ${collect ? 'You will get a second email, headed Ready to collect, when it is packed.'
                : 'We will email you again with tracking as soon as it leaves us.'}
    </td></tr>
    ${footNote(contact)}
  `);

  const owner = shell(`
    ${masthead(origin)}
    ${heading('New order', fulfilmentLabel(order))}
    ${factRow('Order number', esc(order.reference), 'Total', `<b>${gbp(order.total)}</b>`)}
    ${factRow(collect ? 'Collection' : 'Delivery',
              collect ? 'In store' : esc((order.method || {}).name || 'Delivery'),
              'Customer', [c.name, c.email, c.phone].filter(Boolean).map(esc).join('<br>'))}
    ${(order.items || []).map((i) => itemBlock(origin, i)).join('')}
    ${totalsBlock(order, opts.settings)}
    ${collect ? '' : factRow('Ship to',
        [c.line1, c.line2, c.city, c.postcode, c.country].filter(Boolean).map(esc).join('<br>'), '', '')}
  `);

  return { customer, owner };
}

/** Sent when a collection order is marked ready. */
export function readyEmail(order, opts = {}) {
  const origin = opts.origin || 'https://drewrys.store';
  const contact = opts.contactEmail || 'hello@drewrys.store';
  const addr = String(opts.collectAddress || '').split(/\s*,\s*/).filter(Boolean);

  return shell(`
    ${masthead(origin)}
    ${heading('Ready to collect')}
    <tr><td style="padding:14px 28px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK}">
      Your order is packed and waiting for you.
    </td></tr>
    ${addr.length ? panel('Collect from', addr) : ''}
    ${(order.items || []).map((i) => itemBlock(origin, i)).join('')}
    ${totalsBlock(order, opts.settings)}
    <tr><td style="padding:26px 28px 20px;font-family:${SANS};font-size:13.5px;line-height:1.6;color:${MUTED}">
      Bring your order number, ${esc(order.reference)}, with you.
    </td></tr>
    ${footNote(contact)}
  `);
}

/** Sent once the customer has actually collected. Closes the loop. */
export function collectedEmail(order, opts = {}) {
  const origin = opts.origin || 'https://drewrys.store';
  const contact = opts.contactEmail || 'hello@drewrys.store';
  const c = order.customer || {};

  return shell(`
    ${masthead(origin)}
    ${heading('Collected')}
    <tr><td style="padding:14px 28px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK}">
      Thanks${c.name ? ', ' + esc(String(c.name).split(' ')[0]) : ''}. Your order has been collected.
      Here is your receipt.
    </td></tr>
    ${factRow('Order number', esc(order.reference),
              'Collected', esc(niceDate(order.fulfilled)))}
    ${(order.items || []).map((i) => itemBlock(origin, i)).join('')}
    ${totalsBlock(order, opts.settings)}
    <tr><td style="padding:26px 28px 20px;font-family:${SANS};font-size:13.5px;line-height:1.6;color:${MUTED}">
      Keep this for your records. If anything is not right, just reply to this email.
    </td></tr>
    ${footNote(contact)}
  `);
}

/** The review request, sent on a delay after fulfilment. */
export function reviewRequestEmail(order, opts = {}) {
  const origin = opts.origin || 'https://drewrys.store';
  const contact = opts.contactEmail || 'hello@drewrys.store';
  const c = order.customer || {};
  const link = `${String(origin).replace(/\/$/, '')}/review/${opts.token}`;

  return shell(`
    ${masthead(origin)}
    ${heading('How did we do?')}
    <tr><td style="padding:14px 28px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK}">
      Hello${c.name ? ' ' + esc(String(c.name).split(' ')[0]) : ''}. You ordered from us a little while
      back and we would like to know how you got on.
    </td></tr>
    ${(order.items || []).map((i) => itemBlock(origin, i)).join('')}
    <tr><td align="center" style="padding:26px 28px 0">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="${INK}" style="background-color:${INK};border-radius:999px">
          <a href="${link}" style="display:inline-block;padding:15px 32px;font-family:${SANS};
            font-size:15px;font-weight:700;color:${COTTON};text-decoration:none">Leave a review</a>
        </td></tr></table></td></tr>
    ${footNote(contact)}
  `);
}

/** The follow-up, inviting them to post it publicly. */
export function publicReviewInviteEmail(review, opts = {}) {
  const origin = opts.origin || 'https://drewrys.store';
  const contact = opts.contactEmail || 'hello@drewrys.store';
  const platforms = opts.platforms || [];
  const share = opts.shareUrl || '';
  const first = String(review.name || '').split(' ')[0];
  const names = platforms.map((p) => esc(p.name));
  const both = names.length > 1
    ? names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1]
    : (names[0] || 'Google');

  return shell(`
    ${masthead(origin)}
    ${heading('Thank you')}
    <tr><td style="padding:14px 28px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK}">
      Thanks for the review${first ? ', ' + esc(first) : ''}. It means a lot to a small shop.
    </td></tr>
    ${review.text ? `<tr><td style="padding:18px 28px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="${COTTON}" style="background-color:${COTTON};border-radius:12px;padding:16px 18px;
          font-family:${SANS};font-size:14.5px;line-height:1.6;color:${INK};font-style:italic">
          ${esc(review.text).slice(0, 500)}
        </td></tr></table></td></tr>` : ''}
    <tr><td style="padding:22px 28px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK}">
      If you have a moment, would you post the same on ${both}? One tap below copies
      what you wrote so you can paste it straight in.
    </td></tr>
    ${share ? `<tr><td align="center" style="padding:22px 28px 0">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="${INK}" style="background-color:${INK};border-radius:999px">
          <a href="${share}" style="display:inline-block;padding:15px 32px;font-family:${SANS};
            font-size:15px;font-weight:700;color:${COTTON};text-decoration:none">Copy it and post</a>
        </td></tr></table></td></tr>` : ''}
    ${platforms.length ? `<tr><td align="center" style="padding:16px 28px 0;font-family:${SANS};
      font-size:13.5px;color:${MUTED}">Or go straight there:
      ${platforms.map((p) => `<a href="${esc(p.url)}" style="color:${PEANUT};font-weight:700;
        text-decoration:underline;padding:0 6px">${esc(p.name)}</a>`).join(' ')}
    </td></tr>` : ''}
    ${footNote(contact)}
  `);
}

/** Sent when a delivery order is marked dispatched. */
export function dispatchedEmail(order, opts = {}) {
  const origin = opts.origin || 'https://drewrys.store';
  const contact = opts.contactEmail || 'hello@drewrys.store';
  const c = order.customer || {};
  const url = trackingUrl(order.carrier, order.tracking);
  const cn = carrierName(order.carrier);

  return shell(`
    ${masthead(origin)}
    ${heading('On its way')}
    <tr><td style="padding:14px 28px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK}">
      Your order has left us${cn ? ' with ' + esc(cn) : ''}.
    </td></tr>
    ${order.tracking ? `<tr><td style="padding:18px 28px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="${COTTON}" style="background-color:${COTTON};border-radius:12px;padding:16px 18px;
          font-family:${SANS}">
          <div style="font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
            color:${PEANUT};padding-bottom:5px">${esc(cn) || 'Tracking'}</div>
          <div style="font-size:17px;font-weight:700;color:${INK};letter-spacing:.02em">${esc(order.tracking)}</div>
          ${url ? `<div style="padding-top:11px"><a href="${url}"
            style="color:${PEANUT};font-size:14px;font-weight:700;text-decoration:underline">Track your parcel</a></div>` : ''}
        </td></tr></table></td></tr>` : ''}
    ${factRow('Going to',
      [c.line1, c.line2, c.city, c.postcode, c.country].filter(Boolean).map(esc).join('<br>'), '', '')}
    ${(order.items || []).map((i) => itemBlock(origin, i)).join('')}
    ${totalsBlock(order, opts.settings)}
    <tr><td style="padding:26px 28px 20px;font-family:${SANS};font-size:13.5px;line-height:1.6;color:${MUTED}">
      Tracking can take a few hours to show its first scan.
    </td></tr>
    ${footNote(contact)}
  `);
}

/**
 * The email building blocks, exported so refunds.js builds its two emails from
 * the SAME masthead, heading, item blocks and totals as every other customer
 * email. Anything reaching a customer should look like it came from one shop.
 */
export const EMAIL_PARTS = {
  shell, masthead, heading, factRow, itemBlock, totalsBlock, footNote,
  niceDate, esc, gbp, SANS, INK, MUTED, COTTON,
};
