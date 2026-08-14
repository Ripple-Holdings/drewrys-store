/**
 * Drewrys — content pages.
 *
 * Everything the storefront could not rank for, on its own crawlable URL:
 * /shop, /shop/<slug>, /about, /ingredients, /wholesale, /stockists.
 *
 * WHY THIS IS A SEPARATE SHELL FROM public/shell.html
 * ---------------------------------------------------
 * shell.html is 663 KB — one 327 KB <style> block, of which 266 KB is four
 * base64 woff2 fonts, plus 216 KB of inline JS including a full copy of GSAP.
 * That is a defensible trade for the homepage, which is an animated shopfront.
 * It is a terrible trade for a product page, whose job is to load fast and be
 * read. So these pages carry their own ~6 KB of CSS and no JavaScript at all.
 *
 * The type is a system stack rather than the brand faces for the same reason:
 * pulling 266 KB of base64 font to render 500 words of body copy would undo
 * the point of building these pages. If the brand faces are wanted here later,
 * serve them as external .woff2 files with a preload — not inlined.
 *
 * Every page here is server-rendered HTML. No client JS is required to read
 * any of it, which is the whole reason it exists: the homepage keeps its
 * catalogue in a JS object, so a crawler that does not execute scripts sees a
 * shop with no products and no prices.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gbp = (pence) => '£' + (Number(pence || 0) / 100).toFixed(2);

export const ORIGIN = 'https://drewrys.store';

/** Trading identity. Duplicated nowhere else on the public site until now — it
 *  lived only on /terms and /privacy, so the homepage carried no proof the
 *  business existed. */
export const BIZ = {
  legalName: 'DGG Limited',
  tradingName: 'Drewrys',
  company: '130898C',
  vat: 'GB004838290',
  street: 'Falcon House, 22 Ridgeway Street',
  town: 'Douglas',
  postcode: 'IM1 1EL',
  country: 'Isle of Man',
  phone: '+44 7624 373979',
  phoneDisplay: '07624 373979',
  email: 'hello@drewrys.store',
};

/**
 * Tokens copied verbatim from public/shell.html rather than eyeballed, so
 * these pages cannot drift from the storefront:
 *   --cotton  #F3EDE1  the page background
 *   --ink     #191C21  body text
 *   --slate   #2B3037  button fill
 *   --peanut  #C79A6B / --peanut-deep #9A6C3E  accents
 *
 * Type matches the shop too: NeueMontreal for display (shell.html calls it
 * .disp — uppercase, 500, tight leading), Geist for body. Both come from
 * /fonts.css, which is already deployed and is now cached for a year.
 */
