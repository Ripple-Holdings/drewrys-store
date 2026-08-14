/**
 * Drewrys — the 404.
 *
 * This file used to hold a set of standalone pages: a product page, /shop,
 * /about, /ingredients, /wholesale and /stockists. They are gone, deliberately.
 * The storefront is one page and its product card is the dialog; a second
 * design of the same card, on a second URL, was worse than having none.
 *
 * /shop/<slug> is now served by the Worker as the storefront itself with that
 * card opened, so there is one design, one destination, and one thing to
 * maintain — see renderSite() in index.js.
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

