/**
 * Drewrys — storefront Worker.
 *
 *   /                    the site: shell.html from ASSETS with the live
 *                        catalogue injected before </head>
 *   /api/catalogue       same data as JSON
 *   /create-session      POST, starts a Teya hosted checkout
 *   /webhook             POST, Teya payment result
 *   /admin               PIN-gated portal: Catalogue · Stock · Orders
 *   everything else      static asset
 *
 * The page is public/shell.html on purpose — see the note in wrangler.toml.
 */

import {
  createSession, verifySignature, getCatalogue, getSettings, getStock,
  DEFAULT_SETTINGS,
} from './teya.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gbp = (pence) => '£' + (Number(pence || 0) / 100).toFixed(2);
const json = (d, status = 200) => new Response(JSON.stringify(d), {
  status, headers: { 'Content-Type': 'application/json' },
});
const html = (markup, status = 200) => new Response(markup, {
  status, headers: { 'Content-Type': 'text/html;charset=utf-8' },
});

/* ── storefront ──────────────────────────────────────────────────────────── */

async function stockMap(env, products) {
  const out = {};
  for (const p of products) out[p.slug] = await getStock(env, p.slug);
  return out;
}

async function renderSite(request, env) {
  const res = await env.ASSETS.fetch(new URL('/shell.html', request.url));
  if (!res.ok) return new Response('shell.html missing from public/', { status: 500 });

  const cat = await getCatalogue(env);
  const settings = await getSettings(env);
  const live = cat.products.filter((p) => p.active !== false);

  const payload = {
    products: live,
    stock: await stockMap(env, live),
    shipping: settings.shipping,
    free_delivery_over: settings.free_delivery_over,
    payments_live: !!(env.TEYA_API_KEY && env.TEYA_STORE_ID),
  };

  const inject = `<script>window.__DREWRYS__=${
    JSON.stringify(payload).replace(/</g, '\\u003c')
  };</script>`;

  const body = await res.text();
  return html(body.includes('</head>')
    ? body.replace('</head>', inject + '</head>')
    : inject + body);
}

/* ── orders ──────────────────────────────────────────────────────────────── */

async function pushRecent(env, reference) {
  const raw = await env.DREWRYS_KV.get('orders:recent');
  let list = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  list = [reference, ...list.filter((r) => r !== reference)].slice(0, 50);
  await env.DREWRYS_KV.put('orders:recent', JSON.stringify(list));
}

async function decrementStock(env, order) {
  for (const item of order.items || []) {
    const cur = await getStock(env, item.sku);
    if (cur === null) continue;                       // unlimited, leave alone
    const next = Math.max(0, cur - (item.quantity || 0));
    await env.DREWRYS_KV.put(`stock:${item.sku}`, String(next));
  }
}

async function sendEmail(env, { to, subject, html: bodyHtml }) {
  if (!env.SENDGRID_API_KEY || !to) return false;
  const from = env.SHOP_FROM_EMAIL || 'orders@drewrys.store';
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: env.SHOP_NAME || 'Drewrys' },
      subject,
      content: [{ type: 'text/html', value: bodyHtml }],
    }),
  });
  if (!r.ok) console.error('sendgrid', r.status, await r.text().catch(() => ''));
  return r.ok;
}

function orderRows(order) {
  return (order.items || []).map((i) =>
    `<tr><td style="padding:6px 0">${esc(i.name)} &times; ${i.quantity}</td>
     <td align="right">${gbp(i.unit_amount * i.quantity)}</td></tr>`).join('');
}

