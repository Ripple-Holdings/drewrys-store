/**
 * Admin UI for the Drewrys store.
 *
 * Kept in its own module because it is mostly markup - index.js stays about
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

import { DASH_CSS, DASH_JS } from './dashboard.js';

export const GATE = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Drewrys · Admin</title>
<link rel="icon" type="image/png" href="/img/favicon.png">
<link rel="stylesheet" href="/fonts.css">
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:#191C21;font-family:'Geist',system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.gate{width:320px;max-width:88vw;text-align:center;color:#F3EDE1}
.mark{width:76px;margin:0 auto 20px;display:block}
h1{font-family:'NeueMontreal','Geist',system-ui,sans-serif;font-size:19px;margin:0 0 6px;font-weight:500;letter-spacing:-.01em}
p{color:#9a948a;font-size:13px;margin:0 0 22px}
input{width:100%;padding:14px 16px;font-size:20px;letter-spacing:.3em;text-align:center;
  border:1px solid #3a3630;background:#111417;color:#F3EDE1;border-radius:11px;outline:none}
input:focus{border-color:#C79A6B}
button{width:100%;margin-top:12px;padding:13px;font-family:'NeueMontreal','Geist',system-ui,sans-serif;font-size:15px;font-weight:500;
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
<link rel="stylesheet" href="/fonts.css">
<style>
:root{--cotton:#F3EDE1;--cotton-2:#ECE3D3;--ink:#191C21;--peanut:#C79A6B;
  --olive:#94876d;--line:#e0d6c4;--muted:#6f6a62}
*{box-sizing:border-box}
button{font-family:'NeueMontreal','Geist',system-ui,sans-serif}
body{margin:0;background:var(--cotton);color:var(--ink);
  font-family:'Geist',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding-bottom:104px}
header{position:sticky;top:0;z-index:20;background:var(--ink);color:var(--cotton);
  padding:11px 18px;display:flex;align-items:center;gap:11px}
header img{height:26px;width:auto;display:block;filter:invert(1) brightness(1.6)}
header .sub{color:#9a948a;font-size:13px}
header .sp{flex:1}
header button{background:none;border:1px solid #4a453d;color:var(--cotton);
  padding:8px 14px;border-radius:9px;font-size:13px;cursor:pointer;min-height:40px}
nav{position:sticky;top:48px;z-index:19;background:var(--cotton);
  display:flex;gap:8px;padding:12px 18px;border-bottom:1px solid var(--line);flex-wrap:wrap}
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
.hmeta b{display:block;font-family:'NeueMontreal','Geist',system-ui,sans-serif;font-size:15px;font-weight:500;letter-spacing:-.01em}
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
.prow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 20px;align-items:end}
.prow+.prow{margin-top:18px}
.prow+.check{margin-top:20px}
.badge.usebadge{font-size:13px;padding:5px 13px;margin-left:10px;vertical-align:2px}
.prow label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:680px){.prow{grid-template-columns:1fr}}
.danger{margin-top:16px;background:none;border:1px solid #e3c9c9;color:#a33;
  padding:9px 15px;border-radius:9px;font-size:13.5px;cursor:pointer;min-height:44px;width:auto}
.stars{color:var(--peanut);letter-spacing:1px}
.stars .off{color:var(--line)}
.quote{background:var(--cotton);border-radius:12px;padding:13px 15px;font-size:14.5px;
  line-height:1.6;font-style:italic}
.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.ofilter{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.ofilter button{border:1px solid var(--line);background:#fff;color:var(--muted);
  padding:8px 15px;border-radius:99px;font-size:13.5px;cursor:pointer;min-height:40px}
.ofilter button.on{background:var(--ink);color:var(--cotton);border-color:var(--ink)}
.addr{font-size:14px;line-height:1.6}
.fulfil{margin-top:14px;width:100%;padding:13px;border:0;border-radius:11px;
  background:var(--ink);color:var(--cotton);font-size:15px;font-weight:650;cursor:pointer;min-height:48px}
.fulfil:disabled{opacity:.5;cursor:default}
.fulfil.inline{display:inline-flex;align-items:center;justify-content:center;width:auto;
  margin-top:0;padding:0 22px;height:44px;min-height:44px;border-radius:10px;font-size:14px}
.doneline{margin-top:12px;padding:11px 13px;border-radius:11px;background:#e9f0e6;
  font-size:13.5px;color:#2c5c2c}
.refline{margin-top:12px;padding:13px 15px;border-radius:11px;background:#f7e2e2;
  font-size:14px;color:#6e2320;line-height:1.6}
.refline b{font-size:15px;letter-spacing:.2px}
.ghost{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);
  background:#fff;color:var(--ink);padding:0 18px;border-radius:10px;font-size:14px;
  cursor:pointer;height:44px;font-family:'NeueMontreal','Geist',system-ui,sans-serif}
.ghost:hover{background:var(--cotton)}
/* VAT date range picker */
.calwrap{position:relative;margin-top:-4px;margin-bottom:14px}
button.calbtn{width:auto;min-height:0;margin:0;display:inline-flex;align-items:center;gap:10px}
.calcar{font-size:11px;color:var(--muted)}
.calpop{position:absolute;z-index:40;top:calc(100% + 8px);left:0;display:flex;
  background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;
  box-shadow:0 24px 60px -24px rgba(25,28,33,.45)}