const CSS = `
:root{--cotton:#F3EDE1;--cotton-2:#ECE3D3;--cream:#E7DABF;--ink:#191C21;
  --slate:#2B3037;--slate-2:#20242A;--olive:#94876d;--peanut:#C79A6B;
  --peanut-deep:#9A6C3E;--line:rgba(25,28,33,.16);--muted:rgba(25,28,33,.55)}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--cotton);color:var(--ink);
  font:17px/1.65 "Geist",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased}
h1,h2,h3,.disp{font-family:"NeueMontreal","Geist",system-ui,sans-serif;
  font-weight:500;letter-spacing:-.014em}
a{color:var(--peanut-deep)}
a:focus-visible,button:focus-visible{outline:2px solid var(--peanut-deep);outline-offset:2px}
img{max-width:100%;height:auto;display:block}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}

header.site{border-bottom:1px solid var(--line);background:var(--cotton);
  position:sticky;top:0;z-index:20}
header.site .wrap{display:flex;align-items:center;gap:22px;
  min-height:64px;flex-wrap:wrap}
.brand{font-weight:700;letter-spacing:.02em;text-decoration:none;color:var(--ink);font-size:19px}
header.site nav{display:flex;gap:18px;flex-wrap:wrap;margin-left:auto}
header.site nav a{text-decoration:none;color:var(--slate);font-size:15px}
header.site nav a:hover{color:var(--peanut-deep)}

.pg{padding:52px 0 16px}
.pg--narrow{max-width:68ch;margin:0 auto}
.pg-eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--peanut-deep);font-weight:700;margin:0 0 10px}
h1{font-size:clamp(30px,5vw,44px);line-height:1.12;margin:0 0 16px;
  text-wrap:balance;letter-spacing:-.01em}
h2{font-size:clamp(21px,3vw,27px);line-height:1.25;margin:2em 0 .5em;text-wrap:balance}
h3{font-size:19px;margin:1.6em 0 .4em}
.lede{font-size:19px;color:var(--slate)}
.pg-cta{display:flex;gap:12px;flex-wrap:wrap;margin:26px 0}
/* Same button as the storefront: shell.html's .btn is slate on cotton, 700,
   .82rem, .02em tracking, 40px radius. Copied, not approximated. */
.btn{display:inline-flex;align-items:center;gap:8px;background:var(--slate);
  color:var(--cotton);text-decoration:none;font-weight:700;font-size:.82rem;
  letter-spacing:.02em;padding:11px 20px;border-radius:40px;
  transition:transform .18s ease,background .18s ease}
.btn:hover{background:var(--slate-2);transform:translateY(-1px)}
.btn--ghost{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.btn--ghost:hover{background:rgba(25,28,33,.06)}
.btn[aria-disabled="true"]{background:var(--olive);pointer-events:none}

.grid{display:grid;gap:26px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));
  margin:30px 0 60px;padding:0;list-style:none}
.card{background:#fff;border:1px solid var(--line);border-radius:3px;overflow:hidden;
  display:flex;flex-direction:column}
.card a.shot{display:block;aspect-ratio:1/1;background:var(--cream)}
.card a.shot img{width:100%;height:100%;object-fit:cover}
.card .body{padding:16px 16px 20px;display:flex;flex-direction:column;gap:6px;flex:1}
.card h2{font-size:18px;margin:0}
.card h2 a{text-decoration:none;color:var(--ink)}
.card .size{font-size:13px;color:var(--olive);letter-spacing:.06em;text-transform:uppercase}
.card .tag{font-size:15px;color:var(--slate);margin:2px 0 0}
.card .foot{margin-top:auto;padding-top:12px;display:flex;align-items:baseline;
  justify-content:space-between;gap:10px}
.card .price{font-size:18px;font-weight:600}
.card .stock{font-size:13px;color:var(--olive)}
.card .stock.out{color:var(--peanut-deep)}

/* ── product card, as a page ──────────────────────────────────────────────
   These rules are lifted from shell.html's .md-* modal, not reinvented. The
   product page IS the card the shop already opens — same cotton-2 panel, same
   2:1 photo well, same NeueMontreal title, same tabs, same full-width dark
   button — just laid out as a page instead of an overlay. Only the parts a
   modal needs and a page does not (backdrop, close button, sticky footer
   gradient) are dropped. */
.card-pg{width:min(560px,100%);margin:clamp(20px,4vw,44px) auto 0;
  background:var(--cotton-2);border:1px solid var(--line);border-radius:24px;
  box-shadow:0 40px 90px -24px rgba(25,28,33,.28);overflow:hidden}
.card-pg .media{position:relative;aspect-ratio:2/1;background:#f5f2f3;
  display:grid;place-items:center;padding:6%;border-bottom:1px solid var(--line)}
.card-pg .media img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}
.card-pg .tag{position:absolute;top:16px;left:16px;font-size:.6rem;font-weight:700;
  letter-spacing:.1em;text-transform:uppercase;padding:5px 10px;border-radius:20px;
  background:var(--slate);color:var(--cotton)}
.card-pg .body{padding:clamp(18px,2.6vw,28px)}
.card-pg h1{font-family:"NeueMontreal","Geist",system-ui,sans-serif;font-weight:500;
  letter-spacing:-.01em;text-transform:uppercase;font-size:clamp(1.4rem,3vw,2rem);
  line-height:1;color:var(--ink);margin:0}
.card-pg .sub{font-weight:600;color:var(--peanut-deep);margin:8px 0 0;font-size:.9rem}
.card-pg .desc{color:rgba(25,28,33,.82);margin-top:14px;line-height:1.6;font-size:.98rem}
.card-pg h2{font-size:.78rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink);margin:22px 0 10px}
.ings{display:flex;flex-wrap:wrap;gap:10px 12px;margin:14px 0 0;padding:0;list-style:none}
.ings li{width:58px}
.ings a{display:flex;flex-direction:column;align-items:center;gap:6px;text-decoration:none}
.ing-chip{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;
  background:rgba(199,154,107,.14);border:1.5px solid transparent;transition:.15s}
.ings a:hover .ing-chip{background:rgba(199,154,107,.18);border-color:var(--peanut-deep)}
.ing-chip img{width:26px;height:26px}
.ing-name{font-size:.68rem;text-align:center;color:var(--muted);line-height:1.15}
.ings a:hover .ing-name{color:var(--ink)}
.panel{margin:12px 0 4px;padding:14px 16px;background:rgba(25,28,33,.035);border-radius:14px}
.panel ul{list-style:none;display:flex;flex-wrap:wrap;gap:4px 14px;margin:0;padding:0}
.panel li{font-size:.78rem;color:var(--ink);position:relative;padding-left:12px}
.panel li::before{content:"";position:absolute;left:0;top:.5em;width:5px;height:5px;
  border-radius:50%;background:var(--peanut)}
.steps{list-style:none;margin:0;padding:0}
.steps li{font-size:.95rem;line-height:1.62;color:rgba(25,28,33,.82);margin:.5em 0}
.buy{display:flex;box-sizing:border-box;width:100%;justify-content:center;align-items:center;
  margin:26px 0 0;border-radius:12px;padding:15px;background:var(--slate);color:var(--cotton);
  font-weight:700;font-size:.82rem;letter-spacing:.02em;text-decoration:none;border:0;
  cursor:pointer;font-family:inherit;
  box-shadow:0 10px 26px -12px rgba(25,28,33,.6);transition:.18s}
.buy:hover{background:var(--slate-2)}
.buy[disabled],.buy[aria-disabled="true"]{background:var(--olive);box-shadow:none;
  pointer-events:none}
.spec{display:grid;grid-template-columns:auto 1fr;gap:6px 18px;margin:20px 0 0;font-size:.85rem}
.spec dt{color:var(--muted)}
.spec dd{margin:0;color:var(--ink)}
.backlink{display:inline-block;margin:0 0 4px;font-size:.72rem;letter-spacing:.1em;
  text-transform:uppercase;color:var(--peanut-deep);text-decoration:none;font-weight:700}
.also{width:min(560px,100%);margin:clamp(34px,6vw,64px) auto 0}
.also h2{font-family:"NeueMontreal","Geist",system-ui,sans-serif;font-weight:500;
  text-transform:uppercase;letter-spacing:-.01em;font-size:1.05rem;margin:0 0 14px}

.ing{display:grid;gap:22px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));
  margin:26px 0 50px;padding:0;list-style:none}
.ing li{background:#fff;border:1px solid var(--line);border-radius:3px;padding:18px}
.ing h2{font-size:18px;margin:0 0 6px}
.ing p{margin:.4em 0 0;font-size:15.5px;color:var(--slate)}
.ing ul{margin:.5em 0 0;padding-left:18px;font-size:14.5px;color:var(--olive)}

table.rates{border-collapse:collapse;width:100%;font-size:15.5px;margin:16px 0}
table.rates th,table.rates td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line)}
table.rates th{font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--olive)}

footer.site{border-top:1px solid var(--line);margin-top:60px;padding:38px 0 46px;
  font-size:15px;color:var(--slate)}
footer.site .cols{display:grid;gap:28px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}
footer.site h2{font-size:12.5px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--olive);margin:0 0 10px}
footer.site ul{list-style:none;margin:0;padding:0}
footer.site li{margin:.3em 0}
footer.site a{color:var(--slate);text-decoration:none}
footer.site a:hover{color:var(--peanut-deep)}
footer.site address{font-style:normal;line-height:1.7}
.legal{margin-top:26px;padding-top:18px;border-top:1px solid var(--line);
  font-size:13.5px;color:var(--olive);display:flex;gap:16px;flex-wrap:wrap}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

/** Site header. Real anchors — the homepage nav is all `#` fragments, which
 *  is why the site had no internal link graph at all. */
