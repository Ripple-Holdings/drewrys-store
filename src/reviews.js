/**
 * Reviews.
 *
 * A request goes out on a delay after fulfilment: two days after a collection,
 * a week after a delivery, both configurable. The customer follows a one-time
 * tokenised link, leaves a rating and a few words, and it lands in the admin
 * as pending. Ben publishes it or he does not.
 *
 * A second email then invites them to post the same thing on Google or
 * Facebook. Whether that goes to everyone or only above a rating is set by
 * `review_ask_from` in settings.
 *
 * ------------------------------------------------------------------------
 * READ THIS BEFORE CHANGING review_ask_from
 *
 * Setting it above 1 means only some customers are invited to review
 * publicly, chosen by the rating they gave. Google's policy names that
 * directly: "discouraging or prohibiting negative reviews, or selectively
 * soliciting positive reviews from customers". The documented enforcement is
 * removal of every review on the profile, not a warning. In the UK the CMA
 * also has direct enforcement over concealing negative reviews under the
 * DMCC Act 2024.
 *
 * Set review_ask_from to 1 and everyone gets the invite, which is compliant.
 * Mark has been told this twice and chose 4. It is one field, no code change.
 * ------------------------------------------------------------------------
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const REVIEW_DEFAULTS = {
  review_delay_collect: 2,     // days after "collected"
  review_delay_deliver: 7,     // days after "dispatched"
  review_ask_from: 4,          // minimum stars for the public invite; 1 = everyone
  review_google_url: '',       // g.page/r/.../review
  review_facebook_url: '',     // the Page's reviews tab
  review_auto_publish: false,  // publish without Ben looking? default no
};

export const PLATFORMS = { google: 'Google', facebook: 'Facebook' };

/** Which public platforms are actually configured. */
export function livePlatforms(settings) {
  const out = [];
  if (settings.review_google_url) out.push({ id: 'google', name: 'Google', url: settings.review_google_url });
  if (settings.review_facebook_url) out.push({ id: 'facebook', name: 'Facebook', url: settings.review_facebook_url });
  return out;
}

/** Short, unguessable, url safe. */
export function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map((x) => x.toString(36).padStart(2, '0')).join('').slice(0, 22);
}

export function reviewId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const dayMs = 86400000;

/** Queue a request for an order that has just been fulfilled. */
export async function queueReviewRequest(env, order, settings) {
  if (!order?.customer?.email) return;
  const days = order.fulfilment === 'collect'
    ? Number(settings.review_delay_collect ?? REVIEW_DEFAULTS.review_delay_collect)
    : Number(settings.review_delay_deliver ?? REVIEW_DEFAULTS.review_delay_deliver);

  const raw = await env.DREWRYS_KV.get('reviews:queue');
  let queue = [];
  try { queue = raw ? JSON.parse(raw) : []; } catch { queue = []; }
  if (queue.some((q) => q.reference === order.reference)) return;   // already queued

  queue.push({
    reference: order.reference,
    due: Date.now() + Math.max(0, days) * dayMs,
    email: order.customer.email,
  });
  await env.DREWRYS_KV.put('reviews:queue', JSON.stringify(queue.slice(-500)));
}

/** Everything due now. Leaves the rest in place. */
export async function takeDue(env) {
  const raw = await env.DREWRYS_KV.get('reviews:queue');
  let queue = [];
  try { queue = raw ? JSON.parse(raw) : []; } catch { queue = []; }
  const now = Date.now();
  const due = queue.filter((q) => q.due <= now);
  const rest = queue.filter((q) => q.due > now);
  if (due.length) await env.DREWRYS_KV.put('reviews:queue', JSON.stringify(rest));
  return due;
}

