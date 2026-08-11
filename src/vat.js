/**
 * VAT.
 *
 * The shop shows VAT-INCLUSIVE prices, which is what consumer law requires for
 * a retail site, so the VAT is extracted OUT of the total rather than added on
 * top. That is the part people get wrong: at 20% the VAT in a £24.99 price is
 * £4.17, not £5.00, because it is total x 20/120 and not total x 20/100.
 *
 * Zero-rating matters as much as the rate. The Isle of Man and the UK are one
 * VAT territory, so an IoM or UK sale is standard-rated. A delivery to Europe
 * is an EXPORT and is zero-rated, so it must be reported as a sale with no
 * output VAT rather than quietly taxed. Getting that wrong overstates what is
 * owed on every European order.
 *
 * Delivery carries VAT at the same rate as the goods it delivers, so it is
 * inside the gross figure rather than treated separately.
 */

export const VAT_DEFAULTS = {
  vat_registered: false,
  vat_number: '',
  vat_rate: 20,           // percent
};

/** Zones that sit inside the UK/IoM VAT territory. Everything else is an export. */
const DOMESTIC = new Set(['iom', 'uk', 'collect']);

export function vatSettings(settings = {}) {
  const rate = Number(settings.vat_rate);
  return {
    registered: settings.vat_registered === true,
    number: String(settings.vat_number || '').trim(),
    rate: Number.isFinite(rate) && rate >= 0 && rate <= 30 ? rate : VAT_DEFAULTS.vat_rate,
  };
}

/**
 * The VAT inside one order, in pence.
 *
 * Uses the rate STORED ON THE ORDER when there is one, so a historic order is
 * never restated because the rate changed afterwards. Falls back to current
 * settings for orders taken before this existed.
 */
export function vatForOrder(order = {}, settings = {}) {
  const s = vatSettings(settings);
  const gross = Math.max(0, Math.round(order.total || 0));

  if (!s.registered) {
    return { gross, net: gross, vat: 0, rate: 0, zeroRated: false, applicable: false };
  }

  const rate = Number.isFinite(Number(order.vat_rate)) ? Number(order.vat_rate) : s.rate;

  // Collection is on the Island, so it is domestic whatever the address says.
  const zone = order.fulfilment === 'collect' ? 'iom' : String(order.zone || 'iom');
  const zeroRated = !DOMESTIC.has(zone);

  if (zeroRated || rate === 0) {
    return { gross, net: gross, vat: 0, rate: 0, zeroRated, applicable: true };
  }

  // Extract, do not add. Round the VAT and derive net from it so the two always
  // sum back to the gross the customer actually paid.
  const vat = Math.round(gross * rate / (100 + rate));
  return { gross, net: gross - vat, vat, rate, zeroRated: false, applicable: true };
}

/**
 * The SELLING price of a product in pence, which is what the customer pays and
 * what must be shown on the site.
 *
 * `price_mode` says what the number in the admin MEANS:
 *   'inc' (default)  the figure typed is the shelf price, VAT already inside it
 *   'exc'            the figure typed is NET, so VAT is added to reach the price
 *
 * Defaulting to 'inc' matters: every existing product has no price_mode, and
 * treating those as exclusive would silently put 20 per cent on the whole
 * catalogue the moment this shipped.
 */
export function sellingPrice(product = {}, settings = {}) {
  const base = Math.max(0, Math.round(product.price_pence || 0));
  const s = vatSettings(settings);
  const taxable = s.registered && product.vat_applicable !== false;
  if (!taxable || product.price_mode !== 'exc') return base;
  return Math.round(base * (100 + s.rate) / 100);
}

/** True when this product carries VAT at all. Some goods are zero-rated. */
export function productTaxable(product = {}, settings = {}) {
  return vatSettings(settings).registered && product.vat_applicable !== false;
}

const dayOf = (o) => String(o.settled || o.created || '').slice(0, 10);

/**
 * A VAT report over a date range, from the orders themselves.
 *
 * Counts PAID orders and subtracts refunds, because a refunded sale reduces the
 * output VAT for the period the refund falls in. A report that ignores refunds
 * overstates the liability, which is the expensive direction to be wrong in.
 */
export function vatReport(orders, settings, from, to) {
  const s = vatSettings(settings);
  const inRange = (d) => d && d >= from && d <= to;

  const rows = [];
  let salesGross = 0; let salesNet = 0; let salesVat = 0;
  let exportGross = 0; let exportCount = 0;
  let refundGross = 0; let refundVat = 0; let refundCount = 0;

  for (const o of orders || []) {
    const paidDay = dayOf(o);
    const isPaid = ['paid', 'ready', 'collected', 'dispatched', 'refunded', 'cancelled']
      .includes(o.status);

    if (isPaid && inRange(paidDay)) {
      const v = vatForOrder(o, settings);
      salesGross += v.gross; salesNet += v.net; salesVat += v.vat;
      if (v.zeroRated) { exportGross += v.gross; exportCount += 1; }
      rows.push({
        reference: o.reference, day: paidDay,
        zone: o.fulfilment === 'collect' ? 'collection' : (o.zone || ''),
        gross: v.gross, net: v.net, vat: v.vat, rate: v.rate,
        zero_rated: v.zeroRated, kind: 'sale',
      });
    }

    // A refund is credited to the period it was ISSUED in, not the period of
    // the original sale, which is how the return is actually filed.
    const r = o.refund;
    if (r && inRange(String(r.at || '').slice(0, 10))) {
      const v = vatForOrder(o, settings);
      const amount = Math.round(r.amount || 0);
      // Refunds here are full, so the VAT credited is the order's VAT.
      const credited = v.gross ? Math.round(v.vat * (amount / v.gross)) : 0;
      refundGross += amount; refundVat += credited; refundCount += 1;
      rows.push({
        reference: o.reference, day: String(r.at || '').slice(0, 10),
        zone: o.fulfilment === 'collect' ? 'collection' : (o.zone || ''),
        gross: -amount, net: -(amount - credited), vat: -credited, rate: v.rate,
        zero_rated: v.zeroRated, kind: r.kind === 'cancel' ? 'cancellation' : 'refund',
      });
    }
  }

  rows.sort((a, b) => String(a.day).localeCompare(String(b.day)));

  return {
    registered: s.registered,
    number: s.number,
    rate: s.rate,
    from, to,
    sales: { count: rows.filter((r) => r.kind === 'sale').length,
             gross: salesGross, net: salesNet, vat: salesVat },
    exports: { count: exportCount, gross: exportGross },
    refunds: { count: refundCount, gross: refundGross, vat: refundVat },
    due: { gross: salesGross - refundGross,
           net: salesNet - (refundGross - refundVat),
           vat: salesVat - refundVat },
    rows,
  };
}

/** Quarters ending Mar/Jun/Sep/Dec, which is the common filing pattern. */
export function vatPeriods(today = new Date()) {
  const out = [];
  const y = today.getUTCFullYear();
  const q = Math.floor(today.getUTCMonth() / 3);
  for (let back = 0; back < 6; back += 1) {
    let qq = q - back; let yy = y;
    while (qq < 0) { qq += 4; yy -= 1; }
    const startM = qq * 3;
    const from = `${yy}-${String(startM + 1).padStart(2, '0')}-01`;
    const endD = new Date(Date.UTC(yy, startM + 3, 0));
    out.push({
      id: `${yy}-Q${qq + 1}`,
      label: `Q${qq + 1} ${yy}`,
      from, to: endD.toISOString().slice(0, 10),
    });
  }
  return out;
}
