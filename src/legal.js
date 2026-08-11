/**
 * Terms, Returns and Privacy.
 *
 * NOT LEGAL ADVICE. This is a solid, specific starting draft written against
 * how the shop actually works - Isle of Man trader, Teya hosted checkout,
 * Cloudflare hosting, SendGrid email, no cookies, no accounts. Ben should
 * read it and, if he wants certainty, have an IoM solicitor glance at it.
 *
 * EVERYTHING BEN MUST SUPPLY IS IN THE `BUSINESS` BLOCK BELOW AND NOWHERE
 * ELSE. Anything still reading TO BE CONFIRMED renders as a visible marker
 * on the page, so a half-filled policy cannot quietly go live.
 */

export const BUSINESS = {
  legal_name: 'DGG Limited',
  trading_as: 'Drewrys',
  company_number: '130898C',
  registered_address: 'Ground Floor, Falcon House, Ridgeway Street, Douglas, Isle of Man, IM1 1EL',
  trading_address: 'Falcon House, 22 Ridgeway Street, Douglas, Isle of Man, IM1 1EL',
  // Not separately supplied, so returns go to the shop. Change this if Ben
  // wants them somewhere else.
  returns_address: 'Falcon House, 22 Ridgeway Street, Douglas, Isle of Man, IM1 1EL',
  email: 'hello@drewrys.store',
  phone: '07624 373979',
  vat_number: 'GB004838290',
  site: 'drewrys.store',

  // Delivery timescales, as advertised. Keep honest - these are promises.
  dispatch: '1-2 working days',
  delivery_iom: '1-2 working days',
  delivery_uk: '3-5 working days',
  delivery_intl: '7-21 working days',

  // Who pays to send an unwanted item back. Statutory minimum is the
  // customer, provided that is stated before they order - which this does.
  return_postage: 'customer',
};

const MISSING = /TO BE CONFIRMED/;
const f = (key) => {
  const v = BUSINESS[key] || '';
  return MISSING.test(v)
    ? `<mark class="todo">${v}</mark>`
    : String(v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
};

const updated = 'August 2026';

function page(title, intro, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} \u00b7 Drewrys</title>
<link rel="icon" type="image/png" href="/img/favicon.png">
<meta name="robots" content="index,follow">
<link rel="stylesheet" href="/fonts-order.css">
<style>
:root{--cotton:#F3EDE1;--cotton-2:#ECE3D3;--ink:#191C21;--slate:#2B3037;
  --peanut:#C79A6B;--peanut-deep:#9A6C3E;--line:rgba(25,28,33,.16);
  --muted:rgba(25,28,33,.62)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--cotton);color:var(--ink);
  font-family:"Geist",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  line-height:1.62;-webkit-font-smoothing:antialiased}

/* Solid black masthead, mark centred, Back sitting to the right of it and
   dropping under on a phone rather than squashing the logo off centre. */
.top{background:var(--ink)}
.top .in{max-width:760px;margin:0 auto;padding:22px 24px;position:relative;
  display:flex;align-items:center;justify-content:center;min-height:64px}
.top img{height:38px;width:auto;display:block}
.top .back{position:absolute;right:24px;top:50%;transform:translateY(-50%);
  background:var(--peanut);color:var(--ink);text-decoration:none;
  font-family:"NeueMontreal","Geist",system-ui,sans-serif;font-weight:600;
  font-size:.9rem;padding:10px 20px;border-radius:99px;white-space:nowrap}
.top .back:hover{background:var(--cotton)}

main{max-width:760px;margin:0 auto;padding:clamp(34px,6vw,58px) 24px 90px}
h1,h2,h3{font-family:"NeueMontreal","Geist",system-ui,sans-serif;font-weight:500;
  letter-spacing:-.02em}
h1{font-size:clamp(1.9rem,5.2vw,2.7rem);line-height:1.08}
.lede{margin-top:14px;font-size:clamp(1rem,2.2vw,1.08rem);color:var(--muted)}
.meta{margin-top:10px;font-size:.83rem;color:var(--muted)}
h2{margin:clamp(32px,5vw,46px) 0 12px;font-size:clamp(1.15rem,2.8vw,1.3rem);line-height:1.2}
h3{margin:26px 0 8px;font-size:1.02rem;font-weight:600}
/* No per-element max-width: the column IS the measure, so everything lines up
   with the heading instead of hugging the left of a wider band. */
