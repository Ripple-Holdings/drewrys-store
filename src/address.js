/**
 * Postcode → address lookup.
 *
 * Covers the Isle of Man and the UK (Royal Mail PAF, which includes the IM
 * postcode area). Europe falls back to typing it out, which is fine — it is
 * the smallest share of orders and no UK-postcode service covers it anyway.
 *
 * The API key lives in the Worker, never the browser: a key in client-side
 * JavaScript is a key anyone can lift and spend Ben's credits with.
 *
 * DELIBERATELY NOT CACHED. Royal Mail's PAF licence restricts storing address
 * data, and a KV cache of postcode → addresses is exactly that. Ideal
 * Postcodes only charges when a full address list is returned, so the saving
 * would be real, but not worth a licence breach. If Ben's volume ever makes
 * it worth revisiting, ask them first.
 */

/** UK and IoM postcode shapes. Rejects junk before a credit is spent. */
const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function looksLikePostcode(s) {
  return POSTCODE.test(String(s || '').trim());
}

/**
 * Only answer requests that came from our own pages. The endpoint spends
 * money, so it should not be usable from anyone else's site.
 */
function sameOrigin(request, env) {
  const origin = request.headers.get('Origin') || request.headers.get('Referer') || '';
  if (!origin) return true;                     // same-origin fetches may omit it
  try {
    const host = new URL(origin).host;
    const mine = new URL(request.url).host;
    if (host === mine) return true;
    const site = env.SITE_ORIGIN ? new URL(env.SITE_ORIGIN).host : '';
    return !!site && host === site;
  } catch { return false; }
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export async function lookupPostcode(request, env, url) {
  if (!env.ADDRESS_API_KEY) {
    return json({ error: 'lookup unavailable', addresses: [] }, 503);
  }
  if (!sameOrigin(request, env)) return json({ error: 'forbidden' }, 403);

  const q = String(url.searchParams.get('postcode') || '').trim();
  if (!looksLikePostcode(q)) {
    return json({ error: 'That does not look like a postcode.', addresses: [] }, 400);
  }

  const endpoint = `https://api.ideal-postcodes.co.uk/v1/postcodes/${
    encodeURIComponent(q.replace(/\s+/g, ''))}?api_key=${encodeURIComponent(env.ADDRESS_API_KEY)}`;

  let res;
  try {
    res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  } catch (e) {
    console.error('address lookup fetch failed', e);
    return json({ error: 'Lookup is unavailable, please type your address.', addresses: [] }, 502);
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 404) {
    return json({ error: 'No addresses found for that postcode.', addresses: [] }, 404);
  }
  if (!res.ok) {
    // 402 is an exhausted balance. Log it loudly — the shop still works, but
    // nobody would otherwise notice the lookups had quietly stopped.
    console.error('address lookup failed', res.status, JSON.stringify(data).slice(0, 300));
    return json({ error: 'Lookup is unavailable, please type your address.', addresses: [] }, 502);
  }

  const addresses = (data.result || []).map((a) => ({
    line1: a.line_1 || '',
    line2: [a.line_2, a.line_3].filter(Boolean).join(', '),
    city: a.post_town || '',
    postcode: a.postcode || q.toUpperCase(),
    label: [a.line_1, a.line_2, a.line_3, a.post_town].filter(Boolean).join(', '),
  })).filter((a) => a.line1);

  return json({ addresses });
}