function orderTable(order) {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">
    ${orderRows(order)}
    <tr><td style="padding-top:10px">Subtotal</td><td align="right" style="padding-top:10px">${gbp(order.subtotal)}</td></tr>
    ${order.discount ? `<tr><td>Discount${order.promo ? ' (' + esc(order.promo) + ')' : ''}</td><td align="right">&minus;${gbp(order.discount)}</td></tr>` : ''}
    <tr><td>${order.fulfilment === 'collect' ? 'Collection' : 'Delivery'}</td><td align="right">${order.shipping ? gbp(order.shipping) : 'Free'}</td></tr>
    <tr><td style="padding-top:8px;font-weight:700">Total</td><td align="right" style="padding-top:8px;font-weight:700">${gbp(order.total)}</td></tr>
  </table>`;
}

async function sendOrderEmails(env, order) {
  const collect = order.fulfilment === 'collect';
  const addr = env.SHOP_COLLECT_ADDR || '';
  const cust = `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#191C21">
    <h2 style="font-weight:600">Thanks${order.customer?.name ? ', ' + esc(order.customer.name.split(' ')[0]) : ''}.</h2>
    <p>We've got your order. Reference <b>${esc(order.reference)}</b>.</p>
    ${orderTable(order)}
    <p style="margin-top:18px">${collect
      ? 'Ready to collect from the shop' + (addr ? ' &mdash; ' + esc(addr) : '') + '. We\'ll be in touch when it\'s ready.'
      : 'We\'ll drop you a line when it\'s on its way.'}</p>
    <p style="color:#6b6b6b;font-size:12px;margin-top:24px">Drewrys</p></div>`;

  const owner = `<div style="font-family:system-ui,sans-serif;max-width:520px">
    <h2>New order ${esc(order.reference)}</h2>
    ${orderTable(order)}
    <p style="margin-top:14px"><b>${collect ? 'COLLECTION' : 'DELIVERY'}</b><br>
    ${esc(order.customer?.name || '')}<br>${esc(order.customer?.email || '')}<br>
    ${esc(order.customer?.phone || '')}<br>${esc(order.customer?.address || '')} ${esc(order.customer?.postcode || '')}</p></div>`;

  await sendEmail(env, { to: order.customer?.email, subject: `Drewrys order ${order.reference}`, html: cust });
  await sendEmail(env, { to: env.SHOP_ORDER_EMAIL, subject: `New order ${order.reference} — ${gbp(order.total)}`, html: owner });
}

async function handleWebhook(request, env, ctx) {
  const raw = await request.text();
  const sig = request.headers.get('teya-signature') || request.headers.get('x-teya-signature');
  if (!(await verifySignature(raw, sig, env.TEYA_WEBHOOK_SECRET))) {
    return new Response('bad signature', { status: 401 });
  }

  let event = {};
  try { event = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

  const reference = event.reference || event.data?.reference || '';
  const status = String(event.status || event.data?.status || event.type || '').toLowerCase();
  const paid = /succeed|success|paid|complete|captur/.test(status);
  if (!reference) return new Response('ok', { status: 200 });

  const stored = await env.DREWRYS_KV.get(`order:${reference}`);
  if (!stored) { console.warn('webhook for unknown order', reference); return new Response('ok', { status: 200 }); }

  const order = JSON.parse(stored);
  if (order.status === 'paid') return new Response('ok', { status: 200 }); // idempotent

  order.status = paid ? 'paid' : 'failed';
  order.settled = new Date().toISOString();
  await env.DREWRYS_KV.put(`order:${reference}`, JSON.stringify(order));

  if (paid) {
    await pushRecent(env, reference);
    ctx.waitUntil(decrementStock(env, order));
    ctx.waitUntil(sendOrderEmails(env, order));
  }
  return new Response('ok', { status: 200 });
}

/* ── admin ───────────────────────────────────────────────────────────────── */

const GATE = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Drewrys · Admin</title>
<style>
*{box-sizing:border-box}
body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#191C21;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.gate{width:320px;max-width:88vw;text-align:center;color:#F3EDE1}
.logo{width:56px;height:56px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;border:2px solid #C79A6B;border-radius:14px}
.logo b{font-size:24px;font-weight:700;color:#C79A6B;line-height:1}
h1{font-size:19px;margin:0 0 6px;font-weight:600}
p{color:#9a948a;font-size:13px;margin:0 0 22px}
input{width:100%;padding:14px 16px;font-size:20px;letter-spacing:.3em;text-align:center;border:1px solid #3a3630;background:#111417;color:#F3EDE1;border-radius:11px;outline:none}
input:focus{border-color:#C79A6B}
button{width:100%;margin-top:12px;padding:13px;font-size:15px;font-weight:600;color:#191C21;background:#C79A6B;border:0;border-radius:11px;cursor:pointer}
button:disabled{opacity:.5}
.err{color:#e08b8b;font-size:13px;min-height:18px;margin-top:12px}
.foot{margin-top:26px;color:#5a5650;font-size:11px}
</style></head><body>
<div class="gate">
  <div class="logo"><b>D.</b></div>
  <h1>Drewrys Admin</h1>
  <p>Enter your PIN to continue</p>
  <input id="pin" type="password" inputmode="numeric" autocomplete="off" autofocus placeholder="••••">
  <button id="go">Unlock</button>
  <div class="err" id="err"></div>
  <div class="foot">Catalogue, stock &amp; orders · authorised access only</div>
</div>
<script>
var pin=document.getElementById('pin'),go=document.getElementById('go'),err=document.getElementById('err');
async function attempt(code,silent){
  if(!code) return false;
  go.disabled=true; if(!silent){err.textContent='';go.textContent='Checking…';}
  try{ var r=await fetch('/admin',{headers:{'x-admin-key':code}});
    if(r.ok){ var t=await r.text(); sessionStorage.setItem('drw_admin_key',code);
      document.open(); document.write(t); document.close(); return true; }
  }catch(e){}
  go.disabled=false; go.textContent='Unlock';
  if(!silent){ err.textContent='Incorrect PIN'; pin.value=''; pin.focus(); }
  return false;
}
go.addEventListener('click',function(){attempt(pin.value.trim(),false);});
pin.addEventListener('keydown',function(e){if(e.key==='Enter')attempt(pin.value.trim(),false);});
var saved=sessionStorage.getItem('drw_admin_key'); if(saved) attempt(saved,true);
</script></body></html>`;

async function recentOrders(env) {
  const raw = await env.DREWRYS_KV.get('orders:recent');
  let refs = [];
  try { refs = raw ? JSON.parse(raw) : []; } catch { refs = []; }
  const out = [];
  for (const r of refs.slice(0, 25)) {
    const o = await env.DREWRYS_KV.get(`order:${r}`);
    if (o) { try { out.push(JSON.parse(o)); } catch {} }
  }
  return out;
}

async function adminPage(env) {
  const cat = await getCatalogue(env);
  const settings = await getSettings(env);
  const stock = await stockMap(env, cat.products);
  const orders = await recentOrders(env);

  const state = JSON.stringify({ catalogue: cat, settings, stock, orders })
    .replace(/</g, '\\u003c');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Drewrys · Admin</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#F3EDE1;color:#191C21;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding-bottom:96px}
header{position:sticky;top:0;z-index:5;background:#191C21;color:#F3EDE1;padding:14px 18px;display:flex;align-items:center;gap:12px}
header b{font-size:17px;font-weight:600}
header .sp{flex:1}
header button{background:none;border:1px solid #4a453d;color:#F3EDE1;padding:7px 13px;border-radius:9px;font-size:13px;cursor:pointer}
nav{display:flex;gap:4px;padding:12px 18px 0;flex-wrap:wrap}
nav button{border:1px solid #ddd4c4;background:#ECE3D3;color:#191C21;padding:9px 16px;border-radius:10px;font-size:14px;cursor:pointer;min-height:44px}
nav button[aria-selected=true]{background:#94876d;color:#F3EDE1;border-color:#94876d}
main{padding:16px 18px;max-width:1000px}
.card{background:#fff;border:1px solid #e6ddcd;border-radius:14px;padding:16px;margin-bottom:12px}
.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.row .grow{flex:1;min-width:180px}
label{display:block;font-size:12px;color:#6b6b6b;margin:10px 0 4px}
input,textarea,select{width:100%;padding:10px 12px;border:1px solid #ddd4c4;border-radius:9px;font:inherit;font-size:15px;background:#fff;min-height:44px}
textarea{min-height:86px;resize:vertical}
h3{margin:0 0 2px;font-size:16px;font-weight:600}
.muted{color:#6b6b6b;font-size:13px}
.badge{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:600}
.b-ok{background:#e4efe4;color:#2c6b2c}.b-low{background:#fdf0dc;color:#8a5a12}.b-out{background:#f7e2e2;color:#a33}
.savebar{position:fixed;left:0;right:0;bottom:0;background:#191C21;color:#F3EDE1;padding:12px 18px;display:none;align-items:center;gap:12px}
.savebar.on{display:flex}
.savebar .sp{flex:1;font-size:14px}
.savebar button{padding:11px 18px;border-radius:10px;border:0;font-size:15px;font-weight:600;cursor:pointer;min-height:44px}
.savebar .save{background:#C79A6B;color:#191C21}.savebar .disc{background:none;border:1px solid #4a453d;color:#F3EDE1}
table{width:100%;border-collapse:collapse;font-size:14px}
td,th{text-align:left;padding:8px 6px;border-bottom:1px solid #eee6d6}
th{font-size:12px;color:#6b6b6b;font-weight:600}
.toast{position:fixed;bottom:96px;left:50%;transform:translateX(-50%);background:#191C21;color:#F3EDE1;padding:11px 18px;border-radius:11px;font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.on{opacity:1}
</style></head><body>
<header><b>Drewrys</b><span class="muted" style="color:#9a948a">admin</span><span class="sp"></span>
<button id="lock">Lock</button></header>
<nav>
  <button data-tab="catalogue" aria-selected="true">Catalogue</button>
  <button data-tab="stock" aria-selected="false">Stock</button>
  <button data-tab="orders" aria-selected="false">Orders</button>
</nav>
<main id="main"></main>
<div class="savebar" id="savebar"><span class="sp" id="dirty"></span>
<button class="disc" id="discard">Discard</button><button class="save" id="save">Save</button></div>
<div class="toast" id="toast"></div>
<script>
var KEY=sessionStorage.getItem('drw_admin_key')||'';
var S=${state};
var draft=JSON.parse(JSON.stringify({catalogue:S.catalogue,stock:S.stock,settings:S.settings}));
var tab='catalogue';
var money=function(p){return '£'+(Number(p||0)/100).toFixed(2);};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};

function dirtyCount(){
  var n=0;
  draft.catalogue.products.forEach(function(p,i){
    var o=S.catalogue.products[i]||{};
    ['name','size','tagline','badge','description','price_pence','active'].forEach(function(k){
      if(JSON.stringify(p[k])!==JSON.stringify(o[k])) n++;
    });
  });
  Object.keys(draft.stock).forEach(function(k){ if(String(draft.stock[k])!==String(S.stock[k])) n++; });
  if(JSON.stringify(draft.settings)!==JSON.stringify(S.settings)) n++;
  return n;
}
function refreshBar(){
  var n=dirtyCount();
  document.getElementById('savebar').className='savebar'+(n?' on':'');
  document.getElementById('dirty').textContent=n+(n===1?' change':' changes')+' unsaved';
}
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.className='toast on';
  setTimeout(function(){t.className='toast';},2000);}

function stockBadge(v){
  if(v===null||v===''||v===undefined) return '<span class="badge b-ok">Unlimited</span>';
  var n=Number(v);
  if(n<=0) return '<span class="badge b-out">Sold out</span>';
  if(n<=5) return '<span class="badge b-low">Low · '+n+'</span>';
  return '<span class="badge b-ok">'+n+' in stock</span>';
}

function render(){
  var m=document.getElementById('main'),h='';
  if(tab==='catalogue'){
    draft.catalogue.products.forEach(function(p,i){
      h+='<div class="card"><div class="row"><div class="grow"><h3>'+esc(p.name)+'</h3>'+
      '<span class="muted">'+esc(p.slug)+' · '+esc(p.size)+'</span></div>'+
      '<label style="margin:0"><input type="checkbox" data-i="'+i+'" data-f="active" style="width:auto;min-height:0" '+(p.active!==false?'checked':'')+'> visible</label></div>'+
      '<label>Name</label><input data-i="'+i+'" data-f="name" value="'+esc(p.name)+'">'+
      '<label>Price (pence · '+money(p.price_pence)+')</label><input data-i="'+i+'" data-f="price_pence" type="number" min="0" step="1" value="'+Number(p.price_pence)+'">'+
      '<label>Size</label><input data-i="'+i+'" data-f="size" value="'+esc(p.size)+'">'+
      '<label>Badge (blank for none)</label><input data-i="'+i+'" data-f="badge" value="'+esc(p.badge)+'">'+
      '<label>Short line</label><input data-i="'+i+'" data-f="tagline" value="'+esc(p.tagline)+'">'+
      '<label>Description</label><textarea data-i="'+i+'" data-f="description">'+esc(p.description)+'</textarea>'+
      '</div>';
    });
    h+='<div class="card"><h3>Delivery</h3><p class="muted">Pence. Isle of Man and collection are free.</p>';
    ['uk','eu','row'].forEach(function(k){
      h+='<label>'+k.toUpperCase()+'</label><input data-ship="'+k+'" type="number" min="0" value="'+Number(draft.settings.shipping[k]||0)+'">';
    });
    h+='</div>';
  }
  if(tab==='stock'){
    h+='<div class="card"><p class="muted">Blank means unlimited. 0 is sold out. 1&ndash;5 shows as low stock on the site.</p></div>';
    draft.catalogue.products.forEach(function(p){
      var v=draft.stock[p.slug];
      h+='<div class="card"><div class="row"><div class="grow"><h3>'+esc(p.name)+'</h3>'+stockBadge(v)+'</div>'+
      '<input style="width:120px" data-stock="'+esc(p.slug)+'" type="number" min="0" placeholder="unlimited" value="'+(v===null||v===undefined?'':Number(v))+'"></div></div>';
    });
  }
  if(tab==='orders'){
    if(!S.orders.length){ h+='<div class="card"><p class="muted">No paid orders yet.</p></div>'; }
    S.orders.forEach(function(o){
      h+='<div class="card"><div class="row"><div class="grow"><h3>'+esc(o.reference)+' · '+money(o.total)+'</h3>'+
      '<span class="muted">'+esc((o.settled||o.created||'').slice(0,16).replace('T',' '))+' · '+esc(o.fulfilment==='collect'?'Collection':'Delivery')+' · '+esc(o.status)+'</span></div></div>'+
      '<table><tr><th>Item</th><th>Qty</th><th>Line</th></tr>'+
      (o.items||[]).map(function(i){return '<tr><td>'+esc(i.name)+'</td><td>'+i.quantity+'</td><td>'+money(i.unit_amount*i.quantity)+'</td></tr>';}).join('')+
      '</table><p class="muted" style="margin-top:10px">'+esc(o.customer&&o.customer.name||'')+' · '+
      esc(o.customer&&o.customer.email||'')+' · '+esc(o.customer&&o.customer.phone||'')+'<br>'+
      esc(o.customer&&o.customer.address||'')+' '+esc(o.customer&&o.customer.postcode||'')+'</p></div>';
    });
  }
  m.innerHTML=h;
  refreshBar();
}

document.addEventListener('input',function(e){
  var t=e.target;
  if(t.dataset.i!==undefined&&t.dataset.f){
    var p=draft.catalogue.products[+t.dataset.i],f=t.dataset.f;
    p[f]= f==='active' ? t.checked : (f==='price_pence' ? (parseInt(t.value,10)||0) : t.value);
  }
  if(t.dataset.stock!==undefined&&t.dataset.stock!==''&&t.hasAttribute('data-stock')){
    draft.stock[t.dataset.stock]= t.value===''?null:(parseInt(t.value,10)||0);
  }
  if(t.dataset.ship){ draft.settings.shipping[t.dataset.ship]=parseInt(t.value,10)||0; }
  refreshBar();
});
document.querySelectorAll('nav button').forEach(function(b){
  b.addEventListener('click',function(){
    tab=b.dataset.tab;
    document.querySelectorAll('nav button').forEach(function(x){x.setAttribute('aria-selected',String(x===b));});
    render();
  });
});
document.getElementById('discard').addEventListener('click',function(){
  draft=JSON.parse(JSON.stringify({catalogue:S.catalogue,stock:S.stock,settings:S.settings}));
  render(); toast('Changes discarded');
});
document.getElementById('save').addEventListener('click',async function(){
  var btn=this; btn.disabled=true; btn.textContent='Saving…';
  try{
    var r=await fetch('/admin',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':KEY},
      body:JSON.stringify({catalogue:draft.catalogue,stock:draft.stock,settings:draft.settings})});
    if(!r.ok) throw new Error('save failed');
    S.catalogue=JSON.parse(JSON.stringify(draft.catalogue));
    S.stock=JSON.parse(JSON.stringify(draft.stock));
    S.settings=JSON.parse(JSON.stringify(draft.settings));
    toast('Saved'); refreshBar();
  }catch(e){ toast('Save failed'); }
  btn.disabled=false; btn.textContent='Save';
});
document.getElementById('lock').addEventListener('click',function(){
  sessionStorage.removeItem('drw_admin_key'); location.href='/admin';
});
render();
</script></body></html>`;
}

async function handleAdmin(request, env, url) {
  const key = url.searchParams.get('key') || request.headers.get('x-admin-key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    if (request.method === 'POST') return json({ error: 'Unauthorized' }, 401);
    return html(GATE, 401);
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'bad json' }, 400);

    if (body.catalogue && Array.isArray(body.catalogue.products)) {
      const clean = {
        currency: 'GBP',
        updated: new Date().toISOString(),
        products: body.catalogue.products.map((p) => ({
          slug: String(p.slug),
          name: String(p.name || '').slice(0, 120),
          size: String(p.size || '').slice(0, 40),
          tagline: String(p.tagline || '').slice(0, 200),
          badge: String(p.badge || '').slice(0, 40),
          image_key: String(p.image_key || ''),
          description: String(p.description || '').slice(0, 2000),
          price_pence: Math.max(0, parseInt(p.price_pence, 10) || 0),
          ingredients: Array.isArray(p.ingredients) ? p.ingredients : [],
          howto: Array.isArray(p.howto) ? p.howto : [],
          active: p.active !== false,
        })),
      };
      await env.DREWRYS_KV.put('catalogue', JSON.stringify(clean));
    }

    if (body.stock && typeof body.stock === 'object') {
      for (const [slug, v] of Object.entries(body.stock)) {
        if (v === null || v === '') await env.DREWRYS_KV.delete(`stock:${slug}`);
        else await env.DREWRYS_KV.put(`stock:${slug}`, String(Math.max(0, parseInt(v, 10) || 0)));
      }
    }

    if (body.settings) {
      await env.DREWRYS_KV.put('settings', JSON.stringify({ ...DEFAULT_SETTINGS, ...body.settings }));
    }

    return json({ ok: true });
  }

  return html(await adminPage(env));
}

/* ── router ──────────────────────────────────────────────────────────────── */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/' || path === '/index.html') return renderSite(request, env);
      if (path === '/api/catalogue') {
        const cat = await getCatalogue(env);
        return json({ ...cat, stock: await stockMap(env, cat.products) });
      }
      if (path === '/create-session' && request.method === 'POST') return createSession(request, env);
      if (path === '/webhook' && request.method === 'POST') return handleWebhook(request, env, ctx);
      if (path === '/admin') return handleAdmin(request, env, url);
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('Not found', { status: 404 });
    } catch (e) {
      console.error(e);
      return new Response('Server error: ' + e.message, { status: 500 });
    }
  },
};
