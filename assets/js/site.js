// Updated DealsToEnvy site.js
// Slider + coupon improvements

(function () {

function parseBool(value){
  return ["true","1","yes","y"].includes(String(value||"").trim().toLowerCase());
}

function parseNumber(value){
  if(value===null||value===undefined||value==="") return null;
  if(typeof value==="number") return Number.isFinite(value)?value:null;
  const cleaned=String(value).replace(/[^0-9.\-]/g,"");
  if(cleaned===""||cleaned==="-"||cleaned===".") return null;
  const num=Number(cleaned);
  return Number.isFinite(num)?num:null;
}

function formatCurrency(value){
  const num=parseNumber(value);
  if(num===null) return value?String(value):"";
  try{
    return new Intl.NumberFormat(undefined,{
      style:"currency",
      currency:(window.DEALS_SHEET_CONFIG&&window.DEALS_SHEET_CONFIG.currency)||"USD",
      minimumFractionDigits:2,
      maximumFractionDigits:2
    }).format(num);
  }catch(e){
    return "$"+num.toFixed(2);
  }
}

function escapeHtml(text){
  return String(text||"")
  .replace(/&/g,"&amp;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;")
  .replace(/'/g,"&#039;");
}

function normalizeDeal(raw){
return{
active:raw.active===undefined?true:parseBool(raw.active),
retailer:String(raw.retailer||"").trim(),
homepage_feature:raw.homepage_feature===undefined?false:parseBool(raw.homepage_feature),
sort_order:parseNumber(raw.sort_order)??9999,
title:String(raw.title||"").trim(),
price:raw.price,
old_price:raw.old_price!==undefined?raw.old_price:raw.oldPrice,
save:raw.save||"",
category:String(raw.category||"").trim(),
badge:String(raw.badge||raw.category||"").trim(),
code:String(raw.code||raw.coupon||raw.promo||raw.promo_code||"").trim(),
status:String(raw.status||"").trim(),
note:String(raw.note||"").trim(),
link:String(raw.link||"#").trim()||"#",
image:String(raw.image||"").trim()
};
}

function parseCsv(text){
const rows=[];
let row=[];
let value="";
let inQuotes=false;

for(let i=0;i<text.length;i++){
const char=text[i];
const next=text[i+1];

if(char=='"'){
if(inQuotes&&next=='"'){value+='"';i++;}
else{inQuotes=!inQuotes;}
}
else if(char==","&&!inQuotes){row.push(value);value="";}
else if((char=="\n"||char=="\r")&&!inQuotes){
if(char=="\r"&&next=="\n")i++;
row.push(value);
rows.push(row);
row=[];
value="";
}
else{value+=char;}
}

if(value.length||row.length){row.push(value);rows.push(row);}
if(!rows.length)return[];

const headers=rows[0].map(h=>String(h||"").trim().toLowerCase());

return rows.slice(1)
.filter(r=>r.some(cell=>String(cell||"").trim()!==""))
.map(r=>{
const obj={};
headers.forEach((h,idx)=>obj[h]=r[idx]||"");
return obj;
});
}

async function loadDeals(){
const config=window.DEALS_SHEET_CONFIG||{};

if(!config.csvUrl||config.csvUrl.indexOf("PASTE_GOOGLE_SHEETS_CSV_URL_HERE")!==-1){
return{site:{},deals:[]};
}

const response=await fetch(config.csvUrl,{cache:"no-store"});
const csvText=await response.text();

const rows=parseCsv(csvText)
.map(normalizeDeal)
.filter(d=>d.active&&d.title&&d.retailer)
.sort((a,b)=>(a.sort_order-b.sort_order)||a.title.localeCompare(b.title));

return{site:{},deals:rows};
}

function promoMarkup(deal,cls){

if(!deal.code) return "";

const text=deal.code.trim().toUpperCase();

if(text==="CLIP COUPON"||text==="AMAZON COUPON"){
return `<div class="${cls}">Clip coupon on Amazon</div>`;
}

return `<div class="${cls}">Use Code: <strong>${escapeHtml(deal.code)}</strong></div>`;
}

function dealCard(deal) {
  const searchable = `${deal.title} ${deal.category} ${deal.badge} ${deal.code} ${deal.note}`.toLowerCase();
  const price = formatCurrency(deal.price);
  const oldPrice = formatCurrency(deal.old_price);

  return `
  <article class="card deal-card" data-title="${escapeHtml(searchable)}">
    <img class="card-media" src="${escapeHtml(deal.image)}" alt="${escapeHtml(deal.title)}">
    <div class="card-body">

      <span class="badge">${escapeHtml(deal.badge || deal.category)}</span>
      <h3>${escapeHtml(deal.title)}</h3>

      <div class="price-row">
        <span class="price">${price}</span>
        ${oldPrice ? `<span class="old-price">${oldPrice}</span>` : ""}
      </div>

      ${promoMarkup(deal, "promo-code")}

      <a class="btn btn-primary" href="${escapeHtml(deal.link)}" target="_blank" rel="nofollow sponsored noopener">
        View deal
      </a>

    </div>
  </article>
  `;
}
function enableSearch(inputId, containerId) {

  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);

  if (!input || !container) return;

  input.addEventListener("input", () => {

    const q = input.value.trim().toLowerCase();

    container.querySelectorAll(".deal-card").forEach(card => {

      const searchable =
        (card.innerText || "").toLowerCase();

      if (searchable.includes(q)) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }

    });

  });

}
function miniCard(deal){

const price=formatCurrency(deal.price);
const oldPrice=formatCurrency(deal.old_price);

return`
<article class="mini-card">
<img class="card-media" src="${escapeHtml(deal.image)}">

<div class="card-body">

<span class="badge">${escapeHtml(deal.badge||deal.category)}</span>
<h3>${escapeHtml(deal.title)}</h3>

<div class="price-row">
<span class="price">${price}</span>
${oldPrice?`<span class="old-price">${oldPrice}</span>`:""}
</div>

${promoMarkup(deal,"coupon-pill")}

<a class="btn btn-secondary" href="${escapeHtml(deal.link)}" target="_blank" rel="nofollow sponsored noopener">
Open deal
</a>

</div>
</article>
`;
}

function renderDeals(id,deals){
const el=document.getElementById(id);
if(!el)return;
el.innerHTML=deals.map(dealCard).join("");
}

function renderMiniDeals(targetId,deals){

const target=document.getElementById(targetId);
if(!target)return;

const sliderId=`${targetId}-slider`;
const trackId=`${targetId}-track`;
const prevId=`${targetId}-prev`;
const nextId=`${targetId}-next`;

target.innerHTML=`
<div class="featured-slider" id="${sliderId}">

<button class="featured-arrow featured-arrow-left" id="${prevId}">&#10094;</button>

<div class="featured-viewport">
<div class="featured-track" id="${trackId}">
${deals.map(miniCard).join("")}
</div>
</div>

<button class="featured-arrow featured-arrow-right" id="${nextId}">&#10095;</button>

</div>
`;

initSlider(sliderId,trackId,prevId,nextId);
}

function initSlider(sliderId,trackId,prevId,nextId){

const slider=document.getElementById(sliderId);
const track=document.getElementById(trackId);
const prev=document.getElementById(prevId);
const next=document.getElementById(nextId);

const viewport=slider.querySelector(".featured-viewport");

function scrollAmount(){
const card=track.querySelector(".mini-card");
if(!card)return 300;
return card.getBoundingClientRect().width+20;
}

prev.onclick=()=>viewport.scrollBy({left:-scrollAmount(),behavior:"smooth"});
next.onclick=()=>viewport.scrollBy({left:scrollAmount(),behavior:"smooth"});
}

function byRetailer(deals,retailer){
return deals.filter(d=>d.retailer.toLowerCase()===retailer.toLowerCase());
}

function featuredDeals(deals,retailer){
const list=byRetailer(deals,retailer);
const featured=list.filter(d=>d.homepage_feature);
return featured.length?featured:list;
}

document.addEventListener("DOMContentLoaded",async()=>{

const payload=await loadDeals();
const deals=payload.deals||[];

const amazon=byRetailer(deals,"Amazon");
const walmart=byRetailer(deals,"Walmart");

renderDeals("amazon-deals-grid",amazon);
renderDeals("walmart-deals-grid",walmart);

renderMiniDeals("featured-amazon-grid",featuredDeals(deals,"Amazon"));
renderMiniDeals("featured-walmart-grid",featuredDeals(deals,"Walmart"));

enableSearch("amazon-search","amazon-deals-grid");
enableSearch("walmart-search","walmart-deals-grid");

});

})();
