/**
 * Fulfilment: marking an order as gone, and telling the customer.
 *
 * Two shapes, because they are different jobs:
 *   collection — the customer walks in, Ben marks it collected. Nothing to track.
 *   delivery   — Ben records a carrier and a tracking number, marks it
 *                dispatched, and the customer gets an email with the link.
 *
 * The email sends ONCE. Re-marking an order does not re-send; there is an
 * explicit Resend action instead, so a mis-click cannot spam a customer.
 *
 * CHECK BEFORE LIVE: the tracking URL templates below are the public
 * consumer-facing ones. Confirm each against a real consignment number the
 * first time Ben uses that carrier — a wrong template sends the customer to
 * a dead page, which is worse than no link at all.
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

/** A link only if we have a template and a number, otherwise just the number. */
export function trackingUrl(carrierId, number) {
  const c = carrierById[carrierId];
  const n = String(number || '').trim();
  if (!c || !c.url || !n) return '';
  return c.url.replace('{n}', encodeURIComponent(n));
}

export function carrierName(carrierId) {
  return (carrierById[carrierId] || {}).name || '';
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const gbp = (p) => '£' + (Number(p || 0) / 100).toFixed(2);

function itemRows(order) {
  return (order.items || []).map((i) =>
    `<tr><td style="padding:5px 0">${esc(i.name)} &times; ${i.quantity}</td>
     <td align="right">${gbp(i.unit_amount * i.quantity)}</td></tr>`).join('');
}

/** The order confirmation, sent the moment Teya confirms payment. */
export function confirmationEmails(order, shopName, collectAddress) {
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
  const collect = order.fulfilment === 'collect';
  const addr = collectAddress || '';
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
  return { customer: cust, owner };
}

/** Sent when a delivery order is marked dispatched. */
export function dispatchedEmail(order, shopName) {
  const first = (order.customer?.name || '').split(' ')[0];
  const url = trackingUrl(order.carrier, order.tracking);
  const cn = carrierName(order.carrier);
  const addr = [order.customer?.line1, order.customer?.line2, order.customer?.city,
                order.customer?.postcode, order.customer?.country].filter(Boolean);

  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    max-width:520px;color:#191C21;line-height:1.55">
    <h2 style="font-weight:600;margin:0 0 10px">It's on its way${first ? ', ' + esc(first) : ''}.</h2>
    <p style="margin:0 0 14px">Your order <b>${esc(order.reference)}</b> has been dispatched.</p>
    ${order.tracking ? `<div style="background:#ECE3D3;border-radius:12px;padding:14px 16px;margin:0 0 16px">
      <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6f6a62">
        ${esc(cn) || 'Tracking'}</p>
      <p style="margin:0;font-size:16px;font-weight:650">${esc(order.tracking)}</p>
      ${url ? `<p style="margin:10px 0 0"><a href="${url}" style="color:#9A6C3E;font-weight:600">Track your parcel</a></p>` : ''}
    </div>` : ''}
    ${addr.length ? `<p style="margin:0 0 14px;font-size:14px;color:#6f6a62">
      Going to:<br>${addr.map(esc).join('<br>')}</p>` : ''}
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 14px">
      ${itemRows(order)}
      <tr><td style="padding-top:9px;font-weight:700">Total paid</td>
          <td align="right" style="padding-top:9px;font-weight:700">${gbp(order.total)}</td></tr>
    </table>
    <p style="font-size:13px;color:#6f6a62;margin:0">Tracking can take a few hours to show
    a first scan. If anything looks wrong, just reply to this email.</p>
    <p style="color:#6f6a62;font-size:12px;margin-top:22px">${esc(shopName || 'Drewrys')}</p>
  </div>`;
}

/** Sent when a collection order is marked ready. */
export function readyEmail(order, shopName, collectAddress) {
  const first = (order.customer?.name || '').split(' ')[0];
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    max-width:520px;color:#191C21;line-height:1.55">
    <h2 style="font-weight:600;margin:0 0 10px">Ready to collect${first ? ', ' + esc(first) : ''}.</h2>
    <p style="margin:0 0 14px">Your order <b>${esc(order.reference)}</b> is packed and waiting.</p>
    ${collectAddress ? `<div style="background:#ECE3D3;border-radius:12px;padding:14px 16px;margin:0 0 16px">
      <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6f6a62">Collect from</p>
      <p style="margin:0;font-size:15px;line-height:1.5">${collectAddress.split(/\s*,\s*/).map(esc).join('<br>')}</p>
    </div>` : ''}
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 14px">
      ${itemRows(order)}
      <tr><td style="padding-top:9px;font-weight:700">Total paid</td>
          <td align="right" style="padding-top:9px;font-weight:700">${gbp(order.total)}</td></tr>
    </table>
    <p style="font-size:13px;color:#6f6a62;margin:0">Bring your order reference with you.</p>
    <p style="color:#6f6a62;font-size:12px;margin-top:22px">${esc(shopName || 'Drewrys')}</p>
  </div>`;
}
