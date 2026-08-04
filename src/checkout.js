/**
 * /checkout — a page, not a panel.
 *
 * The bag shows what you picked. This shows what it will cost to get it to
 * you and takes the details needed to send it. Card capture is not here:
 * Teya hosts that, so this page ends at "Continue to payment".
 *
 * The basket is read from localStorage and re-priced by the Worker at
 * /create-session, so nothing here is trusted — the summary is a preview.
 */

import { PAYMARKS } from './paymarks.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function checkoutHtml(state) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Checkout · Drewrys</title>
<link rel="icon" type="image/png" href="/img/favicon.png">
<meta name="robots" content="noindex">
<style>
@import url('/fonts.css');
:root{
  --cotton:#F3EDE1;--cotton-2:#ECE3D3;--cream:#E7DABF;--cream-2:#DCC9A4;
  --peanut:#C79A6B;--peanut-deep:#9A6C3E;--slate:#2B3037;--slate-2:#20242A;
  --ink:#191C21;--muted:rgba(25,28,33,.55);--line:rgba(25,28,33,.16);
  --olive:#94876d;
}
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{font-family:"Geist",system-ui,sans-serif;background:var(--cotton);color:var(--ink);
  line-height:1.55;-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%}
a{color:inherit;text-decoration:none}
button{font-family:inherit;cursor:pointer;border:0;background:none;color:inherit}

/* masthead: title left with the form card, mark dead centre, button right
   over the summary column so it is out of the way */
.top{max-width:1180px;margin:0 auto;padding:26px 24px 0;
  display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:16px}
.top h1{font-family:"NeueMontreal",sans-serif;font-weight:500;letter-spacing:-.014em;
  text-transform:uppercase;font-size:clamp(1.9rem,4vw,2.6rem);line-height:1;
  justify-self:start;margin-bottom:-2px}
.mark{justify-self:center;text-align:center}
.mark img{height:60px;width:auto;margin:0 auto}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:700;
  font-size:.82rem;letter-spacing:.02em;padding:11px 20px;border-radius:40px;
  background:var(--slate);color:var(--cotton);transition:transform .18s,background .18s}
.btn:hover{background:var(--slate-2);transform:translateY(-1px)}
.btn.back{justify-self:end}
@media(max-width:900px){
  .top{grid-template-columns:1fr auto;grid-template-areas:"mark mark" "title back";
    row-gap:14px;padding-bottom:0}
  .top h1{grid-area:title}
  .mark{grid-area:mark}
  .btn.back{grid-area:back}
}

.grid{max-width:1180px;margin:10px auto 0;display:grid;grid-template-columns:1fr 390px;
  align-items:start;gap:34px;padding:0 24px 90px}
@media(max-width:900px){
  .grid{grid-template-columns:1fr;gap:24px;padding:0 20px 70px}
  .right{order:-1}
}

h2{font-family:"NeueMontreal",sans-serif;font-weight:500;letter-spacing:-.012em;
  font-size:1.42rem;line-height:1.1;margin:30px 0 13px}
.left > h2:first-child{margin-top:0}
label{display:block;font-size:.85rem;font-weight:600;color:var(--muted);margin:0 0 6px}
label .opt{font-weight:400}
input,select{width:100%;padding:12px 14px;border:1.5px solid var(--line);border-radius:12px;
  background:#fff;font-family:inherit;font-size:.95rem;color:var(--ink)}
input:focus,select:focus{outline:none;border-color:var(--peanut-deep)}
input::placeholder{color:rgba(25,28,33,.34)}
select{cursor:pointer}
.f{margin-bottom:11px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:11px}
@media(max-width:520px){.two{grid-template-columns:1fr}}

.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px 24px}
@media(max-width:520px){.card{padding:18px 17px;border-radius:16px}}

.opts{display:grid;grid-template-columns:1fr 1fr;gap:11px}
@media(max-width:520px){.opts{grid-template-columns:1fr}}
.ful{padding:13px 15px;border:1.5px solid var(--line);border-radius:14px;background:var(--cotton);
  text-align:left;transition:.18s}