p{margin:12px 0}
ul,ol{margin:12px 0 12px 22px}
li{margin:7px 0}
a{color:var(--peanut-deep)}
strong{font-weight:600}
.box{background:var(--cotton-2);border:1px solid var(--line);border-radius:14px;
  padding:18px 20px;margin:22px 0}
.box p:first-child{margin-top:0}.box p:last-child{margin-bottom:0}
.todo{background:#f7e2e2;color:#8a2f2f;padding:1px 7px;border-radius:5px;font-weight:600}

/* Tables scroll rather than squash, which is what broke them on a phone. */
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:16px 0}
table{border-collapse:collapse;width:100%;min-width:420px;font-size:.95rem}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line)}
th{font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;
  color:var(--muted);font-weight:600}

footer{background:var(--ink);color:var(--cotton)}
footer .in{max-width:760px;margin:0 auto;padding:30px 24px;display:flex;gap:22px;
  flex-wrap:wrap;align-items:center;font-size:.88rem;color:rgba(243,237,225,.72)}
footer a{color:var(--cotton);text-decoration:none}
footer a:hover{text-decoration:underline}

@media(max-width:640px){
  .top .in{flex-direction:column;gap:14px;padding:20px}
  .top .back{position:static;transform:none}
  main{padding:30px 20px 70px}
  footer .in{gap:14px;padding:26px 20px}
}
</style></head><body>
<div class="top"><div class="in">
  <a href="/" aria-label="Drewrys"><img src="/img/logo-d-white.png" alt="Drewrys"></a>
  <a class="back" href="/">Back to the shop</a>
</div></div>
<main>
  <h1>${title}</h1>
  <p class="lede">${intro}</p>
  <p class="meta">Last updated ${updated}</p>
  ${body}
</main>
<footer><div class="in">
  <span>&copy; 2026 ${f('legal_name')}</span>
  <a href="/terms">Terms</a><a href="/returns">Returns</a><a href="/privacy">Privacy</a>
  <a href="/">Shop</a>
</div></footer>
</body></html>`;
}


const who = `<div class="box">
  <p><strong>${f('trading_as')}</strong> is a trading name of ${f('legal_name')},
  a company registered in the Isle of Man, company number ${f('company_number')}.
  VAT registration number ${f('vat_number')}.</p>
  <p>Registered office: ${f('registered_address')}<br>
  Shop: ${f('trading_address')}<br>
  Email: <a href="mailto:${BUSINESS.email}">${BUSINESS.email}</a> &middot;
  Telephone: ${f('phone')}</p>
</div>`;

/* ── terms ────────────────────────────────────────────────────────────────── */

export const TERMS = page('Terms &amp; Conditions',
  'The terms you agree to when you buy from this shop.',
  `${who}

<h2>1. About these terms</h2>
<p>These terms apply to every order placed through ${f('site')}. By placing an
order you agree to them, so please read them before you buy. We may update
them from time to time; the version that applies to your order is the one
published when you place it.</p>
<p>Nothing in these terms limits your legal rights as a consumer.</p>

<h2>2. Placing an order</h2>
<p>Adding items to your bag is not an order. Your order is placed when you
complete payment, and a contract is formed when we send you an order
confirmation email. If we cannot fulfil your order &ndash; because an item is
out of stock, priced in error, or we cannot take payment &ndash; we will tell
you and refund anything you have paid in full.</p>
<p>We do not require an account. Your bag is held in your browser only and is
not saved to our systems until you check out.</p>

<h2>3. Prices and payment</h2>
<p>Prices are shown in pounds sterling and include any applicable tax. The
total, including delivery, is shown before you confirm payment.</p>
<p>Payment is taken by <strong>Teya</strong>, our payment provider, on their own
secure checkout page. We never see or hold your card details. If a price is
listed incorrectly we will contact you before dispatch and you may confirm the
order at the correct price or cancel it for a full refund.</p>
<p>Discount codes cannot be combined unless we say so, have no cash value, and
may be withdrawn at any time. All prices and totals are recalculated on our
server when you check out, so the amount charged is always the correct one.</p>

