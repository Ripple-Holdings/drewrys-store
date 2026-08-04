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

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function checkoutHtml(state) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Checkout · Drewrys</title>
<link rel="icon" type="image/png" href="/img/favicon.png">
<meta name="robots" content="noindex">
<style>
:root{--cotton:#F3EDE1;--cotton-2:#ECE3D3;--cream:#E7DABF;--ink:#191C21;
  --peanut:#C79A6B;--peanut-deep:#9A6C3E;--line:rgba(25,28,33,.16);
  --muted:rgba(25,28,33,.58);--olive:#94876d}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:var(--peanut-deep)}
.top{border-bottom:1px solid var(--line);background:#fff}
.top .in{max-width:1120px;margin:0 auto;padding:15px 24px;display:flex;align-items:center;gap:14px}
.top img{height:30px;display:block}
.top .sp{flex:1}
.top a{font-size:14px;font-weight:600;color:var(--ink);text-decoration:none}

.grid{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:1fr 400px;
  align-items:start;gap:0}
.left{padding:34px 40px 90px}
.right{padding:34px 24px 90px 32px;background:var(--cotton);border-left:1px solid var(--line);
  min-height:100vh;position:sticky;top:0}
@media(max-width:900px){
  .grid{grid-template-columns:1fr}
  .right{position:static;min-height:0;border-left:0;border-bottom:1px solid var(--line);
    padding:22px 22px 26px;order:-1}
  .left{padding:24px 22px 80px}
}

h1{font-size:1.05rem;font-weight:650;letter-spacing:.01em}
h2{font-size:1.02rem;font-weight:650;margin:30px 0 12px}
h2:first-of-type{margin-top:0}
label{display:block;font-size:.74rem;font-weight:700;letter-spacing:.07em;
  text-transform:uppercase;color:var(--muted);margin:0 0 6px}
input{width:100%;padding:12px 14px;border:1.5px solid var(--line);border-radius:11px;
  background:#fff;font-family:inherit;font-size:.95rem;color:var(--ink)}
input:focus{outline:none;border-color:var(--peanut-deep)}
input::placeholder{color:rgba(25,28,33,.36)}
.f{margin-bottom:10px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:520px){.two{grid-template-columns:1fr}}

.opts{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:520px){.opts{grid-template-columns:1fr}}
.opt{padding:13px 15px;border:1.5px solid var(--line);border-radius:12px;background:#fff;
  cursor:pointer;text-align:left;font-family:inherit;color:var(--ink)}
.opt b{display:block;font-size:.93rem;font-weight:650}
.opt span{display:block;font-size:.78rem;color:var(--muted);margin-top:1px}
.opt.sel{border-color:var(--peanut-deep);background:var(--cotton)}
#delBlock,#svcBlock{margin-top:4px}

.svc{display:flex;align-items:center;gap:12px;width:100%;padding:13px 15px;
  border:1.5px solid var(--line);border-radius:12px;background:#fff;cursor:pointer;
  text-align:left;font-family:inherit;color:var(--ink);margin-bottom:8px}
.svc.sel{border-color:var(--peanut-deep);background:var(--cotton)}
.svc .dot{flex:0 0 auto;width:17px;height:17px;border-radius:50%;border:1.5px solid var(--line);position:relative}
.svc.sel .dot{border-color:var(--peanut-deep)}
.svc.sel .dot:after{content:"";position:absolute;inset:3px;border-radius:50%;background:var(--peanut-deep)}
.svc .n{display:block;font-weight:650;font-size:.92rem}
.svc .d{display:block;font-size:.78rem;color:var(--muted)}
.svc .p{margin-left:auto;font-weight:700;font-size:.92rem}

.pcrow{display:flex;gap:9px}
.pcrow input{flex:1;min-width:0;text-transform:uppercase}
#find{flex:0 0 auto;padding:0 18px;border-radius:11px;border:1.5px solid var(--ink);
  background:var(--ink);color:var(--cotton);font-family:inherit;font-weight:650;
  font-size:.86rem;cursor:pointer}
#find:disabled{opacity:.45;cursor:default}
.sugg{margin-top:8px;border:1.5px solid var(--line);border-radius:11px;background:#fff;
  max-height:210px;overflow:auto}
.sugg button{display:block;width:100%;text-align:left;padding:11px 14px;border:0;
  border-bottom:1px solid var(--line);background:none;font-family:inherit;font-size:.88rem;
  cursor:pointer;color:var(--ink)}
.sugg button:last-child{border-bottom:0}
.sugg button:hover{background:var(--cotton)}

.msg{font-size:.82rem;margin-top:9px;color:var(--muted)}
.msg.warn{color:#8a3d3d;font-weight:650}
.collect{margin-top:10px;padding:12px 14px;border-radius:12px;background:var(--cotton);
  border:1px solid var(--line);font-size:.85rem;line-height:1.5}
.collect b{display:block;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;
  color:var(--muted);font-weight:700;margin-bottom:3px}

.pay{width:100%;margin-top:26px;padding:16px;border:0;border-radius:13px;background:var(--ink);
  color:var(--cotton);font-family:inherit;font-size:1rem;font-weight:650;cursor:pointer}
.pay:disabled{opacity:.4;cursor:default}
.secure{text-align:center;font-size:.78rem;color:var(--muted);margin-top:11px}

.line{display:flex;gap:13px;align-items:center;margin-bottom:14px}
.line .sh{flex:0 0 auto;width:58px;height:58px;border-radius:11px;background:#fff;
  border:1px solid var(--line);position:relative;overflow:hidden}
.line .sh img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:6px}
.line .q{position:absolute;top:-7px;right:-7px;min-width:21px;height:21px;border-radius:99px;
  background:var(--olive);color:var(--cotton);font-size:.72rem;font-weight:700;
  display:flex;align-items:center;justify-content:center;padding:0 5px}
.line .m{flex:1;min-width:0}
.line .m b{display:block;font-size:.89rem;font-weight:650}
.line .m span{font-size:.78rem;color:var(--muted)}
.line .amt{font-weight:650;font-size:.89rem}
.shwrap{position:relative}
.tot{display:flex;justify-content:space-between;font-size:.9rem;margin-top:9px}
.tot[hidden],[hidden]{display:none!important}
.tot.grand{font-size:1.15rem;font-weight:700;margin-top:14px;padding-top:14px;
  border-top:1px solid var(--line)}
.promo{display:flex;gap:8px;margin:16px 0 18px}
.promo input{flex:1;min-width:0;text-transform:uppercase}
.promo button{flex:0 0 auto;padding:0 17px;border-radius:11px;border:1.5px solid var(--line);
  background:#fff;font-family:inherit;font-weight:650;font-size:.86rem;cursor:pointer;color:var(--ink)}
.empty{padding:60px 24px;text-align:center;color:var(--muted)}
.empty a{display:inline-block;margin-top:14px;font-weight:650}
</style></head><body>
<div class="top"><div class="in">
  <a href="/"><img src="/img/logo-d.png" alt="Drewrys"></a>
  <span class="sp"></span><a href="/">&larr; Continue shopping</a>
</div></div>

<div class="grid" id="grid" hidden>
  <div class="left">
    <h2>Contact</h2>
    <div class="f"><label for="cEmail">Email</label>
      <input id="cEmail" type="email" autocomplete="email" placeholder="you@example.com"></div>
    <div class="two">
      <div class="f"><label for="cName">Name</label>
        <input id="cName" type="text" autocomplete="name" placeholder="Full name"></div>
      <div class="f"><label for="cPhone">Phone <span style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label>
        <input id="cPhone" type="tel" autocomplete="tel" placeholder="For the courier"></div>
    </div>

    <h2>How would you like it?</h2>
    <div class="opts">
      <button type="button" class="opt sel" data-ful="collect"><b>Collect in store</b><span>Free</span></button>
      <button type="button" class="opt" data-ful="deliver"><b>Delivery</b><span id="delFrom">Tracked</span></button>
    </div>
    <div class="collect" id="collectAddr" hidden></div>

    <div id="delBlock" hidden>
      <h2>Delivery address</h2>
      <div class="f"><label for="dest">Country or region</label>
        <select id="dest" style="width:100%;padding:12px 14px;border:1.5px solid var(--line);
          border-radius:11px;background:#fff;font-family:inherit;font-size:.95rem"></select></div>
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

  <div class="right">
    <h1>Order summary</h1>
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
function currentZone(){
  const pc=(document.getElementById('pc').value||'').trim();
  const claimed=document.getElementById('dest').value;
  if(isIOM(pc)) return (D.zones||[]).some(z=>z.id==='iom')?{zone:'iom'}
    :{error:'We cannot deliver to the Isle of Man at the moment.'};
  if(claimed==='iom') return {error:'That is not an Isle of Man postcode.'};
  if(!(D.zones||[]).some(z=>z.id===claimed)) return {error:'We cannot deliver there yet.'};
  return {zone:claimed};
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
  const dest=document.getElementById('dest').value;
  btn.hidden=!(D.address_lookup && (dest==='iom'||dest==='uk'));
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
  sel.innerHTML=(D.zones||[]).map(z=>'<option value="'+z.id+'">'+esc(z.name)+'</option>').join('');
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
    const z=(D.zones||[]).find(z=>z.id===sel.value);
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
          fulfilment:FUL, region:document.getElementById('dest').value, method:METHOD||'',
          name:v('cName'), email:v('cEmail'), phone:v('cPhone'),
          line1:v('a1'), line2:v('a2'), city:v('aCity'), postcode:v('pc'),
          country:zoneName((currentZone()||{}).zone||''),
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
