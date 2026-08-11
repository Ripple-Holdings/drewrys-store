/**
 * Newsletter signups and wholesale enquiries.
 *
 * Both forms existed on the storefront and NEITHER sent anywhere. The
 * newsletter cleared the box and showed a toast; the wholesale button changed
 * its own text to "Request sent". Every signup and every trade enquiry since
 * launch is gone, and the customer was told it worked.
 *
 * Kept in its own module so index.js stays about routing and orders.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Same origin check the address lookup uses, so nobody else can fill the list. */
function sameOrigin(request, env) {
  const want = String(env.SITE_ORIGIN || '').replace(/\/$/, '');
  if (!want) return true;                       // not configured, do not block
  const got = String(request.headers.get('Origin') || '').replace(/\/$/, '');
  return !got || got === want;
}

const clean = (v, n) => String(v ?? '').trim().slice(0, n);

/**
 * POST /api/subscribe  { email, hp }
 *
 * `hp` is a honeypot the browser leaves empty. A bot fills every field it
 * finds, so a non-empty value is answered with a cheerful 200 and dropped -
 * telling a bot it failed only teaches it to try again.
 */
export async function subscribe(request, env) {
  if (!sameOrigin(request, env)) return json({ error: 'no' }, 403);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'bad request' }, 400); }

  if (clean(body.hp, 60)) return json({ ok: true });          // honeypot

  const email = clean(body.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return json({ error: 'That does not look like an email address.' }, 400);
  }

  const key = `sub:${email}`;
  const existing = await env.DREWRYS_KV.get(key);
  if (existing) return json({ ok: true, already: true });     // idempotent, no duplicate

  await env.DREWRYS_KV.put(key, JSON.stringify({
    email, at: new Date().toISOString(),
    source: clean(body.source, 40) || 'footer',
  }));
  console.log('newsletter signup', email);
  return json({ ok: true });
}

/**
 * POST /api/enquiry  { business, name, email, type, message, hp }
 *
 * The wholesale form. Stored AND emailed to the owner, because a trade enquiry
 * that only lands in a KV key nobody opens is barely better than one that went
 * nowhere.
 */
export async function contact(request, env, ctx, sendEmail) {
  return capture(request, env, ctx, sendEmail, 'contact');
}

export async function enquiry(request, env, ctx, sendEmail) {
  return capture(request, env, ctx, sendEmail, 'trade');
}

async function capture(request, env, ctx, sendEmail, kind) {
  if (!sameOrigin(request, env)) return json({ error: 'no' }, 403);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'bad request' }, 400); }

  if (clean(body.hp, 60)) return json({ ok: true });

  const trade = kind === 'trade';
  const email = clean(body.email, 200).toLowerCase();
  const name = clean(body.name, 120);
  const business = clean(body.business, 160);
  if (trade && !business) return json({ error: 'Tell us your business name.' }, 400);
  if (!name) return json({ error: 'Tell us your name.' }, 400);
  if (!EMAIL_RE.test(email)) {
    return json({ error: 'That does not look like an email address.' }, 400);
  }
  const message = clean(body.message, 1200);
  if (!trade && !message) return json({ error: 'Tell us how we can help.' }, 400);

  const lead = {
    id: `${trade ? 'WS' : 'MSG'}-${Date.now().toString(36).toUpperCase()}`,
    kind, at: new Date().toISOString(),
    business, name, email,
    type: clean(body.type, 60),
    message,
  };

  await env.DREWRYS_KV.put(`lead:${lead.id}`, JSON.stringify(lead),
    { expirationTtl: 60 * 60 * 24 * 365 * 2 });
  console.log(trade ? 'wholesale enquiry' : 'contact message', lead.id, business || name);

  const to = env.SHOP_ORDER_EMAIL || env.SHOP_CONTACT_EMAIL;
  if (to && typeof sendEmail === 'function') {
    ctx.waitUntil(sendEmail(env, {
      to,
      subject: trade ? `Trade enquiry from ${business}` : `Message from ${name}`,
      html: enquiryEmail(lead),
      // Reply goes to THEM. The body says to reply, and replying to your own
      // inbox is the sort of thing nobody notices until a lead goes cold.
      replyTo: email,
    }));
  }
  return json({ ok: true });
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Plain and deliberately unstyled: this one goes to the owner, not a customer. */
function enquiryEmail(lead) {
  const row = (k, v) => v
    ? `<tr><td style="padding:6px 14px 6px 0;color:#7a746b;font-size:14px;white-space:nowrap">${k}</td>
         <td style="padding:6px 0;color:#191C21;font-size:15px">${esc(v)}</td></tr>`
    : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:24px;background-color:#EFEAE1;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:26px">
    <tr><td style="font-size:13px;font-weight:700;letter-spacing:.1em;
      text-transform:uppercase;color:#191C21;padding-bottom:14px">${
        lead.kind === 'trade' ? 'Trade enquiry' : 'Message from the website'}</td></tr>
    <tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0">
      ${row('Business', lead.business)}
      ${row('Name', lead.name)}
      ${row('Email', lead.email)}
      ${row('Type', lead.type)}
      ${row('Reference', lead.id)}
    </table></td></tr>
    ${lead.message ? `<tr><td style="padding-top:16px;font-size:15px;line-height:1.6;
      color:#191C21;white-space:pre-wrap">${esc(lead.message)}</td></tr>` : ''}
    <tr><td style="padding-top:20px;font-size:13.5px;color:#7a746b">
      Reply straight to this email to answer them.</td></tr>
  </table>