.ful b{display:block;font-size:.95rem;font-weight:650}
.ful span{display:block;font-size:.79rem;color:var(--muted);margin-top:1px}
.ful.sel{border-color:var(--peanut-deep);background:rgba(199,154,107,.16)}

.svc{display:flex;align-items:center;gap:12px;width:100%;padding:13px 15px;
  border:1.5px solid var(--line);border-radius:14px;background:var(--cotton);
  text-align:left;margin-bottom:9px;transition:.18s}
.svc.sel{border-color:var(--peanut-deep);background:rgba(199,154,107,.16)}
.svc .dot{flex:0 0 auto;width:17px;height:17px;border-radius:50%;border:1.5px solid var(--line);position:relative}
.svc.sel .dot{border-color:var(--peanut-deep)}
.svc.sel .dot:after{content:"";position:absolute;inset:3px;border-radius:50%;background:var(--peanut-deep)}
.svc .n{display:block;font-weight:650;font-size:.93rem}
.svc .d{display:block;font-size:.79rem;color:var(--muted)}
.svc .p{margin-left:auto;font-weight:700;font-size:.93rem;color:var(--peanut-deep)}

.pcrow{display:flex;gap:9px}
.pcrow input{flex:1;min-width:0;text-transform:uppercase}
.pcrow input::placeholder,.promo input::placeholder{text-transform:none}
#find{flex:0 0 auto;padding:0 20px;border-radius:40px;background:var(--peanut);
  color:var(--slate);font-weight:700;font-size:.78rem;letter-spacing:.03em;text-transform:uppercase}
#find:disabled{opacity:.45;cursor:default}
.sugg{margin-top:9px;border:1.5px solid var(--line);border-radius:14px;background:#fff;
  max-height:210px;overflow:auto}
.sugg button{display:block;width:100%;text-align:left;padding:11px 14px;
  border-bottom:1px solid var(--line);font-size:.89rem}
.sugg button:last-child{border-bottom:0}
.sugg button:hover{background:var(--cotton)}

.hint{font-size:.78rem;color:var(--muted);margin-top:6px}
.msg{font-size:.84rem;margin-top:11px;color:var(--muted)}
.msg.warn{color:#8a3d3d;font-weight:650}
.collect{margin-top:11px;padding:13px 15px;border-radius:14px;background:var(--cotton);
  border:1px solid var(--line);font-size:.86rem;line-height:1.5}
.collect b{display:block;font-size:.78rem;color:var(--peanut-deep);font-weight:700;margin-bottom:3px}

.pay{width:100%;margin-top:24px;padding:16px;border-radius:40px;background:var(--slate);
  color:var(--cotton);font-size:.88rem;font-weight:700;letter-spacing:.02em;
  display:flex;align-items:center;justify-content:center;transition:.18s}
.pay:hover:not(:disabled){background:var(--slate-2);transform:translateY(-1px)}
.pay:disabled{opacity:.45;cursor:default}
.paymarks{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:8px}
.paymarks svg{width:59px;height:59px;display:block}
.paymarks svg[aria-label="American Express"]{width:49.5px;height:49.5px}
@media(max-width:620px){.paymarks{gap:6px}
  .paymarks svg{width:48px;height:48px}
  .paymarks svg[aria-label="American Express"]{width:40px;height:40px}}
@media(max-width:420px){.paymarks{gap:4px}
  .paymarks svg{width:40px;height:40px}
  .paymarks svg[aria-label="American Express"]{width:33px;height:33px}}
.secure{text-align:center;font-size:.79rem;color:var(--muted);margin-top:9px}

.right h2{margin-top:0}
.line{display:flex;gap:13px;align-items:center;margin-bottom:15px}
.shwrap{position:relative;flex:0 0 auto}
.line .sh{width:60px;height:60px;border-radius:13px;background:var(--cotton);
  border:1px solid var(--line);position:relative;overflow:hidden}
.line .sh img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:6px}
.line .q{position:absolute;top:-7px;right:-7px;min-width:22px;height:22px;border-radius:99px;
  background:var(--peanut);color:var(--slate);font-size:.72rem;font-weight:700;
  display:flex;align-items:center;justify-content:center;padding:0 6px}
