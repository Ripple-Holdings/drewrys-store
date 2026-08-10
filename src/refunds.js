/**
 * Refunds: the reason list, and the customer email.
 *
 * Kept in its own module rather than added to fulfilment.js so a parallel
 * session editing that file cannot collide with this one.
 */

/**
 * Why the order came back. A fixed list rather than free text so it is
 * reportable later - "damaged in transit" repeating six times is a courier
 * conversation, and you only see that if the reason is a value not a sentence.
 * `other` still takes a note.
 */
export const RETURN_REASONS = [
  { id: 'changed_mind', label: 'Changed their mind' },
  { id: 'damaged_transit', label: 'Damaged in transit' },
  { id: 'faulty', label: 'Faulty or leaking' },
  { id: 'wrong_item', label: 'Wrong item sent' },
  { id: 'reaction', label: 'Reaction or sensitivity' },
  { id: 'not_as_described', label: 'Not as described' },
  { id: 'duplicate', label: 'Ordered twice by mistake' },
  { id: 'other', label: 'Other' },
];

/** Why it cannot go back on the shelf. Only asked when restock is declined. */
export const NO_RESTOCK_REASONS = [
  { id: 'opened', label: 'Opened or seal broken' },
  { id: 'damaged', label: 'Damaged' },
  { id: 'contaminated', label: 'Used or contaminated' },
  { id: 'not_returned', label: 'Not returned by the customer' },
  { id: 'expired', label: 'Past its date' },
  { id: 'other', label: 'Other' },
];

export function reasonLabel(list, id) {
  const hit = list.find((r) => r.id === id);
  return hit ? hit.label : (id || '');
}

const money = (p) => '£' + ((p || 0) / 100).toFixed(2);

/**
 * The refund confirmation. Deliberately says the money is on its way rather
 * than that it has arrived: card refunds settle in days, and a customer told
 * "refunded" who then sees nothing for a week emails to ask why.
 */
export function refundEmail(order, opts = {}) {
  const contact = opts.contactEmail || '';
  const amount = money(order.refund?.amount ?? order.total);
  const rows = (order.items || []).map((i) => `
      <tr>
        <td style="padding:8px 0;color:#191C21;font-size:15px">
          ${escapeHtml(i.name || i.sku)}${i.quantity > 1 ? ` &times; ${i.quantity}` : ''}
        </td>
        <td style="padding:8px 0;text-align:right;color:#191C21;font-size:15px">
          ${money((i.unit_price || 0) * (i.quantity || 1))}
        </td>
      </tr>`).join('');

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#F3EDE1">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#F3EDE1;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ECE3D3;border-radius:16px;padding:32px">
        <tr><td>
          <p style="margin:0 0 6px;font:600 12px/1 -apple-system,Segoe UI,sans-serif;
                    letter-spacing:.16em;text-transform:uppercase;color:#9A6C3E">
            Refund issued
          </p>
          <h1 style="margin:0 0 18px;font:500 30px/1.1 Georgia,serif;color:#191C21">
            Your refund is on its way
          </h1>
          <p style="margin:0 0 20px;font:400 16px/1.6 -apple-system,Segoe UI,sans-serif;color:rgba(25,28,33,.82)">
            We have refunded <strong>${amount}</strong> for order
            <strong>${escapeHtml(order.reference || '')}</strong>. It goes back to the
            card you paid with. Depending on your bank it usually shows within three
            to five working days, and sometimes a little longer.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="border-top:1px solid rgba(25,28,33,.14);margin-bottom:8px">
            ${rows}
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="border-top:1px solid rgba(25,28,33,.14)">
            <tr>
              <td style="padding:12px 0;font:600 17px/1 -apple-system,Segoe UI,sans-serif;color:#191C21">
                Refunded
              </td>
              <td style="padding:12px 0;text-align:right;font:600 17px/1 -apple-system,Segoe UI,sans-serif;color:#191C21">
                ${amount}
              </td>
            </tr>
          </table>

          ${contact ? `
          <p style="margin:22px 0 0;font:400 15px/1.6 -apple-system,Segoe UI,sans-serif;color:rgba(25,28,33,.7)">
            Any questions, reply to this email or write to
            <a href="mailto:${escapeHtml(contact)}" style="color:#9A6C3E">${escapeHtml(contact)}</a>.
          </p>` : ''}

          <p style="margin:26px 0 0;font:400 13px/1.5 -apple-system,Segoe UI,sans-serif;color:rgba(25,28,33,.5)">
            Drewrys &middot; ${escapeHtml(opts.shopName || 'Drewrys')}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