function header() {
  return `<header class="site"><div class="wrap">
    <a class="brand" href="/">drewrys.</a>
    <nav aria-label="Primary">
      <a href="/shop">Shop</a>
      <a href="/ingredients">Ingredients</a>
      <a href="/about">Our story</a>
      <a href="/wholesale">Wholesale</a>
      <a href="/stockists">Find us</a>
    </nav>
  </div></header>`;
}

/** Footer carrying the trading identity, NAP and contact links. */
function footer() {
  return `<footer class="site"><div class="wrap">
    <div class="cols">
      <div>
        <h2>Shop</h2>
        <ul>
          <li><a href="/shop">The range</a></li>
          <li><a href="/ingredients">Ingredients</a></li>
          <li><a href="/wholesale">Trade &amp; wholesale</a></li>
          <li><a href="/stockists">Where to buy</a></li>
        </ul>
      </div>
      <div>
        <h2>Company</h2>
        <ul>
          <li><a href="/about">Our story</a></li>
          <li><a href="https://drewrys.im/">The barbershop</a></li>
          <li><a href="/terms">Terms</a></li>
          <li><a href="/returns">Returns</a></li>
          <li><a href="/privacy">Privacy</a></li>
        </ul>
      </div>
      <div>
        <h2>Visit</h2>
        <address>
          ${esc(BIZ.tradingName)}<br>
          ${esc(BIZ.street)}<br>
          ${esc(BIZ.town)}<br>
          ${esc(BIZ.country)} ${esc(BIZ.postcode)}
        </address>
      </div>
      <div>
        <h2>Contact</h2>
        <ul>
          <li><a href="tel:${esc(BIZ.phone.replace(/\s/g, ''))}">${esc(BIZ.phoneDisplay)}</a></li>
          <li><a href="mailto:${esc(BIZ.email)}">${esc(BIZ.email)}</a></li>
          <li><a href="https://www.instagram.com/drewrys_haircare/" rel="me">Instagram</a></li>
          <li><a href="https://www.facebook.com/drewrys" rel="me">Facebook</a></li>
        </ul>
      </div>
    </div>
    <p class="legal">
      <span>&copy; ${new Date().getUTCFullYear()} ${esc(BIZ.legalName)}, trading as ${esc(BIZ.tradingName)}.</span>
      <span>Company ${esc(BIZ.company)} (Isle of Man).</span>
      <span>VAT ${esc(BIZ.vat)}.</span>
    </p>
  </div></footer>`;
}

