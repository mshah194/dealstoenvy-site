function getSearchKeyword() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("q") || "").trim().toLowerCase();
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

async function runSearchPage() {
  const keyword = getSearchKeyword();
  const label = document.getElementById("search-label");
  const resultsContainer = document.getElementById("search-results");

  if (!resultsContainer) return;

  if (!keyword) {
    if (label) label.textContent = "Enter a keyword to search all deals.";
    resultsContainer.innerHTML = `<div class="notice">No search keyword entered.</div>`;
    return;
  }

  if (label) label.textContent = `Showing results for "${keyword}"`;

  if (typeof window.loadDeals !== "function" || typeof window.dealCard !== "function") {
    resultsContainer.innerHTML = `<div class="notice">Search is not ready yet. Please refresh the page.</div>`;
    return;
  }

  const payload = await window.loadDeals();
  const deals = Array.isArray(payload.deals) ? payload.deals : [];

  const matches = deals.filter(deal => buildSearchableText(deal).includes(keyword));

  if (!matches.length) {
    resultsContainer.innerHTML = `<div class="notice">No deals found for "${keyword}".</div>`;
    return;
  }

  resultsContainer.innerHTML = matches.map(deal => window.dealCard(deal)).join("");
}

document.addEventListener("DOMContentLoaded", runSearchPage);