.line .m{flex:1;min-width:0}
.line .m b{display:block;font-weight:650;font-size:.93rem;line-height:1.2}
.line .m span{display:block;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;
  color:var(--peanut-deep);font-weight:700;margin-top:2px}
.line .amt{font-weight:650;font-size:.93rem}
.tot{display:flex;justify-content:space-between;font-size:.9rem;margin-bottom:7px;color:var(--muted)}
.tot[hidden],[hidden]{display:none!important}
.tot.grand{font-size:1.15rem;font-weight:700;color:var(--ink);margin-top:10px;
  padding-top:10px;border-top:1px solid var(--line)}
.tot.grand span:last-child{color:var(--peanut-deep)}
.promo{display:flex;gap:9px;margin:17px 0 18px}
.promo input{flex:1;min-width:0;text-transform:uppercase}
.promo button{flex:0 0 auto;padding:0 20px;border-radius:40px;background:var(--peanut);
  color:var(--slate);font-weight:700;font-size:.78rem;letter-spacing:.03em;text-transform:uppercase}
.empty{padding:70px 24px;text-align:center;color:var(--muted)}
</style></head><body>
<div class="top">
  <h1>Checkout</h1>
  <div class="mark">
    <a href="/"><img src="/img/logo-d.png" alt="Drewrys"></a>
    ${PAYMARKS}
  </div>
  <a class="btn back" href="/">Continue shopping</a>
</div>

<div class="grid" id="grid" hidden>
  <div class="left card">
    <h2>Contact</h2>
    <div class="f"><label for="cEmail">Email</label>
      <input id="cEmail" type="email" autocomplete="email" placeholder="you@example.com"></div>
    <div class="two">
      <div class="f"><label for="cName">Name</label>
        <input id="cName" type="text" autocomplete="name" placeholder="Full name"></div>
      <div class="f"><label for="cPhone">Phone <span class="opt">(optional)</span></label>
        <input id="cPhone" type="tel" autocomplete="tel" placeholder="For the courier"></div>
    </div>

    <h2>How would you like it?</h2>
    <div class="opts">
      <button type="button" class="ful sel" data-ful="collect"><b>Collect in store</b><span>Free</span></button>
      <button type="button" class="ful" data-ful="deliver"><b>Delivery</b><span id="delFrom">Tracked</span></button>
    </div>
    <div class="collect" id="collectAddr" hidden></div>

    <div id="delBlock" hidden>
      <h2>Delivery address</h2>
      <div class="f"><label for="dest">Country</label>
        <select id="dest"></select>
        <p class="hint">We deliver to the Isle of Man, the UK and Europe.</p></div>
      <div class="f"><label for="pc">Postcode</label>
        <div class="pcrow"><input id="pc" autocomplete="postal-code" placeholder="IM1 1AA">
          <button type="button" id="find" hidden>Find</button></div>
        <div class="sugg" id="sugg" hidden></div></div>
      <div class="f"><label for="a1">Address</label>
        <input id="a1" autocomplete="address-line1" placeholder="Address line 1"></div>
      <div class="f"><input id="a2" autocomplete="address-line2" placeholder="Address line 2 (optional)"></div>
      <div class="f"><input id="aCity" autocomplete="address-level2" placeholder="Town or city"></div>

      <div id="svcBlock" hidden>
        <h2>Delivery method</h2>
        <div id="svcs"></div>
      </div>
    </div>

    <p class="msg" id="msg"></p>
    <button class="pay" id="pay" disabled>Continue to payment</button>
    <p class="secure">Payment is taken securely by Teya. We never see your card details.</p>
  </div>

  <div class="right card">
    <h2>Order summary</h2>
    <div id="lines" style="margin-top:18px"></div>
    <div class="promo">
      <input id="promoIn" placeholder="Discount code" autocomplete="off">
      <button type="button" id="promoBtn">Apply</button>
    </div>
    <p class="msg" id="promoMsg" hidden></p>
    <div class="tot"><span>Subtotal</span><span id="tSub">£0.00</span></div>
    <div class="tot" id="tDiscRow" hidden><span id="tDiscLabel">Discount</span><span id="tDisc"></span></div>
    <div class="tot"><span>Delivery</span><span id="tShip">&mdash;</span></div>
    <div class="tot grand"><span>Total</span><span id="tTotal">£0.00</span></div>
  </div>
