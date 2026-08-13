/**
 * Shipping: zones and the services offered within them.
 *
 * The old model was one flat rate per region. That cannot express "EU standard
 * £6.00 or EU tracked £12.50", so shipping is now a list of METHODS, each
 * belonging to a zone. A zone with two methods makes the customer choose; a
 * zone with one selects it automatically.
 *
 * Rest of world is deliberately absent rather than priced at zero - an order
 * that cannot be fulfilled should be refused at the basket, not accepted and
 * then cancelled.
 */

import { countryByCode } from './countries.js';

export const DEFAULT_ZONES = [
  // Every zone ships INACTIVE by design. These defaults are only ever seen on
  // a first run or after a settings wipe, and in either case delivery must be
  // a deliberate decision made in the admin, not something a blank KV switched
  // on - a wipe once threatened to silently turn Europe delivery back on.
  // Collection keeps working with zero active zones; checkout answers
  // "We cannot deliver to X at the moment" until a zone is enabled.
  { id: 'iom', name: 'Isle of Man', placeholder: 'IM1 1AA', active: false },
  // Guernsey and Jersey map to this zone in countries.js, so the NAME has to
  // say so - the checkout caption is built from zone names.
  { id: 'uk', name: 'United Kingdom and Channel Islands', placeholder: 'SW1A 1AA', active: false },
  { id: 'eu', name: 'Europe', placeholder: 'Postal code', active: false },
];

export const DEFAULT_METHODS = [
  { id: 'iom-next-day', zone: 'iom', name: 'Tracked', note: 'Tracked, 1-2 working days', price: 250, active: false },
  { id: 'uk-tracked', zone: 'uk', name: 'Tracked', note: 'Tracked delivery', price: 450, active: false },
  { id: 'eu-standard', zone: 'eu', name: 'Standard', note: 'Untracked', price: 600, active: false },
  { id: 'eu-tracked', zone: 'eu', name: 'Tracked', note: 'Tracked and signed for', price: 1250, active: false },
];

/** Isle of Man postcodes are the IM district. Nothing else uses that prefix. */
export const IOM_POSTCODE = /^\s*IM\d/i;

export function zones(settings) {
  const z = settings && Array.isArray(settings.zones) && settings.zones.length
    ? settings.zones : DEFAULT_ZONES;
  return z.filter((x) => x.active !== false);
}

export function methods(settings) {
  const m = settings && Array.isArray(settings.shipping_methods) && settings.shipping_methods.length
    ? settings.shipping_methods : DEFAULT_METHODS;
  return m.filter((x) => x.active !== false);
}

export function methodsForZone(settings, zoneId) {
  return methods(settings).filter((m) => m.zone === zoneId);
}

/**
 * Work out which zone an order really belongs to.
 *
 * A postcode beginning IM is the Isle of Man whatever the customer picked, so
 * a UK selection with an IM postcode is corrected down to the cheaper zone.
 * The reverse - claiming the Isle of Man with a postcode that is not IM -
 * is the underpaying direction and is rejected rather than corrected.
 */
export function resolveZone(settings, country, postcode) {
  const pc = String(postcode || '').trim();
  const live = zones(settings);
  const has = (id) => live.some((z) => z.id === id);

  // An IM postcode is the Isle of Man whatever was picked. Cheaper for the
  // customer, so correcting it is safe; the reverse is checked below.
  if (IOM_POSTCODE.test(pc)) {
    return has('iom')
      ? { zone: 'iom', country: 'IM' }
      : { error: 'We cannot deliver to the Isle of Man at the moment.' };
  }

  const raw = String(country || '').trim();
  const c = countryByCode[raw.toUpperCase()];
  if (!c) {
    // A tab left open before the country list shipped still sends the old zone
    // id. Honour it rather than stranding someone mid-order.
    const asZone = raw.toLowerCase();
    if (asZone && has(asZone)) return { zone: asZone, country: null };
    return { error: 'Please choose the country it is going to.' };
  }

  if (c.code === 'IM') {
    return { error: 'That postcode is not an Isle of Man one. Please check it.' };
  }
  if (!c.zone) {
    return { error: `We cannot deliver to ${c.name} yet. Collection in store is still available.` };
  }
  if (!has(c.zone)) {
    return { error: `We cannot deliver to ${c.name} at the moment.` };
  }
  return { zone: c.zone, country: c.code };
}

/** Pick and validate the service. Returns { method } or { error }. */
export function resolveMethod(settings, zoneId, methodId) {
  const available = methodsForZone(settings, zoneId);
  if (!available.length) {
    return { error: 'No delivery service is available for that destination.' };
  }
  if (!methodId) {
    return available.length === 1
      ? { method: available[0] }
      : { error: 'Please choose a delivery service.' };
  }
  const found = available.find((m) => m.id === String(methodId));
  return found ? { method: found } : { error: 'That delivery service is not available for that destination.' };
}
