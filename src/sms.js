/**
 * SMS for the Drewrys Worker.
 *
 * The platform has sms.py doing this job on Railway, but that is Python and
 * this is a Cloudflare Worker, so the twenty lines of send code are written
 * twice rather than routing every text through Railway for no gain. Behaviour
 * is deliberately identical to sms.py: absent configuration is not an error,
 * failures come back as values, and nothing here can break an order.
 *
 * Worker secrets:
 *   TWILIO_ACCOUNT_SID   starts AC...
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_SMS_FROM      +447... or a sender ID such as Drewrys
 *
 * Isle of Man needs no sender ID registration; the UK does. An unregistered ID
 * is filtered by UK networks, so until Drewrys is registered, either leave this
 * unset or use a number.
 */

const MAX_BODY = 1600;

// 3 to 11 characters, letters and digits, at least one letter. A digits-only
// value would be read as a broken phone number.
const ALPHA_SENDER = /^(?=.*[A-Za-z])[A-Za-z0-9]{3,11}$/;

/** A UK or Isle of Man number in E.164, or '' if it cannot be one. */
export function normaliseNumber(raw, defaultCc = '44') {
  let n = String(raw || '').replace(/[^\d+]/g, '');
  if (!n) return '';
  if (n.startsWith('+')) return n.length >= 11 ? n : '';
  if (n.startsWith('00')) {
    n = n.slice(2);
    return n.length >= 10 ? '+' + n : '';
  }
  if (n.startsWith('0')) n = defaultCc + n.slice(1);
  else if (!n.startsWith(defaultCc)) n = defaultCc + n;
  return n.length >= 11 ? '+' + n : '';
}

/** A usable From value: a number in E.164, or an alphanumeric sender ID. */
export function normaliseSender(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('+')) return normaliseNumber(s);
  const cleaned = s.replace(/[^A-Za-z0-9]/g, '').slice(0, 11);
  return ALPHA_SENDER.test(cleaned) ? cleaned : '';
}

export function smsEnabled(env) {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
                 && normaliseSender(env.TWILIO_SMS_FROM));
}

/**
 * Send one SMS. Returns { ok, error }. Never throws.
 *
 * An order confirmation must not fail because a text did not go out, so every
 * failure is a value. Call it from ctx.waitUntil so the customer is not kept
 * waiting on Twilio.
 */
export async function sendSms(env, toNumber, message, sender) {
  const sid = (env.TWILIO_ACCOUNT_SID || '').trim();
  const token = (env.TWILIO_AUTH_TOKEN || '').trim();
  if (!sid || !token) return { ok: false, error: 'sms not configured' };

  const from = normaliseSender(sender || env.TWILIO_SMS_FROM);
  if (!from) return { ok: false, error: 'no valid sender configured' };

  const to = normaliseNumber(toNumber);
  if (!to) return { ok: false, error: 'invalid number' };

  let body = String(message || '').trim();
  if (!body) return { ok: false, error: 'empty message' };
  if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY - 1) + '\u2026';

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${sid}:${token}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
      });

    if (res.ok) {
      // Last four digits only. A full mobile number in a Worker log is personal
      // data sitting somewhere nobody audits.
      console.log('SMS sent to ...' + to.slice(-4));
      return { ok: true, error: null };
    }

    let detail = '';
    try {
      const j = await res.json();
      detail = `${j.code || ''} ${j.message || ''}`.trim();
    } catch { detail = `http ${res.status}`; }
    console.error(`Twilio ${res.status} to ...${to.slice(-4)}: ${detail}`);
    return { ok: false, error: detail };
  } catch (e) {
    console.error('SMS send failed:', String(e && e.message || e));
    return { ok: false, error: String(e && e.message || e) };
  }
}

/** Fire and forget. Resolves true or false, swallows everything. */
export async function sendSmsSafe(env, toNumber, message, sender) {
  try {
    const r = await sendSms(env, toNumber, message, sender);
    return r.ok;
  } catch { return false; }
}