<p>Prices shown INCLUDE VAT at the rate in force. The Isle of Man and the United
Kingdom are a single VAT territory, so VAT applies to orders delivered or
collected there. Orders exported to Europe are zero-rated for VAT, and the price
you pay is the price shown either way. Your order confirmation shows the VAT
included in what you paid.</p>
<h2>4. Delivery and collection</h2>
<div class="tw"><table>
  <tr><th>Option</th><th>Cost</th><th>Timescale</th></tr>
  <tr><td>Collect from the shop</td><td>Free</td><td>${f('dispatch')}</td></tr>
  <tr><td>Isle of Man, next day tracked</td><td>&pound;2.50</td><td>${f('delivery_iom')}</td></tr>
  <tr><td>United Kingdom, tracked</td><td>&pound;4.50</td><td>${f('delivery_uk')}</td></tr>
  <tr><td>Europe, standard</td><td>&pound;6.00</td><td>${f('delivery_intl')}</td></tr>
  <tr><td>Europe, tracked</td><td>&pound;12.50</td><td>${f('delivery_intl')}</td></tr>
</table></div>
<p>We do not deliver outside the Isle of Man, the United Kingdom and Europe at
present. Rates are confirmed in your basket before you pay, and those shown
there are the ones that apply.</p>
<p>Timescales are estimates from dispatch and are not guaranteed. If your order
has not arrived within 30 days of the contract being formed, you may cancel it
for a full refund.</p>
<p>Orders shipped outside the Isle of Man may attract import duty or tax on
arrival. That is payable by you and is not included in the price.</p>
<p>Risk in the goods passes to you on delivery, or when you collect them.</p>

<h2>5. Faulty or incorrect goods</h2>
<p>If something arrives damaged, faulty or not what you ordered, tell us within
a reasonable time and we will put it right &ndash; a replacement or a full
refund, including the delivery you paid and the cost of returning it. Your
statutory rights under consumer law are not affected by anything in these
terms.</p>

<h2>6. Changing your mind</h2>
<p>Separate from anything above, you may have the right to cancel an order
placed at a distance and send it back. That is set out in full on our
<a href="/returns">Returns and Cancellations</a> page, including the
circumstances where it does not apply.</p>

<h2>7. Products</h2>
<p>We describe our products as accurately as we can, but photographs are
illustrative and colours vary between screens. Sizes and volumes are nominal.</p>
<p>Please read the ingredients and directions before use. If you have known
sensitivities, patch test first. Our products are for external use only and
are not suitable for anyone with an allergy to any listed ingredient. Candles
should never be left unattended.</p>

<h2>8. Our liability</h2>
<p>We are responsible for loss you suffer that is a foreseeable result of us
breaking these terms or failing to use reasonable care. We are not responsible
for loss that was not foreseeable, or for business losses.</p>
<p>Nothing here excludes our liability for death or personal injury caused by
our negligence, for fraud, or for anything else that cannot lawfully be
excluded.</p>

<h2>9. Complaints</h2>
<p>Please email <a href="mailto:${BUSINESS.email}">${BUSINESS.email}</a> and we
will acknowledge within five working days and try to resolve matters with you
directly.</p>

<h2>10. Governing law</h2>
<p>These terms are governed by the law of the Isle of Man, and disputes may be
brought in the Isle of Man courts. If you are a consumer resident elsewhere,
this does not deprive you of the protection of mandatory consumer law in your
own country.</p>`);

/* ── returns ──────────────────────────────────────────────────────────────── */

export const RETURNS = page('Returns &amp; Cancellations',
  'Changing your mind, sending something back, and the one important exception.',
  `<div class="box">
  <p><strong>The short version.</strong> You have 14 days from receiving your
  order to tell us you want to cancel, and another 14 days to send it back.
  Sealed haircare that has been opened cannot be returned once unsealed, for
  hygiene reasons. Faulty items are always covered, whatever their state.</p>
</div>

<h2>Your right to cancel</h2>
<p>Because you bought without meeting us face to face, you may cancel your
order within <strong>14 days</strong> of the day you (or someone you nominate)
receive the goods. You do not need to give a reason.</p>
<p>To cancel, just tell us clearly &ndash; email
<a href="mailto:${BUSINESS.email}">${BUSINESS.email}</a> with your order
reference. A phone call or a letter is fine too. You can use the form at the
bottom of this page but you do not have to.</p>

<h2>The hygiene exception, which matters here</h2>
<p>Consumer law does not give a right to cancel for sealed goods that are not
suitable for return once unsealed, for health protection or hygiene reasons.
Most of what we sell falls into that category.</p>
<ul>
  <li><strong>Unopened, with the seal intact</strong> &ndash; returnable within the
  period above.</li>
  <li><strong>Opened or unsealed</strong> &ndash; not returnable, unless it is
  faulty or was not what you ordered.</li>
</ul>
<p>This is not us being awkward. We cannot resell a product once it has been
opened, and neither could anyone else.</p>