/**
 * The page shell. Small, complete, and server-rendered.
 *
 * `jsonld` takes an already-stringified graph so callers can build it from
 * live catalogue data without this module needing to know the shape.
 */
export function shellPage({ title, description, path, body, noindex = false, jsonld = '', ogImage = '' }) {
  const canonical = ORIGIN + (path === '/' ? '/' : path);
  const img = ogImage || `${ORIGIN}/img/share.jpg`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex,follow">' : ''}
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" type="image/png" href="/img/favicon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Drewrys">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(img)}">
<meta name="theme-color" content="#F3EDE1">
<link rel="stylesheet" href="/fonts.css">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ''}
</head>
<body>
${header()}
<main class="wrap" id="main">
${body}
</main>
${footer()}
</body>
</html>`;
}

/* ── 404 ─────────────────────────────────────────────────────────────────── */

/**
 * Deliberately not built on shellPage(): no nav, no footer, no body copy.
 *
 * A 404 is noindex, so it earns nothing in search however much is on it. Its
 * only job is to stop a person leaving. Everything that does not serve that
 * is noise, and the previous version — an email address, two buttons, a full
 * nav and a four-column footer — was mostly noise.
 *
 * The D mark, the number, one button.
 */
export function notFoundPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found · Drewrys</title>
<meta name="robots" content="noindex,follow">
<link rel="icon" type="image/png" href="/img/favicon.png">
<link rel="stylesheet" href="/fonts.css">
<meta name="theme-color" content="#F3EDE1">
<style>
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:#F3EDE1;color:#191C21;
  font:17px/1.55 "Geist",system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:32px;gap:clamp(20px,4vh,40px)}
.mark{width:clamp(84px,11vw,124px);height:auto;display:block}
.code{font-family:"NeueMontreal","Geist",system-ui,sans-serif;font-weight:500;
  font-size:clamp(6rem,26vw,17rem);line-height:.82;letter-spacing:-.03em;
  text-transform:uppercase;margin:0;color:#191C21}
.home{display:inline-flex;align-items:center;gap:8px;background:#2B3037;
  color:#F3EDE1;text-decoration:none;font-weight:700;font-size:.82rem;
  letter-spacing:.02em;padding:11px 20px;border-radius:40px;
  transition:transform .18s ease,background .18s ease}
.home:hover{background:#20242A;transform:translateY(-1px)}
.home:focus-visible{outline:2px solid #9A6C3E;outline-offset:3px}
@media(prefers-reduced-motion:reduce){.home{transition:none}}
</style>
</head>
<body>
<img class="mark" src="/img/logo-d.png" alt="Drewrys" width="440" height="440">
<p class="code">404</p>
<a class="home" href="/">Home</a>
</body>
</html>`;
}

