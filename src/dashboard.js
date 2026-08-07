/**
 * Drewrys - admin dashboard.
 *
 * Built to the supplied design. Charts are hand-drawn SVG and divs, no chart
 * library, matching how the rest of this admin is written.
 *
 * EMPTY STATES ARE THE POINT, not an afterthought. The shop went live on
 * 05/08/2026, so for the first weeks most ranges genuinely have no data and a
 * naive render would show £0 everywhere with -100% badges, which reads as a
 * broken page rather than a new one. So:
 *   - a range that starts before tracking began says so, and says when
 *     tracking did begin, instead of drawing a flat line at zero
 *   - change badges and the dashed previous-period line are HIDDEN whenever
 *     there is no earlier period to compare against, rather than rendered
 *     against nil
 *   - a card with nothing in it yet says what will appear there and when
 *   - the year-on-year KPI is not built at all, by instruction: it cannot be
 *     honest until August 2027
 *
 * This module exports markup only. All figures come from /admin?report=...
 */

export const DASH_CSS = `
.dash button{font-family:'NeueMontreal','Geist',system-ui,sans-serif}
.dash{--cream:#f2ede3;--card:#fff;--ink:#1c1a16;--muted:#8a8377;--faint:#a39c8e;
  --sec:#6d675b;--acc:#6f8a5f;--accd:#8a744f;--line:#e4ddcf;--grid:#eee8db;
  font-family:'Geist',system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;
  color:var(--ink);display:flex;flex-direction:column;gap:24px}
.dash .card{background:var(--card);border-radius:12px;padding:22px 24px;
  box-shadow:0 1px 3px rgba(60,50,30,0.07)}
.dash .hrow{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.dash h1{margin:0;font-size:24px;font-weight:600;letter-spacing:-.01em}
.dash .sub{margin:4px 0 0;font-size:13px;color:var(--muted)}
.dash .sp{flex:1}
.dash .seg{display:flex;gap:6px;background:#fff;border:1px solid var(--line);
  border-radius:24px;padding:4px}
.dash .seg button{border:0;background:none;color:var(--sec);font-size:13px;
  padding:7px 14px;border-radius:20px;cursor:pointer;font-family:'NeueMontreal','Geist',system-ui,sans-serif}
.dash .seg button[aria-selected=true]{background:var(--accd);color:#fff;font-weight:600}
.dash .pillseg{display:flex;gap:4px;background:var(--cream);border-radius:20px;padding:3px}
.dash .pillseg button{border:0;background:none;color:var(--sec);font-size:12px;
  padding:5px 12px;border-radius:16px;cursor:pointer;font-family:'NeueMontreal','Geist',system-ui,sans-serif}
.dash .pillseg button[aria-selected=true]{background:#fff;color:var(--ink);font-weight:600}
.dash .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}
.dash .kpi{background:var(--card);border-radius:12px;padding:18px 20px;
  box-shadow:0 1px 3px rgba(60,50,30,0.07)}
.dash .kpi .lab{font-size:12px;text-transform:uppercase;color:var(--muted);
  letter-spacing:.04em}
.dash .kpi .val{font-family:'NeueMontreal','Geist',system-ui,sans-serif;font-size:26px;font-weight:500;margin:6px 0 8px;letter-spacing:-.01em}
.dash .chg{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--faint);
  min-height:20px}
.dash .badge{font-size:11px;font-weight:650;border-radius:10px;padding:2px 8px}
.dash .up{background:#e6efe2;color:#4a7a3d}
.dash .down{background:#f6e3dd;color:#a04a33}
.dash .tan{background:#f0e9da;color:#8a744f}
.dash .grn{background:#e6efe2;color:#4a7a3d}
.dash .red{background:#f6e3dd;color:#a04a33}
.dash .pur{background:#e9e5f0;color:#5c5480}
.dash .ch{font-family:'NeueMontreal','Geist',system-ui,sans-serif;font-size:16px;font-weight:500;letter-spacing:-.01em;margin:0}
.dash .cs{font-size:12px;color:var(--muted);margin:3px 0 0}
.dash .two{display:grid;grid-template-columns:3fr 2fr;gap:20px}
.dash .col{display:flex;flex-direction:column;gap:20px}
.dash .sub2{display:grid;grid-template-columns:1fr 1fr;gap:20px;flex:1}
.dash .bot{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.dash table{width:100%;border-collapse:collapse;font-size:13px}
.dash th{text-align:left;font-size:11px;text-transform:uppercase;color:var(--muted);
  font-weight:600;padding:0 0 8px;letter-spacing:.04em}
.dash td{padding:9px 0;border-top:1px solid var(--cream)}
.dash td.r,.dash th.r{text-align:right}
.dash .chip{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--cream);
  border-radius:6px;padding:3px 7px;font-size:12px;font-weight:600}
.dash .lnk{color:var(--accd);font-size:13px;cursor:pointer}
.dash .lnk:hover{text-decoration:underline}
.dash .bar{height:6px;background:var(--cream);border-radius:3px;overflow:hidden}
.dash .bar i{display:block;height:100%;background:var(--acc);border-radius:3px}
.dash .fbar{height:20px;background:var(--cream);border-radius:5px;overflow:hidden}
.dash .fbar i{display:block;height:100%;background:var(--acc);border-radius:5px}
.dash .hero{font-size:36px;font-weight:700;letter-spacing:-.02em}
.dash .none{color:var(--faint);font-size:13px;padding:18px 0;text-align:center;
  line-height:1.55}
.dash .none b{display:block;color:var(--muted);font-weight:600;margin-bottom:3px}
.dash .note{background:#f7f3ea;border:1px solid var(--line);border-radius:10px;
  padding:11px 14px;font-size:12.5px;color:var(--sec);line-height:1.5}
.dash .tip{position:absolute;background:#26241f;color:#fff;border-radius:8px;
  padding:8px 12px;font-size:12px;pointer-events:none;white-space:nowrap;
  box-shadow:0 4px 12px rgba(30,25,15,.25);z-index:5;transform:translateX(-50%);top:6px}
.dash .tip s{display:block;color:#b5ae9f;text-decoration:none;font-size:11px}
.dash .wrap{position:relative}
.dash .lg{display:flex;gap:16px;font-size:12px;color:var(--muted);margin-top:10px}
.dash .lg i{display:inline-block;width:14px;height:0;border-top:2px solid var(--acc);
  vertical-align:middle;margin-right:5px}
.dash .lg i.d{border-top:2px dashed #c9c2b2}
.dash .bars{display:flex;align-items:flex-end;gap:4px;height:170px}
.dash .bars>div{flex:1;background:var(--acc);border-radius:3px 3px 0 0;min-height:2px;
  cursor:default}
.dash .bars>div:hover{background:#8a744f}
.dash .xax{display:flex;gap:4px;margin-top:6px;font-size:10px;color:var(--faint)}
.dash .xax>span{flex:1;text-align:center;overflow:visible;white-space:nowrap;min-width:0}
.dash .rowline{display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px}
@media(max-width:900px){.dash .two,.dash .bot,.dash .sub2{grid-template-columns:1fr}}
`;