<h2>Sending it back</h2>
<p>Send returns to:</p>
<div class="box"><p>${f('returns_address')}</p></div>
<p>You have 14 days from telling us to get it back to us. Please include your
order reference so we can find you.</p>
<p><strong>Return postage is paid by you</strong> unless the item is faulty,
damaged or wrong, in which case we cover it. We recommend a tracked service
&ndash; until it reaches us the parcel is your responsibility, and we can only
refund what we actually receive.</p>
<p>You may handle goods as you would in a shop. If they are damaged or used
beyond that, we may reduce your refund to reflect the loss in value.</p>

<h2>Your refund</h2>
<p>We refund within <strong>14 days</strong> of receiving the goods back, or of
you proving you have sent them, whichever is sooner. It goes back to the same
card or method you paid with; we cannot refund to a different one.</p>
<p>We refund the price you paid plus our standard delivery charge. If you chose
a faster or more expensive delivery, we refund the standard rate rather than
the premium. We do not refund the cost of sending it back to us, except where
the item was faulty.</p>

<h2>Faulty, damaged or wrong items</h2>
<p>Tell us as soon as you can and send a photograph if you have one. We will
arrange a replacement or a full refund including all delivery costs both ways.
This applies whether or not the item is opened, and is separate from the
14-day cancellation right above.</p>

<h2>Collection orders</h2>
<p>If you collected in store, the same rights apply from the day you collected.
The easiest route is to bring it back to the shop.</p>

<h2>Model cancellation form</h2>
<p>You do not have to use this &ndash; an email saying you want to cancel is
enough &ndash; but it is here if you prefer it.</p>
<div class="box">
  <p>To ${f('legal_name')}, ${f('returns_address')},
  <a href="mailto:${BUSINESS.email}">${BUSINESS.email}</a>:</p>
  <p>I hereby give notice that I cancel my contract of sale of the following
  goods:</p>
  <p>Ordered on / received on: __________________<br>
  Order reference: __________________<br>
  Name: __________________<br>
  Address: __________________<br>
  Signature (only if sending on paper): __________________<br>
  Date: __________________</p>
</div>`);

/* ── privacy ──────────────────────────────────────────────────────────────── */

export const PRIVACY = page('Privacy Policy',
  'What we collect when you order, why, and what we do not do.',
  `<div class="box">
  <p><strong>The short version.</strong> We collect the details you give us at
  checkout to send you your order, and anything you choose to give us after
  that &ndash; a newsletter signup, a message, a review &ndash; is listed
  below. We never see your card details. This site sets no cookies and shows
  no advertising. Our own visitor counting runs on our server, cannot identify
  you, and is shared with nobody. We do not sell your data to anyone.</p>
</div>

${who}

<p>${f('legal_name')} is the data controller for the information described here.</p>

<h2>What we collect</h2>
<h3>When you place an order</h3>
<ul>
  <li>Your name, email address and telephone number</li>
  <li>Your delivery address and postcode, if you choose delivery</li>
  <li>What you ordered, the amount, and the order reference</li>
</ul>
<h3>When you use the wholesale enquiry form</h3>
<ul>
  <li>The name, business, email and message you type into it</li>
</ul>
<h3>What we never collect</h3>
<ul>
  <li><strong>Card details.</strong> Payment happens on Teya's own checkout
  page. Your card number never touches this website or our systems.</li>
  <li><strong>Advertising and profiling data.</strong> No advertising pixels,
  no profiling, no cookies, and nothing shared with ad networks.</li>
</ul>

<h3>The rest of what we hold</h3>
<ul>
  <li><strong>Newsletter.</strong> If you type your email into the footer, we
  store that email address and the date, and nothing else. Every email we send
  carries a one-click unsubscribe, and you can also email
  hello@drewrys.store and ask.</li>
  <li><strong>Messages.</strong> If you use the contact or wholesale form we
  keep your name, email and what you wrote, so we can answer you.</li>
  <li><strong>Reviews.</strong> If you leave one we store your rating, your
  comment and the name you give. If it is published, that name is shown.</li>
  <li><strong>Visitor counts.</strong> We count visits so we know whether the
  shop is working. To count you once rather than five times we make a short
  code from your IP address and browser, which changes every day and cannot be
  traced back to you or linked across days. We do not store your IP address, we
  do not know who you are, and there is no cookie involved.</li>
  <li><strong>Your bag.</strong> Kept in your own browser's storage on your
  device so it survives a refresh. It never reaches us until you check out, and
  clearing your browser data removes it.</li>
