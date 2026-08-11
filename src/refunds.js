/**
 * Refunds and cancellations: the reason lists, and the two customer emails.
 *
 * Kept in its own module rather than added to fulfilment.js so a parallel
 * session editing that file cannot collide with this one.
 */

import { EMAIL_PARTS as E } from './fulfilment.js';

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
/**
 * The refund email. Built from the SAME parts as every other customer email so
 * it looks like it came from the same shop.
 *
 * Deliberately says the money is on its way rather than that it has arrived:
 * card refunds settle in days, and a customer told "refunded" who then sees
 * nothing for a week emails to ask why.
 */
export function refundEmail(order, opts = {}) {
  const origin = opts.origin || 'https://drewrys.store';
  const contact = opts.contactEmail || 'hello@drewrys.store';
  const c = order.customer || {};
  const amount = opts.amount ?? order.refund?.amount ?? order.total;

  return E.shell(`
    ${E.masthead(origin)}
    ${E.heading('Refund issued')}
    <tr><td style="padding:14px 28px 0;font-family:${E.SANS};font-size:15px;line-height:1.6;color:${E.INK}">
      ${c.name ? E.esc(String(c.name).split(' ')[0]) + ', we' : 'We'} have refunded
      <strong>${E.gbp(amount)}</strong> to the card you paid with.
    </td></tr>
    ${E.factRow('Order number', E.esc(order.reference),
                'Refunded', E.esc(E.niceDate(order.refund?.at || new Date().toISOString())))}
    ${(order.items || []).map((i) => E.itemBlock(origin, i)).join('')}
    ${E.totalsBlock(order)}
    <tr><td style="padding:26px 28px 20px;font-family:${E.SANS};font-size:13.5px;line-height:1.6;color:${E.MUTED}">
      Refunds usually show within three to five working days, sometimes a little
      longer depending on your bank. If it has not appeared after a week, reply
      to this email and we will chase it.
    </td></tr>
    ${E.footNote(contact)}
  `);
}

/**
 * The cancellation email. Sent when an order is stopped BEFORE it goes out, so
 * it has to say two things at once: it is not coming, and the money is going
 * back. Never tell someone their order is cancelled without saying that.
 */
export function cancelledEmail(order, opts = {}) {
  const origin = opts.origin || 'https://drewrys.store';
  const contact = opts.contactEmail || 'hello@drewrys.store';
  const c = order.customer || {};
  const amount = opts.amount ?? order.refund?.amount ?? order.total;

  return E.shell(`
    ${E.masthead(origin)}
    ${E.heading('Order cancelled')}
    <tr><td style="padding:14px 28px 0;font-family:${E.SANS};font-size:15px;line-height:1.6;color:${E.INK}">
      ${c.name ? E.esc(String(c.name).split(' ')[0]) + ', we' : 'We'} are sorry, we have had to
      cancel this order before it went out. Nothing has been sent, and we have
      refunded <strong>${E.gbp(amount)}</strong> to the card you paid with.
    </td></tr>
    ${E.factRow('Order number', E.esc(order.reference),
                'Cancelled', E.esc(E.niceDate(order.refund?.at || new Date().toISOString())))}
    ${(order.items || []).map((i) => E.itemBlock(origin, i)).join('')}
    ${E.totalsBlock(order)}
    <tr><td style="padding:26px 28px 20px;font-family:${E.SANS};font-size:13.5px;line-height:1.6;color:${E.MUTED}">
      Refunds usually show within three to five working days. If you still want
      these, everything is on the site and you are welcome to order again, or
      reply to this email and we will sort it out with you.
    </td></tr>
    ${E.footNote(contact)}
  `);
}