/* ── /shop ───────────────────────────────────────────────────────────────── */

function stockLine(n) {
  if (n === null || n === undefined) return '';
  if (n <= 0) return '<span class="stock out">Sold out</span>';
  if (n <= 5) return `<span class="stock">Only ${n} left</span>`;
  return '<span class="stock">In stock</span>';
}

export function shopPage({ products, stock, jsonld }) {
  const cards = products.map((p) => {
    const n = stock[p.slug];
    return `<li class="card">
      <a class="shot" href="/shop/${esc(p.slug)}">
        <img src="${esc(p.image || '/img/share.jpg')}" alt="${esc(p.name)}, ${esc(p.size || '')}"
             width="600" height="600" loading="lazy" decoding="async">
      </a>
      <div class="body">
        <h2><a href="/shop/${esc(p.slug)}">${esc(p.name)}</a></h2>
        <p class="size">${esc(p.size || '')}</p>
        <p class="tag">${esc(p.tagline || '')}</p>
        <div class="foot">
          <span class="price">${gbp(p.price_pence)}</span>
          ${stockLine(n)}
        </div>
      </div>
    </li>`;
  }).join('\n');

  return shellPage({
    title: 'Shop all hair products — clay, paste, fibre & sea salt spray | Drewrys',
    description:
      'The full Drewrys range: matte clay, hair paste, fibre, sea salt spray, '
      + 'curl cream and shampoo. Made in the UK by a working barber, with organic '
      + 'botanical oils. Free UK delivery over £40.',
    path: '/shop',
    jsonld,
    body: `<section class="pg">
      <p class="pg-eyebrow">The range</p>
      <h1>Hair products made by a barber, not a boardroom</h1>
      <p class="lede">Seven products, built on the floor of a working Isle of Man
        barbershop and made in the UK with organic, sustainably sourced botanical
        oils. Every one of them is here.</p>
    </section>
    <ul class="grid">${cards}</ul>`,
  });
}

/* ── /shop/<slug> ────────────────────────────────────────────────────────── */