</div>

<div class="empty" id="empty" hidden>
  <p>Your bag is empty.</p>
  <a href="/">Back to the shop</a>
</div>

<script>
const D=${JSON.stringify(state).replace(/</g, '\\u003c')};
const money=p=>'£'+(Number(p||0)/100).toFixed(2);
const bySlug=Object.fromEntries(D.products.map(p=>[p.slug,p]));
const byCode=Object.fromEntries((D.countries||[]).map(c=>[c.code,c]));
let FUL='collect', METHOD=null, PROMO=null, LINES=[];

/* the bag, as left by the shop */
try{
  LINES=(JSON.parse(localStorage.getItem('drw_cart_v1')||'[]')||[])
    .map(l=>({p:bySlug[l.slug],qty:Math.max(1,Math.min(99,l.qty|0))}))
    .filter(l=>l.p && l.p.active!==false);
}catch(e){ LINES=[]; }
const savedPromo=(()=>{try{return localStorage.getItem('drw_promo')||'';}catch(e){return '';}})();

if(!LINES.length){
  document.getElementById('empty').hidden=false;
} else {
  document.getElementById('grid').hidden=false;
  if(savedPromo){ document.getElementById('promoIn').value=savedPromo; applyPromo(true); }
  start();
}

function subtotal(){ return LINES.reduce((s,l)=>s+l.p.price_pence*l.qty,0); }
function zoneName(id){ const z=(D.zones||[]).find(z=>z.id===id); return z?z.name:''; }
function methodsFor(z){ return (D.methods||[]).filter(m=>m.zone===z); }
function isIOM(pc){ return /^\\s*IM\\d/i.test(pc||''); }

/* mirrors resolveZone() in the Worker */
/* mirrors resolveZone() in the Worker */
function currentZone(){
  const pc=(document.getElementById('pc').value||'').trim();
  const code=document.getElementById('dest').value;
  if(isIOM(pc)) return (D.zones||[]).some(z=>z.id==='iom')?{zone:'iom'}
    :{error:'We cannot deliver to the Isle of Man at the moment.'};
  const c=byCode[code];
  if(!c) return {error:'Choose the country it is going to'};
  if(c.code==='IM') return {error:'That is not an Isle of Man postcode'};
  if(!c.zone) return {error:'We do not deliver to '+c.name+' yet'};
  if(!(D.zones||[]).some(z=>z.id===c.zone)) return {error:'We cannot deliver to '+c.name+' at the moment'};
  return {zone:c.zone};
}

function shipping(){
  if(FUL==='collect') return {cost:0,label:'Free'};
  const pc=(document.getElementById('pc').value||'').trim();
  if(!pc) return {cost:null,label:'Enter a postcode'};
  const z=currentZone();
  if(z.error) return {cost:null,label:z.error};
  const list=methodsFor(z.zone);
  if(!list.length) return {cost:null,label:'Not available'};
  const m=list.find(x=>x.id===METHOD)||(list.length===1?list[0]:null);
  if(!m) return {cost:null,label:'Choose a method'};
  const thr=(D.free_over||{})[z.zone];
  const disc=PROMO?Math.round(subtotal()*PROMO.pct/100):0;
  if(thr && subtotal()-disc>=thr) return {cost:0,label:'Free'};
  return {cost:m.price,label:m.name};
}

