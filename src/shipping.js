/**
 * Shipping: zones and the services offered within them.
 *
 * The old model was one flat rate per region. That cannot express "EU standard
 * £6.00 or EU tracked £12.50", so shipping is now a list of METHODS, each
 * belonging to a zone. A zone with two methods makes the customer choose; a
 * zone with one selects it automatically.
 *
 * Rest of world is deliberately absent rather than priced at zero — an order
 * that cannot be fulfilled should be refused at the basket, not accepted and
 * then cancelled.
 */

export const DEFAULT_ZONES = [
  { id: 'iom', name: 'Isle of Man', placeholder: 'IM1 1AA', active: true },
  { id: 'uk', name: 'United Kingdom', placeholder: 'SW1A 1AA', active: true },
  { id: 'eu', name: 'Europe', placeholder: 'Postal code', active: true },
];

export const DEFAULT_METHODS = [
  { id: 'iom-next-day', zone: 'iom', name: 'Next day tracked', note: 'Tracked, next working day', price: 250, active: true },
  { id: 'uk-tracked', zone: 'uk', name: 'Tracked', note: 'Tracked delivery', price: 450, active: true },
  { id: 'eu-standard', zone: 'eu', name: 'Standard', note: 'Untracked', price: 600, active: true },
  { id: 'eu-tracked', zone: 'eu', name: 'Tracked', note: 'Tracked and signed for', price: 1250, active: true },
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
 * The reverse — claiming the Isle of Man with a postcode that is not IM —
 * is the underpaying direction and is rejected rather than corrected.
 */
export function resolveZone(settings, claimed, postcode) {
  const pc = String(postcode || '').trim();
  const live = zones(settings);
  const has = (id) => live.some((z) => z.id === id);

  if (IOM_POSTCODE.test(pc)) {
    return has('iom')
      ? { zone: 'iom' }
      : { error: 'We cannot deliver to the Isle of Man at the moment.' };
  }
  const want = String(claimed || '').toLowerCase();
  if (want === 'iom') {
    return { error: 'That postcode is not an Isle of Man one. Please choose where it is going.' };
  }
  if (!has(want)) {
    return { error: 'We cannot deliver there yet. Collection in store is still available.' };
  }
  return { zone: want };
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