export function productPage({ product: p, stock: n, ingredients, related, jsonld }) {
  /* Ingredient chips, exactly as the modal draws them: icon in a peanut
     circle, name underneath. Here each one is a real link through to the
     ingredient library rather than a JS panel toggle. */
  const ingChips = (p.ingredients || []).map((name) => {
    const known = ingredients.find((i) => i.name === name);
    const slug = known ? known.slug : name.toLowerCase().replace(/\s+/g, '-');
    const icon = known && known.icon ? known.icon : '';
    return `<li><a href="/ingredients#${esc(slug)}">
      <span class="ing-chip">${icon
        ? `<img src="${esc(icon)}" alt="" width="26" height="26" loading="lazy">` : ''}</span>
      <span class="ing-name">${esc(name)}</span>
    </a></li>`;
  }).join('');

  const steps = (p.howto || []).map((s) => `<li>${esc(s)}</li>`).join('');
  const sold = n !== null && n !== undefined && n <= 0;

  /* "Pairs well with", drawn as the same card so the page reads as one piece. */
  const alsoCards = related.map((r) => `<li class="card">
      <a class="shot" href="/shop/${esc(r.slug)}">
        <img src="${esc(r.image || '/img/share.jpg')}" alt="${esc(r.name)}"
             width="600" height="600" loading="lazy" decoding="async">
      </a>
      <div class="body">
        <h2><a href="/shop/${esc(r.slug)}">${esc(r.name)}</a></h2>
        <p class="tag">${esc(r.tagline || '')}</p>
        <div class="foot"><span class="price">${gbp(r.price_pence)}</span></div>
      </div>
    </li>`).join('');

  return shellPage({
    title: `${p.name}${p.size ? ', ' + p.size : ''} — ${p.tagline || 'Drewrys'} | Drewrys`,
    description: (p.description || p.tagline || '').slice(0, 155),
    path: `/shop/${p.slug}`,
    ogImage: p.image ? ORIGIN + p.image : '',
    jsonld,
    body: `<article class="card-pg">
      <div class="media">
        ${sold ? '<span class="tag">Sold out</span>'
               : (p.badge ? `<span class="tag">${esc(p.badge)}</span>` : '')}
        <img src="${esc(p.image || '/img/share.jpg')}" alt="${esc(p.name)}, ${esc(p.size || '')}"
             width="900" height="900" fetchpriority="high" decoding="async">
      </div>
      <div class="body">
        <a class="backlink" href="/shop">← The range</a>
        <h1>${esc(p.name)}</h1>
        <p class="sub">${gbp(p.price_pence)} &middot; ${esc((p.size || '').toUpperCase())}</p>
        <p class="desc">${esc(p.description || p.tagline || '')}</p>

        ${ingChips ? `<h2>Ingredients</h2>
        <ul class="ings">${ingChips}</ul>` : ''}

        ${steps ? `<h2>How to use</h2>
        <div class="panel"><ul class="steps">${steps}</ul></div>` : ''}

        <dl class="spec">
          <dt>Size</dt><dd>${esc(p.size || '—')}</dd>
          <dt>Made in</dt><dd>United Kingdom</dd>
          <dt>Delivery</dt><dd>Free collection in Douglas · Isle of Man £2.50 ·
            UK &amp; Channel Islands £4.50 · free over £40</dd>
          <dt>Returns</dt><dd><a href="/returns">14 days</a>, unopened</dd>
        </dl>

        ${sold
          ? '<span class="buy" aria-disabled="true">Sold out</span>'
          : '<a class="buy" href="/#shop">Add to bag</a>'}
      </div>
    </article>

    ${alsoCards ? `<section class="also">
      <h2>Pairs well with</h2>
      <ul class="grid">${alsoCards}</ul>
    </section>` : ''}`,
  });
}

/* ── /ingredients ────────────────────────────────────────────────────────── */