function problem(){
  const v=id=>(document.getElementById(id).value||'').trim();
  if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(v('cEmail'))) return 'Enter a valid email address';
  if(!v('cName')) return 'Enter your name';
  if(FUL!=='deliver') return null;
  if(!v('pc')) return 'Enter your postcode';
  if(!v('a1')) return 'Enter your address';
  if(!v('aCity')) return 'Enter your town or city';
  if(shipping().cost===null) return shipping().label;
  return null;
}

function renderLines(){
  document.getElementById('lines').innerHTML=LINES.map(l=>
    '<div class="line"><div class="shwrap"><div class="sh">'+
    '<img src="'+l.p.image+'" alt=""></div><span class="q">'+l.qty+'</span></div>'+
    '<div class="m"><b>'+esc(l.p.name)+'</b><span>'+esc(l.p.size||'')+'</span></div>'+
    '<span class="amt">'+money(l.p.price_pence*l.qty)+'</span></div>').join('');
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function renderServices(){
  const block=document.getElementById('svcBlock'), box=document.getElementById('svcs');
  const z=currentZone();
  const list=z.zone?methodsFor(z.zone):[];
  if(FUL!=='deliver'||list.length<2){ block.hidden=true;
    METHOD=list.length===1?list[0].id:null; return; }
  if(!list.some(m=>m.id===METHOD)) METHOD=null;
  block.hidden=false;
  box.innerHTML=list.map(m=>'<button type="button" class="svc'+(m.id===METHOD?' sel':'')+
    '" data-svc="'+m.id+'"><span class="dot"></span><span><span class="n">'+esc(m.name)+
    '</span>'+(m.note?'<span class="d">'+esc(m.note)+'</span>':'')+'</span>'+
    '<span class="p">'+money(m.price)+'</span></button>').join('');
  box.querySelectorAll('[data-svc]').forEach(b=>b.addEventListener('click',()=>{
    METHOD=b.dataset.svc; renderServices(); refresh(); }));
}

function refresh(){
  const sub=subtotal(), sh=shipping();
  const disc=PROMO?Math.round(sub*PROMO.pct/100):0;
  document.getElementById('tSub').textContent=money(sub);
  const dr=document.getElementById('tDiscRow');
  if(disc>0){ dr.hidden=false;
    document.getElementById('tDiscLabel').textContent=
      PROMO.code==='PAIRED10'?'Pairs well discount':'Discount ('+PROMO.code+')';
    document.getElementById('tDisc').textContent='\\u2212'+money(disc);
  } else dr.hidden=true;
  document.getElementById('tShip').textContent=
    sh.cost===null?sh.label:(sh.cost===0?'Free':money(sh.cost));
  document.getElementById('tTotal').textContent=money(Math.max(0,sub-disc)+(sh.cost||0));

  const p=problem();
  const msg=document.getElementById('msg');
  msg.textContent=p||'';
  msg.className='msg'+(p?' warn':'');
  document.getElementById('pay').disabled=!!p;

  const btn=document.getElementById('find');
  const c=byCode[document.getElementById('dest').value];
  btn.hidden=!(D.address_lookup && c && (c.code==='IM'||c.code==='GB'));
}

function applyPromo(silent){
  const code=(document.getElementById('promoIn').value||'').trim().toUpperCase();
  const msg=document.getElementById('promoMsg');
  const pct=(D.promos||{})[code];
  if(pct){ PROMO={code,pct}; msg.hidden=false; msg.className='msg';
    msg.textContent=pct+'% off applied.'; }
  else { PROMO=null; if(!silent){ msg.hidden=false; msg.className='msg warn';
    msg.textContent='That code is not recognised.'; } else msg.hidden=true; }
  refresh();
}

function start(){
  renderLines();
  const sel=document.getElementById('dest');
  sel.innerHTML=(D.countries||[])
    .map(c=>'<option value="'+c.code+'">'+esc(c.name)+'</option>').join('');
  sel.value='IM';
  const cheapest=(D.methods||[]).reduce((a,m)=>a===null||m.price<a?m.price:a,null);
  if(cheapest!==null) document.getElementById('delFrom').textContent='Tracked, from '+money(cheapest);

  document.querySelectorAll('[data-ful]').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('[data-ful]').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel'); FUL=b.dataset.ful;
    document.getElementById('delBlock').hidden = FUL!=='deliver';
    const ca=document.getElementById('collectAddr');
    const addr=(D.collect_address||'').trim();
    if(FUL==='collect'&&addr){ ca.hidden=false;
      ca.innerHTML='<b>Collect from</b>'+addr.split(/\\s*,\\s*/).map(esc).join('<br>');
    } else { ca.hidden=true; }
    renderServices(); refresh();
  }));
  document.querySelector('[data-ful="collect"]').click();

  ['cEmail','cName','cPhone','a1','a2','aCity','pc'].forEach(id=>
    document.getElementById(id).addEventListener('input',()=>{
      document.getElementById('sugg').hidden=true; renderServices(); refresh(); }));
  sel.addEventListener('change',()=>{
    const c=byCode[sel.value];
    const z=c&&c.zone?(D.zones||[]).find(z=>z.id===c.zone):null;
    document.getElementById('pc').placeholder=z&&z.placeholder?z.placeholder:'Postal code';
    renderServices(); refresh();
  });
  document.getElementById('promoBtn').addEventListener('click',()=>applyPromo(false));

  document.getElementById('find').addEventListener('click',async function(){
    const pc=(document.getElementById('pc').value||'').trim();
    if(!pc) return;
    const b=this, was=b.textContent; b.disabled=true; b.textContent='...';
    const sugg=document.getElementById('sugg');
    try{
      const r=await fetch('/api/address?postcode='+encodeURIComponent(pc));
      const d=await r.json();
      if(!d.addresses||!d.addresses.length){
        const m=document.getElementById('msg');
        m.textContent=d.error||'No addresses found. Please type it in.'; m.className='msg warn';
        sugg.hidden=true;
      } else {
        sugg.innerHTML=d.addresses.map((a,i)=>'<button type="button" data-a="'+i+'">'+
          esc(a.label)+'</button>').join('');
        sugg.hidden=false;
        sugg.querySelectorAll('[data-a]').forEach(x=>x.addEventListener('click',()=>{
          const a=d.addresses[+x.dataset.a];
          document.getElementById('a1').value=a.line1;
          document.getElementById('a2').value=a.line2;
          document.getElementById('aCity').value=a.city;
          document.getElementById('pc').value=a.postcode;
          sugg.hidden=true; renderServices(); refresh();
        }));
      }
    }catch(e){
      const m=document.getElementById('msg');
      m.textContent='Lookup unavailable, please type your address.'; m.className='msg warn';
    }
    b.disabled=false; b.textContent=was;
  });

  document.getElementById('pay').addEventListener('click',async function(){
    if(problem()) return;
    const b=this, was=b.textContent; b.disabled=true; b.textContent='Taking you to payment…';
    const v=id=>(document.getElementById(id).value||'').trim();
    try{
      const r=await fetch('/create-session',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          lines:LINES.map(l=>({sku:l.p.slug,qty:l.qty})),
          fulfilment:FUL, country:document.getElementById('dest').value, method:METHOD||'',
          name:v('cName'), email:v('cEmail'), phone:v('cPhone'),
          line1:v('a1'), line2:v('a2'), city:v('aCity'), postcode:v('pc'),
          promo:PROMO?PROMO.code:''
        })});
      const d=await r.json();
      if(!r.ok||!d.url) throw new Error(d.error||'Could not start payment');
      try{ localStorage.removeItem('drw_cart_v1'); localStorage.removeItem('drw_promo'); }catch(e){}
      location.href=d.url;
    }catch(e){
      const m=document.getElementById('msg');
      m.textContent=e.message||'Could not reach payment, please try again.'; m.className='msg warn';
      b.disabled=false; b.textContent=was;
    }
  });

  refresh();
}
</script></body></html>`;
}
