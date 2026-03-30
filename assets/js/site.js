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
    <article class="card deal-card deal-card-horizontal" data-title="${escapeHtml(searchable)}">
      <div class="deal-card-image-wrap">
        <img class="card-media deal-card-image" src="${escapeHtml(deal.image || "https://via.placeholder.com/800x600?text=Deal")}" alt="${escapeHtml(deal.title)}">
      </div>

      <div class="card-body deal-card-body-horizontal">
        <div class="deal-card-top">
          <span class="badge">${escapeHtml(deal.badge || deal.category)}</span>
          <h3>${escapeHtml(deal.title)}</h3>
        </div>

        <div class="price-row">
          <span class="price">${price}</span>
          ${oldPrice ? `<span class="old-price">${oldPrice}</span>` : ""}
        </div>

        ${promoMarkup(deal, "promo-code")}
        ${deal.note ? `<p class="deal-note">${escapeHtml(deal.note)}</p>` : ""}

        <div class="deal-card-actions">
          <a class="btn btn-primary" href="${escapeHtml(deal.link)}" target="_blank" rel="nofollow sponsored noopener">
            View deal
          </a>
        </div>
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
function buildSearchableText(deal) {
  return [
    deal.title,
    deal.category,
    deal.badge,
    deal.code,
    deal.note,
    deal.retailer,
    deal.status
  ]
    .join(" ")
    .toLowerCase();
}

function getSearchSuggestions(deals, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return deals
    .filter(deal => buildSearchableText(deal).includes(q))
    .slice(0, 8);
}

function renderHeaderSuggestions(matches, query) {
  const box = document.getElementById("header-search-suggestions");
  if (!box) return;

  if (!query.trim() || !matches.length) {
    box.innerHTML = "";
    box.classList.remove("show");
    return;
  }

  box.innerHTML = matches.map(deal => {
    const retailer = deal.retailer || "";
    const price = formatCurrency(deal.price);
    const oldPrice = formatCurrency(deal.old_price);

    return `
      <a class="header-search-suggestion" href="search.html?q=${encodeURIComponent(query)}">
        <div class="header-search-suggestion-title">${escapeHtml(deal.title)}</div>
        <div class="header-search-suggestion-meta">
          ${escapeHtml(retailer)}${price ? ` • ${escapeHtml(price)}` : ""}${oldPrice ? ` • Was ${escapeHtml(oldPrice)}` : ""}
        </div>
      </a>
    `;
  }).join("");

  box.classList.add("show");
}

function enableHeaderSearchSuggestions(deals) {
  const input = document.getElementById("header-search-input");
  const box = document.getElementById("header-search-suggestions");
  if (!input || !box) return;

  let activeIndex = -1;

  function refreshSuggestions() {
    const query = input.value || "";
    const matches = getSearchSuggestions(deals, query);
    renderHeaderSuggestions(matches, query);
    activeIndex = -1;
  }

  input.addEventListener("input", refreshSuggestions);

  input.addEventListener("focus", refreshSuggestions);

  input.addEventListener("keydown", (e) => {
    const items = Array.from(box.querySelectorAll(".header-search-suggestion"));
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
    } else if (e.key === "Escape") {
      box.classList.remove("show");
      activeIndex = -1;
      return;
    } else {
      return;
    }

    items.forEach((item, idx) => {
      item.classList.toggle("active", idx === activeIndex);
    });
  });

  document.addEventListener("click", (e) => {
    const wrap = document.querySelector(".header-search-wrap");
    if (!wrap) return;
    if (!wrap.contains(e.target)) {
      box.classList.remove("show");
    }
  });
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

enableHeaderSearchSuggestions(deals);

});

})();