</body></html>`;
}

/**
 * A per-address unsubscribe token. HMAC of the email under ANALYTICS_SALT (or
 * ADMIN_KEY), so a link cannot be forged and nobody can unsubscribe a stranger
 * by guessing, and no extra key has to be stored per subscriber.
 */
export async function unsubToken(env, email) {
  const secret = env.ANALYTICS_SALT || env.ADMIN_KEY || 'drewrys';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(String(email).toLowerCase()));
  return [...new Uint8Array(sig).slice(0, 12)]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** GET /unsubscribe?e=<email>&t=<token>. One click, no login, no dark pattern. */
export async function unsubscribe(request, env, url) {
  const email = String(url.searchParams.get('e') || '').trim().toLowerCase();
  const token = String(url.searchParams.get('t') || '').trim();
  let ok = false;
  if (EMAIL_RE.test(email) && token && token === await unsubToken(env, email)) {
    await env.DREWRYS_KV.delete(`sub:${email}`);
    ok = true;
    console.log('unsubscribed', email);
  }
  return new Response(unsubPage(ok, email), {
    status: ok ? 200 : 400,
    headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function unsubPage(ok, email) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ok ? 'Unsubscribed' : 'Link not recognised'} \u00b7 Drewrys</title>
<link rel="icon" type="image/png" href="/img/favicon.png">
<meta name="robots" content="noindex,nofollow">
<link rel="stylesheet" href="/fonts-order.css">
<style>
body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#F3EDE1;
  color:#191C21;font-family:"Geist",system-ui,sans-serif;padding:24px;text-align:center}
.b{max-width:440px}
img{width:92px;height:auto;margin:0 auto 26px;display:block}
h1{font-family:"NeueMontreal","Geist",sans-serif;font-weight:500;letter-spacing:-.02em;
  font-size:clamp(1.6rem,4.5vw,2.2rem);line-height:1.1;margin:0}
p{margin-top:14px;color:rgba(25,28,33,.64);line-height:1.6}
a.btn{display:inline-block;margin-top:26px;background:#C79A6B;color:#191C21;
  text-decoration:none;font-weight:600;padding:14px 28px;border-radius:99px}
</style></head><body><div class="b">
<a href="/"><img src="/img/logo-d.png" alt="Drewrys"></a>
${ok
  ? `<h1>You are unsubscribed.</h1>
     <p>${esc(email)} has been removed from the list and we have deleted the
     record. You will not hear from us again unless you sign up afresh.</p>`
  : `<h1>That link did not work.</h1>
     <p>It may have been cut short by your email app. Reply to any of our
     emails and we will take you off the list by hand.</p>`}
<a class="btn" href="/">Back to the shop</a>
</div></body></html>`;
}

/** Everything captured, newest first, for the admin. */
export async function listLeads(env) {
  const subs = [];
  const leads = [];
  try {
    for (const [prefix, into] of [['sub:', subs], ['lead:', leads]]) {
      let cursor;
      do {
        const page = await env.DREWRYS_KV.list({ prefix, cursor, limit: 500 });
        for (const k of page.keys) {
          const raw = await env.DREWRYS_KV.get(k.name);
          if (!raw) continue;
          try { into.push(JSON.parse(raw)); } catch { /* skip */ }
        }
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
    }
  } catch (e) {
    console.error('listLeads failed', String(e && e.message || e));
  }
  const byDate = (a, b) => String(b.at || '').localeCompare(String(a.at || ''));
  return { subscribers: subs.sort(byDate), enquiries: leads.sort(byDate) };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json;charset=utf-8' },
  });
}