/**
 * Rendered client-side from the report payload. Kept as one function so the
 * admin can call it on load and on every range or view change.
 */
export const DASH_JS = String.raw`
var RPT=null, rRange='30d', rSales='day', rVis='daily', rBusy=false;

function money(p){var n=Number(p||0)/100;
  return '£'+n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});}
function moneyShort(p){var n=Number(p||0)/100;
  if(n>=10000) return '£'+Math.round(n/1000)+'k';
  if(n>=1000) return '£'+(n/1000).toFixed(1)+'k';
  return '£'+Math.round(n);}
function pctTxt(v){return (v>0?'+':'')+v+'%';}
function dLabel(iso){var d=new Date(iso+'T00:00:00Z');
  return d.getUTCDate()+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];}
function niceDate(iso){if(!iso) return '';var d=new Date(iso+'T00:00:00Z');
  return d.getUTCDate()+' '+['January','February','March','April','May','June','July',
    'August','September','October','November','December'][d.getUTCMonth()]+' '+d.getUTCFullYear();}
/* Full ISO 3166 map, generated with pycountry - do not hand-edit */
var CNAME={AD:"Andorra",AE:"UAE",AF:"Afghanistan",AG:"Antigua and Barbuda",AI:"Anguilla",AL:"Albania",AM:"Armenia",AO:"Angola",AQ:"Antarctica",AR:"Argentina",AS:"American Samoa",AT:"Austria",AU:"Australia",AW:"Aruba",AX:"\u00c5land Islands",AZ:"Azerbaijan",BA:"Bosnia and Herzegovina",BB:"Barbados",BD:"Bangladesh",BE:"Belgium",BF:"Burkina Faso",BG:"Bulgaria",BH:"Bahrain",BI:"Burundi",BJ:"Benin",BL:"Saint Barth\u00e9lemy",BM:"Bermuda",BN:"Brunei",BO:"Bolivia",BQ:"Bonaire",BR:"Brazil",BS:"Bahamas",BT:"Bhutan",BV:"Bouvet Island",BW:"Botswana",BY:"Belarus",BZ:"Belize",CA:"Canada",CC:"Cocos (Keeling) Islands",CD:"DR Congo",CF:"Central African Republic",CG:"Congo",CH:"Switzerland",CI:"C\u00f4te d'Ivoire",CK:"Cook Islands",CL:"Chile",CM:"Cameroon",CN:"China",CO:"Colombia",CR:"Costa Rica",CU:"Cuba",CV:"Cabo Verde",CW:"Cura\u00e7ao",CX:"Christmas Island",CY:"Cyprus",CZ:"Czechia",DE:"Germany",DJ:"Djibouti",DK:"Denmark",DM:"Dominica",DO:"Dominican Republic",DZ:"Algeria",EC:"Ecuador",EE:"Estonia",EG:"Egypt",EH:"Western Sahara",ER:"Eritrea",ES:"Spain",ET:"Ethiopia",FI:"Finland",FJ:"Fiji",FK:"Falkland Islands (Malvinas)",FM:"Micronesia",FO:"Faroe Islands",FR:"France",GA:"Gabon",GB:"United Kingdom",GD:"Grenada",GE:"Georgia",GF:"French Guiana",GG:"Guernsey",GH:"Ghana",GI:"Gibraltar",GL:"Greenland",GM:"Gambia",GN:"Guinea",GP:"Guadeloupe",GQ:"Equatorial Guinea",GR:"Greece",GS:"South Georgia",GT:"Guatemala",GU:"Guam",GW:"Guinea-Bissau",GY:"Guyana",HK:"Hong Kong",HM:"Heard Island",HN:"Honduras",HR:"Croatia",HT:"Haiti",HU:"Hungary",ID:"Indonesia",IE:"Ireland",IL:"Israel",IM:"Isle of Man",IN:"India",IO:"British Indian Ocean Territory",IQ:"Iraq",IR:"Iran",IS:"Iceland",IT:"Italy",JE:"Jersey",JM:"Jamaica",JO:"Jordan",JP:"Japan",KE:"Kenya",KG:"Kyrgyzstan",KH:"Cambodia",KI:"Kiribati",KM:"Comoros",KN:"Saint Kitts and Nevis",KP:"North Korea",KR:"South Korea",KW:"Kuwait",KY:"Cayman Islands",KZ:"Kazakhstan",LA:"Laos",LB:"Lebanon",LC:"Saint Lucia",LI:"Liechtenstein",LK:"Sri Lanka",LR:"Liberia",LS:"Lesotho",LT:"Lithuania",LU:"Luxembourg",LV:"Latvia",LY:"Libya",MA:"Morocco",MC:"Monaco",MD:"Moldova",ME:"Montenegro",MF:"Saint Martin (French part)",MG:"Madagascar",MH:"Marshall Islands",MK:"North Macedonia",ML:"Mali",MM:"Myanmar",MN:"Mongolia",MO:"Macao",MP:"Northern Mariana Islands",MQ:"Martinique",MR:"Mauritania",MS:"Montserrat",MT:"Malta",MU:"Mauritius",MV:"Maldives",MW:"Malawi",MX:"Mexico",MY:"Malaysia",MZ:"Mozambique",NA:"Namibia",NC:"New Caledonia",NE:"Niger",NF:"Norfolk Island",NG:"Nigeria",NI:"Nicaragua",NL:"Netherlands",NO:"Norway",NP:"Nepal",NR:"Nauru",NU:"Niue",NZ:"New Zealand",OM:"Oman",PA:"Panama",PE:"Peru",PF:"French Polynesia",PG:"Papua New Guinea",PH:"Philippines",PK:"Pakistan",PL:"Poland",PM:"Saint Pierre and Miquelon",PN:"Pitcairn",PR:"Puerto Rico",PS:"Palestine, State of",PT:"Portugal",PW:"Palau",PY:"Paraguay",QA:"Qatar",RE:"R\u00e9union",RO:"Romania",RS:"Serbia",RU:"Russia",RW:"Rwanda",SA:"Saudi Arabia",SB:"Solomon Islands",SC:"Seychelles",SD:"Sudan",SE:"Sweden",SG:"Singapore",SH:"Saint Helena",SI:"Slovenia",SJ:"Svalbard and Jan Mayen",SK:"Slovakia",SL:"Sierra Leone",SM:"San Marino",SN:"Senegal",SO:"Somalia",SR:"Suriname",SS:"South Sudan",ST:"Sao Tome and Principe",SV:"El Salvador",SX:"Sint Maarten (Dutch part)",SY:"Syria",SZ:"Eswatini",T1:"Tor network",TC:"Turks and Caicos Islands",TD:"Chad",TF:"French Southern Territories",TG:"Togo",TH:"Thailand",TJ:"Tajikistan",TK:"Tokelau",TL:"Timor-Leste",TM:"Turkmenistan",TN:"Tunisia",TO:"Tonga",TR:"Turkey",TT:"Trinidad and Tobago",TV:"Tuvalu",TW:"Taiwan",TZ:"Tanzania",UA:"Ukraine",UG:"Uganda",UM:"US Outlying Islands",US:"United States",UY:"Uruguay",UZ:"Uzbekistan",VA:"Vatican City",VC:"Saint Vincent and the Grenadines",VE:"Venezuela",VG:"Virgin Islands, British",VI:"Virgin Islands, U.S.",VN:"Vietnam",VU:"Vanuatu",WF:"Wallis and Futuna",WS:"Samoa",XX:"Unknown",YE:"Yemen",YT:"Mayotte",ZA:"South Africa",ZM:"Zambia",ZW:"Zimbabwe"};
function cName(c){return CNAME[c]||c;}

function rangeLabel(){return {today:'today','7d':'last 7 days','30d':'last 30 days',
  '12m':'last 12 months'}[rRange];}

/* Days of real data inside the SELECTED window. This is what decides whether
   a chart is drawn or an explanation is shown. */
function covered(){
  if(!RPT||!RPT.tracking_started) return 0;
  var days={today:1,'7d':7,'30d':30,'12m':365}[rRange];
  return Math.min(days, RPT.days_tracked||0);
}
function thin(){return covered()<2;}

function emptyCard(title,why){
  return '<div class="none"><b>'+esc(title)+'</b>'+esc(why)+'</div>';
}
/* One consistent sentence, so a quiet card never reads as a failed one. */
function sinceLine(){
  if(!RPT||!RPT.tracking_started) return 'Tracking has not started yet.';
  var d=RPT.days_tracked||0;
  return 'Tracking started on '+niceDate(RPT.tracking_started)+', so there '+
    (d===1?'is 1 day':'are '+d+' days')+' of data so far.';
}

function chgHtml(v){
  if(v===null||v===undefined) return '<div class="chg"><span style="color:#a39c8e">'+
    'No earlier period to compare yet</span></div>';
  return '<div class="chg"><span class="badge '+(v>=0?'up':'down')+'">'+pctTxt(v)+
    '</span><span>vs previous</span></div>';
}

function kpiCard(lab,val,chg){
  return '<div class="kpi"><div class="lab">'+lab+'</div><div class="val">'+val+
    '</div>'+chgHtml(chg)+'</div>';
}

/* ── sales chart ────────────────────────────────────────────────────────── */
function salesChart(){
  var s=RPT.sales, pts=s.points||[], vals=pts.map(function(p){return p.revenue;});
  var prev=s.previous||[];
  var any=vals.some(function(v){return v>0;});
  if(!any) return emptyCard('No sales in this period yet',sinceLine());

  var max=Math.max.apply(null,vals.concat(prev.length?prev:[0]))*1.1||1;
  var W=1000,H=260,PAD=14;
  var x=function(i,n){return n<2?W/2:(i/(n-1))*W;};
  var y=function(v){return H-PAD-(v/max)*(H-PAD*2);};
  var path=function(a){return a.map(function(v,i){
    return (i?'L':'M')+x(i,a.length).toFixed(1)+' '+y(v).toFixed(1);}).join(' ');};

  var line=path(vals);
  var area=line+' L'+W+' '+H+' L0 '+H+' Z';
  var grid=[0.25,0.5,0.75,1].map(function(f){
    return 'M0 '+(H-PAD-f*(H-PAD*2)).toFixed(0)+'H'+W;}).join(' ');
  var ylab=[1,.75,.5,.25,0].map(function(f){
    return '<span>'+(f===0?'£0':moneyShort(max*f))+'</span>';}).join('');

  var svg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" '+
    'style="width:100%;height:238px;display:block">'+
    '<path d="'+grid+'" stroke="#eee8db" stroke-width="1" fill="none"/>'+
    '<path d="'+area+'" fill="rgba(111,138,95,0.16)"/>'+
    (prev.length?'<path d="'+path(prev)+'" stroke="#c9c2b2" stroke-width="2" '+
      'stroke-dasharray="6 5" fill="none"/>':'')+
    '<path d="'+line+'" stroke="#6f8a5f" stroke-width="2.5" fill="none" '+
      'stroke-linejoin="round"/>'+
    (vals.length===1?'<circle cx="'+x(0,1)+'" cy="'+y(vals[0])+'" r="6" fill="#6f8a5f"/>':'')+
    '</svg>';

  var xlab=pts.map(function(p,i){
    var show=pts.length<=12||i%Math.ceil(pts.length/8)===0;
    var t=s.view==='hour'?p.key+':00':(s.view==='week'?dLabel(p.key):dLabel(p.key));
    return '<span>'+(show?t:'')+'</span>';}).join('');

  var strips=pts.map(function(p,i){
    return '<div data-si="'+i+'" style="flex:1"></div>';}).join('');

  return '<div class="wrap" id="salesWrap">'+
    '<div style="display:flex;gap:10px">'+
      '<div style="display:flex;flex-direction:column;justify-content:space-between;'+
        'font-size:11px;color:#a39c8e;height:238px;text-align:right;min-width:38px">'+ylab+'</div>'+
      '<div style="flex:1;position:relative">'+svg+
        '<div id="salesStrips" style="position:absolute;inset:0;display:flex">'+strips+'</div>'+
      '</div>'+
    '</div>'+
    '<div style="display:flex;gap:0;margin-left:48px">'+xlab+'</div>'+
    '<div class="lg"><span><i></i>This period</span>'+
      (prev.length?'<span><i class="d"></i>Previous period</span>':'')+'</div>'+
    '<div id="salesTip"></div></div>';
}

/* ── visitors ───────────────────────────────────────────────────────────── */
function visitorsChart(){
  var v=RPT.visitors, pts=v.points||[];
  var any=pts.some(function(p){return p.views>0;});
  if(!any) return emptyCard('No visits recorded in this period',sinceLine());

  var max=Math.max.apply(null,pts.map(function(p){return p.views;}))*1.1||1;
  var bars=pts.map(function(p,i){
    return '<div data-vi="'+i+'" style="height:'+((p.views/max)*100).toFixed(1)+'%"></div>';
  }).join('');
  var lab=pts.map(function(p,i){
    var show=pts.length<=12||i%Math.ceil(pts.length/7)===0;
    var t=v.view==='daily'?dLabel(p.key):p.label;
    return '<span>'+(show?t:'')+'</span>';}).join('');
  return '<div class="wrap" id="visWrap"><div class="bars" id="visBars">'+bars+'</div>'+
    '<div class="xax">'+lab+'</div>'+
    '<div class="lg"><span><i></i>Unique visitors</span></div>'+
    '<div id="visTip"></div></div>';
}

/* ── funnel ─────────────────────────────────────────────────────────────── */
function funnelCard(){
  var f=RPT.funnel;
  if(!f.visits) return '<div class="card"><p class="ch">Checkout funnel</p>'+
    emptyCard('Nothing to measure yet',sinceLine())+'</div>';

  var conv=f.visits?Math.round((f.paid/f.visits)*1000)/10:0;
  var row=function(name,n,pctOf,cap){
    return '<div style="margin-bottom:14px"><div class="rowline"><span>'+name+
      '</span><span style="color:#8a8377">'+n+'</span></div>'+
      '<div class="fbar"><i style="width:'+pctOf.toFixed(1)+'%"></i></div>'+
      (cap?'<div style="font-size:11px;color:#a39c8e;margin-top:4px">'+cap+'</div>':'')+
      '</div>';};
  return '<div class="card"><p class="ch">Checkout funnel</p>'+
    '<p class="cs">'+rangeLabel()+'</p>'+
    '<div style="margin:16px 0 6px"><div class="hero">'+conv+'%</div>'+
    '<div style="font-size:12px;color:#8a8377;line-height:1.5;margin-top:2px">'+
    'overall conversion<br>visits that end in a paid order</div></div>'+
    '<div style="margin-top:18px">'+
      row('Visits',f.visits,100,'')+
      row('Reached checkout',f.checkout,f.visits?f.checkout/f.visits*100:0,
        (f.visits?(Math.round(f.checkout/f.visits*1000)/10):0)+'% of visits')+
      row('Paid',f.paid,f.visits?f.paid/f.visits*100:0,
        (f.checkout?(Math.round(f.paid/f.checkout*1000)/10):0)+'% of checkouts')+
    '</div></div>';
}

/* ── donut ──────────────────────────────────────────────────────────────── */
function splitCard(){
  var s=RPT.fulfilment, tot=s.collect+s.delivery;
  if(!tot) return '<div class="card"><p class="ch">Delivery vs collection</p>'+
    emptyCard('No orders in this period',sinceLine())+'</div>';
  var share=s.delivery/tot, C=2*Math.PI*70;
  return '<div class="card"><p class="ch">Delivery vs collection</p>'+
    '<div style="display:flex;align-items:center;gap:20px;margin-top:14px">'+
    '<svg viewBox="0 0 180 180" style="width:132px;height:132px;flex:none">'+
      '<circle cx="90" cy="90" r="70" fill="none" stroke="#e4ddcf" stroke-width="20"/>'+
      '<circle cx="90" cy="90" r="70" fill="none" stroke="#6f8a5f" stroke-width="20" '+
        'stroke-dasharray="'+(C*share).toFixed(1)+' '+C.toFixed(1)+'" '+
        'transform="rotate(-90 90 90)"/>'+
      '<text x="90" y="86" text-anchor="middle" font-size="24" font-weight="700" '+
        'fill="#1c1a16">'+Math.round(share*100)+'%</text>'+
      '<text x="90" y="104" text-anchor="middle" font-size="11" fill="#8a8377">delivery</text>'+
    '</svg><div style="flex:1;font-size:13px">'+
      '<div class="rowline"><span><span style="display:inline-block;width:9px;height:9px;'+
        'border-radius:2px;background:#6f8a5f;margin-right:7px"></span>Delivery</span>'+
        '<span style="color:#8a8377">'+s.delivery+' · '+Math.round(share*100)+'%</span></div>'+
      '<div class="rowline"><span><span style="display:inline-block;width:9px;height:9px;'+
        'border-radius:2px;background:#e4ddcf;margin-right:7px"></span>Collection</span>'+
        '<span style="color:#8a8377">'+s.collect+' · '+Math.round((1-share)*100)+'%</span></div>'+
    '</div></div></div>';
}

/* ── render ─────────────────────────────────────────────────────────────── */
function renderDash(){
  if(!RPT) return '<div class="dash"><div class="card">'+
    '<div class="none"><b>Loading</b>Fetching your figures.</div></div></div>';

  if(RPT.enabled===false) return '<div class="dash"><div class="card">'+
    '<p class="ch">Reporting is not switched on</p>'+
    '<div class="note" style="margin-top:12px">No D1 database is bound to this '+
    'Worker, so nothing is being recorded. Create a database called '+
    '<b>drewrys-analytics</b> in Cloudflare, put its ID into wrangler.toml and '+
    'redeploy. Everything else on the site works normally in the meantime.</div>'+
    '</div></div>';

  var k=RPT.kpis, out=[];

  out.push('<div class="hrow"><div><h1>Dashboard</h1>'+
    '<p class="sub">Sales and traffic overview · '+rangeLabel()+'</p></div>'+
    '<span class="sp"></span><div class="seg" id="rangeSeg">'+
    [['today','Today'],['7d','7 days'],['30d','30 days'],['12m','12 months']]
      .map(function(r){return '<button data-range="'+r[0]+'" aria-selected="'+
        (rRange===r[0])+'">'+r[1]+'</button>';}).join('')+
    '</div></div>');

  // One honest line at the top rather than a page of quiet zeros.
  if(thin()) out.push('<div class="note">'+esc(sinceLine())+
    ' Longer ranges and the comparisons against a previous period will fill in '+
    'as the days pass.</div>');

  out.push('<div class="kpis">'+
    kpiCard('Total revenue',money(k.revenue),k.revenue_change)+
    kpiCard('Orders',k.orders,k.orders_change)+
    kpiCard('Avg order value',k.orders?money(k.aov):'No orders yet',k.aov_change)+
    kpiCard('Visitors today',k.visitors_today,null)+
    '</div>');

  out.push('<div class="card"><div class="hrow"><div><p class="ch">Sales</p>'+
    '<p class="cs">'+money(k.revenue)+' from '+k.orders+
    (k.orders===1?' order':' orders')+' · '+rangeLabel()+'</p></div>'+
    '<span class="sp"></span><div class="pillseg" id="salesSeg">'+
    [['hour','Hour'],['day','Day'],['week','Week']].map(function(v){
      return '<button data-sv="'+v[0]+'" aria-selected="'+(rSales===v[0])+'">'+
        v[1]+'</button>';}).join('')+
    '</div></div><div style="margin-top:14px">'+salesChart()+'</div></div>');

  var cSum=RPT.countries.reduce(function(s,c){return s+c.visitors;},0);
  var countryRows=RPT.countries.length
    ? RPT.countries.map(function(c){
        var p=cSum?Math.round(c.visitors/cSum*1000)/10:0;
        return '<div style="margin-bottom:11px"><div class="rowline">'+
          '<span style="font-weight:550">'+esc(cName(c.code))+'</span>'+
          '<span style="color:#8a8377">'+c.visitors+' · '+p+'%</span></div>'+
          '<div class="bar"><i style="width:'+(cSum?c.visitors/cSum*100:0).toFixed(1)+
          '%"></i></div></div>';}).join('')
    : emptyCard('No visits yet',sinceLine());

  var codeRows=RPT.codes.length
    ? '<table><tr><th>Code</th><th class="r">Uses</th><th class="r">Saved</th></tr>'+
      RPT.codes.map(function(c){return '<tr><td><span class="chip">'+esc(c.code)+
        '</span></td><td class="r">'+c.uses+'</td><td class="r">'+money(c.saved)+
        '</td></tr>';}).join('')+'</table>'
    : emptyCard('No codes used in this period','A code appears here once a customer has used it.');

  out.push('<div class="two"><div class="col">'+
    '<div class="card"><div class="hrow"><div><p class="ch">Visitors</p>'+
      '<p class="cs">'+RPT.visitors.total+' unique · '+rangeLabel()+'</p></div>'+
      '<span class="sp"></span><div class="pillseg" id="visSeg">'+
      [['daily','Daily'],['hour','Time of day'],['dow','Day of week']].map(function(v){
        return '<button data-vv="'+v[0]+'" aria-selected="'+(rVis===v[0])+'">'+
          v[1]+'</button>';}).join('')+
      '</div></div><div style="margin-top:14px">'+visitorsChart()+'</div></div>'+
    '<div class="sub2">'+
      '<div class="card"><p class="ch">Visitors by country</p>'+
        '<div style="margin-top:14px">'+countryRows+'</div></div>'+
      '<div class="card"><div class="hrow"><p class="ch">Discount codes</p>'+
        '<span class="sp"></span>'+(RPT.codes.length?'<span class="badge grn">'+
        RPT.codes.length+' used</span>':'')+'</div>'+
        '<div style="margin-top:14px">'+codeRows+'</div></div>'+
    '</div></div>'+
    '<div class="col">'+funnelCard()+splitCard()+lowStockCard()+'</div></div>');

  var bs=RPT.best_sellers;
  var bsHtml=bs.length
    ? '<table><tr><th>Product</th><th class="r">Units</th><th class="r">Revenue</th>'+
      '<th class="r">Trend</th></tr>'+bs.map(function(p){
        return '<tr><td>'+esc(p.name||p.sku)+'</td><td class="r">'+p.units+
          '</td><td class="r">'+money(p.revenue)+'</td><td class="r">'+
          (p.trend===null?'<span style="color:#a39c8e">not yet</span>':
            '<span class="badge '+(p.trend>=0?'up':'down')+'">'+pctTxt(p.trend)+'</span>')+
          '</td></tr>';}).join('')+'</table>'
    : emptyCard('No sales in this period yet',sinceLine());

  var ords=(S.orders||[]).slice(0,6);
  var stCls={paid:'tan',ready:'pur',dispatched:'grn',collected:'grn',failed:'red'};
  var ordHtml=ords.length
    ? '<table><tr><th>Order</th><th>Customer</th><th class="r">Total</th>'+
      '<th class="r">Status</th></tr>'+ords.map(function(o){
        return '<tr><td>'+esc(o.reference)+'</td><td>'+
          esc((o.customer&&o.customer.name)||'')+'</td><td class="r">'+
          money(o.total)+'</td><td class="r"><span class="badge '+
          (stCls[o.status]||'tan')+'">'+esc(o.status||'')+'</span></td></tr>';
      }).join('')+'</table>'
    : emptyCard('No orders yet','Orders appear here as soon as the first one is paid.');

  out.push('<div class="bot">'+
    '<div class="card"><p class="ch">Best-selling products</p>'+
      '<p class="cs">'+rangeLabel()+'</p><div style="margin-top:12px">'+bsHtml+'</div></div>'+
    '<div class="card"><div class="hrow"><div><p class="ch">Recent orders</p>'+
      '<p class="cs">latest first</p></div><span class="sp"></span>'+
      '<span class="lnk" data-goto="orders">View all</span></div>'+
      '<div style="margin-top:12px">'+ordHtml+'</div></div>'+
    '</div>');

  return '<div class="dash">'+out.join('')+'</div>';
}

/* Low stock reads KV through the page state, not D1 - it is current stock,
   not history, so a range does not apply to it. */
function lowStockCard(){
  var low=[];
  (S.catalogue.products||[]).forEach(function(p){
    var n=S.stock[p.slug];
    if(n!==null&&n!==undefined&&n<=10) low.push({name:p.name,size:p.size,left:n});
  });
  low.sort(function(a,b){return a.left-b.left;});
  if(!low.length) return '<div class="card"><p class="ch">Low stock</p>'+
    '<div class="none"><b>Nothing running low</b>Products with 10 or fewer left '+
    'appear here.</div></div>';
  return '<div class="card"><div class="hrow"><p class="ch">Low stock</p>'+
    '<span class="sp"></span><span class="badge red">'+low.length+
    (low.length===1?' item':' items')+'</span></div><div style="margin-top:12px">'+
    low.slice(0,6).map(function(p){
      return '<div class="rowline" style="align-items:center;margin-bottom:9px">'+
        '<span>'+esc(p.name)+'<span style="color:#a39c8e"> · '+esc(p.size||'')+
        '</span></span><span class="badge '+(p.left<=5?'red':'tan')+'">'+p.left+
        ' left</span></div>';}).join('')+
    '<div style="margin-top:10px"><span class="lnk" data-goto="stock">Go to Stock</span></div>'+
    '</div></div>';
}

/* ── data + events ──────────────────────────────────────────────────────── */
async function loadReport(){
  if(rBusy) return; rBusy=true;
  try{
    var u='/admin?report='+rRange+'&sales='+rSales+'&visitors='+rVis;
    var r=await fetch(u,{headers:{'x-admin-key':KEY}});
    RPT=r.ok?await r.json():{enabled:false};
  }catch(e){ RPT={enabled:false}; }
  rBusy=false;
  if(tab==='dashboard') render();
}

function wireDash(){
  var seg=document.getElementById('rangeSeg');
  if(seg) seg.addEventListener('click',function(e){
    var b=e.target.closest('button[data-range]'); if(!b) return;
    rRange=b.dataset.range; RPT=null; render(); loadReport();});

  var ss=document.getElementById('salesSeg');
  if(ss) ss.addEventListener('click',function(e){
    var b=e.target.closest('button[data-sv]'); if(!b) return;
    rSales=b.dataset.sv; loadReport();});

  var vs=document.getElementById('visSeg');
  if(vs) vs.addEventListener('click',function(e){
    var b=e.target.closest('button[data-vv]'); if(!b) return;
    rVis=b.dataset.vv; loadReport();});

  document.querySelectorAll('[data-goto]').forEach(function(el){
    el.addEventListener('click',function(){ goTab(el.dataset.goto); });});

  var strips=document.getElementById('salesStrips');
  if(strips){
    strips.addEventListener('mouseover',function(e){
      var d=e.target.closest('[data-si]'); if(!d) return;
      var i=+d.dataset.si, p=RPT.sales.points[i];
      var prev=RPT.sales.previous[i];
      var lab=RPT.sales.view==='hour'?p.key+':00':dLabel(p.key);
      var pct=Math.min(88,Math.max(12,i/Math.max(1,RPT.sales.points.length-1)*100));
      document.getElementById('salesTip').innerHTML='<div class="tip" style="left:'+
        pct+'%">'+lab+'<s>'+money(p.revenue)+' · '+p.orders+
        (p.orders===1?' order':' orders')+'</s>'+
        (prev===undefined?'':'<s>previous '+money(prev)+'</s>')+'</div>';});
    strips.addEventListener('mouseleave',function(){
      document.getElementById('salesTip').innerHTML='';});
  }

  var vb=document.getElementById('visBars');
  if(vb){
    vb.addEventListener('mouseover',function(e){
      var d=e.target.closest('[data-vi]'); if(!d) return;
      var i=+d.dataset.vi, p=RPT.visitors.points[i];
      var lab=RPT.visitors.view==='daily'?dLabel(p.key):p.label;
      var pct=Math.min(88,Math.max(12,(i+0.5)/RPT.visitors.points.length*100));
      document.getElementById('visTip').innerHTML='<div class="tip" style="left:'+
        pct+'%">'+lab+'<s>'+p.visitors+' unique · '+p.views+' views</s></div>';});
    vb.addEventListener('mouseleave',function(){
      document.getElementById('visTip').innerHTML='';});
  }
}
`;