export function ingredientsPage({ ingredients, jsonld }) {
  const items = ingredients
    .filter((i) => i.text)          // the two blank entries stay off the page
    .map((i) => `<li id="${esc(i.slug)}">
      <h2>${esc(i.name)}</h2>
      ${(i.bullets || []).length
        ? `<ul>${i.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      <p>${esc(i.text)}</p>
    </li>`).join('\n');

  return shellPage({
    title: 'Ingredients — the oils and botanicals in Drewrys haircare | Drewrys',
    description:
      'Marula, baobab, prickly pear, kalahari melon and shea butter — what each '
      + 'ingredient does for your hair, and where we source it from. Organic, '
      + 'sustainably sourced, cruelty free.',
    path: '/ingredients',
    jsonld,
    body: `<section class="pg">
      <p class="pg-eyebrow">Ingredients</p>
      <h1>Ingredients your hair will thank you for</h1>
      <p class="lede">Every product is built on organic, sustainably sourced
        botanical oils. Several come from cooperatives that put money back into
        the communities that harvest them. Here is what each one does, and why
        it is in the jar.</p>
    </section>
    <ul class="ing">${items}</ul>`,
  });
}

/* ── /about ──────────────────────────────────────────────────────────────── */

export function aboutPage({ jsonld }) {
  return shellPage({
    title: 'Our story — barber-made haircare from the Isle of Man | Drewrys',
    description:
      'Drewrys is made by Ben Drewry, a barber with 15 years on the floor. '
      + 'Built in the Isle of Man, made in the UK, cruelty free, and tested '
      + 'on paying clients every day.',
    path: '/about',
    jsonld,
    body: `<section class="pg pg--narrow">
      <p class="pg-eyebrow">Our story</p>
      <h1>Built, not bought.</h1>
      <p class="lede">Drewrys is the haircare range of Ben Drewry, a barber with
        fifteen years on the floor and a shop in Douglas, Isle of Man.</p>

      <p>With fifteen years in the barbering industry, we have tried every product
        under the sun. We grew frustrated watching brands we loved sacrifice
        quality for high-street volume, so we built our own range focused
        entirely on consistency and performance.</p>

      <p>Through rigorous testing, we developed a line to our exact
        specifications. Infused with vitamins, natural oils and subtle, signature
        scents, these products offer far more than standard styling. Everything is
        proudly made in the UK, cruelty free, and crafted simply to be the best of
        the best, day in and day out.</p>

      <h2>Tested where it counts</h2>
      <p>Every product in the range is used in the chair before it is sold in a
        jar. That is the part a lab cannot replicate: if a clay goes tacky by
        mid-afternoon, or a spray leaves hair like straw, we find out the same
        week from the person sitting in front of us.</p>

      <h2>Where the ingredients come from</h2>
      <p>The oils are organic and sustainably sourced, and several come from
        cooperatives that fund the communities harvesting them — shea butter
        sorted and shelled by a women's cooperative in Ghana supporting over 1,400
        people, prickly pear from a women's cooperative in South Morocco that
        guarantees income and funds education, baobab from the Widows and Orphans
        Movement in Ghana. <a href="/ingredients">The full ingredient library is
        here.</a></p>

      <h2>Find us</h2>
      <p>The shop is at ${esc(BIZ.street)}, ${esc(BIZ.town)},
        ${esc(BIZ.country)} ${esc(BIZ.postcode)}. You can
        <a href="/stockists">collect an order for free</a>, or
        <a href="tel:${esc(BIZ.phone.replace(/\s/g, ''))}">call ${esc(BIZ.phoneDisplay)}</a>.</p>

      <p>For a cut rather than a jar, the barbershop is
        <a href="https://drewrys.im/">Drewry's in Douglas</a> — same people, and
        where every one of these products was tested before it went on sale.</p>

      <p class="pg-cta"><a class="btn" href="/shop">Shop the range</a>
        <a class="btn btn--ghost" href="/wholesale">Stock Drewrys</a></p>
    </section>`,
  });
}

/* ── /wholesale ──────────────────────────────────────────────────────────── */

export function wholesalePage({ jsonld }) {
  return shellPage({
    title: 'Wholesale & trade accounts — stock Drewrys in your salon | Drewrys',
    description:
      'Trade pricing on the full Drewrys range for barbershops, salons and '
      + 'retailers across the Isle of Man and the UK. Low minimum order, free '
      + 'wholesale delivery, counter display and product training included.',
    path: '/wholesale',
    jsonld,
    body: `<section class="pg pg--narrow">
      <p class="pg-eyebrow">Trade</p>
      <h1>Stock Drewrys in your salon</h1>
      <p class="lede">Made in the UK and used on the floor every day. We supply
        salons, barbershops and retailers across the Island and the UK.</p>

      <h2>What a trade account gets you</h2>
      <ul class="steps">
        <li>Trade pricing on the full range</li>
        <li>Low minimum order to get started</li>
        <li>Free delivery on Isle of Man and UK wholesale orders</li>
        <li>Counter display and product training included</li>
      </ul>

      <h2>Why barbers stock it</h2>
      <p>It is built by a working barber, so it behaves the way you expect on the
        floor: the clay reworks through the day, the spray does not go crunchy,
        and nothing leaves residue you have to wash twice. Your clients ask what
        you used, and you have it on the counter.</p>

      <p>The range is made in the UK, cruelty free, and free from SLS, sulfates,
        parabens, palm oil and mineral oil — which increasingly is the first
        question a client asks.</p>

      <h2>Get trade pricing</h2>
      <p>Tell us your shop, roughly how much you would take to start, and where
        you are. We come back within two working days with a price list.</p>
      <p class="pg-cta">
        <a class="btn" href="/#wholesale">Request trade pricing</a>
        <a class="btn btn--ghost" href="mailto:${esc(BIZ.email)}?subject=Wholesale%20enquiry">Email us</a>
      </p>
      <p class="note">Prefer to talk it through? Call
        <a href="tel:${esc(BIZ.phone.replace(/\s/g, ''))}">${esc(BIZ.phoneDisplay)}</a>
        or email <a href="mailto:${esc(BIZ.email)}">${esc(BIZ.email)}</a>.</p>
    </section>`,
  });
}

/* ── /stockists ──────────────────────────────────────────────────────────── */

export function stockistsPage({ jsonld }) {
  return shellPage({
    title: `Where to buy Drewrys — ${BIZ.town}, ${BIZ.country} | Drewrys`,
    description:
      `Buy Drewrys haircare online with UK delivery, or collect free from our shop at `
      + `${BIZ.street}, ${BIZ.town}, ${BIZ.country}. Open to trade stockists too.`,
    path: '/stockists',
    jsonld,
    body: `<section class="pg pg--narrow">
      <p class="pg-eyebrow">Find us</p>
      <h1>Where to buy Drewrys</h1>
      <p class="lede">Order online for UK delivery, or collect for free from the
        shop in central Douglas.</p>

      <h2>Collect in Douglas — free</h2>
      <address style="font-style:normal;line-height:1.8">
        <strong>${esc(BIZ.tradingName)}</strong><br>
        ${esc(BIZ.street)}<br>
        ${esc(BIZ.town)}<br>
        ${esc(BIZ.country)} ${esc(BIZ.postcode)}<br>
        <a href="tel:${esc(BIZ.phone.replace(/\s/g, ''))}">${esc(BIZ.phoneDisplay)}</a> ·
        <a href="mailto:${esc(BIZ.email)}">${esc(BIZ.email)}</a>
      </address>
      <p>Choose <strong>Collect in store</strong> at checkout and there is no
        delivery charge. We will email you when it is ready to pick up.</p>

      <h2>Delivery</h2>
      <table class="rates">
        <tr><th>Where</th><th>Cost</th><th>Time</th></tr>
        <tr><td>Collect from the shop</td><td>Free</td><td>1–2 working days</td></tr>
        <tr><td>Isle of Man, tracked</td><td>£2.50</td><td>1–2 working days</td></tr>
        <tr><td>United Kingdom, tracked</td><td>£4.50</td><td>3–5 working days</td></tr>
        <tr><td>Guernsey and Jersey, tracked</td><td>£4.50</td><td>3–5 working days</td></tr>
      </table>
      <p class="note"><strong>Free delivery on orders over £40.</strong> Two
        products usually clears it.</p>

      <h2>Stock it in your shop</h2>
      <p>We supply barbershops, salons and retailers across the Island and the UK.
        <a href="/wholesale">Trade pricing is here.</a></p>
    </section>`,
  });
}