.calside{display:flex;flex-direction:column;border-right:1px solid var(--line);
  padding:8px 0;min-width:150px;background:#fff}
.calside button{width:calc(100% - 12px);min-height:0;margin:2px 6px;border:0;border-radius:9px;
  background:var(--cotton-2);
  text-align:left;padding:9px 18px;font-size:13.5px;color:var(--ink);cursor:pointer;
  font-family:'NeueMontreal','Geist',system-ui,sans-serif}
.calside button:hover{background:var(--cotton)}
button.calapply{width:auto;min-height:0;margin:0;padding:8px 18px;border:0;border-radius:99px;
  background:var(--ink);color:var(--cotton);font-size:13px;font-weight:600;cursor:pointer;
  font-family:'NeueMontreal','Geist',system-ui,sans-serif}
button.calapply:hover{background:#000}
button.calapply:disabled{opacity:.35;cursor:default}
.calside button.on{background:var(--ink);color:var(--cotton)}
.calmain{padding:14px 16px 10px}
.calhead{display:flex;align-items:center;gap:8px;padding:0 4px 10px}
.calmon{font-size:14.5px;font-weight:600;min-width:118px;text-align:center}
.calgap{flex:1}
button.calnav{width:28px;height:28px;min-height:0;margin:0;padding:0;border:0;border-radius:99px;
  background:var(--cotton-2);
  color:var(--muted);font-size:14px;cursor:pointer;border-radius:7px}
button.calnav:hover{background:var(--cotton);color:var(--ink)}
.calgrids{display:flex;gap:26px}
.calgrid{border-collapse:collapse}
.calgrid th{font-size:12px;font-weight:500;color:var(--muted);padding:4px 0;
  text-align:center;text-transform:none;letter-spacing:0}
.calgrid td{padding:1px;border:0}
.calgrid td.pad{width:34px}
.calgrid td button{width:34px;height:32px;min-height:0;margin:0;padding:0;border:0;
  background:none;border-radius:8px;font-size:13.5px;color:var(--ink);cursor:pointer;
  font-family:'Geist',system-ui,sans-serif}
.calgrid td button:hover{background:var(--cotton)}
.calgrid td button.today{box-shadow:inset 0 0 0 1px var(--peanut)}
.calgrid td button.mid{background:var(--cotton-2);border-radius:0}
.calgrid td button.end{background:var(--ink);color:var(--cotton)}
.calfoot{display:flex;align-items:center;gap:10px;border-top:1px solid var(--line);
  margin-top:10px;padding:12px 4px 4px}
.calfield{font-size:13px;color:var(--muted);padding-bottom:3px;min-width:96px;
  border-bottom:2px solid transparent}
.calfield.act{color:var(--ink);border-bottom-color:var(--ink)}
.calarrow{color:var(--muted);font-size:13px}
button.callink{width:auto;min-height:0;margin:0;padding:7px 14px;border:1px solid var(--line);
  background:#fff;border-radius:999px;color:var(--ink);font-size:13px;cursor:pointer}
button.callink:hover{background:var(--cotton)}
@media(max-width:820px){
  .calpop{flex-direction:column;left:0;right:0}
  .calside{flex-direction:row;flex-wrap:wrap;border-right:0;
    border-bottom:1px solid var(--line);padding:8px}
  .calside button{width:auto;border-radius:99px;padding:7px 13px}
  .calgrids{flex-direction:column;gap:14px}
}
/* Destructive actions in a red pill, sized so they never compete with the big
   black fulfilment button above them. */
button.tiny{width:auto;min-height:0;margin:0;background:#9A3B34;
  border:0;padding:8px 17px;border-radius:999px;
  font-family:'NeueMontreal','Geist',system-ui,sans-serif;
  font-size:13px;font-weight:600;color:#fff;cursor:pointer}
button.tiny:hover{background:#7f2f29}
button.pill-danger{width:auto;min-height:0;margin-top:14px;background:#9A3B34;
  border:0;padding:12px 24px;border-radius:999px;
  font-family:'NeueMontreal','Geist',system-ui,sans-serif;
  font-size:14.5px;font-weight:600;color:#fff;cursor:pointer}
button.pill-danger:hover{background:#7f2f29}
button.pill-danger:disabled{opacity:.6;cursor:default}
.panel--tight{margin-top:10px;padding:16px;background:var(--cotton);
  border:1px solid var(--line);border-radius:12px}
.ghost.del{background:#a33b30;border-color:#a33b30;color:#fff}
.ghost.del:hover{background:#8f3128;border-color:#8f3128}
.svcrow{display:flex;gap:9px;align-items:flex-start;margin-top:9px}
.svcmain{flex:1;min-width:0;display:grid;gap:6px}
.svcp{flex:0 0 118px}
.svcrow .x{flex:0 0 auto;width:44px;height:44px;border:1px solid var(--line);background:#fff;
  border-radius:9px;cursor:pointer;color:var(--muted);font-size:17px}
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
.hint{font-size:12px;color:var(--muted);margin:7px 0;line-height:1.5}
.steps{counter-reset:s}
.steprow{display:flex;gap:9px;align-items:flex-start;margin-top:8px}
.steprow .num{flex:0 0 auto;width:28px;height:44px;display:flex;align-items:center;
  justify-content:center;font-weight:600;color:var(--peanut);font-size:15px}
.steprow textarea{min-height:44px}
.steprow .x{flex:0 0 auto;width:44px;height:44px;border:1px solid var(--line);background:#fff;
  border-radius:9px;cursor:pointer;color:var(--muted);font-size:17px}
.addstep{margin:12px 0 16px;background:#C79A6B;border:0;color:#191C21;font-weight:600;
  padding:10px 17px;border-radius:999px;font-size:13.5px;cursor:pointer;min-height:44px;width:auto}
.addstep:hover{background:#b8895a}
.upload{display:flex;align-items:center;gap:11px;margin-top:6px}
.upload button{background:var(--cotton-2);border:1px solid var(--line);color:var(--ink);
  padding:9px 15px;border-radius:9px;font-size:13.5px;cursor:pointer;min-height:44px;width:auto}
.addnew{width:100%;padding:14px;border:0;background:#C79A6B;color:#191C21;
  border-radius:999px;font-size:14.5px;font-weight:600;cursor:pointer;min-height:52px;margin-bottom:12px}
.addnew:hover{background:#b8895a}

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
  padding:12px 18px;display:flex;align-items:center;gap:11px;
  animation:sbup .18s ease-out}
@keyframes sbup{from{transform:translateY(100%)}to{transform:translateY(0)}}
.savebar[hidden]{display:none!important}
.savebar .sp.clean{color:#9a948a}
.savebar .disc[hidden]{display:none}
.savebar .sp{flex:1;font-size:14px}
.savebar button{padding:12px 20px;border-radius:10px;border:0;font-size:15px;
  font-weight:600;cursor:pointer;min-height:46px}
.savebar .save{background:var(--peanut);color:var(--ink)}
.savebar .disc{background:none;border:1px solid #4a453d;color:var(--cotton)}
.toast{position:fixed;bottom:104px;left:50%;transform:translateX(-50%);z-index:40;
  background:var(--ink);color:var(--cotton);padding:12px 20px;border-radius:11px;
  font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.on{opacity:1}
${DASH_CSS}
</style></head><body>
<header>
  <img src="/img/logo-d.png" alt="Drewrys">
  <span class="sub">admin</span><span class="sp"></span>
  <button id="lock">Lock</button>
</header>
<nav>
  <button data-tab="dashboard" aria-selected="true">Dashboard</button>
  <button data-tab="catalogue" aria-selected="false">Catalogue</button>
  <button data-tab="ingredients" aria-selected="false">Ingredients</button>
  <button data-tab="stock" aria-selected="false">Stock</button>
  <button data-tab="delivery" aria-selected="false">Delivery</button>
  <button data-tab="discounts" aria-selected="false">Discounts</button>
  <button data-tab="orders" aria-selected="false">Orders</button>
  <button data-tab="vat" aria-selected="false">VAT</button>
  <button data-tab="reviews" aria-selected="false">Reviews</button>
  <button data-tab="leads" aria-selected="false">Signups</button>
</nav>
<main id="main"></main>
<div class="savebar" id="savebar" hidden><span class="sp" id="dirty"></span>
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
var tab='dashboard', openCard=null, orderView='todo', revView='pending', DIAG=null,
    REFUND_FOR=null, VAT=null, VATR=null, CALOPEN=false, CALM=null, CALPICK=null;

// VAT date picker helpers. Everything is a plain YYYY-MM-DD string in UTC:
// building from a local Date and slicing toISOString shifts the day behind UTC
// and would drop a day at the very edge of a VAT period.
var MONTHS=['January','February','March','April','May','June','July','August',
  'September','October','November','December'];
function pad2(n){ return (n<10?'0':'')+n; }
function ymdOf(d){ return d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1)+'-'+pad2(d.getUTCDate()); }
function todayYmd(){ var d=new Date(); d.setUTCHours(12,0,0,0); return ymdOf(d); }
function shiftDays(n){ var d=new Date(); d.setUTCHours(12,0,0,0);
  d.setUTCDate(d.getUTCDate()-n); return ymdOf(d); }
function monthName(y,m){ return MONTHS[m]+' '+y; }
function nextY(c){ return c.m===11 ? c.y+1 : c.y; }
function nextM(c){ return c.m===11 ? 0 : c.m+1; }

// The last six quarters, worked out here rather than taken from the server, so
// the tab still works if an older build is live. Six covers Q1 to Q4 whatever
// month it is.
// One source for the quarter list, used by the render AND the click handler.
// They had drifted: the buttons drew from the fallback while the handler still
// looked in S.vat_periods, so a quarter click quietly did nothing.
function vatPeriodList(){
  return (S.vat_periods&&S.vat_periods.length)?S.vat_periods:localQuarters();
}

function localQuarters(){
  var out=[], now=new Date(), y=now.getUTCFullYear(), q=Math.floor(now.getUTCMonth()/3), i;
  for(i=0;i<6;i++){
    var qq=q-i, yy=y;
    while(qq<0){ qq+=4; yy-=1; }
    var sm=qq*3;
    var end=new Date(Date.UTC(yy,sm+3,0));
    out.push({id:yy+'-Q'+(qq+1), label:'Q'+(qq+1)+' '+yy,
      from:yy+'-'+pad2(sm+1)+'-01', to:ymdOf(end)});
  }
  return out;
}

function monthGrid(y,m){
  var lead=new Date(Date.UTC(y,m,1)).getUTCDay();     // 0 = Sunday
  var days=new Date(Date.UTC(y,m+1,0)).getUTCDate();
  var sel=CALPICK||{}, from=sel.start||'', to=sel.end||'';
  var out='<table class="calgrid"><tr>'+
    ['Su','Mo','Tu','We','Th','Fr','Sa'].map(function(d){return '<th>'+d+'</th>';}).join('')+
    '</tr><tr>';
  var col=0, n;
  for(n=0;n<lead;n++){ out+='<td class="pad"></td>'; col++; }
  for(n=1;n<=days;n++){
    var iso=y+'-'+pad2(m+1)+'-'+pad2(n), cls=[];
    if(iso===todayYmd()) cls.push('today');
    if(iso===from||iso===to) cls.push('end');
    else if(from&&to&&iso>from&&iso<to) cls.push('mid');
    out+='<td><button type="button" data-calday="'+iso+'"'+
      (cls.length?' class="'+cls.join(' ')+'"':'')+'>'+n+'</button></td>';
    col++;
    if(col===7&&n<days){ out+='</tr><tr>'; col=0; }
  }
  while(col>0&&col<7){ out+='<td class="pad"></td>'; col++; }
  return out+'</tr></table>';
}

var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
var pounds=function(pence){return (Number(pence||0)/100).toFixed(2);};
// Shop-local timestamps. Everything is STORED as UTC ISO (toISOString), which
// reads an hour behind during British Summer Time if sliced straight into the
// page. Formatted in Europe/London so BST/GMT flips itself twice a year -
// never a hardcoded +1 - and reads as shop time whatever device views it.
var ldt=function(iso){
  if(!iso) return '';
  var d=new Date(iso);
  if(isNaN(d.getTime())) return String(iso).slice(0,16).replace('T',' ');
  var p={};
  new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',
    month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})
    .formatToParts(d).forEach(function(x){p[x.type]=x.value;});
  return p.year+'-'+p.month+'-'+p.day+' '+p.hour+':'+p.minute;
};
var toPence=function(v){return Math.round(parseFloat(String(v).replace(/[^0-9.]/g,''))*100)||0;};
var carrierLabel=function(id){
  var c=(S.carriers||[]).filter(function(x){return x.id===id;})[0];
  return c?c.name:(id||'');
};
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
  var lbl=document.getElementById('dirty');
  lbl.textContent = n===1 ? '1 change unsaved' : n+' changes unsaved';
  lbl.className = 'sp';
  document.getElementById('discard').hidden = false;
  // Only on screen when there is something to save. It used to sit there
  // permanently reading "No unsaved changes", which is a bar taking up the
  // bottom of every page to tell you it has nothing to do.
  document.getElementById('savebar').hidden = !n || tab==='dashboard';
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

  if(tab==='dashboard'){
    m.innerHTML=renderDash();
    wireDash();
    refreshBar();
    return;
  }

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
          (S.settings.vat_registered
            ? '<div class="two">'+
                '<div><label>That price is</label>'+
                  '<select data-i="'+i+'" data-f="price_mode">'+
                    '<option value="inc"'+(p.price_mode!=='exc'?' selected':'')+'>Including VAT</option>'+
                    '<option value="exc"'+(p.price_mode==='exc'?' selected':'')+'>Excluding VAT</option>'+
                  '</select></div>'+
                '<div><label>VAT on this product</label>'+
                  '<div style="display:flex;gap:10px;align-items:center;padding-top:9px">'+
                    '<input type="checkbox" id="vt-'+i+'" data-i="'+i+'" data-f="vat_applicable"'+
                      (p.vat_applicable!==false?' checked':'')+
                      ' style="width:17px;height:17px;flex:0 0 auto;margin:0;accent-color:#2B3037">'+
                    '<label for="vt-'+i+'" style="display:inline;margin:0;font-size:14px;'+
                      'color:var(--ink);white-space:normal;cursor:pointer">Charge VAT</label>'+
                  '</div></div>'+
              '</div>'+
              '<div class="hint">'+(p.price_mode==='exc'
                ? 'Customers will be shown '+money(Math.round((p.price_pence||0)*(100+(Number(S.settings.vat_rate)||0))/100))+', which is this price plus VAT.'
                : 'Customers are shown '+money(p.price_pence||0)+', with the VAT already inside it.')+'</div>'
            : '')+
          '<label>Badge <span style="font-weight:400">(blank for none)</span></label>'+
            '<input data-i="'+i+'" data-f="badge" value="'+esc(p.badge)+'" placeholder="e.g. Best seller">'+
          '<label>Short line <span style="font-weight:400">(shown on the card)</span></label>'+
            '<input data-i="'+i+'" data-f="tagline" value="'+esc(p.tagline)+'">'+
          '<label>Description <span style="font-weight:400">(shown in Learn more)</span></label>'+
            '<textarea data-i="'+i+'" data-f="description">'+esc(p.description)+'</textarea>'+
          '<label>Ingredients <span style="font-weight:400">(order matters - the first one opens by default)</span></label>'+
            '<div class="chips">'+LIB.map(function(m){
              var pos=(p.ingredients||[]).indexOf(m.name);
              var ic=iconUploads[m.slug]||m.icon;
              return '<button type="button" class="chip'+(ic?'':' no-icon')+'" data-ing="'+i+'|'+esc(m.name)+
                '" aria-pressed="'+(pos>=0)+'">'+(pos>=0?'<span class="n">'+(pos+1)+'</span>':'')+
                (ic?'<img class="cicon" src="'+esc(ic)+'" alt="">':'')+
                esc(m.name)+'</button>';
            }).join('')+'</div>'+
            '<div class="hint">Dashed ones have no icon yet, so they will not show on the card - '+
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
    h+='<div class="note">Collection is always free. Each destination can have '+
       'one or more services - two or more and the customer chooses. '+
       'Turn a destination off and the site will not accept orders for it.</div>';
    h+='<div class="card open"><div class="head" style="cursor:default">'+
      '<div class="hmeta"><b>Collection address</b><span>Shown in the bag and on the confirmation email</span></div></div>'+
      '<div class="body"><label>Address</label>'+
      '<input data-collect="1" value="'+esc(draft.settings.collect_address||'')+
      '" placeholder="Drewrys, 1 Example Street, Douglas, IM1 1AA">'+
      '<div class="note" style="margin:10px 0 0;padding:9px 11px">Separate with commas - '+
      'each part shows on its own line.</div></div></div>';

    (draft.settings.zones||[]).forEach(function(z,zi){
      var mine=(draft.settings.shipping_methods||[]).filter(function(m){return m.zone===z.id;});
      h+='<div class="card open"><div class="head" style="cursor:default">'+
        '<div class="hmeta"><b>'+esc(z.name)+'</b><span>'+
          (z.active===false?'not delivering here':mine.length+(mine.length===1?' service':' services'))+
        '</span></div>'+
        '<label class="check" style="margin:0"><input type="checkbox" data-zone="'+zi+
          '"'+(z.active!==false?' checked':'')+'> on</label></div>'+
        '<div class="body">'+
        // The name was a heading, so a destination could never be renamed - which
        // is what stopped "United Kingdom" being corrected to include the
        // Channel Islands it already serves.
        '<div class="two">'+
          '<div><label>What customers see</label>'+
            '<input data-zn="'+zi+'" value="'+esc(z.name)+'" placeholder="Destination name"></div>'+
          '<div><label>Postcode example</label>'+
            '<input data-zp="'+zi+'" value="'+esc(z.placeholder||'')+'" placeholder="SW1A 1AA"></div>'+
        '</div>'+
        '<div class="hint">The name is what the checkout says it delivers to, so make '+
        'it match the places this destination actually covers.</div>';
      mine.forEach(function(m){
        var mi=draft.settings.shipping_methods.indexOf(m);
        h+='<div class="svcrow">'+
          '<div class="svcmain"><input data-m="'+mi+'" data-mf="name" value="'+esc(m.name)+'" placeholder="Service name">'+
          '<input data-m="'+mi+'" data-mf="note" value="'+esc(m.note||'')+'" placeholder="Short description (optional)"></div>'+
          '<div class="money svcp"><span>£</span><input data-m="'+mi+'" data-mf="price" inputmode="decimal" value="'+
            pounds(m.price)+'"></div>'+
          '<button type="button" class="x" data-mdel="'+mi+'">&times;</button></div>';
      });
      if(!mine.length) h+='<div class="hint">No service yet - nobody can order to '+esc(z.name)+'.</div>';
      h+='<button type="button" class="addstep" data-madd="'+esc(z.id)+'">+ Add a service</button>'+
        '<div class="row" style="margin-top:10px"><button type="button" class="tiny" '+
          'data-zdel="'+zi+'">Remove this destination</button></div>'+
        '<label>Free delivery over <span style="font-weight:400">(0 for none)</span></label>'+
        '<div class="money" style="max-width:180px"><span>£</span><input data-free="'+esc(z.id)+
          '" inputmode="decimal" value="'+pounds((draft.settings.free_over||{})[z.id])+'"></div>'+
        '</div></div>';
    });
    h+='<div class="note">Anywhere not listed above is refused at the basket with a note '+
       'that collection is still available - better than taking an order you cannot post.</div>';
  }

  if(tab==='discounts'){
    draft.settings.promos=draft.settings.promos||[];
    h+='<div class="note">Codes are typed at checkout. A code that is off, expired or '+
       'past its usage limit is refused with the reason. Stackable codes can be used '+
       'together; a non-stackable code only ever applies on its own.</div>';
    if(!draft.settings.promos.length) h+='<div class="hint">No codes yet.</div>';
    draft.settings.promos.forEach(function(pr,pi){
      var used=(S.promo_uses||{})[pr.code]||0;
      var ub='b-ok', ut='Used '+used+(used===1?' time':' times');
      if(pr.limit>0){ ut='Used '+used+' of '+pr.limit;
        if(used>=pr.limit) ub='b-out';
        else if(pr.limit-used<=Math.max(3,pr.limit*0.2)) ub='b-low'; }
      var sub=(pr.type==='fixed'?'£'+pounds(pr.amount)+' off':(pr.amount||0)+'% off')+
        (pr.expires?' · until '+esc(pr.expires):'')+
        (pr.stackable?' · stackable':'');
      h+='<div class="card open"><div class="head" style="cursor:default">'+
        '<div class="hmeta"><b>'+esc(pr.code||'NEW CODE')+
        '<span class="badge usebadge '+ub+'">'+ut+'</span></b><span>'+sub+'</span></div>'+
        '<label class="check" style="margin:0"><input type="checkbox" data-pr="'+pi+
          '" data-pf="active"'+(pr.active!==false?' checked':'')+'> live</label>'+
        '<button type="button" class="ghost del" data-prdel="'+pi+'">Delete</button></div>'+
        '<div class="body">'+
        '<div class="prow">'+
          '<div><label>Code</label>'+
            '<input data-pr="'+pi+'" data-pf="code" value="'+esc(pr.code||'')+
            '" placeholder="SUMMER20" style="text-transform:uppercase"></div>'+
          '<div><label>Type</label>'+
            '<select data-pr="'+pi+'" data-pf="type">'+
            '<option value="percent"'+(pr.type!=='fixed'?' selected':'')+'>Percentage off</option>'+
            '<option value="fixed"'+(pr.type==='fixed'?' selected':'')+'>Amount off</option>'+
            '</select></div>'+
          '<div><label>'+(pr.type==='fixed'?'Amount':'Percent')+'</label>'+
            '<div class="money"><span>'+(pr.type==='fixed'?'£':'%')+'</span>'+
            '<input data-pr="'+pi+'" data-pf="amount" inputmode="decimal" value="'+
            (pr.type==='fixed'?pounds(pr.amount):(pr.amount||0))+'"></div></div>'+
        '</div>'+
        '<div class="prow">'+
          '<div><label>Expires <span style="font-weight:400">(blank for never)</span></label>'+
            '<input type="date" data-pr="'+pi+'" data-pf="expires" value="'+esc(pr.expires||'')+'"></div>'+
          '<div><label>Usage limit <span style="font-weight:400">(blank for unlimited)</span></label>'+
            '<input data-pr="'+pi+'" data-pf="limit" inputmode="numeric" value="'+
            (pr.limit>0?pr.limit:'')+'" placeholder="Unlimited"></div>'+
          '<div><label>Minimum spend <span style="font-weight:400">(0 for none)</span></label>'+
            '<div class="money"><span>£</span>'+
            '<input data-pr="'+pi+'" data-pf="min_spend" inputmode="decimal" value="'+
            pounds(pr.min_spend)+'"></div></div>'+
        '</div>'+
        '<label class="check"><input type="checkbox" data-pr="'+pi+'" data-pf="stackable"'+
          (pr.stackable===true?' checked':'')+'> Can be combined with other stackable codes</label>'+
        '</div></div>';
    });
    h+='<button type="button" class="addstep" id="addpromo">+ Add a code</button>'+
      '<div class="note">Uses are counted when an order is PAID, not when the code is '+
      'typed, so an abandoned basket never burns one. PAIRED10 is the pairs-well offer '+
      'shown after adding to bag; turn it off here and the offer stops appearing.</div>';
  }

  if(tab==='orders'){
    var OPEN={paid:1,ready:1};
    var pend=S.orders.filter(function(o){return OPEN[o.status];});
    var done=S.orders.filter(function(o){return !OPEN[o.status];});
        var list=(orderView==='done')?done:pend;

    h+='<div class="ofilter">'+
      '<button type="button" data-oview="todo"'+(orderView!=='done'?' class="on"':'')+'>'+
        'To fulfil'+(pend.length?' ('+pend.length+')':'')+'</button>'+
      '<button type="button" data-oview="done"'+(orderView==='done'?' class="on"':'')+'>'+
        'Done'+(done.length?' ('+done.length+')':'')+'</button>'+
      '</div>';

    if(!S.orders.length){
      h+='<div class="note">No paid orders yet. They appear here the moment Teya confirms '+
         'payment, and a copy goes to your email.</div>';
    } else if(!list.length){
      h+='<div class="note">'+(orderView==='done'
        ?'Nothing completed yet.':'Nothing waiting.')+'</div>';
    }

    list.forEach(function(o){
      var collect=(o.fulfilment==='collect');
      var n=o.notified||{};
      var badge={
        paid: collect?'<span class="badge b-low">Needs packing</span>'
                     :'<span class="badge b-low">Awaiting dispatch</span>',
        ready:'<span class="badge b-low">Ready - waiting for customer</span>',
        collected:'<span class="badge b-ok">Collected</span>',
        dispatched:'<span class="badge b-ok">Dispatched</span>'
      }[o.status]||'<span class="badge b-out">'+esc(o.status)+'</span>';

      h+='<div class="card open"><div class="head" style="cursor:default">'+
        '<div class="hmeta"><b>'+esc(o.reference)+' &middot; £'+pounds(o.total)+'</b>'+
        '<span>'+esc(ldt(o.settled||o.created))+' &middot; '+
        (collect?'Collection':'Delivery'+(o.method?' &middot; '+esc(o.method.name):''))+'</span></div>'+
        badge+'</div><div class="body">'+
        '<table><tr><th>Item</th><th>Qty</th><th>Line</th></tr>'+
        (o.items||[]).map(function(i){return '<tr><td>'+esc(i.name)+'</td><td>'+i.quantity+
          '</td><td>£'+pounds(i.unit_amount*i.quantity)+'</td></tr>';}).join('')+
        '</table>'+
        '<label>'+(collect?'Customer':'Deliver to')+'</label>'+
        '<div class="addr">'+esc((o.customer||{}).name||'-')+'<br>'+
        esc((o.customer||{}).email||'')+(((o.customer||{}).phone)?'<br>'+esc(o.customer.phone):'')+
        (collect?'':'<br>'+esc((o.customer||{}).address||''))+'</div>';

      // A cancelled or refunded order is CLOSED: no fulfilment banner, no
      // buttons. Before this guard a cancelled order fell into the collected
      // branch and showed "Collected" with a blank time plus an Undo button
      // that the server would refuse - exactly the confusion it caused.
      var closed=!!o.refund||o.status==='cancelled'||o.status==='refunded'
        ||o.refund_state==='pending';

      if(closed){
        // History only, if it actually went out before the money went back.
        if(o.fulfilled){
          h+='<div class="doneline">'+(collect?'Was collected ':'Was dispatched ')+
             esc(ldt(o.fulfilled))+
             (!collect&&o.tracking?' &middot; '+esc(carrierLabel(o.carrier))+' '+esc(o.tracking):'')+
             '</div>';
        }
      } else if(collect){
        if(o.status==='paid'){
          h+='<button type="button" class="fulfil" data-act="ready" data-ref="'+esc(o.reference)+'">'+
             'Ready for collection</button>'+
             '<div class="hint">Emails the customer to come and get it. '+
             'Mark it collected later, when they actually have.</div>';
        } else if(o.status==='ready'){
          h+='<div class="doneline">Marked ready '+esc(ldt(o.ready_at))+
            (n.ready?' &middot; customer emailed':' &middot; <b>email not sent</b>')+'</div>'+
            '<button type="button" class="fulfil" data-act="collected" data-ref="'+esc(o.reference)+'">'+
            'Customer has collected it</button>'+
            '<div class="hint">Closes the order and emails them a receipt.</div>'+
            '<div class="row" style="margin-top:10px">'+
            '<button type="button" class="ghost" data-act="resend" data-ref="'+esc(o.reference)+'">Resend ready email</button>'+
            '<button type="button" class="ghost" data-act="undo" data-ref="'+esc(o.reference)+'">Not ready after all - undo</button></div>';
        } else {
          h+='<div class="doneline">Collected '+esc(ldt(o.fulfilled))+'</div>'+
            '<div class="row" style="margin-top:10px">'+
            '<button type="button" class="ghost" data-act="undo" data-ref="'+esc(o.reference)+'">Not collected after all - undo</button></div>';
        }
      } else {
        if(o.status==='paid'){
          h+='<div class="two" style="margin-top:12px">'+
            '<div><label>Carrier</label><select data-carrier="'+esc(o.reference)+'">'+
              (S.carriers||[]).map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>';}).join('')+
            '</select></div>'+
            '<div><label>Tracking number</label>'+
              '<input data-tracking="'+esc(o.reference)+'" placeholder="Optional"></div></div>'+
            '<button type="button" class="fulfil" data-act="dispatch" data-ref="'+esc(o.reference)+'">'+
            'Mark as dispatched</button>'+
            '<div class="hint">Emails the customer with the tracking link. '+
            'Leave tracking blank if there is none - they still get told it is on its way.</div>';
        } else {
          h+='<div class="doneline">Dispatched '+esc(ldt(o.fulfilled))+
            (o.tracking?' &middot; '+esc(carrierLabel(o.carrier))+' '+esc(o.tracking):'')+
            (n.dispatched?' &middot; customer emailed':' &middot; <b>email not sent</b>')+'</div>'+
            '<div class="row" style="margin-top:10px">'+
            '<button type="button" class="ghost" data-act="resend" data-ref="'+esc(o.reference)+'">Resend email</button>'+
            '<button type="button" class="ghost" data-act="undo" data-ref="'+esc(o.reference)+'">Not dispatched after all - undo</button></div>';
        }
      }
      // ── cancel / refund ──────────────────────────────────────────────
      // CANCEL sits with an order still to fulfil: it has not gone out, so it
      // is stopped and the money returned. REFUND sits with a completed one:
      // it has been collected or dispatched and is coming back.
      // Small text control, opening a compact panel, so it can never be hit
      // by accident next to the big fulfilment button.
      var gone=(o.status==='collected'||o.status==='dispatched');
      var isCancel=!gone;
      var open=(REFUND_FOR===o.reference);

      if(o.refund){
        var wasCancel=(o.refund.kind==='cancel');
        h+='<div class="refline"><b>'+(wasCancel?'ORDER CANCELLED':'ORDER REFUNDED')+
           '</b> &middot; '+money(o.refund.amount)+' sent back to the customer &middot; '+
           esc(ldt(o.refund.at))+'<br>'+
           'Reason: '+esc(o.refund.reason_label||'not recorded')+
           (o.refund.note?' &middot; '+esc(o.refund.note):'')+'<br>'+
           'Stock: '+(o.refund.restocked
             ?'back on the shelf'
             :'<b>not restocked</b> &middot; '+esc(o.refund.no_restock_label||''))+
           '</div>';
      } else if(o.refund_state==='pending'){
        h+='<div class="doneline" style="margin-top:12px">Submitted, waiting on Teya</div>'+
           '<div class="hint">Teya accepted it but has not confirmed. Nothing has been '+
           'restocked and the customer has not been emailed.</div>';
      } else if(o.status!=='pending'&&o.status!=='failed'&&o.status!=='cancelled'){
        h+='<div style="margin-top:14px"><button type="button" class="tiny" '+
             'data-rtog="'+esc(o.reference)+'">'+
             (open?'Close':(isCancel?'Cancel order':'Refund order'))+'</button></div>';
        if(open){
          h+='<div class="panel panel--tight">'+
            '<div><label>'+(isCancel?'Why is it being cancelled':'Reason for the return')+
              '</label><select data-rreason="'+esc(o.reference)+'">'+
                (S.return_reasons||[]).map(function(r){
                  return '<option value="'+esc(r.id)+'">'+esc(r.label)+'</option>';}).join('')+
              '</select></div>'+
            (isCancel
              ? '<div class="hint" style="margin-top:8px">It has not gone out, so the stock '+
                'goes straight back on the shelf.</div>'
              : '<div style="display:flex;gap:10px;align-items:center;margin-top:12px">'+
                  '<input type="checkbox" id="rs-'+esc(o.reference)+'" '+
                    'data-rstock="'+esc(o.reference)+'" checked '+
                    'style="width:17px;height:17px;flex:0 0 auto;margin:0;accent-color:#2B3037">'+
                  '<label for="rs-'+esc(o.reference)+'" style="display:inline;margin:0;'+
                    'font-size:14px;color:var(--ink);white-space:normal;cursor:pointer">'+
                    'Put the items back into stock</label></div>'+
                '<div data-rnostock-wrap="'+esc(o.reference)+'" hidden style="margin-top:10px">'+
                  '<label>Why it cannot go back on the shelf</label>'+
                  '<select data-rnostock="'+esc(o.reference)+'">'+
                    (S.no_restock_reasons||[]).map(function(r){
                      return '<option value="'+esc(r.id)+'">'+esc(r.label)+'</option>';}).join('')+
                  '</select></div>')+
            '<div style="margin-top:10px"><label>Note, optional</label>'+
              '<input data-rnote="'+esc(o.reference)+'" placeholder="Anything worth recording"></div>'+
            '<button type="button" class="pill-danger" '+
              'data-rgo="'+esc(o.reference)+'" data-rkind="'+(isCancel?'cancel':'refund')+'">'+
              (isCancel?'Cancel and refund ':'Refund ')+money(o.total||0)+'</button>'+
            '<div class="hint">Full amount only. Sends the money back through Teya and emails '+
            'the customer. Card refunds take a few days to land, and the email says so.</div>'+
          '</div>';
        }
      }

      h+='</div></div>';
    });
  }

  if(tab==='leads'){
    var LD=S.leads||{subscribers:[],enquiries:[]};

    // .card open / .head / .hmeta / .body is the admin's own panel shape.
    // .panel and .bars are not classes in this stylesheet.
    h+='<div class="card open"><div class="head" style="cursor:default">'+
      '<div class="hmeta"><b>Footer links</b><span>Blank hides the link. '+
      'All three used to point at a hash and jump to the top of the page</span></div></div>'+
      '<div class="body">'+
        '<div><label>Instagram URL</label>'+
          '<input data-rs="instagram_url" value="'+esc(S.settings.instagram_url||'')+'" '+
          'placeholder="https://instagram.com/yourpage"></div>'+
        '<div><label>Facebook URL</label>'+
          '<input data-rs="facebook_url" value="'+esc(S.settings.facebook_url||'')+'" '+
          'placeholder="https://facebook.com/yourpage"></div>'+
        '<div><label>Contact email</label>'+
          '<input data-rs="contact_email" value="'+esc(S.settings.contact_email||'')+'" '+
          'placeholder="hello@drewrys.store"></div>'+
        '<div class="hint">The Contact link opens a mail app addressed here.</div>'+
      '</div></div>';

    h+='<div class="card open"><div class="head" style="cursor:default">'+
      '<div class="hmeta"><b>Review on the contact panel</b>'+
      '<span>Shown beside the contact form. Leave blank and it uses a published '+
      'review instead, or shows nothing</span></div></div><div class="body">'+
      '<div><label>Quote</label>'+
        '<input data-rs="feature_quote" value="'+esc(S.settings.feature_quote||'')+'" '+
        'placeholder="What they said about the product"></div>'+
      '<div class="two">'+
        '<div><label>Name</label>'+
          '<input data-rs="feature_name" value="'+esc(S.settings.feature_name||'')+'" '+
          'placeholder="Their name"></div>'+
        '<div><label>Under the name</label>'+
          '<input data-rs="feature_sub" value="'+esc(S.settings.feature_sub||'')+'" '+
          'placeholder="Sea Salt Spray"></div>'+
      '</div>'+
      '<div class="hint">Use something a real customer actually said, with their '+
      'permission. It renders with five stars and their name against it.</div>'+
      '</div></div>';

    h+='<div class="card open"><div class="head" style="cursor:default">'+
      '<div class="hmeta"><b>Newsletter</b><span>'+LD.subscribers.length+' '+
      (LD.subscribers.length===1?'signup from the footer':'signups from the footer')+
      '</span></div>'+
      (LD.subscribers.length?'<button type="button" class="ghost" data-csv="subs">Download CSV</button>':'')+
      '</div><div class="body">';
    if(!LD.subscribers.length){
      h+='<div class="note">Nobody yet. The footer form writes here the moment someone signs up.</div>';
    } else {
      h+='<table><tr><th>Email</th><th>Signed up</th></tr>'+
        LD.subscribers.map(function(x){
          return '<tr><td>'+esc(x.email)+'</td><td>'+
            esc(String(x.at||'').slice(0,10))+'</td></tr>';}).join('')+'</table>';
    }
    h+='</div></div>';
  }

  if(tab==='vat'){
    h+='<div class="card open"><div class="head" style="cursor:default">'+
      '<div class="hmeta"><b>VAT settings</b><span>Switch this off and no VAT is '+
      'shown or reported anywhere, including on receipts</span></div></div>'+
      '<div class="body">'+
      '<div style="display:flex;gap:10px;align-items:center">'+
        '<input type="checkbox" id="vreg" data-rs="vat_registered"'+
          (S.settings.vat_registered?' checked':'')+
          ' style="width:17px;height:17px;flex:0 0 auto;margin:0;accent-color:#2B3037">'+
        '<label for="vreg" style="display:inline;margin:0;font-size:14px;color:var(--ink);'+
          'white-space:normal;cursor:pointer">This business is VAT registered</label></div>'+
      '<div class="two" style="margin-top:14px">'+
        '<div><label>VAT registration number</label>'+
          '<input data-rs="vat_number" value="'+esc(S.settings.vat_number||'')+'" '+
          'placeholder="GB000000000"></div>'+
        '<div><label>VAT rate, per cent</label>'+
          '<input data-rs="vat_rate" type="number" min="0" max="30" step="0.5" value="'+
          esc(String(S.settings.vat_rate==null?20:S.settings.vat_rate))+'"></div>'+
      '</div>'+
      '<div class="hint">The number appears on the terms, returns and privacy pages. '+
      'The rate is stamped onto each order when it is placed, so changing it here '+
      'never restates an order already taken.</div>'+
      '</div></div>';

      var periods=vatPeriodList();
      // Default to the current quarter so the report has something to show,
      // but mark it as coming from the quarter row, not the picker.
      if(!VATR&&periods.length){
        VATR={from:periods[0].from,to:periods[0].to,label:periods[0].label,src:'quarter'};
      }

      // Quarters are buttons in their own right. They were making the popover
      // twice as tall for something that is one click either way.
      h+='<div class="ofilter" style="margin-top:-4px">'+periods.map(function(q){
        return '<button type="button" data-vatq="'+esc(q.id)+'"'+
          (VATR&&VATR.label===q.label?' class="on"':'')+'>'+esc(q.label)+'</button>';}).join('')+
        '</div>';

      // Date range picker. One trigger, one popover: preset list on the left,
      // two months side by side, chosen dates read out underneath.
      // The trigger names a CUSTOM period only. Echoing the quarter you just
      // pressed on the pill above it says nothing and reads like a bug.
      var lbl=(VATR&&VATR.src&&VATR.src!=='quarter') ? VATR.label : 'Custom';
      h+='<div class="calwrap">'+
        '<button type="button" class="ghost calbtn" data-calopen="1">'+esc(lbl)+
          '<span class="calcar">&#9662;</span></button>';

      if(CALOPEN){
        if(!CALM){
          var seed=(CALPICK&&CALPICK.start)||(VATR&&VATR.from)||todayYmd();
          CALM={y:+seed.slice(0,4), m:+seed.slice(5,7)-1};
        }
        var presets=[['today','Today'],['yesterday','Yesterday'],['7','Last 7 Days'],
          ['30','Last 30 Days'],['60','Last 60 Days'],['90','Last 90 Days'],
          ['180','Last 180 Days'],['365','Last 365 Days']];

        h+='<div class="calpop">'+
          '<div class="calside">'+presets.map(function(x){
            return '<button type="button" data-vatp="'+x[0]+'"'+
              (VATR&&VATR.label===x[1]?' class="on"':'')+'>'+x[1]+'</button>';}).join('')+
          '</div>'+
          '<div class="calmain">'+
            '<div class="calhead">'+
              '<button type="button" class="calnav" data-calnav="-12" aria-label="Previous year">&#124;&lsaquo;</button>'+
              '<button type="button" class="calnav" data-calnav="-1" aria-label="Previous month">&lsaquo;</button>'+
              '<span class="calmon">'+monthName(CALM.y,CALM.m)+'</span>'+
              '<span class="calgap"></span>'+
              '<span class="calmon">'+monthName(nextY(CALM),nextM(CALM))+'</span>'+
              '<button type="button" class="calnav" data-calnav="1" aria-label="Next month">&rsaquo;</button>'+
              '<button type="button" class="calnav" data-calnav="12" aria-label="Next year">&rsaquo;&#124;</button>'+
            '</div>'+
            '<div class="calgrids">'+
              monthGrid(CALM.y,CALM.m)+monthGrid(nextY(CALM),nextM(CALM))+
            '</div>'+
            '<div class="calfoot">'+
              '<span class="calfield'+((CALPICK&&CALPICK.start&&!CALPICK.end)?' act':'')+'">'+
                (CALPICK&&CALPICK.start?esc(CALPICK.start):'Start date')+'</span>'+
              '<span class="calarrow">&rarr;</span>'+
              '<span class="calfield">'+
                (CALPICK&&CALPICK.end?esc(CALPICK.end):'End date')+'</span>'+
              '<span class="calgap"></span>'+
              '<button type="button" class="callink" data-calreset="1">Reset</button>'+
              '<button type="button" class="callink" data-calclear="1">Clear</button>'+
              '<button type="button" class="calapply" data-calapply="1"'+
                ((CALPICK&&CALPICK.start&&CALPICK.end)?'':' disabled')+'>Apply</button>'+
            '</div>'+
          '</div>'+
        '</div>';
      }
      h+='</div>';

      var vatOn=(S.vat&&S.vat.registered)||S.settings.vat_registered===true;
      if(!vatOn){
        h+='<div class="note">VAT is switched off. Tick "This business is VAT registered" '+
           'above and save, and the report appears.</div>';
      } else if(!VAT){
        h+='<div class="note">Loading...</div>';
        if(VATR) fetch('/admin/vat?from='+VATR.from+'&to='+VATR.to,{headers:{'x-admin-key':KEY}})
          .then(function(r){return r.json();}).then(function(d){ VAT=d; render(); })
          .catch(function(){ VAT={error:'could not load'}; render(); });
      } else if(VAT.error){
        h+='<div class="note">'+esc(VAT.error)+'</div>';
      } else {
        h+='<div class="card open"><div class="head" style="cursor:default">'+
          '<div class="hmeta"><b>VAT due, '+esc((VATR&&VATR.label)||'period')+'</b><span>'+
          esc(VAT.from)+' to '+esc(VAT.to)+' &middot; registration '+esc(VAT.number||'not set')+
          ' &middot; '+esc(String(VAT.rate))+' per cent</span></div>'+
          '<button type="button" class="ghost" data-vatcsv="1">Download CSV</button>'+
          '</div><div class="body">'+
          '<table><tr><th>&nbsp;</th><th>Orders</th><th>Gross</th><th>Net</th><th>VAT</th></tr>'+
          '<tr><td>Sales</td><td>'+VAT.sales.count+'</td><td>'+money(VAT.sales.gross)+
            '</td><td>'+money(VAT.sales.net)+'</td><td>'+money(VAT.sales.vat)+'</td></tr>'+
          '<tr><td>Refunds and cancellations</td><td>'+VAT.refunds.count+'</td><td>&minus;'+
            money(VAT.refunds.gross)+'</td><td>&minus;'+money(VAT.refunds.gross-VAT.refunds.vat)+
            '</td><td>&minus;'+money(VAT.refunds.vat)+'</td></tr>'+
          '<tr><td><b>Due</b></td><td></td><td><b>'+money(VAT.due.gross)+'</b></td><td><b>'+
            money(VAT.due.net)+'</b></td><td><b>'+money(VAT.due.vat)+'</b></td></tr>'+
          '</table>'+
          (VAT.exports.count
            ? '<div class="hint">Includes '+VAT.exports.count+' zero-rated export'+
              (VAT.exports.count===1?'':'s')+' to Europe worth '+money(VAT.exports.gross)+
              ', reported as sales with no VAT.</div>'
            : '')+
          '<div class="hint">Prices on the site include VAT, so this is the VAT taken OUT '+
          'of what customers paid, not added on top. Figures are a working total from the '+
          'orders, not a filed return.</div>'+
          '</div></div>';

        h+='<div class="card open"><div class="head" style="cursor:default">'+
          '<div class="hmeta"><b>Every line</b><span>'+VAT.rows.length+' in this period'+
          '</span></div></div><div class="body">';
        h+= VAT.rows.length
          ? '<table><tr><th>Date</th><th>Order</th><th>Where</th><th>Gross</th><th>VAT</th></tr>'+
            VAT.rows.map(function(r){
              return '<tr><td>'+esc(r.day)+'</td><td>'+esc(r.reference)+
                (r.kind!=='sale'?' <span class="hint">'+esc(r.kind)+'</span>':'')+
                '</td><td>'+esc(r.zone)+(r.zero_rated?' (export)':'')+'</td><td>'+
                money(r.gross)+'</td><td>'+money(r.vat)+'</td></tr>';}).join('')+'</table>'
          : '<div class="note">Nothing in this period.</div>';
        h+='</div></div>';
      }
    }

  if(tab==='reviews'){
    var revs=S.reviews||[];
    var pend=revs.filter(function(r){return r.status==='pending';});
    var pub=revs.filter(function(r){return r.status==='published';});
    var hid=revs.filter(function(r){return r.status==='hidden';});
    var list={pending:pend,published:pub,hidden:hid}[revView]||pend;
    var links=(S.platforms||[]);
    var platName=links.map(function(x){return x.name;}).join(' / ')||'public';

    h+='<div class="ofilter">'+
      [['pending','To review',pend.length],['published','Published',pub.length],
       ['hidden','Hidden',hid.length],['settings','Settings',0]]
      .map(function(v){return '<button type="button" data-rview="'+v[0]+'"'+
        (revView===v[0]?' class="on"':'')+'>'+v[1]+(v[2]?' ('+v[2]+')':'')+'</button>';}).join('')+
      '</div>';

    if(revView==='settings'){

    h+='<div class="card open"><div class="head" style="cursor:default">'+
      '<div class="hmeta"><b>Reviews</b><span>When the request goes out, and who gets asked publicly</span></div></div>'+
      '<div class="body"><div class="two">'+
        '<div><label>Days after collection</label>'+
          '<input data-rs="review_delay_collect" type="number" min="0" value="'+
          Number(draft.settings.review_delay_collect||0)+'"></div>'+
        '<div><label>Days after delivery</label>'+
          '<input data-rs="review_delay_deliver" type="number" min="0" value="'+
          Number(draft.settings.review_delay_deliver||0)+'"></div></div>'+
      '<label>Google review link</label>'+
      '<input data-rs="review_google_url" value="'+esc(draft.settings.review_google_url||'')+
        '" placeholder="https://g.page/r/.../review">'+
      '<label>Facebook review link</label>'+
      '<input data-rs="review_facebook_url" value="'+esc(draft.settings.review_facebook_url||'')+
        '" placeholder="https://facebook.com/yourpage/reviews">'+
      '<div class="hint">Set either or both. Whatever is filled in appears in the invite '+
      'email and on the copy-and-post page.</div>'+
      '<label>Send the public invite from</label>'+
      '<select data-rs="review_ask_from">'+
        [0,1,2,3,4,5].map(function(n){return '<option value="'+n+'"'+
          (Number(draft.settings.review_ask_from)===n?' selected':'')+'>'+
          (n===0?'Never, keep reviews internal':(n===1?'Everyone':n+' stars and up'))+
          '</option>';}).join('')+
      '</select>'+
      '<div class="check"><input type="checkbox" id="rap" data-rs="review_auto_publish"'+
        (draft.settings.review_auto_publish?' checked':'')+
        '><label for="rap" style="margin:0">Publish new reviews without checking them first</label></div>'+
      '</div></div>';
      m.innerHTML=h; refreshBar(); return;
    }

    if(!revs.length) h+='<div class="note">No reviews yet. They arrive '+
      Number(draft.settings.review_delay_collect||0)+' days after a collection and '+
      Number(draft.settings.review_delay_deliver||0)+' days after a delivery.</div>';
    else if(!list.length) h+='<div class="note">Nothing here.</div>';

    list.forEach(function(r){
      h+='<div class="card open"><div class="head" style="cursor:default">'+
        '<div class="hmeta"><b>'+esc(r.name||'Anonymous')+' '+
          '<span class="stars">'+'&#9733;'.repeat(r.rating)+
          '<span class="off">'+'&#9733;'.repeat(5-r.rating)+'</span></span></b>'+
        '<span>'+esc(String(r.created||'').slice(0,10))+' &middot; order '+esc(r.reference)+
        (r.invited?' &middot; invited to '+esc(platName||'post publicly'):'')+'</span></div>'+
        '<span class="badge '+(r.status==='published'?'b-ok':(r.status==='hidden'?'b-out':'b-low'))+'">'+
        esc(r.status)+'</span></div><div class="body">'+
        (r.text?'<div class="quote">'+esc(r.text)+'</div>':'<div class="hint">No words, rating only.</div>')+
        '<div class="row" style="margin-top:14px">'+
        (r.status!=='published'?'<button type="button" class="fulfil inline" data-rev="publish" data-rid="'+esc(r.id)+'">Publish</button>':'')+
        (r.status!=='hidden'?'<button type="button" class="ghost" data-rev="hide" data-rid="'+esc(r.id)+'">Hide</button>':'')+
        (r.status==='hidden'?'<button type="button" class="ghost" data-rev="pending" data-rid="'+esc(r.id)+'">Back to review</button>':'')+
        (links.length?'<button type="button" class="ghost" data-rev="invite" data-rid="'+esc(r.id)+'">'+
          (r.invited?'Resend':'Send')+' '+esc(platName)+' invite</button>':'')+
        '<button type="button" class="ghost del" data-rev="delete" data-rid="'+esc(r.id)+'">Delete</button>'+
        '</div></div></div>';
    });
  }

  m.innerHTML=h;
  refreshBar();
}

/* ── interactions ───────────────────────────────────────────────────────── */

// Unticking "put the items back into stock" has to reveal the reason picker.
// Delegated, because the panel is re-rendered on every state change.
document.addEventListener('change',function(e){
  var c=e.target;
  if(c && c.dataset && c.dataset.rstock!==undefined){
    var wrap=document.querySelector('[data-rnostock-wrap="'+c.dataset.rstock+'"]');
    if(wrap) wrap.hidden = c.checked;
  }
});

document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&(typeof CALOPEN!=='undefined')&&CALOPEN){
    CALOPEN=false; CALM=null; render();
  }
});

document.addEventListener('click',function(e){
  // Clicking anywhere outside the date picker closes it, the way every date
  // picker behaves. If the click also landed on another control, the close
  // rides along and that control's own branch does the re-render.
  var caloutside=(typeof CALOPEN!=='undefined')&&CALOPEN&&!e.target.closest('.calwrap');
  var t=e.target.closest('[data-toggle],[data-del],[data-upload],[data-inc],[data-dec],'+
    '[data-ing],[data-stepadd],[data-stepdel],[data-gicon],[data-gdel],'+
    '[data-gbadd],[data-gbdel],[data-madd],[data-mdel],[data-oview],[data-recon],'+
    '[data-zdel],'+
    '[data-rtog],[data-rgo],[data-csv],[data-vatq],[data-vatp],[data-vatcsv],'+
    '[data-calopen],[data-calnav],[data-calday],[data-calreset],[data-calclear],'+
    '[data-calapply],'+
    '[data-act],[data-rview],[data-rev],[data-prdel],#addpromo,#addnew,#addingredient');
  if(caloutside){ CALOPEN=false; CALM=null; if(!t){ render(); return; } }
  if(!t) return;

  if(t.dataset.prdel!==undefined){
    var prq=draft.settings.promos[+t.dataset.prdel];
    if(prq&&prq.code&&!confirm('Delete the code '+prq.code+'?')) return;
    draft.settings.promos.splice(+t.dataset.prdel,1); render(); refreshBar(); return; }

  if(t.id==='addpromo'){
    draft.settings.promos=draft.settings.promos||[];
    draft.settings.promos.push({code:'',type:'percent',amount:10,active:true,
      limit:0,expires:'',stackable:false,min_spend:0});
    render(); refreshBar(); return; }

  if(t.dataset.oview!==undefined){ orderView=t.dataset.oview;  render(); return; }

  if(t.dataset.calopen!==undefined){ CALOPEN=!CALOPEN; CALM=null; render(); return; }
  if(t.dataset.calnav!==undefined){
    var step=parseInt(t.dataset.calnav,10)||0;
    var tot=CALM.y*12+CALM.m+step;
    CALM={y:Math.floor(tot/12), m:((tot%12)+12)%12};
    render(); return;
  }
  if(t.dataset.calclear!==undefined){ CALPICK=null; render(); return; }
  if(t.dataset.calreset!==undefined){
    var p0=vatPeriodList()[0];
    CALPICK=null;
    if(p0){ VATR={from:p0.from,to:p0.to,label:p0.label,src:'quarter'}; VAT=null; }
    CALOPEN=false; render(); return;
  }

  if(t.dataset.calday!==undefined){
    var d=t.dataset.calday;
    if(!CALPICK||!CALPICK.start||CALPICK.end){
      CALPICK={start:d,end:''};                 // first click starts a new range
    } else {
      // Second click closes the range but does NOT apply it. Clicking earlier
      // than the first is a slip, not an instruction, so swap rather than
      // refuse. Apply is what commits.
      var a2=CALPICK.start, b2=d;
      if(b2<a2){ var sw=a2; a2=b2; b2=sw; }
      CALPICK={start:a2,end:b2};
    }
    render(); return;
  }

  if(t.dataset.calapply!==undefined){
    if(!CALPICK||!CALPICK.start||!CALPICK.end) return;
    VATR={from:CALPICK.start,to:CALPICK.end,
          label:CALPICK.start+' to '+CALPICK.end, src:'range'};
    VAT=null; CALOPEN=false; render(); return;
  }

  if(t.dataset.vatq!==undefined){
    var q=vatPeriodList().filter(function(x){return x.id===t.dataset.vatq;})[0];
    if(q){ VATR={from:q.from,to:q.to,label:q.label,src:'quarter'}; VAT=null;
           CALPICK={start:q.from,end:q.to}; CALOPEN=false; render(); }
    return;
  }

  if(t.dataset.vatp!==undefined){
    var k=t.dataset.vatp, to=todayYmd(), from, label=t.textContent.trim();
    if(k==='today'){ from=to; }
    else if(k==='yesterday'){ from=shiftDays(1); to=from; }
    else { from=shiftDays(parseInt(k,10)-1); }
    VATR={from:from,to:to,label:label,src:'preset'};
    CALPICK={start:from,end:to};
    VAT=null; CALOPEN=false; render(); return;
  }

  if(t.dataset.vatcsv!==undefined){
    if(!VAT||!VAT.rows) return;
    var q=String.fromCharCode(34), CRLF=String.fromCharCode(13,10), BOM=String.fromCharCode(65279);
    var rows=[['date','order','type','where','zero rated','gross','net','vat','rate']]
      .concat(VAT.rows.map(function(r){
        return [r.day,r.reference,r.kind,r.zone,r.zero_rated?'yes':'no',
          (r.gross/100).toFixed(2),(r.net/100).toFixed(2),(r.vat/100).toFixed(2),r.rate];}));
    var csv=rows.map(function(r){return r.map(function(c){
      return q+String(c==null?'':c).split(q).join(q+q)+q;}).join(',');}).join(CRLF);
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([BOM+csv],{type:'text/csv;charset=utf-8'}));
    a.download='drewrys-vat-'+VAT.from+'-to-'+VAT.to+'.csv'; a.click();
    URL.revokeObjectURL(a.href); return;
  }

  if(t.dataset.csv!==undefined){
    var LD=S.leads||{subscribers:[],enquiries:[]};
    var rows, name;
    if(t.dataset.csv==='subs'){
      name='drewrys-newsletter.csv';
      rows=[['email','signed up']].concat(LD.subscribers.map(function(x){return [x.email,x.at];}));
    } else { return; }
    var q=String.fromCharCode(34), CRLF=String.fromCharCode(13,10), BOM=String.fromCharCode(65279);
    var csv=rows.map(function(r){return r.map(function(c){
      return q+String(c==null?'':c).split(q).join(q+q)+q;}).join(',');}).join(CRLF);
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([BOM+csv],{type:'text/csv;charset=utf-8'}));
    a.download=name; a.click(); URL.revokeObjectURL(a.href);
    return;
  }

  if(t.dataset.rtog!==undefined){
    REFUND_FOR = (REFUND_FOR===t.dataset.rtog) ? null : t.dataset.rtog;
    render(); return;
  }

  if(t.dataset.rgo!==undefined){
    var ref=t.dataset.rgo;
    var restock=!!(document.querySelector('[data-rstock="'+ref+'"]')||{}).checked;
    var payload={reference:ref, action:(t.dataset.rkind||'refund'),
      reason:(document.querySelector('[data-rreason="'+ref+'"]')||{}).value||'',
      restock:restock,
      note:(document.querySelector('[data-rnote="'+ref+'"]')||{}).value||''};
    if(!restock) payload.no_restock_reason=(document.querySelector('[data-rnostock="'+ref+'"]')||{}).value||'';
    // No confirm dialog on purpose: the panel has to be opened deliberately
    // and the button states the amount, so the intent is already explicit.
    t.disabled=true; t.textContent='Refunding...';
    fetch('/admin',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':KEY},
      body:JSON.stringify({order:payload})})
      .then(function(r){return r.json();})
      .then(function(d){
        var i=S.orders.findIndex(function(o){return o.reference===ref;});
        if(d.pending){
          if(i>=0 && d.order) S.orders[i]=d.order;
          REFUND_FOR=null; render();
          toast('Teya has it but has not confirmed yet - not refunded');
          return;
        }
        if(d.error){ toast(d.error); t.disabled=false; t.textContent='Try again'; return; }
        if(i>=0) S.orders[i]=d.order;
        REFUND_FOR=null; render();
        toast(t.dataset.rkind==='cancel'
          ? 'Cancelled and refunded. The customer has been emailed.'
          : 'Refunded. The customer has been emailed.');
      })
      .catch(function(){ toast('Could not reach the server'); t.disabled=false; });
    return;
  }

  if(t.dataset.recon!==undefined){
    t.textContent='Checking...';
    fetch('/admin/reconcile?ref='+encodeURIComponent(t.dataset.recon),
          {headers:{'x-admin-key':KEY}})
      .then(function(r){return r.json();})
      .then(function(d){
        toast(d.error ? d.error
              : ('Teya says '+(d.teya_status||'?')+(d.paid?' - marked paid, emails sent':' - not paid')));
        DIAG=null; render();
      })
      .catch(function(){ toast('Could not reach Teya'); });
    return;
  }

  if(t.dataset.rview!==undefined){ revView=t.dataset.rview; render(); return; }

  if(t.dataset.rev!==undefined){
    var rid=t.dataset.rid, ract=t.dataset.rev;
    if(ract==='delete'&&!confirm('Delete this review for good?')) return;
    var wasR=t.textContent; t.disabled=true; t.textContent='Working...';
    fetch('/admin',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':KEY},
      body:JSON.stringify({review:{id:rid,action:ract}})})
      .then(function(r){ if(!r.ok) throw new Error('failed'); return r.json(); })
      .then(function(res){
        if(ract==='delete') S.reviews=S.reviews.filter(function(x){return x.id!==rid;});
        else { var i=S.reviews.findIndex(function(x){return x.id===rid;}); if(i>=0) S.reviews[i]=res.review; }
        render();
        toast(ract==='invite' ? (res.emailed?'Invite sent':'Invite did not send') : 'Done');
      })
      .catch(function(){ t.disabled=false; t.textContent=wasR; toast('That did not work'); });
    return;
  }

  if(t.dataset.act!==undefined){
    var ref=t.dataset.ref, act=t.dataset.act;
    if(act==='undo'&&!confirm('Step '+ref+' back one stage?')) return;
    var payload={reference:ref,action:act};
    var cs=document.querySelector('[data-carrier="'+ref+'"]');
    var tr=document.querySelector('[data-tracking="'+ref+'"]');
    if(cs) payload.carrier=cs.value;
    if(tr) payload.tracking=tr.value.trim();
    var was=t.textContent; t.disabled=true; t.textContent='Working…';
    fetch('/admin',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':KEY},
      body:JSON.stringify({order:payload})})
      .then(function(r){ if(!r.ok) throw new Error('failed'); return r.json(); })
      .then(function(res){
        var i=S.orders.findIndex(function(o){return o.reference===ref;});
        if(i>=0) S.orders[i]=res.order;
        render();
        toast(act==='undo' ? 'Stepped back'
          : (res.emailed ? 'Done - customer emailed' : 'Done'));
      })
      .catch(function(){ t.disabled=false; t.textContent=was; toast('That did not save'); });
    return;
  }

  if(t.dataset.zdel!==undefined){
    var zdi=+t.dataset.zdel, zd=draft.settings.zones[zdi];
    if(!zd) return;
    // Its services go with it. Leaving them behind would orphan rows that no
    // destination renders, and they would still price at checkout.
    var svc=(draft.settings.shipping_methods||[]).filter(function(m){return m.zone===zd.id;});
    var NL=String.fromCharCode(10);
    if(!confirm('Remove "'+zd.name+'"'+
      (svc.length?' and its '+svc.length+(svc.length===1?' service':' services'):'')+
      '?'+NL+NL+'Nobody will be able to order to it. You can turn it off instead '+
      'if you only want to pause it.')) return;
    draft.settings.zones.splice(zdi,1);
    draft.settings.shipping_methods=(draft.settings.shipping_methods||[])
      .filter(function(m){return m.zone!==zd.id;});
    if(draft.settings.free_over) delete draft.settings.free_over[zd.id];
    render(); refreshBar(); return;
  }

  if(t.dataset.madd!==undefined){
    var zid=t.dataset.madd;
    var nm2=prompt('Service name, e.g. Tracked'); if(!nm2) return;
    draft.settings.shipping_methods=draft.settings.shipping_methods||[];
    var base=zid+'-'+slugify(nm2), id2=base, n2=2;
    while(draft.settings.shipping_methods.some(function(m){return m.id===id2;})) id2=base+'-'+(n2++);
    draft.settings.shipping_methods.push({id:id2,zone:zid,name:nm2,note:'',price:0,active:true});
    render(); refreshBar(); return;
  }
  if(t.dataset.mdel!==undefined){
    var m2=draft.settings.shipping_methods[+t.dataset.mdel];
    if(!confirm('Remove "'+m2.name+'"?')) return;
    draft.settings.shipping_methods.splice(+t.dataset.mdel,1);
    render(); refreshBar(); return;
  }
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
      if(file.size>400000){ toast('Icon is over 400KB - please shrink it'); return; }
      var rd=new FileReader();
      rd.onload=function(){ iconUploads[gs]=rd.result; render(); toast('Icon ready - press Save'); };
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
      if(file.size>1500000){ toast('That image is over 1.5MB - please shrink it first'); return; }
      var rd=new FileReader();
      rd.onload=function(){ uploads[slug]=rd.result; render(); toast('Image ready - press Save'); };
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
    if(f==='active'||f==='vat_applicable') p[f]=t.checked;
    else if(f==='price_pence') p[f]=toPence(t.value);
    else p[f]=t.value;
    if(f==='price_mode'||f==='vat_applicable') render();
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
  if(t.dataset.zone!==undefined){
    draft.settings.zones[+t.dataset.zone].active=t.checked; render(); }
  if(t.dataset.zn!==undefined){ draft.settings.zones[+t.dataset.zn].name=t.value; }
  if(t.dataset.zp!==undefined){ draft.settings.zones[+t.dataset.zp].placeholder=t.value; }
  if(t.dataset.collect){ draft.settings.collect_address=t.value; }
  if(t.dataset.rs){
    draft.settings[t.dataset.rs] = t.type==='checkbox' ? t.checked
      : (t.type==='number'||t.dataset.rs==='review_ask_from' ? (parseInt(t.value,10)||0) : t.value);
    if(t.dataset.rs==='review_ask_from') render();
  }
  if(t.dataset.pr!==undefined&&t.dataset.pf){
    var pv=draft.settings.promos[+t.dataset.pr], pf=t.dataset.pf;
    if(pf==='active'||pf==='stackable') pv[pf]=t.checked;
    else if(pf==='code'){ pv.code=t.value.toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,30);
      if(t.value!==pv.code) t.value=pv.code;
      var ph=t.closest('.card').querySelector('.hmeta b'); if(ph) ph.textContent=pv.code||'NEW CODE'; }
    else if(pf==='amount') pv.amount=pv.type==='fixed'?toPence(t.value):Math.max(0,Math.min(100,parseInt(t.value,10)||0));
    else if(pf==='min_spend') pv.min_spend=toPence(t.value);
    else if(pf==='limit') pv.limit=Math.max(0,parseInt(t.value,10)||0);
    else if(pf==='type'){ var oldT=pv.type; pv.type=t.value==='fixed'?'fixed':'percent';
      if(oldT!==pv.type) pv.amount=pv.type==='fixed'?1000:10;
      render(); }
    else pv[pf]=t.value;
  }
  if(t.dataset.m!==undefined&&t.dataset.mf){
    var mm=draft.settings.shipping_methods[+t.dataset.m];
    mm[t.dataset.mf]= t.dataset.mf==='price' ? toPence(t.value) : t.value;
  }
  refreshBar();
});

function goTab(name){
  var b=document.querySelector('nav button[data-tab="'+name+'"]');
  if(b) b.click();
}

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
    uploads={}; iconUploads={}; render(); toast('Saved - the site is updated');
  }catch(e){ toast('Save failed - nothing was changed'); }
  btn.disabled=false; btn.textContent='Save changes';
});
document.getElementById('lock').addEventListener('click',function(){
  sessionStorage.removeItem('drw_admin_key'); location.href='/admin';
});
window.addEventListener('beforeunload',function(e){
  if(dirtyCount()){ e.preventDefault(); e.returnValue=''; }
});
${DASH_JS}

render();
loadReport();
</script></body></html>`;
}
