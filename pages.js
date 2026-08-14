/**
 * Drewrys — content pages.
 *
 * One job: a real, server-rendered page for each product at /shop/<slug>,
 * plus the 404.
 *
 * These are NOT site navigation. Nothing on the storefront links to them as
 * pages - the footer stays on the homepage and "Learn more" opens the modal.
 * They exist because Googlebot never clicks anything: it requests
 * /shop/matte-clay from the server and indexes whatever comes back. Without
 * a page at that address the URL 404s, and a product with no URL cannot earn
 * a product rich result or a free Shopping listing.
 *
 * WHY THIS IS A SEPARATE SHELL FROM public/shell.html
 * ---------------------------------------------------
 * shell.html is 663 KB — one 327 KB <style> block, of which 266 KB is four
 * base64 woff2 fonts, plus 216 KB of inline JS including a full copy of GSAP.
 * That is a defensible trade for the homepage, which is an animated shopfront.
 * It is a terrible trade for a product page, whose job is to load fast and be
 * read. So these pages carry their own ~6 KB of CSS and no JavaScript at all.
 *
 * Type comes from /fonts.css - the real NeueMontreal and Geist - which is
 * already deployed and cached, so these pages match the shop.
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
/* The page presents as the dialog does: dark ground, the card floated on it,
   scrolling inside itself rather than the page scrolling behind. Values are
   shell.html's — .md-backdrop's rgba(20,23,27,.55) over --ink for the ground,
   .md-dialog's min(500px,94vw) / 90vh / 24px radius for the card. */
body.pdp{background:#141719;display:flex;align-items:center;justify-content:center;
  min-height:100vh;min-height:100svh;padding:20px}
body.pdp::before{content:"";position:fixed;inset:0;
  background:radial-gradient(120% 90% at 50% 0%,rgba(199,154,107,.16),transparent 60%),
             rgba(20,23,27,.55);pointer-events:none}
.card-pg{position:relative;width:min(500px,94vw);max-height:90vh;overflow:auto;
  background:var(--cotton-2);border:1px solid var(--line);border-radius:24px;
  box-shadow:0 40px 90px -24px rgba(25,28,33,.55);
  scrollbar-width:none;-ms-overflow-style:none}
.card-pg::-webkit-scrollbar{display:none}
/* Sticky so it stays put while the card scrolls, exactly as in the dialog.
   The negative bottom margin keeps it out of the flow so it does not push
   the photo down. */
.card-pg .x{position:sticky;top:6px;z-index:6;display:grid;place-items:center;
  margin:0 8px -50px auto;width:44px;height:44px;background:transparent;border:0;
  color:var(--slate);font-size:30px;line-height:1;text-decoration:none;opacity:.6;
  transition:opacity .18s}
.card-pg .x:hover{opacity:1}
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
.also-links{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0;padding:0;list-style:none}
.also-links a{display:inline-block;font-size:.78rem;font-weight:600;letter-spacing:.03em;
  text-transform:uppercase;text-decoration:none;color:var(--slate-2);background:var(--peanut);
  padding:9px 15px;border-radius:30px;transition:.18s}
.also-links a:hover{background:var(--peanut-deep);color:var(--cotton)}

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
      <a href="/#shop">Shop</a>
      <a href="/#ingredients">Ingredients</a>
      <a href="/#story">Story</a>
      <a href="/#wholesale">Wholesale</a>
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
          <li><a href="/#shop">The range</a></li>
          <li><a href="/#ingredients">Ingredients</a></li>
          <li><a href="/#wholesale">Trade &amp; wholesale</a></li>
        </ul>
      </div>
      <div>
        <h2>Company</h2>
        <ul>
          <li><a href="/#story">Our story</a></li>
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
export function shellPage({ title, description, path, body, noindex = false, jsonld = '',
                           ogImage = '', bare = false }) {
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
<meta name="theme-color" content="${bare ? '#141719' : '#F3EDE1'}">
<link rel="stylesheet" href="/fonts.css">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ''}
</head>
${bare
  /* Product pages present as the dialog does: the card alone on a dark
     ground, no chrome around it. The × is the way out. */
  ? `<body class="pdp">
${body}
</body>`
  : `<body>
${header()}
<main class="wrap" id="main">
${body}
</main>
${footer()}
</body>`}
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

  /* "Pairs well with" — the same three the shop offers, as plain links so the
     card stays a card. Each product page linking to three others also gives
     the seven pages a link graph between themselves. */
  const alsoLinks = related.map((r) =>
    `<li><a href="/shop/${esc(r.slug)}">${esc(r.name)}</a></li>`).join('');

  /* The × goes back to this product's own tile on the shop grid, not just the
     top of the section — #p-<slug> is on every card, server-rendered and
     client-rendered alike. */
  const backToTile = `/#p-${esc(p.slug)}`;

  return shellPage({
    title: `${p.name}${p.size ? ', ' + p.size : ''} — ${p.tagline || 'Drewrys'} | Drewrys`,
    description: (p.description || p.tagline || '').slice(0, 155),
    path: `/shop/${p.slug}`,
    ogImage: p.image ? ORIGIN + p.image : '',
    bare: true,
    jsonld,
    body: `<article class="card-pg">
      <a class="x" href="${backToTile}" aria-label="Close">&times;</a>
      <div class="media">
        ${sold ? '<span class="tag">Sold out</span>'
               : (p.badge ? `<span class="tag">${esc(p.badge)}</span>` : '')}
        <img src="${esc(p.image || '/img/share.jpg')}" alt="${esc(p.name)}, ${esc(p.size || '')}"
             width="900" height="900" fetchpriority="high" decoding="async">
      </div>
      <div class="body">
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

        ${alsoLinks ? `<h2>Pairs well with</h2>
        <ul class="also-links">${alsoLinks}</ul>` : ''}

        ${sold
          ? '<span class="buy" aria-disabled="true">Sold out</span>'
          : `<a class="buy" href="/?add=${esc(p.slug)}#p-${esc(p.slug)}">Add to bag</a>`}
      </div>
    </article>`,
  });
}