</ul>

<h2>Why we use it, and our lawful basis</h2>
<div class="tw"><table>
  <tr><th>Purpose</th><th>Lawful basis</th></tr>
  <tr><td>Taking payment and sending your order</td><td>Performance of our contract with you</td></tr>
  <tr><td>Emailing your confirmation and any updates</td><td>Performance of our contract with you</td></tr>
  <tr><td>Handling returns, refunds and complaints</td><td>Contract, and our legal obligations</td></tr>
  <tr><td>Keeping accounting and tax records</td><td>Legal obligation</td></tr>
  <tr><td>Sending you the newsletter</td><td>Your consent, withdrawable at any time</td></tr>
  <tr><td>Answering a message you send us</td><td>Our legitimate interest in replying to you</td></tr>
  <tr><td>Publishing a review you chose to leave</td><td>Your consent</td></tr>
  <tr><td>Counting visits to the shop</td><td>Our legitimate interest in knowing the site works, using data that cannot identify you</td></tr>
  <tr><td>Replying to a wholesale enquiry</td><td>Our legitimate interest in responding to you</td></tr>
  <tr><td>Marketing emails, if you sign up</td><td>Your consent, withdrawable at any time</td></tr>
</table></div>

<h2>Who else handles it</h2>
<p>We use a small number of service providers, each only for what is listed:</p>
<ul>
  <li><strong>Teya</strong> &ndash; takes the payment and tells us whether it
  succeeded.</li>
  <li><strong>Cloudflare</strong> &ndash; hosts the site and stores order
  records.</li>
  <li><strong>SendGrid (Twilio)</strong> &ndash; sends your confirmation email.</li>
  <li><strong>Our delivery carriers</strong> &ndash; receive the name and
  address needed to deliver your parcel.</li>
</ul>
<p>Some of these operate outside the Isle of Man. Where information is
transferred, it is protected by an adequacy decision or by standard
contractual clauses. We do not sell or rent your information, and we do not
share it for anyone else's marketing.</p>

<h2>How long we keep it</h2>
<ul>
  <li><strong>Order records</strong> &ndash; six years after the end of the
  relevant tax year, because tax and accounting law requires it.</li>
  <li><strong>Checkouts that were started but never paid</strong> &ndash;
  automatically deleted after 90 days.</li>
  <li><strong>Wholesale enquiries</strong> &ndash; up to two years, then deleted.</li>
  <li><strong>Marketing sign-ups</strong> &ndash; until you unsubscribe, and we
  delete the record straight away when you do.</li>
  <li><strong>Messages from the contact form</strong> &ndash; up to two years,
  then deleted.</li>
  <li><strong>Reviews</strong> &ndash; for as long as they are published. Ask
  and we will remove yours.</li>
  <li><strong>Visitor counts</strong> &ndash; the raw daily codes are deleted
  after seven days. What remains is a total per day with nothing in it that
  points at a person, kept for 13 months so we can compare one year to the
  next.</li>
</ul>

<h2>Your rights</h2>
<p>You can ask us to:</p>
<ul>
  <li>give you a copy of what we hold about you</li>
  <li>correct anything that is wrong</li>
  <li>delete it, where we are not required to keep it</li>
  <li>restrict or object to how we use it</li>
  <li>send it to you or another provider in a portable format</li>
  <li>stop sending you marketing, at any time</li>
</ul>
<p>Email <a href="mailto:${BUSINESS.email}">${BUSINESS.email}</a> and we will
respond within one month. There is no charge.</p>
<p>If you are unhappy with how we have handled your information you can
complain to the <strong>Isle of Man Information Commissioner</strong> at
<a href="https://www.inforights.im" rel="noopener">inforights.im</a>. If you
live in the UK you may instead contact the Information Commissioner's Office
at <a href="https://ico.org.uk" rel="noopener">ico.org.uk</a>.</p>

<h2>Security</h2>
<p>The site is served over HTTPS. Order records are held in access-controlled
storage, and the shop's admin area is protected by authentication. No system
is perfectly secure, but we keep what we hold to a minimum, which is the best
protection there is.</p>

<h2>Children</h2>
<p>This shop is not intended for children and we do not knowingly collect
information about anyone under 16.</p>

<h2>Changes</h2>
<p>If we change this policy we will update the date at the top. Material
changes affecting how we use information you have already given us will be
notified to you directly.</p>`);