export async function getReviews(env) {
  const raw = await env.DREWRYS_KV.get('reviews:index');
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export async function putReviews(env, list) {
  await env.DREWRYS_KV.put('reviews:index', JSON.stringify(list.slice(0, 300)));
}

/** Published reviews only, newest first, for the shop to render. */
export function publishedReviews(list) {
  return list.filter((r) => r.status === 'published');
}

export function ratingSummary(list) {
  const pub = publishedReviews(list);
  if (!pub.length) return { count: 0, average: 0, perProduct: {} };
  const total = pub.reduce((s, r) => s + r.rating, 0);
  const perProduct = {};
  pub.forEach((r) => (r.products || []).forEach((slug) => {
    perProduct[slug] = perProduct[slug] || { count: 0, sum: 0 };
    perProduct[slug].count += 1;
    perProduct[slug].sum += r.rating;
  }));
  Object.values(perProduct).forEach((p) => { p.average = p.sum / p.count; });
  return { count: pub.length, average: total / pub.length, perProduct };
}

/* ── the customer-facing form ────────────────────────────────────────────── */

export function reviewFormPage(order, token, opts = {}) {
  const items = (order.items || []).map((i) => esc(i.name)).join(', ');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Leave a review · Drewrys</title>
<link rel="icon" type="image/png" href="/img/favicon.png">
<meta name="robots" content="noindex">
<style>
@import url('/fonts.css');
:root{--cotton:#F3EDE1;--cotton-2:#ECE3D3;--ink:#191C21;--peanut:#C79A6B;
  --peanut-deep:#9A6C3E;--slate:#2B3037;--line:rgba(25,28,33,.16);--muted:rgba(25,28,33,.58)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--cotton);color:var(--ink);font-family:"Geist",system-ui,sans-serif;
  line-height:1.55;-webkit-font-smoothing:antialiased}
.top{padding:30px 22px 0;text-align:center}
.top img{height:56px;margin:0 auto;display:block}
.wrap{max-width:620px;margin:22px auto 70px;padding:0 22px}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:26px 26px 28px}
h1{font-family:"NeueMontreal",sans-serif;font-weight:500;font-size:1.6rem;
  letter-spacing:-.012em;margin-bottom:8px}
p.sub{color:var(--muted);font-size:.95rem;margin-bottom:22px}
label{display:block;font-size:.85rem;font-weight:600;color:var(--muted);margin:16px 0 7px}
input,textarea{width:100%;padding:12px 14px;border:1.5px solid var(--line);border-radius:12px;
  background:#fff;font-family:inherit;font-size:.95rem;color:var(--ink)}
textarea{min-height:120px;resize:vertical;line-height:1.55}
input:focus,textarea:focus{outline:none;border-color:var(--peanut-deep)}
.stars{display:flex;gap:6px}
.star{width:52px;height:52px;border:1.5px solid var(--line);border-radius:14px;background:#fff;
  cursor:pointer;font-size:24px;line-height:1;color:var(--line);transition:.15s}
.star.on{color:var(--peanut);border-color:var(--peanut)}
.star:focus{outline:2px solid var(--peanut-deep);outline-offset:2px}
.rlabel{font-size:.85rem;color:var(--muted);margin-top:8px;min-height:20px}
button.send{width:100%;margin-top:24px;padding:16px;border:0;border-radius:40px;
  background:var(--slate);color:var(--cotton);font-family:inherit;font-size:.9rem;
  font-weight:700;letter-spacing:.02em;cursor:pointer}
button.send:disabled{opacity:.45;cursor:default}
.msg{margin-top:14px;font-size:.86rem;color:#8a3d3d;font-weight:650;min-height:20px}
.done{text-align:center;padding:14px 0}
.done h1{margin-bottom:10px}
.plat{display:inline-flex;align-items:center;justify-content:center;margin-top:18px;
  padding:14px 26px;border-radius:40px;background:var(--peanut);color:var(--slate);
  font-weight:700;font-size:.86rem;letter-spacing:.02em;text-decoration:none}
.order{font-size:.8rem;color:var(--muted);margin-top:20px;text-align:center}
</style></head><body>
<div class="top"><a href="/"><img src="/img/logo-d.png" alt="Drewrys"></a></div>
<div class="wrap">
  <div class="card" id="form">
    <h1>How did we do?</h1>
    <p class="sub">${items ? 'You ordered ' + items + '.' : ''} It takes a minute and it genuinely helps.</p>

    <label>Your rating</label>
    <div class="stars" id="stars">
      ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star" data-n="${n}"
        aria-label="${n} star${n > 1 ? 's' : ''}">&#9733;</button>`).join('')}
    </div>
    <div class="rlabel" id="rlabel"></div>

    <label for="name">Your name</label>
    <input id="name" maxlength="60" value="${esc(order.customer?.name || '')}" autocomplete="name">

    <label for="text">Anything you would like to say</label>
    <textarea id="text" maxlength="1200"
      placeholder="What you bought, how you got on with it, anything at all."></textarea>

    <button class="send" id="send" disabled>Send review</button>
    <div class="msg" id="msg"></div>
  </div>

  <div class="card done" id="done" hidden>
    <h1>Thank you.</h1>
    <p class="sub" id="doneMsg">That is genuinely useful.</p>
    <div id="platWrap" hidden>
      <p class="sub" style="margin-bottom:0">Would you mind sharing it publicly too?</p>
      <a class="plat" id="platLink" href="#" rel="noopener">Review us on <span id="platName"></span></a>
    </div>
  </div>
  <p class="order">Order ${esc(order.reference)}</p>
</div>
<script>
var RATING=0;
var LABELS={1:'Not good',2:'Below par',3:'Fine',4:'Good',5:'Excellent'};
var stars=[].slice.call(document.querySelectorAll('.star'));
stars.forEach(function(b){
  b.addEventListener('click',function(){
    RATING=+b.dataset.n;
    stars.forEach(function(x){ x.classList.toggle('on', +x.dataset.n<=RATING); });
    document.getElementById('rlabel').textContent=LABELS[RATING]||'';
    document.getElementById('send').disabled=false;
  });
});
document.getElementById('send').addEventListener('click',async function(){
  if(!RATING) return;
  var b=this; b.disabled=true; b.textContent='Sending...';
  try{
    var r=await fetch(location.pathname,{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({rating:RATING,
        name:document.getElementById('name').value,
        text:document.getElementById('text').value})});
    var d=await r.json();
    if(!r.ok) throw new Error(d.error||'Could not send that');
    document.getElementById('form').hidden=true;
    var done=document.getElementById('done'); done.hidden=false;
    if(d.platform&&d.url){
      document.getElementById('platName').textContent=d.platform;
      document.getElementById('platLink').href=d.url;
      document.getElementById('platWrap').hidden=false;
    }
  }catch(e){
    document.getElementById('msg').textContent=e.message||'Could not send that.';
    b.disabled=false; b.textContent='Send review';
  }
});
</script></body></html>`;
}

export function reviewSharePage(review, links) {
  const text = String(review.text || '');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Share your review · Drewrys</title>
<link rel="icon" type="image/png" href="/img/favicon.png">
<meta name="robots" content="noindex">
<style>
@import url('/fonts.css');
:root{--cotton:#F3EDE1;--cotton-2:#ECE3D3;--ink:#191C21;--peanut:#C79A6B;
  --peanut-deep:#9A6C3E;--slate:#2B3037;--line:rgba(25,28,33,.16);--muted:rgba(25,28,33,.58)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--cotton);color:var(--ink);font-family:"Geist",system-ui,sans-serif;
  line-height:1.55;-webkit-font-smoothing:antialiased}
.top{padding:30px 22px 0;text-align:center}
.top img{height:56px;margin:0 auto;display:block}
.wrap{max-width:600px;margin:22px auto 70px;padding:0 22px}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:26px}
h1{font-family:"NeueMontreal",sans-serif;font-weight:500;font-size:1.5rem;
  letter-spacing:-.012em;margin-bottom:8px}
p.sub{color:var(--muted);font-size:.95rem;margin-bottom:20px}
.stars{color:var(--peanut);font-size:1.1rem;letter-spacing:2px;margin-bottom:10px}
.stars .off{color:var(--line)}
.quote{background:var(--cotton);border:1px solid var(--line);border-radius:14px;
  padding:16px 18px;font-size:.98rem;line-height:1.62;white-space:pre-wrap}
.copy{width:100%;margin-top:14px;padding:15px;border:1.5px solid var(--ink);border-radius:40px;
  background:#fff;color:var(--ink);font-family:inherit;font-size:.88rem;font-weight:700;cursor:pointer}
.copy.done{background:var(--ink);color:var(--cotton)}
.step{margin-top:26px;font-size:.8rem;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--muted)}
.go{display:block;text-align:center;margin-top:10px;padding:16px;border-radius:40px;
  background:var(--slate);color:var(--cotton);text-decoration:none;font-weight:700;font-size:.9rem}
.go.fb{background:var(--peanut);color:var(--slate)}
.note{font-size:.82rem;color:var(--muted);margin-top:18px;line-height:1.6}
</style></head><body>
<div class="top"><a href="/"><img src="/img/logo-d.png" alt="Drewrys"></a></div>
<div class="wrap"><div class="card">
  <h1>Thanks again.</h1>
  <p class="sub">If you would share the same publicly, here it is ready to paste.</p>
  <div class="stars">${'&#9733;'.repeat(review.rating)}<span class="off">${'&#9733;'.repeat(5 - review.rating)}</span></div>
  <div class="quote" id="q">${esc(text) || '(you did not leave any words, so write whatever you like)'}</div>
  <button class="copy" id="copy">Copy my review</button>
  <div class="step">Then post it</div>
  ${links.map((l) => `<a class="go${l.id === 'facebook' ? ' fb' : ''}" href="${esc(l.url)}"
    target="_blank" rel="noopener">Open ${esc(l.name)}</a>`).join('')}
  
</div></div>
<script>
document.getElementById('copy').addEventListener('click',async function(){
  var t=document.getElementById('q').innerText;
  try{ await navigator.clipboard.writeText(t); }
  catch(e){ var r=document.createRange(); r.selectNode(document.getElementById('q'));
    window.getSelection().removeAllRanges(); window.getSelection().addRange(r);
    try{ document.execCommand('copy'); }catch(e2){} }
  this.textContent='Copied'; this.classList.add('done');
});
</script></body></html>`;
}

export function reviewGonePage(message) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Drewrys</title><meta name="robots" content="noindex">
<style>@import url('/fonts.css');
body{margin:0;background:#F3EDE1;color:#191C21;font-family:"Geist",system-ui,sans-serif;
  display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}
h1{font-family:"NeueMontreal",sans-serif;font-weight:500;font-size:1.5rem;margin-bottom:8px}
p{color:rgba(25,28,33,.6);font-size:.95rem}
a{color:#9A6C3E;font-weight:600;display:inline-block;margin-top:16px}
</style></head><body><div>
<h1>${esc(message)}</h1>
<p>If you think that is wrong, just reply to the email we sent you.</p>
<a href="/">Back to the shop</a>
</div></body></html>`;
}
