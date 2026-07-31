/**
 * Admin UI for the Drewrys store.
 *
 * Kept in its own module because it is mostly markup — index.js stays about
 * routing and orders.
 *
 * Design notes, all deliberate:
 *   - prices are entered in POUNDS and stored in pence. Typing 2499 for
 *     £24.99 is a trap and Ben will get it wrong eventually.
 *   - every product card is collapsed to a thumbnail, name and price until
 *     it is opened. Eight products open at once was a wall of inputs.
 *   - a product photo can be uploaded here and lands in KV, so adding a
 *     product does not need a commit to the repo.
 */

export const GATE = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Drewrys · Admin</title>
<link rel="icon" type="image/png" href="/img/favicon.png">
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:#191C21;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.gate{width:320px;max-width:88vw;text-align:center;color:#F3EDE1}
.mark{width:76px;margin:0 auto 20px;display:block}
h1{font-size:19px;margin:0 0 6px;font-weight:600;letter-spacing:-.01em}
p{color:#9a948a;font-size:13px;margin:0 0 22px}
input{width:100%;padding:14px 16px;font-size:20px;letter-spacing:.3em;text-align:center;
  border:1px solid #3a3630;background:#111417;color:#F3EDE1;border-radius:11px;outline:none}
input:focus{border-color:#C79A6B}
button{width:100%;margin-top:12px;padding:13px;font-size:15px;font-weight:600;
  color:#191C21;background:#C79A6B;border:0;border-radius:11px;cursor:pointer}
button:disabled{opacity:.5}
.err{color:#e08b8b;font-size:13px;min-height:18px;margin-top:12px}
.foot{margin-top:26px;color:#5a5650;font-size:11px}
</style></head><body>
<div class="gate">
  <img class="mark" src="/img/logo-d.png" alt="Drewrys">
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

export function adminHtml(state) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Drewrys · Admin</title>
<link rel="icon" type="image/png" href="/img/favicon.png">
<style>
:root{--cotton:#F3EDE1;--cotton-2:#ECE3D3;--ink:#191C21;--peanut:#C79A6B;
  --olive:#94876d;--line:#e0d6c4;--muted:#6f6a62}
*{box-sizing:border-box}
body{margin:0;background:var(--cotton);color:var(--ink);
  font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding-bottom:104px}
header{position:sticky;top:0;z-index:20;background:var(--ink);color:var(--cotton);
  padding:11px 18px;display:flex;align-items:center;gap:11px}
header img{height:26px;width:auto;display:block;filter:invert(1) brightness(1.6)}
header .sub{color:#9a948a;font-size:13px}
header .sp{flex:1}
header button{background:none;border:1px solid #4a453d;color:var(--cotton);
  padding:8px 14px;border-radius:9px;font-size:13px;cursor:pointer;min-height:40px}
nav{position:sticky;top:48px;z-index:19;background:var(--cotton);
  display:flex;gap:6px;padding:12px 18px;border-bottom:1px solid var(--line);flex-wrap:wrap}
nav button{border:1px solid var(--line);background:var(--cotton-2);color:var(--ink);
  padding:9px 17px;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;min-height:44px}
nav button[aria-selected=true]{background:var(--olive);color:var(--cotton);border-color:var(--olive)}
main{padding:16px 18px;max-width:940px;margin:0 auto}

.card{background:#fff;border:1px solid var(--line);border-radius:14px;margin-bottom:10px;overflow:hidden}
.head{display:flex;align-items:center;gap:13px;padding:11px 13px;cursor:pointer;user-select:none}
.head:hover{background:#fdfbf7}
.thumb{flex:0 0 auto;width:54px;height:54px;border-radius:10px;background:#f5f2f3;
  position:relative;overflow:hidden}
.thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:5px}
.hmeta{flex:1;min-width:0}
.hmeta b{display:block;font-size:15px;font-weight:600}
.hmeta span{font-size:12.5px;color:var(--muted)}
.chev{flex:0 0 auto;color:var(--muted);transition:transform .18s;font-size:13px}
.card.open .chev{transform:rotate(90deg)}
.body{display:none;padding:4px 13px 15px;border-top:1px solid var(--line)}
.card.open .body{display:block}
.hidden-flag{font-size:11px;font-weight:600;color:#a33;background:#f7e2e2;
  padding:2px 8px;border-radius:99px;margin-left:6px}

label{display:block;font-size:12px;color:var(--muted);margin:12px 0 5px;font-weight:500}
input,textarea,select{width:100%;padding:10px 12px;border:1px solid var(--line);
  border-radius:9px;font:inherit;font-size:15px;background:#fff;min-height:44px;color:var(--ink)}
input:focus,textarea:focus{outline:none;border-color:var(--olive)}
textarea{min-height:84px;resize:vertical;line-height:1.45}
.two{display:grid;grid-template-columns:1fr 1fr;gap:11px}
@media(max-width:560px){.two{grid-template-columns:1fr}}
.money{position:relative}
.money span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:15px}
.money input{padding-left:25px}
.check{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:14px}
.check input{width:auto;min-height:0;transform:scale(1.15)}
.danger{margin-top:16px;background:none;border:1px solid #e3c9c9;color:#a33;
  padding:9px 15px;border-radius:9px;font-size:13.5px;cursor:pointer;min-height:44px;width:auto}
.chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:2px}
.chip{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:99px;
  border:1px solid var(--line);background:#fff;font-size:13.5px;cursor:pointer;min-height:40px;color:var(--ink)}
.chip[aria-pressed=true]{background:var(--olive);border-color:var(--olive);color:var(--cotton)}
.chip .n{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;
  border-radius:99px;background:rgba(255,255,255,.28);font-size:11px;font-weight:700}
.chip.no-icon{border-style:dashed;opacity:.72}
.chip .cicon{width:19px;height:19px;object-fit:contain}
.chip[aria-pressed=true] .cicon{filter:invert(1) brightness(1.7)}
.icon-slot{flex:0 0 auto;width:46px;height:46px;border-radius:10px;background:var(--cotton-2);
  border:1px solid var(--line);display:flex;align-items:center;justify-content:center;overflow:hidden}
.icon-slot img{width:30px;height:30px;object-fit:contain}
.icon-slot.empty{border-style:dashed;color:var(--muted);font-size:11px;text-align:center;line-height:1.2}
.hint{font-size:12px;color:var(--muted);margin-top:7px;line-height:1.5}
.steps{counter-reset:s}
.steprow{display:flex;gap:9px;align-items:flex-start;margin-top:8px}
.steprow .num{flex:0 0 auto;width:28px;height:44px;display:flex;align-items:center;
  justify-content:center;font-weight:600;color:var(--peanut);font-size:15px}
.steprow textarea{min-height:44px}
.steprow .x{flex:0 0 auto;width:44px;height:44px;border:1px solid var(--line);background:#fff;
  border-radius:9px;cursor:pointer;color:var(--muted);font-size:17px}
.addstep{margin-top:9px;background:var(--cotton-2);border:1px solid var(--line);color:var(--ink);
  padding:10px 15px;border-radius:9px;font-size:13.5px;cursor:pointer;min-height:44px;width:auto}
.upload{display:flex;align-items:center;gap:11px;margin-top:6px}
.upload button{background:var(--cotton-2);border:1px solid var(--line);color:var(--ink);
  padding:9px 15px;border-radius:9px;font-size:13.5px;cursor:pointer;min-height:44px;width:auto}
.addnew{width:100%;padding:14px;border:1px dashed var(--line);background:none;color:var(--muted);
  border-radius:14px;font-size:14.5px;font-weight:500;cursor:pointer;min-height:52px;margin-bottom:12px}
.addnew:hover{border-color:var(--olive);color:var(--ink)}

.note{background:#fff;border:1px solid var(--line);border-radius:14px;padding:13px 15px;
  margin-bottom:12px;font-size:13.5px;color:var(--muted);line-height:1.5}
.badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11.5px;font-weight:600}
.b-ok{background:#e4efe4;color:#2c6b2c}.b-low{background:#fdf0dc;color:#8a5a12}
.b-out{background:#f7e2e2;color:#a33}
.step{display:flex;align-items:center;gap:0;flex:0 0 auto}
.step button{width:44px;height:44px;border:1px solid var(--line);background:#fff;
  font-size:19px;cursor:pointer;color:var(--ink)}
.step button:first-child{border-radius:9px 0 0 9px}
.step button:last-child{border-radius:0 9px 9px 0}
.step input{width:82px;text-align:center;border-radius:0;border-left:0;border-right:0;min-height:44px}

table{width:100%;border-collapse:collapse;font-size:13.5px}
td,th{text-align:left;padding:7px 6px;border-bottom:1px solid #f0e9dc}
th{font-size:11.5px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em}

.savebar{position:fixed;left:0;right:0;bottom:0;z-index:30;background:var(--ink);color:var(--cotton);
  padding:12px 18px;display:none;align-items:center;gap:11px}
.savebar.on{display:flex}
.savebar .sp{flex:1;font-size:14px}
.savebar button{padding:12px 20px;border-radius:10px;border:0;font-size:15px;
  font-weight:600;cursor:pointer;min-height:46px}
.savebar .save{background:var(--peanut);color:var(--ink)}
.savebar .disc{background:none;border:1px solid #4a453d;color:var(--cotton)}
.toast{position:fixed;bottom:104px;left:50%;transform:translateX(-50%);z-index:40;
  background:var(--ink);color:var(--cotton);padding:12px 20px;border-radius:11px;
  font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.on{opacity:1}
</style></head><body>
<header>
  <img src="/img/logo-d.png" alt="Drewrys">
  <span class="sub">admin</span><span class="sp"></span>
  <button id="lock">Lock</button>
</header>
<nav>
  <button data-tab="catalogue" aria-selected="true">Catalogue</button>
  <button data-tab="ingredients" aria-selected="false">Ingredients</button>
  <button data-tab="stock" aria-selected="false">Stock</button>
  <button data-tab="delivery" aria-selected="false">Delivery</button>
  <button data-tab="orders" aria-selected="false">Orders</button>
</nav>
<main id="main"></main>
<div class="savebar" id="savebar"><span class="sp" id="dirty"></span>
  <button class="disc" id="discard">Discard</button>
  <button class="save" id="save">Save changes</button></div>
<div class="toast" id="toast"></div>
<script>
var KEY=sessionStorage.getItem('drw_admin_key')||'';
var S=${JSON.stringify(state).replace(/</g, '\\u003c')};
var clone=function(o){return JSON.parse(JSON.stringify(o));};
var draft=clone({catalogue:S.catalogue,stock:S.stock,settings:S.settings});
var LIB=clone(S.ingredients||[]);
var iconUploads={};          // ingredient slug -> data URL waiting to be saved
var uploads={};              // slug -> data URL waiting to be saved
var tab='catalogue', openCard=null;

var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
var pounds=function(pence){return (Number(pence||0)/100).toFixed(2);};
var toPence=function(v){return Math.round(parseFloat(String(v).replace(/[^0-9.]/g,''))*100)||0;};
var slugify=function(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-')
  .replace(/^-|-$/g,'').slice(0,40);};

function dirtyCount(){
  var n=0, base=S.catalogue.products, now=draft.catalogue.products;
  if(base.length!==now.length) n+=Math.abs(base.length-now.length);
  now.forEach(function(p){
    var o=base.filter(function(x){return x.slug===p.slug;})[0];
    if(!o) return;
    ['name','size','tagline','badge','description','price_pence','active','image',
     'ingredients','howto']
      .forEach(function(k){ if(JSON.stringify(p[k])!==JSON.stringify(o[k])) n++; });
  });
  Object.keys(draft.stock).forEach(function(k){
    if(String(draft.stock[k])!==String(S.stock[k])) n++; });
  if(JSON.stringify(draft.settings)!==JSON.stringify(S.settings)) n++;
  n+=Object.keys(uploads).length+Object.keys(iconUploads).length;
  if(JSON.stringify(LIB)!==JSON.stringify(S.ingredients||[])) n++;
  return n;
}
function refreshBar(){
  var n=dirtyCount();
  document.getElementById('savebar').className='savebar'+(n?' on':'');
  document.getElementById('dirty').textContent=n+(n===1?' change':' changes')+' unsaved';
}
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.className='toast on';
  clearTimeout(window.__t); window.__t=setTimeout(function(){t.className='toast';},2200);}

function stockBadge(v){
  if(v===null||v===''||v===undefined) return '<span class="badge b-ok">Unlimited</span>';
  var n=Number(v);
  if(n<=0) return '<span class="badge b-out">Sold out</span>';
  if(n<=5) return '<span class="badge b-low">Low · '+n+' left</span>';
  return '<span class="badge b-ok">'+n+' in stock</span>';
}
function imgFor(p){ return uploads[p.slug] || p.image || '/img/favicon.png'; }

function render(){
  var m=document.getElementById('main'), h='';

  if(tab==='catalogue'){
    h+='<button class="addnew" id="addnew">+ Add a product</button>';
    draft.catalogue.products.forEach(function(p,i){
      var open=(openCard===p.slug);
      h+='<div class="card'+(open?' open':'')+'" data-slug="'+esc(p.slug)+'">'+
        '<div class="head" data-toggle="'+esc(p.slug)+'">'+
          '<div class="thumb"><img src="'+esc(imgFor(p))+'" alt=""></div>'+
          '<div class="hmeta"><b>'+esc(p.name||'Untitled')+
            (p.active===false?'<span class="hidden-flag">hidden</span>':'')+'</b>'+
            '<span>£'+pounds(p.price_pence)+(p.size?' · '+esc(p.size):'')+'</span></div>'+
          '<div class="chev">&#9654;</div>'+
        '</div><div class="body">'+
          '<label>Product name</label><input data-i="'+i+'" data-f="name" value="'+esc(p.name)+'">'+
          '<div class="two"><div><label>Price</label><div class="money"><span>£</span>'+
            '<input data-i="'+i+'" data-f="price_pence" inputmode="decimal" value="'+pounds(p.price_pence)+'"></div></div>'+
            '<div><label>Size</label><input data-i="'+i+'" data-f="size" value="'+esc(p.size)+'"></div></div>'+
          '<label>Badge <span style="font-weight:400">(blank for none)</span></label>'+
            '<input data-i="'+i+'" data-f="badge" value="'+esc(p.badge)+'" placeholder="e.g. Best seller">'+
          '<label>Short line <span style="font-weight:400">(shown on the card)</span></label>'+
            '<input data-i="'+i+'" data-f="tagline" value="'+esc(p.tagline)+'">'+
          '<label>Description <span style="font-weight:400">(shown in Learn more)</span></label>'+
            '<textarea data-i="'+i+'" data-f="description">'+esc(p.description)+'</textarea>'+
          '<label>Ingredients <span style="font-weight:400">(order matters &mdash; the first one opens by default)</span></label>'+
            '<div class="chips">'+LIB.map(function(m){
              var pos=(p.ingredients||[]).indexOf(m.name);
              var ic=iconUploads[m.slug]||m.icon;
              return '<button type="button" class="chip'+(ic?'':' no-icon')+'" data-ing="'+i+'|'+esc(m.name)+
                '" aria-pressed="'+(pos>=0)+'">'+(pos>=0?'<span class="n">'+(pos+1)+'</span>':'')+
                (ic?'<img class="cicon" src="'+esc(ic)+'" alt="">':'')+
                esc(m.name)+'</button>';
            }).join('')+'</div>'+
            '<div class="hint">Dashed ones have no icon yet, so they will not show on the card &mdash; '+
            'add one on the Ingredients tab. Tap again to remove; numbers show the order they appear in.</div>'+
          '<label>How to use <span style="font-weight:400">(one step per box)</span></label>'+
            '<div class="steps">'+((p.howto||[]).map(function(st,si){
              return '<div class="steprow"><div class="num">'+(si+1)+'</div>'+
                '<textarea data-step="'+i+'|'+si+'">'+esc(st)+'</textarea>'+
                '<button type="button" class="x" data-stepdel="'+i+'|'+si+'">&times;</button></div>';
            }).join('')||'<div class="hint" style="margin-top:0">No guide yet.</div>')+'</div>'+
            '<button type="button" class="addstep" data-stepadd="'+i+'">+ Add a step</button>'+
            '<div class="hint">A single step shows as a plain line. Two or more are numbered '+
            'automatically. Leave it empty for something like a candle.</div>'+
          '<label>Photo</label><div class="upload">'+
            '<div class="thumb"><img src="'+esc(imgFor(p))+'" alt=""></div>'+
            '<button type="button" data-upload="'+esc(p.slug)+'">Choose image…</button></div>'+
          '<div class="check"><input type="checkbox" id="vis-'+i+'" data-i="'+i+'" data-f="active"'+
            (p.active!==false?' checked':'')+'><label for="vis-'+i+'" style="margin:0">Show on the site</label></div>'+
          '<button class="danger" data-del="'+esc(p.slug)+'">Remove this product</button>'+
        '</div></div>';
    });
  }

  if(tab==='ingredients'){
    h+='<div class="note">These are shared across every product. An ingredient with no icon '+
       'will not appear on a product card at all, so add one before using it. '+
       'Bullets and the write-up show when a customer taps the chip in Learn more.</div>';
    h+='<button class="addnew" id="addingredient">+ Add an ingredient</button>';
    LIB.forEach(function(g,gi){
      var open=(openCard==='ing:'+g.slug), ic=iconUploads[g.slug]||g.icon;
      var done=(g.bullets&&g.bullets.length)||g.text;
      h+='<div class="card'+(open?' open':'')+'">'+
        '<div class="head" data-toggle="ing:'+esc(g.slug)+'">'+
          '<div class="icon-slot'+(ic?'':' empty')+'">'+(ic?'<img src="'+esc(ic)+'" alt="">':'no icon')+'</div>'+
          '<div class="hmeta"><b>'+esc(g.name)+'</b><span>'+
            (done?(g.bullets||[]).length+' bullets'+(g.text?' · write-up':''):'no write-up yet')+'</span></div>'+
          '<div class="chev">&#9654;</div></div>'+
        '<div class="body">'+
          '<label>Name</label><input data-g="'+gi+'" data-gf="name" value="'+esc(g.name)+'">'+
          '<label>Icon <span style="font-weight:400">(SVG or PNG, square, line art on transparent)</span></label>'+
          '<div class="upload"><div class="icon-slot'+(ic?'':' empty')+'">'+
            (ic?'<img src="'+esc(ic)+'" alt="">':'none')+'</div>'+
            '<button type="button" data-gicon="'+esc(g.slug)+'">Choose icon…</button></div>'+
          '<label>Bullet points <span style="font-weight:400">(short, up to six)</span></label>'+
          '<div class="steps">'+((g.bullets||[]).map(function(bt,bi){
            return '<div class="steprow"><div class="num">&bull;</div>'+
              '<textarea data-gb="'+gi+'|'+bi+'" style="min-height:44px">'+esc(bt)+'</textarea>'+
              '<button type="button" class="x" data-gbdel="'+gi+'|'+bi+'">&times;</button></div>';
          }).join('')||'<div class="hint" style="margin-top:0">No bullets yet.</div>')+'</div>'+
          ((g.bullets||[]).length<6?'<button type="button" class="addstep" data-gbadd="'+gi+'">+ Add a bullet</button>':'')+
          '<label>Write-up</label><textarea data-g="'+gi+'" data-gf="text" '+
            'style="min-height:110px">'+esc(g.text||'')+'</textarea>'+
          '<button class="danger" data-gdel="'+esc(g.slug)+'">Remove this ingredient</button>'+
        '</div></div>';
    });
  }

  if(tab==='stock'){
    h+='<div class="note">Leave blank for unlimited. <b>0</b> marks it sold out on the site '+
       'and blocks it at checkout. <b>1&ndash;5</b> shows &ldquo;Only N left&rdquo; on the card. '+
       'Paid orders reduce these automatically.</div>';
    draft.catalogue.products.forEach(function(p){
      var v=draft.stock[p.slug];
      h+='<div class="card"><div class="head" style="cursor:default">'+
        '<div class="thumb"><img src="'+esc(imgFor(p))+'" alt=""></div>'+
        '<div class="hmeta"><b>'+esc(p.name)+'</b>'+stockBadge(v)+'</div>'+
        '<div class="step"><button type="button" data-dec="'+esc(p.slug)+'">&minus;</button>'+
        '<input data-stock="'+esc(p.slug)+'" inputmode="numeric" placeholder="unlimited" value="'+
          (v===null||v===undefined?'':Number(v))+'">'+
        '<button type="button" data-inc="'+esc(p.slug)+'">+</button></div>'+
      '</div></div>';
    });
  }

  if(tab==='delivery'){
    h+='<div class="note">Collection and Isle of Man delivery are always free. '+
       'Set a free-delivery threshold to 0 to turn it off for that region.</div>';
    h+='<div class="card open"><div class="head" style="cursor:default">'+
      '<div class="hmeta"><b>Collection address</b><span>Shown in the bag and on the confirmation email</span></div></div>'+
      '<div class="body"><label>Address</label>'+
      '<input data-collect="1" value="'+esc(draft.settings.collect_address||'')+
      '" placeholder="Drewrys, 1 Example Street, Douglas, IM1 1AA">'+
      '<div class="note" style="margin:10px 0 0;padding:9px 11px">Separate with commas &mdash; '+
      'each part shows on its own line.</div></div></div>';
    [['uk','United Kingdom'],['eu','Europe'],['row','Rest of world']].forEach(function(r){
      h+='<div class="card open"><div class="head" style="cursor:default">'+
        '<div class="hmeta"><b>'+r[1]+'</b><span>'+esc(r[0].toUpperCase())+'</span></div></div>'+
        '<div class="body"><div class="two">'+
        '<div><label>Delivery charge</label><div class="money"><span>£</span>'+
          '<input data-ship="'+r[0]+'" inputmode="decimal" value="'+
          pounds((draft.settings.shipping||{})[r[0]])+'"></div></div>'+
        '<div><label>Free over</label><div class="money"><span>£</span>'+
          '<input data-free="'+r[0]+'" inputmode="decimal" value="'+
          pounds((draft.settings.free_over||{})[r[0]])+'"></div></div>'+
        '</div></div></div>';
    });
  }

  if(tab==='orders'){
    if(!S.orders.length){
      h+='<div class="note">No paid orders yet. They appear here the moment Teya confirms payment, '+
         'and a copy goes to your email.</div>';
    }
    S.orders.forEach(function(o){
      h+='<div class="card open"><div class="head" style="cursor:default">'+
        '<div class="hmeta"><b>'+esc(o.reference)+' &middot; £'+pounds(o.total)+'</b>'+
        '<span>'+esc(String(o.settled||o.created||'').slice(0,16).replace('T',' '))+' &middot; '+
        (o.fulfilment==='collect'?'Collection':'Delivery')+'</span></div>'+
        '<span class="badge '+(o.status==='paid'?'b-ok':'b-out')+'">'+esc(o.status)+'</span></div>'+
        '<div class="body"><table><tr><th>Item</th><th>Qty</th><th>Line</th></tr>'+
        (o.items||[]).map(function(i){return '<tr><td>'+esc(i.name)+'</td><td>'+i.quantity+
          '</td><td>£'+pounds(i.unit_amount*i.quantity)+'</td></tr>';}).join('')+
        '</table><label>Customer</label><div style="font-size:14px;line-height:1.6">'+
        esc((o.customer||{}).name||'—')+'<br>'+esc((o.customer||{}).email||'')+'<br>'+
        esc((o.customer||{}).phone||'')+'<br>'+esc((o.customer||{}).address||'')+' '+
        esc((o.customer||{}).postcode||'')+'</div></div></div>';
    });
  }

  m.innerHTML=h;
  refreshBar();
}

/* ── interactions ───────────────────────────────────────────────────────── */

document.addEventListener('click',function(e){
  var t=e.target.closest('[data-toggle],[data-del],[data-upload],[data-inc],[data-dec],'+
    '[data-ing],[data-stepadd],[data-stepdel],[data-gicon],[data-gdel],'+
    '[data-gbadd],[data-gbdel],#addnew,#addingredient');
  if(!t) return;

  if(t.id==='addingredient'){
    var nm=prompt('Ingredient name'); if(!nm) return;
    var sg=slugify(nm);
    if(LIB.some(function(x){return x.slug===sg;})){ toast('That one already exists'); return; }
    LIB.push({name:nm,slug:sg,icon:'',bullets:[],text:''});
    openCard='ing:'+sg; render(); toast('Added. Give it an icon or it will not show.'); return;
  }
  if(t.dataset.gicon!==undefined){
    var gs=t.dataset.gicon;
    var fi=document.createElement('input'); fi.type='file';
    fi.accept='image/svg+xml,image/png,image/webp';
    fi.addEventListener('change',function(){
      var file=fi.files[0]; if(!file) return;
      if(file.size>400000){ toast('Icon is over 400KB — please shrink it'); return; }
      var rd=new FileReader();
      rd.onload=function(){ iconUploads[gs]=rd.result; render(); toast('Icon ready — press Save'); };
      rd.readAsDataURL(file);
    });
    fi.click(); return;
  }
  if(t.dataset.gdel!==undefined){
    var gg=LIB.filter(function(x){return x.slug===t.dataset.gdel;})[0];
    var used=draft.catalogue.products.filter(function(pp){
      return (pp.ingredients||[]).indexOf(gg.name)>=0;}).map(function(pp){return pp.name;});
    if(used.length && !confirm('"'+gg.name+'" is used on '+used.join(', ')+
      '. Removing it takes it off those products too. Continue?')) return;
    if(!used.length && !confirm('Remove "'+gg.name+'"?')) return;
    LIB=LIB.filter(function(x){return x.slug!==t.dataset.gdel;});
    draft.catalogue.products.forEach(function(pp){
      pp.ingredients=(pp.ingredients||[]).filter(function(n){return n!==gg.name;});});
    delete iconUploads[t.dataset.gdel];
    openCard=null; render(); return;
  }
  if(t.dataset.gbadd!==undefined){
    var gb=LIB[+t.dataset.gbadd]; gb.bullets=(gb.bullets||[]).concat(['']); render(); return;
  }
  if(t.dataset.gbdel!==undefined){
    var gd=t.dataset.gbdel.split('|'); LIB[+gd[0]].bullets.splice(+gd[1],1); render(); return;
  }
  if(t.dataset.ing!==undefined){
    var bits=t.dataset.ing.split('|'), pr=draft.catalogue.products[+bits[0]], nm=bits[1];
    pr.ingredients=pr.ingredients||[];
    var at=pr.ingredients.indexOf(nm);
    if(at>=0) pr.ingredients.splice(at,1); else pr.ingredients.push(nm);
    render(); refreshBar(); return;
  }
  if(t.dataset.stepadd!==undefined){
    var pa=draft.catalogue.products[+t.dataset.stepadd];
    pa.howto=(pa.howto||[]).concat(['']); render(); refreshBar();
    var boxes=document.querySelectorAll('[data-step^="'+t.dataset.stepadd+'|"]');
    if(boxes.length) boxes[boxes.length-1].focus();
    return;
  }
  if(t.dataset.stepdel!==undefined){
    var sb=t.dataset.stepdel.split('|'), ps=draft.catalogue.products[+sb[0]];
    ps.howto.splice(+sb[1],1); render(); refreshBar(); return;
  }

  if(t.id==='addnew'){
    var name=prompt('Product name'); if(!name) return;
    var slug=slugify(name);
    if(draft.catalogue.products.some(function(p){return p.slug===slug;})){
      toast('A product with that name already exists'); return; }
    draft.catalogue.products.push({slug:slug,name:name,size:'',tagline:'',badge:'',
      image:'',description:'',price_pence:0,ingredients:[],howto:[],active:false});
    draft.stock[slug]=null; openCard=slug; render();
    toast('Added. Fill it in, then tick "Show on the site".'); return;
  }
  if(t.dataset.toggle!==undefined){
    openCard = (openCard===t.dataset.toggle) ? null : t.dataset.toggle; render(); return;
  }
  if(t.dataset.del!==undefined){
    var p=draft.catalogue.products.filter(function(x){return x.slug===t.dataset.del;})[0];
    if(!confirm('Remove "'+(p?p.name:t.dataset.del)+'" from the shop? This cannot be undone once saved.')) return;
    draft.catalogue.products=draft.catalogue.products.filter(function(x){return x.slug!==t.dataset.del;});
    delete draft.stock[t.dataset.del]; delete uploads[t.dataset.del];
    openCard=null; render(); return;
  }
  if(t.dataset.upload!==undefined){
    var slug=t.dataset.upload;
    var f=document.createElement('input'); f.type='file'; f.accept='image/png,image/jpeg,image/webp';
    f.addEventListener('change',function(){
      var file=f.files[0]; if(!file) return;
      if(file.size>1500000){ toast('That image is over 1.5MB — please shrink it first'); return; }
      var rd=new FileReader();
      rd.onload=function(){ uploads[slug]=rd.result; render(); toast('Image ready — press Save'); };
      rd.readAsDataURL(file);
    });
    f.click(); return;
  }
  if(t.dataset.inc!==undefined||t.dataset.dec!==undefined){
    var sl=t.dataset.inc||t.dataset.dec, cur=draft.stock[sl];
    if(cur===null||cur===undefined) cur=0;
    draft.stock[sl]=Math.max(0, Number(cur)+(t.dataset.inc!==undefined?1:-1));
    render(); return;
  }
});

document.addEventListener('input',function(e){
  var t=e.target;
  if(t.dataset.i!==undefined&&t.dataset.f){
    var p=draft.catalogue.products[+t.dataset.i], f=t.dataset.f;
    if(f==='active') p[f]=t.checked;
    else if(f==='price_pence') p[f]=toPence(t.value);
    else p[f]=t.value;
    if(f==='name'||f==='price_pence'){
      var head=t.closest('.card').querySelector('.hmeta');
      head.querySelector('b').childNodes[0].nodeValue=p.name||'Untitled';
      head.querySelector('span').textContent='£'+pounds(p.price_pence)+(p.size?' · '+p.size:'');
    }
  }
  if(t.dataset.g!==undefined&&t.dataset.gf){
    var gl=LIB[+t.dataset.g], gf=t.dataset.gf;
    if(gf==='name'){
      var was=gl.name; gl.name=t.value;
      draft.catalogue.products.forEach(function(pp){
        pp.ingredients=(pp.ingredients||[]).map(function(n){return n===was?t.value:n;});});
    } else gl[gf]=t.value;
  }
  if(t.dataset.gb!==undefined){
    var gp=t.dataset.gb.split('|'); LIB[+gp[0]].bullets[+gp[1]]=t.value;
  }
  if(t.dataset.step!==undefined){
    var sp=t.dataset.step.split('|');
    draft.catalogue.products[+sp[0]].howto[+sp[1]]=t.value;
  }
  if(t.hasAttribute('data-stock')){
    draft.stock[t.dataset.stock]= t.value===''?null:Math.max(0,parseInt(t.value,10)||0);
    var b=t.closest('.hmeta')||t.closest('.head').querySelector('.hmeta');
    if(b){ var old=b.querySelector('.badge'); if(old) old.outerHTML=stockBadge(draft.stock[t.dataset.stock]); }
  }
  if(t.dataset.ship){ draft.settings.shipping=draft.settings.shipping||{};
    draft.settings.shipping[t.dataset.ship]=toPence(t.value); }
  if(t.dataset.free){ draft.settings.free_over=draft.settings.free_over||{};
    draft.settings.free_over[t.dataset.free]=toPence(t.value); }
  if(t.dataset.collect){ draft.settings.collect_address=t.value; }
  refreshBar();
});

document.querySelectorAll('nav button').forEach(function(b){
  b.addEventListener('click',function(){
    tab=b.dataset.tab; openCard=null;
    document.querySelectorAll('nav button').forEach(function(x){
      x.setAttribute('aria-selected',String(x===b)); });
    render(); window.scrollTo(0,0);
  });
});
document.getElementById('discard').addEventListener('click',function(){
  if(!confirm('Discard all unsaved changes?')) return;
  draft=clone({catalogue:S.catalogue,stock:S.stock,settings:S.settings});
  LIB=clone(S.ingredients||[]); uploads={}; iconUploads={};
  render(); toast('Changes discarded');
});
document.getElementById('save').addEventListener('click',async function(){
  var btn=this; btn.disabled=true; btn.textContent='Saving…';
  try{
    var r=await fetch('/admin',{method:'POST',
      headers:{'Content-Type':'application/json','x-admin-key':KEY},
      body:JSON.stringify({catalogue:draft.catalogue,stock:draft.stock,
        settings:draft.settings,images:uploads,
        ingredients:LIB.map(function(g){
          return Object.assign({},g,{icon_upload:iconUploads[g.slug]||undefined});})})});
    if(!r.ok) throw new Error('save failed');
    var res=await r.json();
    if(res.images) draft.catalogue.products.forEach(function(p){
      if(res.images[p.slug]) p.image=res.images[p.slug]; });
    if(res.images&&res.images.__ingredients){ LIB=res.images.__ingredients; }
    S.catalogue=clone(draft.catalogue); S.stock=clone(draft.stock);
    S.settings=clone(draft.settings); S.ingredients=clone(LIB);
    uploads={}; iconUploads={}; render(); toast('Saved — the site is updated');
  }catch(e){ toast('Save failed — nothing was changed'); }
  btn.disabled=false; btn.textContent='Save changes';
});
document.getElementById('lock').addEventListener('click',function(){
  sessionStorage.removeItem('drw_admin_key'); location.href='/admin';
});
window.addEventListener('beforeunload',function(e){
  if(dirtyCount()){ e.preventDefault(); e.returnValue=''; }
});
render();
</script></body></html>`;
}
